import { supabase } from '../core/supabase.js';
import { ErroValidacao } from '../core/errors.js';
import { CATEGORIAS, validarArquivo, gerarCaminho } from '../utils/files.js';
import { prepararArquivo } from '../utils/midia.js';
import { obterLimitesUpload } from './configuracoes.js';

/** O bucket recusa o formato novo quando a migração de MIME ainda não foi aplicada. */
function formatoRecusado(erro) {
  const texto = `${erro?.message ?? ''} ${erro?.error ?? ''} ${erro?.statusCode ?? ''}`.toLowerCase();
  return /mime|content-type|\b415\b/.test(texto);
}

/**
 * Valida e envia um arquivo ao bucket privado da categoria.
 * `pasta` = id do devedor (foto/documento) ou id da dívida (comprovante) — exigido pelas constraints do banco.
 * Imagens são convertidas para WebP e PDFs reotimizados antes do envio; se a conversão falhar ou não reduzir
 * o arquivo, o original é enviado. Bucket sem o formato novo também volta ao original.
 */
export async function enviarArquivo(categoria, pasta, file) {
  const limites = await obterLimitesUpload();
  const v = await validarArquivo(file, categoria, limites[categoria]);
  if (!v.valido) throw new ErroValidacao(v.erro);
  const preparado = await prepararArquivo(file, categoria);
  const final = preparado.convertido ? await validarArquivo(preparado.arquivo, categoria, limites[categoria]) : v;
  if (!final.valido) throw new ErroValidacao(final.erro);

  const bucket = supabase.storage.from(CATEGORIAS[categoria].bucket);
  const enviar = (escolhido) => {
    const path = gerarCaminho(pasta, escolhido.extensao);
    return bucket.upload(path, escolhido.arquivo, { contentType: escolhido.mime, upsert: false, cacheControl: '0' })
      .then(({ error }) => ({ error, path }));
  };

  let escolhido = { ...final, arquivo: preparado.arquivo };
  let { error, path } = await enviar(escolhido);
  if (error && preparado.convertido && formatoRecusado(error)) {
    escolhido = { ...v, arquivo: file };
    ({ error, path } = await enviar(escolhido));
  }
  if (error) throw error;
  return { path, nome_original: escolhido.arquivo.name, mime_type: escolhido.mime, tamanho_bytes: escolhido.arquivo.size };
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
