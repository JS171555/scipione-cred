import { supabase } from '../core/supabase.js';
import { centavosParaDecimal } from '../utils/money.js';

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
