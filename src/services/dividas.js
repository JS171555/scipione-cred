import { supabase } from '../core/supabase.js';
import { centavosParaDecimal } from '../utils/money.js';
import { termoDeBusca } from './devedores.js';

const COLUNAS_LISTA = 'id, devedor_id, descricao, valor_original, total_pago, saldo, status, data_registro, data_vencimento, observacoes, created_at';
const ORDENS = {
  recentes: ['data_registro', false], antigos: ['data_registro', true],
  vencimento: ['data_vencimento', true], data_desc: ['data_registro', false], data_asc: ['data_registro', true],
};
const STATUS = new Set(['', 'em_aberto', 'quitada']);
const TAMANHO_PAGINA_IDS = 1000;
const TAMANHO_CHUNK_IDS = 200;
const paginaValida = (pagina) => Math.max(1, Number.parseInt(pagina, 10) || 1);
const tamanhoValido = (porPagina) => Math.max(1, Math.min(100, Number.parseInt(porPagina, 10) || 20));
const temCount = (count) => typeof count === 'number' && Number.isFinite(count);
const termoDescricao = (texto) => String(texto ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);

const unicos = (ids) => [...new Set((ids ?? []).filter(Boolean))];
const emChunks = (valores, tamanho = TAMANHO_CHUNK_IDS) => {
  const saida = [];
  for (let i = 0; i < valores.length; i += tamanho) saida.push(valores.slice(i, i + tamanho));
  return saida;
};

/**
 * A busca textual usa parâmetros do cliente Supabase, nunca uma expressão .or().
 * A paginação por id continua até uma página curta (inclusive busca com exatamente
 * 1000 resultados, que provoca uma leitura vazia de confirmação).
 */
async function idsPorIlike(tabela, coluna, termo) {
  const ids = [];
  let de = 0;
  for (;;) {
    const { data, error } = await supabase.from(tabela).select('id')
      .ilike(coluna, `%${termo}%`)
      .order('id', { ascending: true })
      .range(de, de + TAMANHO_PAGINA_IDS - 1);
    if (error) throw error;
    const pagina = (data ?? []).map((item) => item.id).filter(Boolean);
    ids.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA_IDS) break;
    de += TAMANHO_PAGINA_IDS;
  }
  return unicos(ids);
}

/** Busca ids de dívidas para uma lista de ids de devedores, sem .or() textual. */
async function idsDividasPorDevedores(idsDevedores) {
  const ids = [];
  for (const chunk of emChunks(unicos(idsDevedores))) {
    let de = 0;
    for (;;) {
      const { data, error } = await supabase.from('vw_dividas_saldo').select('id')
        .in('devedor_id', chunk)
        .order('id', { ascending: true })
        .range(de, de + TAMANHO_PAGINA_IDS - 1);
      if (error) throw error;
      const pagina = (data ?? []).map((item) => item.id).filter(Boolean);
      ids.push(...pagina);
      if (pagina.length < TAMANHO_PAGINA_IDS) break;
      de += TAMANHO_PAGINA_IDS;
    }
  }
  return unicos(ids);
}

async function idsDevedoresPorBusca(busca) {
  const termo = termoDeBusca(busca);
  return termo ? idsPorIlike('vw_devedores_resumo', 'busca', termo) : [];
}

async function idsDividasPorBusca(busca) {
  const termoCliente = termoDeBusca(busca);
  const termoLiteral = termoDescricao(busca);
  if (!termoCliente && !termoLiteral) return [];
  const idsClientes = await idsDevedoresPorBusca(busca);
  const [idsPorDescricao, idsPorCliente] = await Promise.all([
    idsPorIlike('vw_dividas_saldo', 'descricao', termoLiteral),
    idsDividasPorDevedores(idsClientes),
  ]);
  return unicos([...idsPorDescricao, ...idsPorCliente]);
}

async function nomesDevedores(ids) {
  const nomes = {};
  for (const chunk of emChunks(unicos(ids))) {
    const { data, error } = await supabase.from('vw_devedores_resumo')
      .select('id, nome_razao_social').in('id', chunk);
    if (error) throw error;
    for (const item of data ?? []) nomes[item.id] = item.nome_razao_social;
  }
  return nomes;
}

const compararValor = (a, b, asc, nullsFirst = false) => {
  const aNulo = a == null;
  const bNulo = b == null;
  if (aNulo || bNulo) {
    if (aNulo && bNulo) return 0;
    return aNulo === nullsFirst ? -1 : 1;
  }
  if (a === b) return 0;
  return (a < b ? -1 : 1) * (asc ? 1 : -1);
};

const compararDividas = (a, b, coluna, asc) => compararValor(a[coluna], b[coluna], asc, false) || compararValor(a.id, b.id, asc, false);
const ordenarDividas = (itens, coluna, asc) => [...itens].sort((a, b) => compararDividas(a, b, coluna, asc));

/** Mantém no máximo os primeiros `necessarios` registros de cada união. */
const adicionarLimitado = (destino, novos, necessarios, coluna, asc) => {
  if (!novos.length) return;
  destino.push(...novos);
  if (destino.length > necessarios) {
    destino.sort((a, b) => compararDividas(a, b, coluna, asc));
    destino.splice(necessarios);
  }
};

const criarConsultaDividas = ({ filtroStatus, coluna, asc, ids, devedores = false }) => {
  let q = supabase.from('vw_dividas_saldo').select(COLUNAS_LISTA, { count: 'exact' });
  if (filtroStatus) q = q.eq('status', filtroStatus);
  q = q.in(devedores ? 'devedor_id' : 'id', ids);
  return q.order(coluna, { ascending: asc, nullsFirst: false }).order('id', { ascending: asc });
};

/**
 * Busca cada bloco de ids com limite de candidatos suficiente para o merge global.
 * Se count não existir, repete páginas até uma página curta para não truncar total.
 * Em busca, o custo cresce com os ids encontrados (blocos de 200) e com a página
 * solicitada; a lista vazia continua usando uma única leitura paginada do banco.
 */
async function consultarPorIds(ids, { filtroStatus, coluna, asc, necessarios }) {
  const candidatos = [];
  let total = 0;
  for (const chunk of emChunks(unicos(ids))) {
    const quantidade = Math.max(1, Math.min(chunk.length, necessarios));
    const primeira = await criarConsultaDividas({ filtroStatus, coluna, asc, ids: chunk }).range(0, quantidade - 1);
    if (primeira.error) throw primeira.error;
    let linhas = primeira.data ?? [];
    let count = primeira.count;
    if (!temCount(count)) {
      linhas = [];
      let de = 0;
      for (;;) {
        const { data, error } = await criarConsultaDividas({ filtroStatus, coluna, asc, ids: chunk })
          .range(de, de + TAMANHO_CHUNK_IDS - 1);
        if (error) throw error;
        const pagina = data ?? [];
        linhas.push(...pagina);
        if (pagina.length < TAMANHO_CHUNK_IDS) break;
        de += TAMANHO_CHUNK_IDS;
      }
      count = linhas.length;
    }
    total += count;
    adicionarLimitado(candidatos, linhas, necessarios, coluna, asc);
  }
  return { candidatos, total };
}

async function consultaDireta({ filtroStatus, coluna, asc, numeroPagina, limite }) {
  const montar = (pg) => {
    let q = supabase.from('vw_dividas_saldo').select(COLUNAS_LISTA, { count: 'exact' });
    if (filtroStatus) q = q.eq('status', filtroStatus);
    const de = (pg - 1) * limite;
    return q.order(coluna, { ascending: asc, nullsFirst: false }).order('id', { ascending: asc })
      .range(de, de + limite - 1);
  };

  const primeira = await montar(numeroPagina);
  if (primeira.error?.code === 'PGRST103' && numeroPagina > 1) return consultaDireta({ filtroStatus, coluna, asc, numeroPagina: 1, limite });
  if (primeira.error) throw primeira.error;
  if (temCount(primeira.count)) {
    const total = primeira.count;
    const paginaFinal = total ? Math.min(numeroPagina, Math.ceil(total / limite)) : 1;
    if (paginaFinal !== numeroPagina) {
      const ultima = await montar(paginaFinal);
      if (ultima.error) throw ultima.error;
      return { data: ultima.data ?? [], total, pagina: paginaFinal };
    }
    return { data: primeira.data ?? [], total, pagina: numeroPagina };
  }

  // Fallback deliberado: sem count, só termina depois de uma página curta.
  const todas = [];
  let de = 0;
  for (;;) {
    const { data, error } = await montar(Math.floor(de / limite) + 1);
    if (error) throw error;
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < limite) break;
    de += limite;
  }
  const total = todas.length;
  const paginaFinal = total ? Math.min(numeroPagina, Math.ceil(total / limite)) : 1;
  return { data: todas.slice((paginaFinal - 1) * limite, paginaFinal * limite), total, pagina: paginaFinal };
}

/** Lista globalmente sem join relacional: saldo e nome são leituras RLS separadas. */
export async function listarPagina({ busca = '', status = '', ordem = 'recentes', pagina = 1, porPagina = 20 } = {}) {
  const pg = paginaValida(pagina);
  const limite = tamanhoValido(porPagina);
  const filtroStatus = STATUS.has(status) ? status : '';
  const [coluna, asc] = ORDENS[ordem] ?? ORDENS.recentes;
  const termo = termoDeBusca(busca);

  let itens;
  let total;
  let paginaFinal;
  if (!termo) {
    const resultado = await consultaDireta({ filtroStatus, coluna, asc, numeroPagina: pg, limite });
    itens = resultado.data;
    total = resultado.total;
    paginaFinal = resultado.pagina;
  } else {
    const ids = await idsDividasPorBusca(busca);
    if (!ids.length) return { itens: [], total: 0, pagina: 1, porPagina: limite };
    const resultado = await consultarPorIds(ids, {
      filtroStatus, coluna, asc, necessarios: pg * limite,
    });
    total = resultado.total;
    paginaFinal = total ? Math.min(pg, Math.ceil(total / limite)) : 1;
    const ordenados = ordenarDividas(resultado.candidatos, coluna, asc);
    itens = ordenados.slice((paginaFinal - 1) * limite, paginaFinal * limite);
  }

  const nomes = await nomesDevedores(itens.map((item) => item.devedor_id));
  return {
    itens: itens.map((item) => ({ ...item, devedor_nome: nomes[item.devedor_id] ?? null, nome_razao_social: nomes[item.devedor_id] ?? null })),
    total,
    pagina: paginaFinal,
    porPagina: limite,
  };
}

export const ORDENS_LISTA = ORDENS;
export const listarGlobal = listarPagina;

export async function listarPorDevedor(devedorId) {
  const { data, error } = await supabase.from('vw_dividas_saldo').select('*').eq('devedor_id', devedorId)
    .order('data_registro', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function obter(id) {
  const { data, error } = await supabase.from('vw_dividas_saldo').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function registrar({ devedorId, descricao, valorC, dataRegistro = null, vencimento = null, observacoes = null }) {
  const { data, error } = await supabase.rpc('registrar_divida', {
    p_devedor_id: devedorId, p_descricao: descricao, p_valor: centavosParaDecimal(valorC),
    p_data_registro: dataRegistro, p_vencimento: vencimento || null, p_observacoes: observacoes || null,
  });
  if (error) throw error;
  return data;
}

/** Campos editáveis sem efeito financeiro. Valor original: use alterarValor(). */
export async function editar(id, { descricao, observacoes, vencimento }) {
  const { data, error } = await supabase.from('dividas')
    .update({ descricao, observacoes: observacoes || null, data_vencimento: vencimento || null })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function alterarValor(id, valorC) {
  const { data, error } = await supabase.rpc('alterar_valor_divida', { p_divida_id: id, p_valor: centavosParaDecimal(valorC) });
  if (error) throw error;
  return data;
}
