import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('../../src/core/supabase.js', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { jwt, storageFalso, ADMIN, OUTRO } = await import('./helpers.js');
  const subs = { admin: ADMIN, outro: OUTRO };
  const clientes = {};
  const criar = (quem) => {
    const c = createClient(process.env.IT_URL, jwt(null, process.env.IT_JWT_SECRET, 'anon'), {   // chave anon = JWT com role anon, como no Supabase
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: quem === 'anon' ? {} : { Authorization: `Bearer ${jwt(subs[quem])}` } },
    });
    Object.defineProperty(c, 'storage', { value: storageFalso });
    return c;
  };
  globalThis.__quem = 'admin';
  const supabase = new Proxy({}, { get: (_, p) => { const c = (clientes[globalThis.__quem] ??= criar(globalThis.__quem)); const v = c[p]; return typeof v === 'function' ? v.bind(c) : v; } });
  return { supabase, diagnostico: { ok: true } };
});

import { supabase } from '../../src/core/supabase.js';
import * as devedores from '../../src/services/devedores.js';
import * as documentos from '../../src/services/documentos.js';
import * as dividas from '../../src/services/dividas.js';
import * as pagamentos from '../../src/services/pagamentos.js';
import * as dashboard from '../../src/services/dashboard.js';
import * as auditoria from '../../src/services/auditoria.js';
import { descreverMovimentacao } from '../../src/domain/movimentacoes.js';
import { validarDevedor } from '../../src/domain/devedor.js';
import { totaisDevedor } from '../../src/domain/financeiro.js';
import { traduzirErro } from '../../src/core/errors.js';
import { paraCentavos } from '../../src/utils/money.js';
import { hojeISO } from '../../src/utils/dates.js';
import { arquivos } from './helpers.js';

const usar = (quem) => { globalThis.__quem = quem; };
const bin = (bytes, nome, type) => new File([new Uint8Array(bytes)], nome, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
const falha = async (p) => { try { await p; } catch (e) { return e; } throw new Error('esperava falha, mas a operação teve sucesso'); };
const msg = async (p) => traduzirErro(await falha(p));

const S = {};   // estado compartilhado entre os passos

describe('serviços ↔ PostgREST ↔ migrations reais', () => {
  beforeAll(() => usar('admin'));

  it('cadastra PF e PJ; CPF duplicado é bloqueado com mensagem clara', async () => {
    const pf = validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'José da Silva', cpf_cnpj: '529.982.247-25', celular: '(11) 98888-7777', cep: '01310-100', uf: 'sp', rg: '12.345.678-9', logradouro: 'Av. Paulista' });
    expect(pf.erros).toEqual({});
    S.jose = await devedores.criar(pf.dados);
    expect(S.jose).toMatchObject({ status: 'ativo', cpf_cnpj: '52998224725', uf: 'SP', celular: '11988887777' });
    const pj = validarDevedor({ tipo_pessoa: 'PJ', nome_razao_social: 'Empresa Exemplo Ltda', cpf_cnpj: '11.222.333/0001-81', telefone: '(11) 3333-4444' });
    S.empresa = await devedores.criar(pj.dados);
    expect(S.empresa.tipo_pessoa).toBe('PJ');
    expect(await msg(devedores.criar(validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'Clone', cpf_cnpj: '52998224725' }).dados))).toMatch(/CPF\/CNPJ/);
  });

  it('pesquisa por nome (sem acento), CPF, CNPJ, RG e telefone; curingas são literais', async () => {
    const ids = async (busca) => (await devedores.listar({ busca })).map((d) => d.nome_razao_social);
    expect(await ids('jose')).toEqual(['José da Silva']);
    expect(await ids('JOSÉ DA')).toEqual(['José da Silva']);
    expect(await ids('529.982.247-25')).toEqual(['José da Silva']);
    expect(await ids('11.222.333/0001-81')).toEqual(['Empresa Exemplo Ltda']);
    expect(await ids('12.345.678-9')).toEqual(['José da Silva']);
    expect(await ids('(11) 98888-7777')).toEqual(['José da Silva']);
    expect(await ids('3333-4444')).toEqual(['Empresa Exemplo Ltda']);
    expect(await ids('%')).toEqual([]);
    expect(await ids('_')).toEqual([]);
    expect(await ids('')).toHaveLength(2);
  });

  it('edita o cadastro e persiste', async () => {
    await devedores.atualizar(S.jose.id, validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'José Carlos da Silva', cpf_cnpj: '52998224725', email: 'JOSE@x.com', observacoes: 'cliente antigo' }).dados);
    const d = await devedores.obter(S.jose.id);
    expect(d).toMatchObject({ nome_razao_social: 'José Carlos da Silva', email: 'jose@x.com', observacoes: 'cliente antigo', total_em_aberto: 0 });
    expect(d.busca).toBeUndefined();
  });

  it('foto: envia, substitui (remove a antiga) e rejeita arquivo falsificado', async () => {
    const p1 = await devedores.definirFoto(S.jose.id, bin(PNG, 'a.png', 'image/png'));
    expect(p1.startsWith(`${S.jose.id}/`)).toBe(true);
    expect((await devedores.obter(S.jose.id)).foto_path).toBe(p1);
    const p2 = await devedores.definirFoto(S.jose.id, bin(PNG, 'b.png', 'image/png'), p1);
    expect(p2).not.toBe(p1);
    expect(arquivos.has(`fotos-devedores/${p1}`)).toBe(false);
    expect(arquivos.has(`fotos-devedores/${p2}`)).toBe(true);
    expect(await msg(devedores.definirFoto(S.jose.id, bin([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'f.png', 'image/png')))).toMatch(/conteúdo/);
    expect(await devedores.urlFoto(p2)).toMatch(/^https:\/\/storage\.fake\/fotos-devedores/);
  });

  it('documentos: anexa, lista, abre e remove logicamente (com auditoria)', async () => {
    const doc = await documentos.adicionar(S.jose.id, 'identificacao', bin(PDF, 'rg.pdf', 'application/pdf'));
    expect(doc.storage_path.startsWith(`${S.jose.id}/`)).toBe(true);
    expect(await documentos.listar(S.jose.id)).toHaveLength(1);
    expect(await documentos.urlDocumento(doc)).toMatch(/documentos-devedores/);
    expect(await msg(documentos.adicionar(S.jose.id, 'outro', bin(PDF, 'x.exe', 'application/pdf')))).toMatch(/Formato não permitido/);
    await documentos.remover(doc.id);
    expect(await documentos.listar(S.jose.id)).toHaveLength(0);
    const { data } = await supabase.from('auditoria').select('operacao').eq('entidade_id', doc.id);
    expect(data.map((a) => a.operacao).sort()).toEqual(['INSERT', 'REMOCAO']);
  });

  it('dívidas: várias por devedor, edição, alteração de valor e validações', async () => {
    S.A = await dividas.registrar({ devedorId: S.jose.id, descricao: 'Dívida 01', valorC: 150000 });
    S.B = await dividas.registrar({ devedorId: S.jose.id, descricao: 'Dívida 02', valorC: 80000 });
    S.C = await dividas.registrar({ devedorId: S.jose.id, descricao: 'Dívida 03', valorC: 70000, vencimento: '2099-01-31', observacoes: 'cheque' });
    const lista = await dividas.listarPorDevedor(S.jose.id);
    expect(lista).toHaveLength(3);
    expect(lista.every((d) => d.status === 'em_aberto' && d.total_pago === 0)).toBe(true);
    expect(S.C.data_vencimento).toBe('2099-01-31');
    await dividas.editar(S.C.id, { descricao: 'Dívida 03 (cheque)', observacoes: '', vencimento: '' });
    expect(await dividas.obter(S.C.id)).toMatchObject({ descricao: 'Dívida 03 (cheque)', data_vencimento: null, observacoes: null });
    await dividas.alterarValor(S.C.id, 75000);
    expect(paraCentavos((await dividas.obter(S.C.id)).saldo)).toBe(75000);
    await dividas.alterarValor(S.C.id, 70000);
    expect(await msg(dividas.registrar({ devedorId: S.jose.id, descricao: 'Futura', valorC: 100, dataRegistro: '2099-01-01' }))).toMatch(/futura/);
    expect(await falha(dividas.registrar({ devedorId: S.jose.id, descricao: 'Zero', valorC: 0 }))).toBeTruthy();
  });

  it('pagamentos: parcial, comprovante, idempotência, bloqueio acima do saldo, quitação e estorno', async () => {
    const hoje = hojeISO();
    const p1 = await pagamentos.registrar({ dividaId: S.A.id, valorC: 30000, data: hoje, observacao: 'primeiro', arquivo: bin(PDF, 'rec.pdf', 'application/pdf'), chave: '11111111-1111-4111-8111-111111111111' });
    expect(p1.comprovante_path.startsWith(`${S.A.id}/`)).toBe(true);
    await pagamentos.registrar({ dividaId: S.A.id, valorC: 20000, data: hoje, chave: '22222222-2222-4222-8222-222222222222' });
    expect(paraCentavos((await dividas.obter(S.A.id)).saldo)).toBe(100000);    // 1.500 − 300 − 200 = 1.000

    const repetido = await pagamentos.registrar({ dividaId: S.A.id, valorC: 30000, data: hoje, chave: '11111111-1111-4111-8111-111111111111' });
    expect(repetido.id).toBe(p1.id);
    expect(await pagamentos.listarPorDivida(S.A.id)).toHaveLength(2);

    expect(await msg(pagamentos.registrar({ dividaId: S.A.id, valorC: 100001, data: hoje }))).toMatch(/excede o saldo/);
    expect(await falha(pagamentos.registrar({ dividaId: S.A.id, valorC: -5, data: hoje }))).toBeTruthy();
    expect(await msg(pagamentos.registrar({ dividaId: S.A.id, valorC: 100, data: '2099-01-01' }))).toMatch(/futura/);

    const quita = await pagamentos.registrar({ dividaId: S.A.id, valorC: 100000, data: hoje });
    expect((await dividas.obter(S.A.id))).toMatchObject({ status: 'quitada', saldo: 0, total_pago: 1500 });
    expect(await msg(pagamentos.registrar({ dividaId: S.A.id, valorC: 1, data: hoje }))).toMatch(/excede o saldo/);

    const est = await pagamentos.estornar(quita.id, 'Lançado por engano');
    expect(est.status).toBe('estornado');
    expect(await dividas.obter(S.A.id)).toMatchObject({ status: 'em_aberto', saldo: 1000 });
    expect(await msg(pagamentos.estornar(quita.id, 'de novo'))).toMatch(/já estornado/);
    expect(await msg(pagamentos.estornar(p1.id, 'x'))).toMatch(/motivo/i);

    const historico = await pagamentos.listarPorDevedor(S.jose.id);
    expect(historico).toHaveLength(3);
    expect(historico.filter((p) => p.status === 'estornado')).toHaveLength(1);
    expect(historico[0].dividas).toBeUndefined();
    expect(await pagamentos.urlComprovante(p1.comprovante_path)).toMatch(/comprovantes-pagamentos/);
  });

  it('totais conferem com o exemplo do escopo (3.000 − 500 = 2.500) e valores centavos são exatos', async () => {
    const lista = await dividas.listarPorDevedor(S.jose.id);
    const t = totaisDevedor(lista, paraCentavos);
    expect(t).toEqual({ registradoC: 300000, pagoC: 50000, emAbertoC: 250000, abertas: 3, quitadas: 0 });
    expect((await devedores.obter(S.jose.id)).total_em_aberto).toBe(2500);
    const D = await dividas.registrar({ devedorId: S.empresa.id, descricao: 'Centavos', valorC: 10030 });
    await pagamentos.registrar({ dividaId: D.id, valorC: 10, data: hojeISO() });
    await pagamentos.registrar({ dividaId: D.id, valorC: 20, data: hojeISO() });
    expect(paraCentavos((await dividas.obter(D.id)).saldo)).toBe(10000);
    const dash = (await supabase.from('vw_dashboard').select('*').single()).data;
    expect(dash).toMatchObject({ total_devedores: 2, devedores_ativos: 2, dividas_em_aberto: 4, dividas_quitadas: 0, valor_total_em_aberto: 2600 });
  });

  it('inativação com dívidas em aberto exige confirmação; histórico e pagamentos permanecem', async () => {
    const r = await devedores.alterarStatus(S.jose.id, 'inativo');
    expect(r).toMatchObject({ alterado: false, requer_confirmacao: true, qtd_dividas_abertas: 3, valor_em_aberto: 2500 });
    expect((await devedores.obter(S.jose.id)).status).toBe('ativo');
    expect(await devedores.alterarStatus(S.jose.id, 'inativo', true)).toMatchObject({ alterado: true });
    expect(await msg(dividas.registrar({ devedorId: S.jose.id, descricao: 'Nova', valorC: 100 }))).toMatch(/inativo/);
    await pagamentos.registrar({ dividaId: S.B.id, valorC: 5000, data: hojeISO() });   // pagamento segue permitido
    expect(await dividas.listarPorDevedor(S.jose.id)).toHaveLength(3);
    expect(await devedores.alterarStatus(S.jose.id, 'ativo')).toMatchObject({ alterado: true });
  });

  it('auditoria registra as operações principais', async () => {
    const { data } = await supabase.from('auditoria').select('entidade, operacao, usuario_id').eq('devedor_id', S.jose.id);
    const tem = (e, o) => data.some((a) => a.entidade === e && a.operacao === o);
    expect(tem('devedores', 'INSERT') && tem('devedores', 'UPDATE') && tem('devedores', 'STATUS')).toBe(true);
    expect(tem('dividas', 'INSERT') && tem('dividas', 'UPDATE')).toBe(true);
    expect(tem('pagamentos', 'INSERT') && tem('pagamentos', 'ESTORNO')).toBe(true);
    expect(data.every((a) => a.usuario_id === 'a0000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('usuário autenticado que não é administrador não vê nem altera nada', async () => {
    usar('outro');
    expect(await devedores.listar()).toEqual([]);
    expect(await devedores.obter(S.jose.id)).toBeNull();
    expect(await dividas.listarPorDevedor(S.jose.id)).toEqual([]);
    expect(await msg(dividas.registrar({ devedorId: S.jose.id, descricao: 'Intruso', valorC: 100 }))).toMatch(/restrito|negado/i);
    expect(await msg(pagamentos.registrar({ dividaId: S.B.id, valorC: 100 }))).toMatch(/restrito|negado/i);
    expect(await msg(pagamentos.estornar('00000000-0000-0000-0000-000000000000', 'abc'))).toMatch(/restrito|negado/i);
    expect(await msg(devedores.criar(validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'Intruso' }).dados))).toBe('Acesso negado.');
    expect((await supabase.from('auditoria').select('id')).data).toEqual([]);
    usar('admin');
  });

  it('sem login (anon) não há acesso a nenhuma tabela, view ou RPC', async () => {
    usar('anon');
    expect(await msg(devedores.listar())).toBe('Acesso negado.');
    expect(await msg(dividas.listarPorDevedor(S.jose.id))).toBe('Acesso negado.');
    expect(await msg(pagamentos.registrar({ dividaId: S.B.id, valorC: 100 }))).toBe('Acesso negado.');
    expect((await supabase.from('auditoria').select('id')).error).toBeTruthy();
    expect((await supabase.from('configuracoes').select('chave')).error).toBeTruthy();
    usar('admin');
  });
});

describe('Etapa 4: dashboard, listagem, histórico e integração entre módulos', () => {
  const nomes = async (filtros) => (await devedores.listarPagina(filtros)).itens.map((d) => d.nome_razao_social);

  it('cadastrar → aparece na lista; dívida e pagamentos atualizam totais; quitação reflete na lista', async () => {
    S.maria = await devedores.criar(validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'Maria Quitada' }).dados);
    let r = await devedores.listarPagina({ busca: 'maria' });
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({ id: S.maria.id, total_em_aberto: 0, qtd_dividas_abertas: 0, qtd_dividas_quitadas: 0 });
    const dv = await dividas.registrar({ devedorId: S.maria.id, descricao: 'Única', valorC: 50000 });
    r = await devedores.listarPagina({ busca: 'maria' });
    expect(r.itens[0]).toMatchObject({ total_em_aberto: 500, qtd_dividas_abertas: 1 });
    await pagamentos.registrar({ dividaId: dv.id, valorC: 20000, data: hojeISO() });
    expect((await devedores.listarPagina({ busca: 'maria' })).itens[0].total_em_aberto).toBe(300);
    await pagamentos.registrar({ dividaId: dv.id, valorC: 30000, data: hojeISO() });
    expect((await devedores.listarPagina({ busca: 'maria' })).itens[0]).toMatchObject({ total_em_aberto: 0, qtd_dividas_abertas: 0, qtd_dividas_quitadas: 1 });
    expect(await dividas.obter(dv.id)).toMatchObject({ status: 'quitada' });
    S.pedro = await devedores.criar(validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'Pedro Inativo' }).dados);
    await dividas.registrar({ devedorId: S.pedro.id, descricao: 'Aberta', valorC: 50000 });
    await devedores.alterarStatus(S.pedro.id, 'inativo', true);
  });

  it('dashboard reflete os dados reais (sem valores fixos)', async () => {
    // José: 1.000 + 750 + 700 = 2.450 · Empresa: 100 · Pedro (inativo): 500 · Maria: quitada
    expect(await dashboard.obterIndicadores()).toEqual({ total_devedores: 4, devedores_ativos: 3, devedores_inativos: 1, dividas_em_aberto: 5, dividas_quitadas: 1, valor_total_em_aberto: 3050 });
    const ult = await dashboard.ultimosCadastros(2);
    expect(ult.map((d) => d.nome_razao_social)).toEqual(['Pedro Inativo', 'Maria Quitada']);
    expect(ult[0].total_em_aberto).toBe(500);
  });

  it('ordenação por nome e por data de cadastro', async () => {
    expect(await nomes({ ordem: 'nome_asc' })).toEqual(['Empresa Exemplo Ltda', 'José Carlos da Silva', 'Maria Quitada', 'Pedro Inativo']);
    expect(await nomes({ ordem: 'nome_desc' })).toEqual(['Pedro Inativo', 'Maria Quitada', 'José Carlos da Silva', 'Empresa Exemplo Ltda']);
    expect(await nomes({ ordem: 'recentes' })).toEqual(['Pedro Inativo', 'Maria Quitada', 'Empresa Exemplo Ltda', 'José Carlos da Silva']);
    expect(await nomes({ ordem: 'antigos' })).toEqual(['José Carlos da Silva', 'Empresa Exemplo Ltda', 'Maria Quitada', 'Pedro Inativo']);
    expect(await nomes({ ordem: 'invalida' })).toEqual(await nomes({ ordem: 'nome_asc' }));
  });

  it('filtros: ativos, inativos, dívidas em aberto, quitadas e combinações com busca', async () => {
    expect(await nomes({ status: 'inativo' })).toEqual(['Pedro Inativo']);
    expect(await nomes({ status: 'ativo' })).toHaveLength(3);
    expect(await nomes({ situacao: 'em_aberto' })).toEqual(['Empresa Exemplo Ltda', 'José Carlos da Silva', 'Pedro Inativo']);
    expect(await nomes({ situacao: 'quitados' })).toEqual(['Maria Quitada']);
    expect(await nomes({ status: 'ativo', situacao: 'em_aberto' })).toEqual(['Empresa Exemplo Ltda', 'José Carlos da Silva']);
    expect(await nomes({ status: 'inativo', situacao: 'quitados' })).toEqual([]);
    expect(await nomes({ situacao: 'em_aberto', busca: 'jose' })).toEqual(['José Carlos da Silva']);
  });

  it('paginação no banco: total exato, páginas sem sobreposição e recuo quando a página não existe', async () => {
    const p1 = await devedores.listarPagina({ porPagina: 3, pagina: 1 });
    const p2 = await devedores.listarPagina({ porPagina: 3, pagina: 2 });
    expect(p1.total).toBe(4); expect(p1.itens).toHaveLength(3); expect(p2.itens).toHaveLength(1);
    expect(new Set([...p1.itens, ...p2.itens].map((d) => d.id)).size).toBe(4);
    const alem = await devedores.listarPagina({ porPagina: 2, pagina: 9 });
    expect(alem).toMatchObject({ pagina: 2, total: 4 }); expect(alem.itens).toHaveLength(2);
    const filtro = await devedores.listarPagina({ status: 'inativo', porPagina: 2, pagina: 3 });
    expect(filtro).toMatchObject({ pagina: 1, total: 1 }); expect(filtro.itens).toHaveLength(1);
    expect((await devedores.listarPagina({ busca: 'nada-aqui' }))).toMatchObject({ itens: [], total: 0 });
  });

  it('miniaturas em lote ignoram caminhos vazios', async () => {
    const urls = await devedores.urlsFotos(['a/x.png', null, 'a/x.png', 'b/y.png']);
    expect(Object.keys(urls).sort()).toEqual(['a/x.png', 'b/y.png']);
    expect(await devedores.urlsFotos([null])).toEqual({});
  });

  it('histórico do devedor: ordem, paginação e todas as operações reais têm descrição', async () => {
    const todas = await auditoria.listarPorDevedor(S.jose.id, { limite: 200 });
    const a = await auditoria.listarPorDevedor(S.jose.id, { limite: 5 });
    const b = await auditoria.listarPorDevedor(S.jose.id, { limite: 5, offset: 5 });
    expect(a.map((m) => m.id)).toEqual(todas.slice(0, 5).map((m) => m.id));
    expect(b.map((m) => m.id)).toEqual(todas.slice(5, 10).map((m) => m.id));
    expect(todas.every((m) => m.devedor_id === S.jose.id)).toBe(true);
    expect(todas.map((m) => m.id)).toEqual([...todas.map((m) => m.id)].sort((x, y) => y - x));
    expect(todas.some((m) => m.operacao === 'ESTORNO')).toBe(true);
    const titulos = todas.map((m) => descreverMovimentacao(m).titulo);
    expect(titulos.filter((t) => /^(INSERT|UPDATE|STATUS|ESTORNO|REMOCAO) em /.test(t))).toEqual([]);
    expect(titulos).toEqual(expect.arrayContaining(['Devedor cadastrado', 'Pagamento registrado', 'Pagamento estornado', 'Dívida quitada', 'Dívida reaberta', 'Valor da dívida alterado', 'Cadastro inativado', 'Cadastro reativado', 'Documento anexado', 'Documento removido', 'Foto atualizada']));
  });

  it('atividade recente cruza devedores e resolve nomes', async () => {
    const rec = await auditoria.listarRecentes(6);
    expect(rec).toHaveLength(6);
    const n = await devedores.nomesPorId(rec.map((r) => r.devedor_id));
    expect(Object.values(n).length).toBeGreaterThan(0);
    expect(Object.values(n).every((v) => typeof v === 'string')).toBe(true);
    expect(await devedores.nomesPorId([])).toEqual({});
  });

  it('usuário que não é administrador vê dashboard zerado e nenhuma atividade', async () => {
    usar('outro');
    expect(await dashboard.obterIndicadores()).toMatchObject({ total_devedores: 0, dividas_em_aberto: 0, valor_total_em_aberto: 0 });
    expect(await dashboard.ultimosCadastros()).toEqual([]);
    expect(await auditoria.listarRecentes()).toEqual([]);
    expect(await devedores.listarPagina()).toMatchObject({ itens: [], total: 0 });
    usar('admin');
  });
});
