import { supabase } from '../core/supabase.js';
import { centavosParaDecimal } from '../utils/money.js';
import { enviarArquivo, urlAssinada } from './storage.js';

const COLUNAS = 'id, divida_id, valor, data_pagamento, observacao, comprovante_path, status, estornado_em, motivo_estorno, created_at';

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
