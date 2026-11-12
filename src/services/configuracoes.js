import { supabase } from '../core/supabase.js';
import { CATEGORIAS } from '../utils/files.js';

let cache; let cacheEm = 0;

/** Limites de upload em bytes por categoria (tabela `configuracoes`); usa o padrão se indisponível. */
export async function obterLimitesUpload() {
  if (cache && Date.now() - cacheEm < 300_000) return cache;
  const limites = Object.fromEntries(Object.entries(CATEGORIAS).map(([k, v]) => [k, v.limitePadrao]));
  const { data } = await supabase.from('configuracoes').select('chave, valor');
  for (const [cat, regra] of Object.entries(CATEGORIAS)) {
    const linha = data?.find((l) => l.chave === regra.chaveLimite);
    if (linha && Number.isFinite(Number(linha.valor))) limites[cat] = Number(linha.valor);
  }
  cache = limites; cacheEm = Date.now();
  return limites;
}
