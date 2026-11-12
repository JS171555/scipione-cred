// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/devedores.js', () => ({ listarPagina: vi.fn(), urlsFotos: vi.fn(async () => ({})), nomesPorId: vi.fn(async () => ({})), ORDENS: { nome_asc: [], nome_desc: [], recentes: [], antigos: [] }, obter: vi.fn(), urlFoto: vi.fn(), alterarStatus: vi.fn() }));
vi.mock('../../src/services/dashboard.js', () => ({ obterIndicadores: vi.fn(), ultimosCadastros: vi.fn() }));
vi.mock('../../src/services/auditoria.js', () => ({ listarPorDevedor: vi.fn(), listarRecentes: vi.fn() }));
vi.mock('../../src/services/dividas.js', () => ({ listarPorDevedor: vi.fn(async () => []) }));
vi.mock('../../src/services/pagamentos.js', () => ({ listarPorDevedor: vi.fn(async () => []) }));
vi.mock('../../src/services/documentos.js', () => ({ listar: vi.fn(async () => []), TIPOS_DOCUMENTO: { outro: 'Outro' } }));
vi.mock('../../src/services/auth.js', () => ({ obterAdmin: vi.fn(), sair: vi.fn() }));

import * as devedores from '../../src/services/devedores.js';
import * as dashboard from '../../src/services/dashboard.js';
import * as auditoria from '../../src/services/auditoria.js';
import { obterAdmin } from '../../src/services/auth.js';
import { renderDashboard } from '../../src/modules/dashboard.js';
import { renderListaDevedores } from '../../src/modules/devedores-lista.js';
import { renderDevedorDetalhe } from '../../src/modules/devedor-detalhe.js';
import { iniciarRouter } from '../../src/core/router.js';

const ID = '11111111-1111-4111-8111-111111111111';
const ADMIN = { id: 'a1', nome: 'Admin Teste' };
let raiz;
const $ = (s) => raiz.querySelector(s);
const texto = () => raiz.textContent.replace(/\s+/g, ' ');
const muda = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
const item = (n, o = {}) => ({ id: 'id' + n, nome_razao_social: `Devedor ${n}`, cpf_cnpj: null, telefone: null, celular: null, status: 'ativo', foto_path: null, total_em_aberto: 100 * n, ...o });
const pag = (itens, total, pagina = 1) => ({ itens, total, pagina, porPagina: 20 });

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>'; raiz = document.getElementById('app'); location.hash = '';
});

describe('dashboard', () => {
  it('mostra os indicadores reais, últimos cadastros e registros recentes', async () => {
    dashboard.obterIndicadores.mockResolvedValue({ total_devedores: 12, devedores_ativos: 9, devedores_inativos: 3, dividas_em_aberto: 7, dividas_quitadas: 4, valor_total_em_aberto: 15432.5 });
    dashboard.ultimosCadastros.mockResolvedValue([item(1, { created_at: '2026-11-10T12:00:00Z' })]);
    auditoria.listarRecentes.mockResolvedValue([{ id: 1, usuario_id: 'a1', operacao: 'INSERT', entidade: 'pagamentos', entidade_id: 'p', devedor_id: ID, dados_antes: null, dados_depois: { valor: 300, data_pagamento: '2026-11-05' }, created_at: '2026-11-05T15:00:00Z' }]);
    devedores.nomesPorId.mockResolvedValue({ [ID]: 'José da Silva' });
    await renderDashboard(raiz, { admin: ADMIN });
    const cards = [...raiz.querySelectorAll('.card')].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    expect(cards).toEqual(['Devedores cadastrados12', 'Clientes ativos9', 'Clientes inativos3', 'Dívidas em aberto7', 'Dívidas quitadas4', expect.stringMatching(/Valor total em aberto.*15\.432,50/)]);
    expect(texto()).toContain('Devedor 1');
    expect(texto()).toContain('Pagamento registrado'); expect(texto()).toContain('José da Silva'); expect(texto()).toContain('Admin Teste');
    expect(raiz.querySelector('a[href="#/devedores/novo"]')).toBeTruthy();
    expect(raiz.querySelector('a[href="#/devedores"]')).toBeTruthy();
  });
  it('estados vazios e erro traduzido', async () => {
    dashboard.obterIndicadores.mockResolvedValue({ total_devedores: 0, devedores_ativos: 0, devedores_inativos: 0, dividas_em_aberto: 0, dividas_quitadas: 0, valor_total_em_aberto: 0 });
    dashboard.ultimosCadastros.mockResolvedValue([]); auditoria.listarRecentes.mockResolvedValue([]);
    await renderDashboard(raiz, { admin: ADMIN });
    expect(texto()).toContain('Nenhum devedor cadastrado ainda'); expect(texto()).toContain('Nenhuma movimentação registrada');
    dashboard.obterIndicadores.mockRejectedValue({ code: '42501', message: 'permission denied' });
    await renderDashboard(raiz, { admin: ADMIN });
    expect(texto()).toContain('Acesso negado.');
  });
});

describe('lista: filtros, ordenação e paginação', () => {
  it('restaura o estado da URL, aplica filtros no banco e atualiza a URL', async () => {
    devedores.listarPagina.mockResolvedValue(pag([item(1)], 1));
    await renderListaDevedores(raiz, { consulta: new URLSearchParams('q=ana&status=inativo&situacao=em_aberto&ordem=recentes&p=1') });
    await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenCalled());
    expect(devedores.listarPagina).toHaveBeenLastCalledWith({ busca: 'ana', status: 'inativo', situacao: 'em_aberto', ordem: 'recentes', pagina: 1, porPagina: 20 });
    expect($('#busca').value).toBe('ana'); expect($('#f-status').value).toBe('inativo'); expect($('#f-ordem').value).toBe('recentes');
    muda('#f-situacao', 'quitados'); await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: 'quitados', pagina: 1 })));
    muda('#f-status', 'ativo'); await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ativo' })));
    muda('#f-ordem', 'antigos'); await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenLastCalledWith(expect.objectContaining({ ordem: 'antigos' })));
    await vi.waitFor(() => expect(location.hash).toBe('#/devedores?q=ana&status=ativo&situacao=quitados&ordem=antigos'));
    $('#limpar').click();
    await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenLastCalledWith({ busca: '', status: '', situacao: '', ordem: 'nome_asc', pagina: 1, porPagina: 20 }));
    await vi.waitFor(() => expect(location.hash).toBe('#/devedores'));
  });
  it('valores inválidos na URL caem nos padrões', async () => {
    devedores.listarPagina.mockResolvedValue(pag([], 0));
    await renderListaDevedores(raiz, { consulta: new URLSearchParams('status=hack&situacao=x&ordem=y&p=-3') });
    await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenCalled());
    expect(devedores.listarPagina).toHaveBeenLastCalledWith({ busca: '', status: '', situacao: '', ordem: 'nome_asc', pagina: 1, porPagina: 20 });
  });
  it('pagina: informa intervalo, desabilita limites e navega', async () => {
    devedores.listarPagina.mockResolvedValueOnce(pag(Array.from({ length: 20 }, (_, i) => item(i + 1)), 45, 1));
    await renderListaDevedores(raiz, {});
    await vi.waitFor(() => expect(texto()).toContain('Mostrando 1–20 de 45'));
    expect(texto()).toContain('Página 1 de 3');
    expect($('[data-pg="0"]').disabled).toBe(true); expect($('[data-pg="2"]').disabled).toBe(false);
    devedores.listarPagina.mockResolvedValueOnce(pag(Array.from({ length: 5 }, (_, i) => item(i + 41)), 45, 3));
    $('[data-pg="2"]').click();
    await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 })));
    await vi.waitFor(() => expect(texto()).toContain('Mostrando 41–45 de 45'));
    expect($('[data-pg="4"]').disabled).toBe(true);
  });
  it('mostra miniaturas assinadas quando há foto', async () => {
    devedores.listarPagina.mockResolvedValue(pag([item(1, { foto_path: `${ID}/f.png` })], 1));
    devedores.urlsFotos.mockResolvedValue({ [`${ID}/f.png`]: 'https://x/f.png?t=1' });
    await renderListaDevedores(raiz, {});
    await vi.waitFor(() => expect($('.mini img')?.getAttribute('src')).toBe('https://x/f.png?t=1'));
  });
});

describe('histórico de movimentações no perfil', () => {
  const mov = (i) => ({ id: i, usuario_id: 'a1', operacao: 'INSERT', entidade: 'dividas', entidade_id: 'd' + i, devedor_id: ID, dados_antes: null, dados_depois: { descricao: `Dívida ${i}`, valor_original: 100 * i }, created_at: '2026-11-05T15:00:00Z' });
  beforeEach(() => {
    devedores.obter.mockResolvedValue({ id: ID, tipo_pessoa: 'PF', nome_razao_social: 'José', status: 'ativo', created_at: '2026-11-01T12:00:00Z', foto_path: null });
  });
  it('lista as movimentações, carrega mais com offset e some o botão ao acabar', async () => {
    auditoria.listarPorDevedor.mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => mov(i + 1))).mockResolvedValueOnce([mov(11), mov(12)]);
    await renderDevedorDetalhe(raiz, { params: { id: ID }, admin: ADMIN });
    expect(auditoria.listarPorDevedor).toHaveBeenCalledWith(ID, { limite: 10 });
    expect(raiz.querySelectorAll('#historico li')).toHaveLength(10);
    expect(texto()).toContain('Dívida registrada'); expect(texto()).toContain('Admin Teste');
    $('[data-acao=mais-historico]').click();
    await vi.waitFor(() => expect(raiz.querySelectorAll('#historico li')).toHaveLength(12));
    expect(auditoria.listarPorDevedor).toHaveBeenLastCalledWith(ID, { limite: 10, offset: 10 });
    expect($('[data-acao=mais-historico]')).toBeNull();
  });
  it('sem movimentações mostra estado vazio', async () => {
    auditoria.listarPorDevedor.mockResolvedValue([]);
    await renderDevedorDetalhe(raiz, { params: { id: ID }, admin: ADMIN });
    expect(texto()).toContain('Nenhuma movimentação registrada');
  });
});

describe('proteção de rotas', () => {
  const rotas = (extra = {}) => ({
    '/': { render: (r) => { r.textContent = 'INTERNA'; } },
    '/devedores/:id': { render: (r, { params }) => { r.textContent = `PERFIL ${params.id}`; } },
    '/devedores': { render: (r, { consulta }) => { r.textContent = `LISTA ${consulta.get('q') ?? ''}`; } },
    '/login': { render: (r) => { r.textContent = 'LOGIN'; }, publica: true, soDeslogado: true },
    '/404': { render: (r) => { r.textContent = '404'; } }, ...extra,
  });
  it('sem sessão qualquer página interna redireciona ao login', async () => {
    obterAdmin.mockResolvedValue(null);
    location.hash = '#/devedores/abc';
    await iniciarRouter({ raiz, rotas: rotas() });
    expect(location.hash).toBe('#/login');
    expect(raiz.textContent).not.toContain('PERFIL');
  });
  it('com sessão: acessa páginas, recebe parâmetros e consulta; login redireciona para o início', async () => {
    obterAdmin.mockResolvedValue(ADMIN);
    location.hash = '#/devedores/abc'; await iniciarRouter({ raiz, rotas: rotas() });
    expect(raiz.textContent).toBe('PERFIL abc');
    location.hash = '#/devedores?q=ana'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(raiz.textContent).toBe('LISTA ana'));
    location.hash = '#/login'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(location.hash).toBe('#/'));
  });
});
