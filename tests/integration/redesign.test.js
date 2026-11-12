import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
vi.mock('../../src/core/supabase.js', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { jwt, storageFalso, ADMIN } = await import('./helpers.js');
  const supabase = createClient(process.env.IT_URL, jwt(null, process.env.IT_JWT_SECRET, 'anon'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt(ADMIN)}` } },
  });
  Object.defineProperty(supabase, 'storage', { value: storageFalso });
  return { supabase, diagnostico: { ok: true } };
});
import * as devedores from '../../src/services/devedores.js';
import * as dividas from '../../src/services/dividas.js';
import * as pagamentos from '../../src/services/pagamentos.js';
import { obterTotaisFinanceiros } from '../../src/services/dashboard.js';

const S = {};
describe('redesign — leituras e funções preservadas sobre PostgreSQL local', () => {
  beforeAll(async () => {
    // Proibido executar estas fixtures em projeto remoto.
    if (process.env.IT_URL !== 'http://127.0.0.1:3100') throw new Error('Use apenas o executor de integração local.');
    S.cliente = await devedores.criar({ nome_razao_social: 'Sintético, (Alfa) Especial', tipo_pessoa: 'PF' });
    S.divida = await dividas.registrar({ devedorId: S.cliente.id, descricao: 'Documento, (revisão) sintético', valorC: 10000 });
    await pagamentos.registrar({ dividaId: S.divida.id, valorC: 2500 });
  });
  afterAll(() => {
    if (process.env.IT_URL !== 'http://127.0.0.1:3100') return;
    // Apenas teardown do banco scipione_it descartável criado por run.sh.
    // As suítes são sequenciais; preserva auth/admin e limpa todas as fixtures financeiras.
    const args = ['-X', '-v', 'ON_ERROR_STOP=1', '-d', 'scipione_it', '-c', 'TRUNCATE public.devedores CASCADE;'];
    if (process.env.TEST_PG_RUN_AS) execFileSync('runuser', ['-u', 'postgres', '--', 'psql', ...args]);
    else execFileSync('psql', args);
  });
  it('busca cliente com vírgulas e parênteses sem injetar gramática de filtro', async () => {
    const d = await dividas.listarPagina({ busca: 'Sintético, (Alfa)', porPagina: 20 });
    expect(d.itens.map((r) => r.id)).toContain(S.divida.id);
    const p = await pagamentos.listarPagina({ busca: 'Sintético, (Alfa)', porPagina: 20 });
    expect(p.itens.every((r) => r.devedor_id === S.cliente.id)).toBe(true);
    expect(p.itens.length).toBeGreaterThan(0);
  });
  it('busca descrição literal com vírgulas e parênteses', async () => {
    expect((await dividas.listarPagina({ busca: 'Documento, (revisão)' })).itens.map((r) => r.id)).toContain(S.divida.id);
    expect((await pagamentos.listarPagina({ busca: 'Documento, (revisão)' })).itens.length).toBeGreaterThan(0);
  });
  it('consolida todos os saldos com paginação de uma linha, sem ponto flutuante', async () => {
    const t = await obterTotaisFinanceiros({ porPagina: 1 });
    expect(Number.isSafeInteger(t.totalRegistradoC)).toBe(true);
    expect(t.totalRegistradoC - t.totalRecebidoC).toBe(t.totalEmAbertoC);
    expect(t.totalRegistradoC).toBeGreaterThanOrEqual(10000);
  });
  it('remove somente a foto privada e preserva o cadastro', async () => {
    const file = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,4])], 'synthetic.png', { type: 'image/png' });
    const path = await devedores.definirFoto(S.cliente.id, file);
    await devedores.removerFotoDoCadastro(S.cliente.id, path);
    expect((await devedores.obter(S.cliente.id)).foto_path).toBeNull();
    expect((await devedores.obter(S.cliente.id)).nome_razao_social).toBe('Sintético, (Alfa) Especial');
  });
});
