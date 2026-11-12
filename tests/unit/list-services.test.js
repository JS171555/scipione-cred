import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  db: {},
  calls: [],
  omitCountTables: new Set(),
}));

vi.mock('../../src/core/supabase.js', () => ({ supabase: mock.supabase }));

import { listarPagina as listarDividas } from '../../src/services/dividas.js';
import { listarPagina as listarPagamentos } from '../../src/services/pagamentos.js';
import { obterTotaisFinanceiros } from '../../src/services/dashboard.js';

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const casaIlike = (valor, padrao) => {
  let regex = '^';
  let escapado = false;
  for (const caractere of String(padrao)) {
    if (escapado) {
      regex += escaparRegex(caractere);
      escapado = false;
    } else if (caractere === '\\') {
      escapado = true;
    } else if (caractere === '%') {
      regex += '.*';
    } else if (caractere === '_') {
      regex += '.';
    } else {
      regex += escaparRegex(caractere);
    }
  }
  if (escapado) regex += escaparRegex('\\');
  return new RegExp(`${regex}$`, 'i').test(String(valor ?? ''));
};

const uid = (prefixo, numero) => `${prefixo}${String(numero).padStart(4, '0')}-0000-0000-0000-${String(numero).padStart(12, '0')}`;

function builderPara(tabela) {
  const chamada = { tabela, operacoes: [] };
  mock.calls.push(chamada);
  const estado = { filtros: [], ordens: [], limite: null, count: false };
  const registrar = (operacao, ...args) => {
    chamada.operacoes.push({ operacao, args });
  };
  const executar = (inicio = 0, fim = Number.MAX_SAFE_INTEGER) => {
    let linhas = [...(mock.db[tabela] ?? [])];
    for (const filtro of estado.filtros) {
      if (filtro.tipo === 'ilike') linhas = linhas.filter((linha) => casaIlike(linha[filtro.coluna], filtro.padrao));
      if (filtro.tipo === 'in') linhas = linhas.filter((linha) => filtro.valores.includes(linha[filtro.coluna]));
      if (filtro.tipo === 'eq') linhas = linhas.filter((linha) => linha[filtro.coluna] === filtro.valor);
    }
    for (let i = estado.ordens.length - 1; i >= 0; i -= 1) {
      const { coluna, ascending } = estado.ordens[i];
      linhas.sort((a, b) => {
        const av = a[coluna];
        const bv = b[coluna];
        if (av == null || bv == null) return av == null && bv == null ? 0 : (av == null ? 1 : -1);
        if (av === bv) return 0;
        const resultado = av < bv ? -1 : 1;
        return ascending ? resultado : -resultado;
      });
    }
    const total = linhas.length;
    if (estado.limite != null) linhas = linhas.slice(0, estado.limite);
    const data = linhas.slice(inicio, Math.min(fim + 1, linhas.length));
    return {
      data,
      error: null,
      count: estado.count && !mock.omitCountTables.has(tabela) ? total : undefined,
    };
  };
  const q = {
    select(_colunas, opcoes = {}) {
      estado.count = opcoes.count === 'exact';
      registrar('select', _colunas, opcoes);
      return q;
    },
    ilike(coluna, padrao) {
      estado.filtros.push({ tipo: 'ilike', coluna, padrao });
      registrar('ilike', coluna, padrao);
      return q;
    },
    in(coluna, valores) {
      estado.filtros.push({ tipo: 'in', coluna, valores });
      registrar('in', coluna, valores);
      return q;
    },
    eq(coluna, valor) {
      estado.filtros.push({ tipo: 'eq', coluna, valor });
      registrar('eq', coluna, valor);
      return q;
    },
    order(coluna, opcoes = {}) {
      estado.ordens.push({ coluna, ascending: opcoes.ascending !== false });
      registrar('order', coluna, opcoes);
      return q;
    },
    limit(valor) {
      estado.limite = valor;
      registrar('limit', valor);
      return q;
    },
    range(inicio, fim) {
      registrar('range', inicio, fim);
      return Promise.resolve(executar(inicio, fim));
    },
    then(resolve, reject) {
      try {
        return Promise.resolve(executar()).then(resolve, reject);
      } catch (error) {
        return Promise.reject(error).then(resolve, reject);
      }
    },
    maybeSingle() {
      registrar('maybeSingle');
      const resposta = executar(0, 0);
      return Promise.resolve({ data: resposta.data[0] ?? null, error: null });
    },
    single() {
      registrar('single');
      const resposta = executar(0, 0);
      return Promise.resolve({ data: resposta.data[0] ?? null, error: null });
    },
  };
  return q;
}

mock.supabase.from.mockImplementation((tabela) => builderPara(tabela));

const operacoes = (nome) => mock.calls.flatMap((chamada) => chamada.operacoes.filter((op) => op.operacao === nome));
const rangesDe = (tabela, temIlike = null) => mock.calls
  .filter((chamada) => chamada.tabela === tabela)
  .filter((chamada) => temIlike === null || chamada.operacoes.some((op) => op.operacao === 'ilike' && op.args[0] === temIlike))
  .flatMap((chamada) => chamada.operacoes.filter((op) => op.operacao === 'range').map((op) => op.args[0]));

beforeEach(() => {
  mock.db = {};
  mock.calls.length = 0;
  mock.omitCountTables.clear();
  mock.supabase.rpc.mockReset();
});

describe('listagens financeiras sem truncamento de busca', () => {
  it('dívidas: busca literal com vírgula/parênteses percorre mais de 1000 ids e pagina com total exato', async () => {
    const quantidade = 1005;
    mock.db.vw_devedores_resumo = Array.from({ length: quantidade }, (_, i) => ({
      id: uid('c001', i), nome_razao_social: `Cliente ${i}`, busca: 'outro cliente',
    }));
    mock.db.vw_dividas_saldo = Array.from({ length: quantidade }, (_, i) => ({
      id: uid('d001', i), devedor_id: uid('c001', i), descricao: 'cobranca, (especial)',
      valor_original: 10, total_pago: 0, saldo: 10, status: 'em_aberto', data_registro: '2026-01-01',
      data_vencimento: null, observacoes: null, created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    }));

    const resultado = await listarDividas({ busca: 'cobranca, (especial)', pagina: 2, porPagina: 20 });

    expect(resultado.total).toBe(quantidade);
    expect(resultado.pagina).toBe(2);
    expect(resultado.itens).toHaveLength(20);
    expect(resultado.itens.every((item) => item.descricao === 'cobranca, (especial)')).toBe(true);
    expect(rangesDe('vw_dividas_saldo', 'descricao')).toEqual([0, 1000]);
    expect(operacoes('or')).toHaveLength(0);
    expect(operacoes('limit')).toHaveLength(0);
    expect(operacoes('in').every((op) => op.args[1].length <= 200)).toBe(true);
  });

  it('pagamentos: une ids de cliente e descrição acima de 1000 sem .or textual nem perda no total', async () => {
    const quantidade = 1005;
    mock.db.vw_devedores_resumo = Array.from({ length: quantidade }, (_, i) => ({
      id: uid('c002', i), nome_razao_social: `Cliente especial ${i}`, busca: 'cliente, (especial)',
    }));
    mock.db.vw_dividas_saldo = Array.from({ length: quantidade }, (_, i) => ({
      id: uid('d002', i), devedor_id: uid('c002', i), descricao: 'cliente, (especial)', saldo: 10, status: 'em_aberto',
    }));
    mock.db.pagamentos = Array.from({ length: quantidade }, (_, i) => ({
      id: uid('p002', i), divida_id: uid('d002', i), valor: 0.1, data_pagamento: '2026-01-01',
      observacao: null, comprovante_path: null, status: 'valido', estornado_em: null, motivo_estorno: null,
      created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    }));

    const resultado = await listarPagamentos({ busca: 'cliente, (especial)', pagina: 51, porPagina: 20 });

    expect(resultado.total).toBe(quantidade);
    expect(resultado.pagina).toBe(51);
    expect(resultado.itens).toHaveLength(5);
    expect(resultado.itens.every((item) => item.divida_descricao === 'cliente, (especial)')).toBe(true);
    expect(rangesDe('vw_devedores_resumo', 'busca')).toEqual([0, 1000]);
    expect(rangesDe('vw_dividas_saldo', 'descricao')).toEqual([0, 1000]);
    expect(operacoes('or')).toHaveLength(0);
    expect(operacoes('limit')).toHaveLength(0);
    expect(operacoes('in').every((op) => op.args[1].length <= 200)).toBe(true);
  });
});

describe('totais do dashboard', () => {
  it('continua após primeira página cheia sem count e soma 0,10 + 0,20 em centavos', async () => {
    mock.db.vw_devedores_resumo = Array.from({ length: 1001 }, (_, i) => ({
      id: uid('c003', i), total_registrado: 0, total_pago: 0, total_em_aberto: 0,
    }));
    mock.db.vw_devedores_resumo[0].total_registrado = 0.1;
    mock.db.vw_devedores_resumo[0].total_pago = 0.1;
    mock.db.vw_devedores_resumo[0].total_em_aberto = 0.1;
    mock.db.vw_devedores_resumo[1].total_registrado = 0.2;
    mock.db.vw_devedores_resumo[1].total_pago = 0.2;
    mock.db.vw_devedores_resumo[1].total_em_aberto = 0.2;
    mock.omitCountTables.add('vw_devedores_resumo');

    const resultado = await obterTotaisFinanceiros();

    expect(resultado).toMatchObject({
      totalRegistradoC: 30, totalRecebidoC: 30, totalEmAbertoC: 30,
      total_registrado: 0.3, total_recebido: 0.3, total_em_aberto: 0.3,
    });
    expect(rangesDe('vw_devedores_resumo')).toEqual([0, 1000]);
  });
});
