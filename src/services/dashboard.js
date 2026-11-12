import { supabase } from '../core/supabase.js';
import { paraCentavos } from '../utils/money.js';

const POR_PAGINA_TOTAIS = 1000;

export async function obterIndicadores() {
  const { data, error } = await supabase.from('vw_dashboard').select('*').single();
  if (error) throw error;
  return data;
}

/**
 * Soma os valores financeiros de todos os devedores, em páginas completas.
 * A consulta seleciona somente colunas financeiras da view, ordena por id e
 * continua até uma página curta; `count` não é usado como atalho que possa
 * silenciar registros quando a resposta estiver limitada pelo PostgREST.
 */
export async function obterTotaisFinanceiros({ porPagina = POR_PAGINA_TOTAIS } = {}) {
  const tamanho = Math.max(1, Math.min(1000, Number(porPagina) || POR_PAGINA_TOTAIS));
  let pagina = 0;
  let totalRegistradoC = 0;
  let totalRecebidoC = 0;
  let totalEmAbertoC = 0;

  for (;;) {
    const de = pagina * tamanho;
    const { data, error } = await supabase
      .from('vw_devedores_resumo')
      .select('total_registrado,total_pago,total_em_aberto', { count: 'exact' })
      .order('id', { ascending: true })
      .range(de, de + tamanho - 1);
    if (error) throw error;

    const itens = data ?? [];
    for (const item of itens) {
      totalRegistradoC += paraCentavos(item.total_registrado);
      totalRecebidoC += paraCentavos(item.total_pago);
      totalEmAbertoC += paraCentavos(item.total_em_aberto);
    }
    pagina += 1;
    if (itens.length < tamanho) break;
  }

  return {
    totalRegistradoC,
    totalRecebidoC,
    totalEmAbertoC,
    // Nomes decimais também são expostos para consumidores do formato do PostgREST.
    total_registrado: totalRegistradoC / 100,
    total_recebido: totalRecebidoC / 100,
    total_em_aberto: totalEmAbertoC / 100,
  };
}

export async function ultimosCadastros(limite = 5) {
  const { data, error } = await supabase.from('vw_devedores_resumo')
    .select('id, tipo_pessoa, nome_razao_social, status, created_at, total_em_aberto')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limite);
  if (error) throw error;
  return data;
}
