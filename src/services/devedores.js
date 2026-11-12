import { supabase } from '../core/supabase.js';
import { apenasDigitos } from '../utils/cpf-cnpj.js';
import { enviarArquivo, urlAssinada, urlsAssinadas, removerFoto } from './storage.js';

const COLUNAS_LISTA = 'id, tipo_pessoa, nome_razao_social, cpf_cnpj, telefone, celular, status, foto_path, created_at, total_em_aberto, qtd_dividas_abertas, qtd_dividas_quitadas';

/** Termo → padrão para a coluna `busca` (sem acento, minúsculo; só dígitos quando parece documento/telefone). */
export function termoDeBusca(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return '';
  const base = /^[\d.\-/() ]+$/.test(t) ? apenasDigitos(t) : t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
  return base.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listar({ busca = '', limite = 200 } = {}) {
  let q = supabase.from('vw_devedores_resumo').select(COLUNAS_LISTA).order('nome_razao_social').limit(limite);
  const termo = termoDeBusca(busca);
  if (termo) q = q.ilike('busca', `%${termo}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function obter(id) {
  const { data, error } = await supabase.from('vw_devedores_resumo').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (data) delete data.busca;
  return data;
}

export async function criar(dados) {
  const { data, error } = await supabase.from('devedores').insert(dados).select().single();
  if (error) throw error;
  return data;
}

export async function atualizar(id, dados) {
  const { data, error } = await supabase.from('devedores').update(dados).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Sem `confirmar`, inativar com dívidas em aberto devolve { requer_confirmacao: true, qtd_dividas_abertas, valor_em_aberto }. */
export async function alterarStatus(id, status, confirmar = false) {
  const { data, error } = await supabase.rpc('alterar_status_devedor', { p_devedor_id: id, p_status: status, p_confirmar: confirmar });
  if (error) throw error;
  return data;
}

/** Envia a nova foto, aponta o cadastro para ela e só então remove a anterior. */
export async function definirFoto(id, file, fotoAnterior = null) {
  const up = await enviarArquivo('foto', id, file);
  const { error } = await supabase.from('devedores').update({ foto_path: up.path }).eq('id', id);
  if (error) { await removerFoto(up.path).catch(() => {}); throw error; }
  if (fotoAnterior) await removerFoto(fotoAnterior).catch(() => {});
  return up.path;
}

export const urlFoto = (path) => urlAssinada('foto', path, 300);

export const ORDENS = {
  nome_asc: ['nome_razao_social', true], nome_desc: ['nome_razao_social', false],
  recentes: ['created_at', false], antigos: ['created_at', true],
};

/**
 * Listagem paginada no banco (busca, filtros e ordenação).
 * status: 'ativo' | 'inativo' | ''  ·  situacao: 'em_aberto' (tem dívida em aberto) | 'quitados' (sem dívida em aberto e com ao menos uma quitada) | ''
 */
export async function listarPagina({ busca = '', status = '', situacao = '', ordem = 'nome_asc', pagina = 1, porPagina = 20 } = {}) {
  const [coluna, asc] = ORDENS[ordem] ?? ORDENS.nome_asc;
  const consulta = (pg) => {
    let q = supabase.from('vw_devedores_resumo').select(COLUNAS_LISTA, { count: 'exact' });
    const termo = termoDeBusca(busca);
    if (termo) q = q.ilike('busca', `%${termo}%`);
    if (status) q = q.eq('status', status);
    if (situacao === 'em_aberto') q = q.gt('qtd_dividas_abertas', 0);
    if (situacao === 'quitados') q = q.eq('qtd_dividas_abertas', 0).gt('qtd_dividas_quitadas', 0);
    const de = (pg - 1) * porPagina;
    return q.order(coluna, { ascending: asc }).order('id', { ascending: asc }).range(de, de + porPagina - 1);
  };
  let { data, error, count } = await consulta(pagina);
  if (error?.code === 'PGRST103' && pagina > 1) {           // página além do fim (ex.: filtro reduziu o total)
    const primeira = await consulta(1);
    if (primeira.error) throw primeira.error;
    return listarPagina({ busca, status, situacao, ordem, pagina: Math.max(1, Math.ceil((primeira.count ?? 0) / porPagina)), porPagina });
  }
  if (error) throw error;
  return { itens: data, total: count ?? data.length, pagina, porPagina };
}

/** Nomes de vários devedores de uma vez: { id: nome }. */
export async function nomesPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return {};
  const { data, error } = await supabase.from('vw_devedores_resumo').select('id, nome_razao_social').in('id', unicos);
  if (error) throw error;
  return Object.fromEntries(data.map((d) => [d.id, d.nome_razao_social]));
}

/** URLs assinadas das fotos em lote: { path: url } (falhas são ignoradas). */
export async function urlsFotos(paths) {
  const validos = [...new Set(paths.filter(Boolean))];
  return validos.length ? urlsAssinadas('foto', validos, 300) : {};
}
