// Validação de arquivos: extensão + MIME + assinatura binária (magic bytes) + tamanho.
const MB = 1024 * 1024;
const IMG = ['png', 'jpg', 'jpeg', 'avif'];
const FOTO = [...IMG, 'webp'];
const DOC = [...FOTO, 'pdf'];

export const MIME_POR_EXTENSAO = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', webp: 'image/webp', pdf: 'application/pdf',
};

export const CATEGORIAS = {
  foto:        { bucket: 'fotos-devedores',         extensoes: FOTO, chaveLimite: 'upload.foto_max_bytes',       limitePadrao: 5 * MB },
  documento:   { bucket: 'documentos-devedores',    extensoes: DOC, chaveLimite: 'upload.documento_max_bytes',   limitePadrao: 10 * MB },
  comprovante: { bucket: 'comprovantes-pagamentos', extensoes: DOC, chaveLimite: 'upload.comprovante_max_bytes', limitePadrao: 10 * MB },
};

export function extensaoDe(nome) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(nome ?? ''));
  return m ? m[1].toLowerCase() : '';
}

const bytesIniciam = (b, sig, off = 0) => sig.every((v, i) => b[off + i] === v);

export function assinaturaCompativel(bytes, ext) {
  const b = Array.from(bytes);
  switch (MIME_POR_EXTENSAO[ext]) {
    case 'image/png': return bytesIniciam(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg': return bytesIniciam(b, [0xff, 0xd8, 0xff]);
    case 'application/pdf': return bytesIniciam(b, [0x25, 0x50, 0x44, 0x46]);
    case 'image/webp': return bytesIniciam(b, [0x52, 0x49, 0x46, 0x46]) && bytesIniciam(b, [0x57, 0x45, 0x42, 0x50], 8);
    case 'image/avif': return bytesIniciam(b, [0x66, 0x74, 0x79, 0x70], 4) && /avi[fs]/.test(String.fromCharCode(...b.slice(8, 12)));
    default: return false;
  }
}

export function formatarTamanho(bytes) {
  return bytes >= MB ? `${(bytes / MB).toFixed(bytes % MB ? 1 : 0)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** @returns {Promise<{valido: boolean, erro?: string, extensao?: string, mime?: string}>} */
export async function validarArquivo(file, categoria, limiteBytes) {
  const regra = CATEGORIAS[categoria];
  if (!regra) return { valido: false, erro: 'Categoria de arquivo desconhecida.' };
  if (!file || typeof file.size !== 'number') return { valido: false, erro: 'Selecione um arquivo.' };
  const ext = extensaoDe(file.name);
  if (!regra.extensoes.includes(ext)) {
    return { valido: false, erro: `Formato não permitido. Aceitos: ${regra.extensoes.map((e) => e.toUpperCase()).join(', ')}.` };
  }
  const mime = MIME_POR_EXTENSAO[ext];
  if (file.type && file.type !== mime) return { valido: false, erro: 'O tipo do arquivo não corresponde à extensão.' };
  if (file.size <= 0) return { valido: false, erro: 'O arquivo está vazio.' };
  const limite = Number.isFinite(limiteBytes) ? limiteBytes : regra.limitePadrao;
  if (file.size > limite) return { valido: false, erro: `Arquivo acima do limite de ${formatarTamanho(limite)}.` };
  const cabeca = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!assinaturaCompativel(cabeca, ext)) return { valido: false, erro: 'O conteúdo do arquivo não corresponde ao formato informado.' };
  return { valido: true, extensao: ext, mime };
}

/** Caminho no bucket: {pasta}/{uuid}.{ext}. Nunca usa o nome enviado pelo usuário. */
export function gerarCaminho(pasta, ext, uuid = crypto.randomUUID()) {
  return `${pasta}/${uuid}.${ext}`;
}
