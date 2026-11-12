import { supabase } from '../core/supabase.js';

export async function obterIndicadores() {
  const { data, error } = await supabase.from('vw_dashboard').select('*').single();
  if (error) throw error;
  return data;
}

export async function ultimosCadastros(limite = 5) {
  const { data, error } = await supabase.from('vw_devedores_resumo')
    .select('id, tipo_pessoa, nome_razao_social, status, created_at, total_em_aberto')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limite);
  if (error) throw error;
  return data;
}
