// Conversão antes do upload: imagens viram WebP e PDFs são reotimizados sem perda.
// Qualquer falha (navegador sem canvas, arquivo corrompido, PDF protegido) mantém o original.
import { extensaoDe } from './files.js';

export const MIME_WEBP = 'image/webp';
const IMAGENS = new Set(['png', 'jpg', 'jpeg', 'avif', 'webp']);
const AJUSTES = {
  foto: { lado: 1600, qualidade: 0.82 },
  documento: { lado: 2200, qualidade: 0.85 },
  comprovante: { lado: 2200, qualidade: 0.85 },
};
const AJUSTE_PADRAO = { lado: 2000, qualidade: 0.85 };
/** PDFs só são substituídos quando a economia passa de 3% (evita reescrever arquivos por nada). */
const GANHO_MINIMO_PDF = 0.03;
const LIMITE_DECODIFICACAO_MS = 8000;
const JANELA_ASSINATURA = 1 << 20;

/** PDFs com assinatura digital são preservados: reescrever o arquivo invalidaria a assinatura. */
function pdfAssinado(bytes) {
  try {
    const decodificador = new TextDecoder('latin1');
    const inicio = decodificador.decode(bytes.slice(0, Math.min(bytes.length, JANELA_ASSINATURA)));
    const fim = bytes.length > JANELA_ASSINATURA ? decodificador.decode(bytes.slice(-JANELA_ASSINATURA)) : '';
    return /\/ByteRange|\/Type\s*\/Sig/.test(inicio + fim);
  } catch {
    return true;
  }
}

/** Troca a extensão preservando o nome base do arquivo enviado pelo usuário. */
export function nomeComExtensao(nome, ext) {
  const base = String(nome ?? '').replace(/\.[^./\\]+$/, '').trim();
  return `${base || 'arquivo'}.${ext}`;
}

/** Reduz o maior lado até `ladoMaximo` sem ampliar imagens menores nem distorcer a proporção. */
export function dimensoesAlvo(largura, altura, ladoMaximo) {
  const l = Math.max(1, Math.round(Number(largura) || 0));
  const a = Math.max(1, Math.round(Number(altura) || 0));
  const maior = Math.max(l, a);
  if (!maior || !Number.isFinite(ladoMaximo) || maior <= ladoMaximo) return { largura: l, altura: a };
  const escala = ladoMaximo / maior;
  return { largura: Math.max(1, Math.round(l * escala)), altura: Math.max(1, Math.round(a * escala)) };
}

/** true quando o canvas 2D está disponível para decodificar e recodificar a imagem. */
export function suportaCanvas() {
  if (typeof OffscreenCanvas === 'function') return true;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext?.('2d'));
  } catch {
    return false;
  }
}

function comLimiteDeTempo(promessa, ms) {
  return new Promise((resolve) => {
    let encerrado = false;
    const fim = setTimeout(() => { if (!encerrado) { encerrado = true; resolve(null); } }, ms);
    promessa.then((valor) => { if (!encerrado) { encerrado = true; clearTimeout(fim); resolve(valor); } })
      .catch(() => { if (!encerrado) { encerrado = true; clearTimeout(fim); resolve(null); } });
  });
}

async function decodificarImagem(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* opção não suportada */ }
    try { return await createImageBitmap(blob); } catch { return null; }
  }
  if (typeof Image === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const imagem = await comLimiteDeTempo(new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }), LIMITE_DECODIFICACAO_MS);
    URL.revokeObjectURL(url);
    return imagem;
  }
  return null;
}

async function codificarWebp(origem, { lado, qualidade }) {
  const larguraOrigem = origem.width || origem.naturalWidth || 0;
  const alturaOrigem = origem.height || origem.naturalHeight || 0;
  if (!larguraOrigem || !alturaOrigem) return null;
  const { largura, altura } = dimensoesAlvo(larguraOrigem, alturaOrigem, lado);
  let canvas = null;
  if (typeof OffscreenCanvas === 'function') canvas = new OffscreenCanvas(largura, altura);
  else if (typeof document !== 'undefined') { canvas = document.createElement('canvas'); canvas.width = largura; canvas.height = altura; }
  if (!canvas) return null;
  const contexto = canvas.getContext?.('2d');
  if (!contexto) return null;
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(origem, 0, 0, largura, altura);
  if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: MIME_WEBP, quality: qualidade });
  if (typeof canvas.toBlob === 'function') {
    return comLimiteDeTempo(new Promise((resolve) => {
      try { canvas.toBlob((blob) => resolve(blob), MIME_WEBP, qualidade); } catch { resolve(null); }
    }), LIMITE_DECODIFICACAO_MS);
  }
  return null;
}

/**
 * Converte uma imagem para WebP reduzindo o maior lado quando necessário.
 * Devolve `null` quando o navegador não codifica WebP ou quando o resultado não é menor.
 */
export async function converterImagemParaWebp(file, { lado, qualidade } = {}) {
  if (!file || !suportaCanvas()) return null;
  const origem = await decodificarImagem(file);
  if (!origem) return null;
  try {
    const blob = await codificarWebp(origem, { lado: lado ?? AJUSTE_PADRAO.lado, qualidade: qualidade ?? AJUSTE_PADRAO.qualidade });
    if (!blob || blob.type !== MIME_WEBP || !blob.size) return null;
    if (blob.size >= file.size) return null;
    return new File([blob], nomeComExtensao(file.name, 'webp'), { type: MIME_WEBP, lastModified: Date.now() });
  } catch {
    return null;
  } finally {
    origem.close?.();
  }
}

/**
 * Reotimiza PDFs sem perda: reescreve o arquivo com object streams e remove metadados duplicados.
 * PDFs digitalizados (já compostos por JPEG) quase não mudam e o original é mantido.
 */
export async function otimizarPdf(file) {
  if (!file) return null;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const original = new Uint8Array(await file.arrayBuffer());
    if (pdfAssinado(original)) return null;
    const doc = await PDFDocument.load(original, { updateMetadata: false, throwOnInvalidObject: false });
    const saida = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    if (!saida?.length || saida.length > file.size * (1 - GANHO_MINIMO_PDF)) return null;
    return new File([saida], file.name, { type: 'application/pdf', lastModified: Date.now() });
  } catch {
    return null;
  }
}

/**
 * Prepara o arquivo para o storage: WebP para imagens, reotimização para PDF.
 * Sempre devolve um arquivo utilizável — em caso de falha, o próprio original.
 */
export async function prepararArquivo(file, categoria) {
  const ext = extensaoDe(file?.name);
  try {
    if (IMAGENS.has(ext) && ext !== 'webp') {
      const ajuste = AJUSTES[categoria] ?? AJUSTE_PADRAO;
      const convertido = await converterImagemParaWebp(file, ajuste);
      if (convertido) return { arquivo: convertido, convertido: true, formato: 'webp' };
    }
    if (ext === 'pdf') {
      const otimizado = await otimizarPdf(file);
      if (otimizado) return { arquivo: otimizado, convertido: true, formato: 'pdf' };
    }
  } catch {
    /* conversão é otimização: nunca bloqueia o upload */
  }
  return { arquivo: file, convertido: false, formato: ext };
}
