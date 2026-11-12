import { supabase } from '../core/supabase.js';
import { ErroValidacao } from '../core/errors.js';
import { CATEGORIAS, validarArquivo, gerarCaminho } from '../utils/files.js';
import { obterLimitesUpload } from './configuracoes.js';

/**
 * Valida e envia um arquivo ao bucket privado da categoria.
 * `pasta` = id do devedor (foto/documento) ou id da dívida (comprovante) — exigido pelas constraints do banco.
 */
export async function enviarArquivo(categoria, pasta, file) {
  const limites = await obterLimitesUpload();
  const v = await validarArquivo(file, categoria, limites[categoria]);
  if (!v.valido) throw new ErroValidacao(v.erro);
  const path = gerarCaminho(pasta, v.extensao);
  const { error } = await supabase.storage.from(CATEGORIAS[categoria].bucket)
    .upload(path, file, { contentType: v.mime, upsert: false, cacheControl: '0' });
  if (error) throw error;
  return { path, nome_original: file.name, mime_type: v.mime, tamanho_bytes: file.size };
}

/** URL assinada de curta duração (padrão 60 s). Os buckets são privados. */
export async function urlAssinada(categoria, path, segundos = 60) {
  const { data, error } = await supabase.storage.from(CATEGORIAS[categoria].bucket).createSignedUrl(path, segundos);
  if (error) throw error;
  return data.signedUrl;
}

/** Só fotos podem ser apagadas do storage (troca de foto); documentos/comprovantes são preservados. */
export async function removerFoto(path) {
  const { error } = await supabase.storage.from(CATEGORIAS.foto.bucket).remove([path]);
  if (error) throw error;
}

/** Várias URLs assinadas de uma vez (miniaturas da lista). Retorna { path: signedUrl }; itens com erro ficam de fora. */
export async function urlsAssinadas(categoria, paths, segundos = 300) {
  const { data, error } = await supabase.storage.from(CATEGORIAS[categoria].bucket).createSignedUrls(paths, segundos);
  if (error) throw error;
  return Object.fromEntries(data.filter((i) => i.signedUrl && !i.error).map((i) => [i.path, i.signedUrl]));
}
