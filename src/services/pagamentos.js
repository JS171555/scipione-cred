import { supabase } from '../core/supabase.js';
import { centavosParaDecimal } from '../utils/money.js';
import { enviarArquivo, urlAssinada } from './storage.js';
import { termoDeBusca } from './devedores.js';

const COLUNAS = 'id, divida_id, valor, data_pagamento, observacao, comprovante_path, status, estornado_em, motivo_estorno, created_at';
const ORDENS = {
  recentes: ['data_pagamento', false], antigos: ['data_pagamento', true],
  data_desc: ['data_pagamento', false], data_asc: ['data_pagamento', true],
};
const STATUS = new Set(['', 'valido', 'estornado']);
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
 * Busca textual por parâmetro ilike. O termo pode conter vírgula, parênteses,
 * barra invertida ou curingas escapados sem jamais entrar na gramática de .or().
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

/** Usa somente ids de devedores em in(), sempre em blocos de no máximo 200. */
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

/** Resolve nome/descrição sem buscar pagamentos quando a busca está vazia. */
async function contextoDividasPorBusca(busca) {
  const termoCliente = termoDeBusca(busca);
  const termoLiteral = termoDescricao(busca);
  if (!termoCliente && !termoLiteral) return [];
  const idsClientes = termoCliente ? await idsPorIlike('vw_devedores_resumo', 'busca', termoCliente) : [];
  const [idsPorDescricao, idsPorCliente] = await Promise.all([
    idsPorIlike('vw_dividas_saldo', 'descricao', termoLiteral),
    idsDividasPorDevedores(idsClientes),
  ]);
  return unicos([...idsPorDescricao, ...idsPorCliente]);
}

async function contextoDividas(ids) {
  const dados = [];
  for (const chunk of emChunks(unicos(ids))) {
    const { data, error } = await supabase.from('vw_dividas_saldo')
      .select('id, devedor_id, descricao, saldo, status').in('id', chunk);
    if (error) throw error;
    dados.push(...(data ?? []));
  }

  const clientes = unicos(dados.map((item) => item.devedor_id));
  const nomes = {};
  for (const chunk of emChunks(clientes)) {
    const resposta = await supabase.from('vw_devedores_resumo')
      .select('id, nome_razao_social').in('id', chunk);
    if (resposta.error) throw resposta.error;
    for (const item of resposta.data ?? []) nomes[item.id] = item.nome_razao_social;
  }
  return Object.fromEntries(dados.map((item) => [item.id, {
    ...item,
    devedor_nome: nomes[item.devedor_id] ?? null,
    nome_razao_social: nomes[item.devedor_id] ?? null,
  }]));
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

const compararPagamentos = (a, b, coluna, asc) =>
  compararValor(a[coluna], b[coluna], asc, false)
  || compararValor(a.created_at, b.created_at, asc, false)
  || compararValor(a.id, b.id, asc, false);
const ordenarPagamentos = (itens, coluna, asc) => [...itens].sort((a, b) => compararPagamentos(a, b, coluna, asc));

const adicionarLimitado = (destino, novos, necessarios, coluna, asc) => {
  if (!novos.length) return;
  destino.push(...novos);
  if (destino.length > necessarios) {
    destino.sort((a, b) => compararPagamentos(a, b, coluna, asc));
    destino.splice(necessarios);
  }
};

const criarConsultaPagamentos = ({ filtroStatus, coluna, asc, ids }) => {
  let q = supabase.from('pagamentos').select(COLUNAS, { count: 'exact' });
  if (filtroStatus) q = q.eq('status', filtroStatus);
  q = q.in('divida_id', ids);
  return q.order(coluna, { ascending: asc }).order('created_at', { ascending: asc }).order('id', { ascending: asc });
};

/**
 * Consulta cada bloco de dívidas. O merge mantém só os primeiros registros
 * necessários à página, mas soma counts de todos os blocos para total exato.
 * Sem count, a leitura cai para páginas até uma página curta.
 * Em buscas grandes, o custo é proporcional aos ids de dívidas encontrados,
 * em blocos de 200, e à página pedida; busca vazia nunca carrega o histórico inteiro.
 */
async function consultarPorDividas(ids, { filtroStatus, coluna, asc, necessarios }) {
  const candidatos = [];
  let total = 0;
  for (const chunk of emChunks(unicos(ids))) {
    const quantidade = Math.max(1, Math.min(TAMANHO_CHUNK_IDS, necessarios));
    const primeira = await criarConsultaPagamentos({ filtroStatus, coluna, asc, ids: chunk }).range(0, quantidade - 1);
    if (primeira.error) throw primeira.error;
    let linhas = primeira.data ?? [];
    let count = primeira.count;
    if (!temCount(count)) {
      linhas = [];
      let de = 0;
      for (;;) {
        const { data, error } = await criarConsultaPagamentos({ filtroStatus, coluna, asc, ids: chunk })
          .range(de, de + TAMANHO_PAGINA_IDS - 1);
        if (error) throw error;
        const pagina = data ?? [];
        linhas.push(...pagina);
        if (pagina.length < TAMANHO_PAGINA_IDS) break;
        de += TAMANHO_PAGINA_IDS;
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
    let q = supabase.from('pagamentos').select(COLUNAS, { count: 'exact' });
    if (filtroStatus) q = q.eq('status', filtroStatus);
    const de = (pg - 1) * limite;
    return q.order(coluna, { ascending: asc }).order('created_at', { ascending: asc }).order('id', { ascending: asc })
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

  // Sem count, percorre desde o início até uma página curta; nunca aceita o primeiro lote como total.
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

/**
 * Histórico global paginado. A busca só lê ids de clientes/dívidas e depois
 * pagamentos nos blocos correspondentes; com busca vazia não há carga integral.
 * Estornados permanecem visíveis e filtráveis.
 */
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
    const idsDividas = await contextoDividasPorBusca(busca);
    if (!idsDividas.length) return { itens: [], total: 0, pagina: 1, porPagina: limite };
    const resultado = await consultarPorDividas(idsDividas, {
      filtroStatus, coluna, asc, necessarios: pg * limite,
    });
    total = resultado.total;
    paginaFinal = total ? Math.min(pg, Math.ceil(total / limite)) : 1;
    const ordenados = ordenarPagamentos(resultado.candidatos, coluna, asc);
    itens = ordenados.slice((paginaFinal - 1) * limite, paginaFinal * limite);
  }

  const contexto = await contextoDividas(itens.map((item) => item.divida_id));
  return {
    itens: itens.map((item) => ({ ...item, ...(contexto[item.divida_id] ?? {}), divida_descricao: contexto[item.divida_id]?.descricao ?? null })),
    total,
    pagina: paginaFinal,
    porPagina: limite,
  };
}

export const ORDENS_LISTA = ORDENS;
export const listarGlobal = listarPagina;

export async function listarPorDivida(dividaId) {
  const { data, error } = await supabase.from('pagamentos').select(COLUNAS).eq('divida_id', dividaId)
    .order('data_pagamento', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Histórico financeiro do devedor (todas as dívidas), inclusive estornados. */
export async function listarPorDevedor(devedorId) {
  const { data, error } = await supabase.from('pagamentos').select(`${COLUNAS}, dividas!inner(devedor_id)`)
    .eq('dividas.devedor_id', devedorId)
    .order('data_pagamento', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(({ dividas, ...p }) => p);
}

/**
 * `chave` deve ser gerada uma vez por abertura do formulário (reenvio/duplo clique não duplica o pagamento).
 * O comprovante (opcional) é validado e enviado antes; se o banco recusar, o arquivo fica órfão (buckets não permitem apagar).
 */
export async function registrar({ dividaId, valorC, data = null, observacao = null, arquivo = null, chave = crypto.randomUUID() }) {
  const comprovante = arquivo ? await enviarArquivo('comprovante', dividaId, arquivo) : null;
  const { data: pagamento, error } = await supabase.rpc('registrar_pagamento', {
    p_divida_id: dividaId, p_valor: centavosParaDecimal(valorC), p_data: data,
    p_observacao: observacao || null, p_comprovante_path: comprovante?.path ?? null, p_chave: chave,
  });
  if (error) throw error;
  return pagamento;
}

export async function estornar(id, motivo) {
  const { data, error } = await supabase.rpc('estornar_pagamento', { p_pagamento_id: id, p_motivo: motivo });
  if (error) throw error;
  return data;
}

export const urlComprovante = (path) => urlAssinada('comprovante', path, 60);
