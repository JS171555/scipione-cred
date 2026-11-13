// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/devedores.js', () => ({
  listarPagina: vi.fn(),
  urlsFotos: vi.fn(async () => ({})),
  nomesPorId: vi.fn(async () => ({})),
  ORDENS: { nome_asc: [], nome_desc: [], recentes: [], antigos: [] },
}));
vi.mock('../../src/services/dividas.js', () => ({
  listarPagina: vi.fn(),
  listarPorDevedor: vi.fn(async () => []),
  obter: vi.fn(),
  remover: vi.fn(),
}));
vi.mock('../../src/services/pagamentos.js', () => ({
  listarPagina: vi.fn(),
  urlComprovante: vi.fn(),
}));
vi.mock('../../src/services/auth.js', () => ({ obterAdmin: vi.fn(), sair: vi.fn() }));

import * as devedores from '../../src/services/devedores.js';
import * as dividas from '../../src/services/dividas.js';
import * as pagamentos from '../../src/services/pagamentos.js';
import { renderListaDividas } from '../../src/modules/dividas-lista.js';
import { renderListaPagamentos } from '../../src/modules/pagamentos-lista.js';
import { renderSelecionarDivida, renderSelecionarPagamento } from '../../src/modules/selecionar-registro.js';

let raiz;
const texto = () => raiz.textContent.replace(/\s+/g, ' ');
const pagina = (itens, total = itens.length, numero = 1) => ({ itens, total, pagina: numero, porPagina: 20 });
const DIV = '22222222-2222-4222-8222-222222222222';
const DEV = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  raiz = document.getElementById('app');
  location.hash = '';
});

describe('listas financeiras globais', () => {
  it('lista dívidas com 20 itens, filtros URL e ações existentes', async () => {
    dividas.listarPagina.mockResolvedValue(pagina([{
      id: DIV, devedor_id: DEV, devedor_nome: 'Ana Souza', descricao: 'Empréstimo',
      valor_original: 1200, total_pago: 200, saldo: 1000, status: 'em_aberto', data_registro: '2026-11-01', data_vencimento: null,
    }]));
    await renderListaDividas(raiz, { consulta: new URLSearchParams('q=ana&status=em_aberto&ordem=antigos') });
    await vi.waitFor(() => expect(dividas.listarPagina).toHaveBeenCalledWith({ busca: 'ana', status: 'em_aberto', ordem: 'antigos', pagina: 1, porPagina: 20 }));
    expect(raiz.querySelector('.financial-table')).toBeTruthy();
    expect(raiz.querySelector('td[data-label="Cliente"] a[href="#/devedores/' + DEV + '"]')).toBeTruthy();
    expect(raiz.querySelector('a[href="#/dividas/' + DIV + '/editar"]')).toBeTruthy();
    expect(raiz.querySelector('a[href="#/dividas/' + DIV + '/pagamento"]')).toBeTruthy();
    expect(raiz.querySelectorAll('td[data-label]').length).toBeGreaterThan(0);
  });

  it('mantém pagamentos estornados no histórico e expõe comprovante assinado', async () => {
    pagamentos.listarPagina.mockResolvedValue(pagina([{
      id: 'pg-1', divida_id: DIV, devedor_id: DEV, devedor_nome: 'Ana Souza', divida_descricao: 'Empréstimo',
      valor: 200, data_pagamento: '2026-11-02', status: 'estornado', estornado_em: '2026-11-03T12:00:00Z',
      motivo_estorno: 'Lançamento duplicado', comprovante_path: `${DIV}/rec.pdf`, divida_status: 'em_aberto',
    }]));
    await renderListaPagamentos(raiz, { consulta: new URLSearchParams('status=estornado') });
    await vi.waitFor(() => expect(pagamentos.listarPagina).toHaveBeenCalledWith({ busca: '', status: 'estornado', ordem: 'recentes', pagina: 1, porPagina: 20 }));
    expect(raiz.querySelector('tr.estornado')).toBeTruthy();
    expect(texto()).toContain('Lançamento duplicado');
    expect(raiz.querySelector('[data-acao="comprovante"][data-path="' + DIV + '/rec.pdf"]')).toBeTruthy();
    expect(raiz.querySelector('a[href="#/dividas/' + DIV + '/pagamento"]')).toBeTruthy();
  });

  it('permite apagar dívida sem pagamentos após confirmação', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    const base = { devedor_id: DEV, devedor_nome: 'Ana Souza', valor_original: 1200, data_registro: '2026-11-01', data_vencimento: null };
    dividas.listarPagina.mockResolvedValue(pagina([
      { ...base, id: DIV, descricao: 'Empréstimo', total_pago: 0, saldo: 1200, status: 'em_aberto' },
      { ...base, id: '44444444-4444-4444-8444-444444444444', descricao: 'Com pagamento', total_pago: 200, saldo: 1000, status: 'em_aberto' },
    ]));
    await renderListaDividas(raiz, {});
    await vi.waitFor(() => expect(raiz.querySelector('[data-apagar-divida]')).toBeTruthy());
    const botoes = raiz.querySelectorAll('[data-apagar-divida]');
    expect(botoes).toHaveLength(1);
    expect(botoes[0].dataset.apagarDivida).toBe(DIV);
    botoes[0].click();
    await vi.waitFor(() => expect(document.querySelector('dialog [data-s]')).toBeTruthy());
    dividas.remover.mockResolvedValueOnce();
    document.querySelector('dialog [data-s]').click();
    await vi.waitFor(() => expect(dividas.remover).toHaveBeenCalledWith(DIV));
  });

  it('recolhe os filtros atrás do botão nas listas financeiras', async () => {
    dividas.listarPagina.mockResolvedValue(pagina([]));
    pagamentos.listarPagina.mockResolvedValue(pagina([]));
    for (const render of [renderListaDividas, renderListaPagamentos]) {
      document.body.innerHTML = '<div id="app"></div>';
      raiz = document.getElementById('app');
      await render(raiz, {});
      await vi.waitFor(() => expect(raiz.querySelector('#tabela')).toBeTruthy());
      const botao = raiz.querySelector('#filtro-toggle');
      const painel = raiz.querySelector('#filtros-painel');
      expect(botao).toBeTruthy();
      expect(painel.dataset.aberto).toBe('false');
      botao.click();
      expect(painel.dataset.aberto).toBe('true');
      expect(botao.getAttribute('aria-expanded')).toBe('true');
      botao.click();
      expect(painel.dataset.aberto).toBe('false');
    }
  });

  it('mostra retry nos estados de erro', async () => {
    dividas.listarPagina.mockRejectedValueOnce({ code: '42501', message: 'permission denied' });
    await renderListaDividas(raiz, {});
    await vi.waitFor(() => expect(raiz.querySelector('[data-retry]')).toBeTruthy());
    expect(raiz.querySelector('.error-state')).toBeTruthy();
  });
});

describe('seleção para novos registros', () => {
  it('seleciona somente clientes ativos para nova dívida', async () => {
    devedores.listarPagina.mockResolvedValue(pagina([{ id: DEV, nome_razao_social: 'Ana Souza', status: 'ativo', cpf_cnpj: null, total_em_aberto: 0 }]));
    await renderSelecionarDivida(raiz, {});
    await vi.waitFor(() => expect(devedores.listarPagina).toHaveBeenCalledWith({ busca: '', status: 'ativo', situacao: '', ordem: 'nome_asc', pagina: 1, porPagina: 20 }));
    expect(raiz.querySelector('a[data-selecionar="' + DEV + '"][href="#/devedores/' + DEV + '/dividas/nova"]')).toBeTruthy();
  });

  it('seleciona somente dívidas em aberto para novo pagamento', async () => {
    dividas.listarPagina.mockResolvedValue(pagina([{ id: DIV, devedor_id: DEV, devedor_nome: 'Ana Souza', descricao: 'Empréstimo', saldo: 100, status: 'em_aberto', data_registro: '2026-11-01' }]));
    await renderSelecionarPagamento(raiz, {});
    await vi.waitFor(() => expect(dividas.listarPagina).toHaveBeenCalledWith({ busca: '', status: 'em_aberto', ordem: 'recentes', pagina: 1, porPagina: 20 }));
    expect(raiz.querySelector('a[data-selecionar="' + DIV + '"][href="#/dividas/' + DIV + '/pagamento"]')).toBeTruthy();
  });
});
