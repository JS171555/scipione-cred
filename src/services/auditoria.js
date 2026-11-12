import { supabase } from '../core/supabase.js';

const COLUNAS = 'id, usuario_id, operacao, entidade, entidade_id, devedor_id, dados_antes, dados_depois, created_at';

/** Histórico de movimentações de um devedor (mais recentes primeiro). */
export async function listarPorDevedor(devedorId, { limite = 10, offset = 0 } = {}) {
  const { data, error } = await supabase.from('auditoria').select(COLUNAS).eq('devedor_id', devedorId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limite - 1);
  if (error) throw error;
  return data;
}

/** Atividade recente de toda a operação (dashboard). */
export async function listarRecentes(limite = 10) {
  const { data, error } = await supabase.from('auditoria').select(COLUNAS)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limite);
  if (error) throw error;
  return data;
}
