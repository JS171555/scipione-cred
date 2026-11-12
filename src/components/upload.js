import { esc } from '../core/dom.js';
import { CATEGORIAS, formatarTamanho, validarArquivo } from '../utils/files.js';
import { obterLimitesUpload } from '../services/configuracoes.js';

const nomes = {
  foto: 'PNG, JPG, JPEG ou AVIF',
  documento: 'PNG, JPG, JPEG, AVIF, WEBP ou PDF',
  comprovante: 'PNG, JPG, JPEG, AVIF, WEBP ou PDF',
};

const extensoes = (categoria) => (CATEGORIAS[categoria]?.extensoes ?? []).map((x) => x.toUpperCase()).join(', ');

/** HTML do campo; a validação final continua no serviço para preservar a segurança. */
export function uploadField({ id, label = 'Arquivo', categoria, accept, multiple = false, help = '', required = false } = {}) {
  const regra = CATEGORIAS[categoria];
  const aceite = accept ?? regra?.extensoes?.map((x) => `.${x}`).join(',') ?? '';
  const formatos = nomes[categoria] ?? extensoes(categoria);
  const inputAttrs = `${multiple ? ' multiple' : ''}${required ? ' required' : ''}`;
  return `<div class="upload-field" id="${esc(id)}-field" data-upload-category="${esc(categoria ?? '')}">
    <label for="${esc(id)}" class="upload-label"><span>${esc(label)}</span>
      <input id="${esc(id)}" type="file" accept="${esc(aceite)}"${inputAttrs}>
    </label>
    <div class="upload-preview" id="${esc(id)}-preview" hidden aria-live="polite"></div>
    <button type="button" class="btn sec peq upload-remove" data-upload-remove hidden>Remover seleção</button>
    <div class="upload-meta" id="${esc(id)}-meta">${esc(help || `Formatos: ${formatos}. Limite definido pela configuração.`)}</div>
    <p class="upload-error erro-campo" id="${esc(id)}-erro" role="alert" hidden></p>
  </div>`;
}

export const renderUploadField = uploadField;

function arquivosDoInput(input) {
  return Array.from(input?.files ?? []);
}

function mesmosArquivos(a, b) {
  if (a.length !== b.length) return false;
  return a.every((arquivo, i) => {
    const outro = b[i];
    return arquivo === outro || (arquivo?.name === outro?.name && arquivo?.size === outro?.size && arquivo?.type === outro?.type && arquivo?.lastModified === outro?.lastModified);
  });
}

function revogarBlobUrls(estado) {
  if (!estado?.blobUrls?.length) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    for (const url of estado.blobUrls) URL.revokeObjectURL(url);
  }
  estado.blobUrls = [];
}

function limparPreview(input) {
  const campo = input.closest('.upload-field') ?? input.parentElement;
  const preview = campo?.querySelector('.upload-preview');
  const meta = campo?.querySelector('.upload-meta');
  const remove = campo?.querySelector('[data-upload-remove]');
  const erro = campo?.querySelector('.upload-error');
  if (preview) { preview.hidden = true; preview.replaceChildren(); }
  if (remove) remove.hidden = true;
  if (erro) { erro.hidden = true; erro.textContent = ''; }
  return { campo, meta };
}

function mostrarPreview(input, files, estado) {
  const { campo, meta } = limparPreview(input);
  const preview = campo?.querySelector('.upload-preview');
  if (!preview || !meta) return;
  preview.hidden = !files.length;
  const remove = campo.querySelector('[data-upload-remove]');
  if (remove) remove.hidden = !files.length;
  if (!files.length) {
    meta.textContent = `Formatos: ${nomes[input.dataset.uploadCategory] ?? ''}. Selecione um arquivo.`;
    return;
  }
  const lista = document.createElement('div');
  lista.className = 'upload-preview-list';
  const blobUrls = [];
  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';
    if (file.type?.startsWith('image/') && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const img = document.createElement('img');
      img.className = 'upload-preview-image';
      img.alt = `Prévia de ${file.name}`;
      const url = URL.createObjectURL(file);
      blobUrls.push(url);
      img.src = url;
      item.append(img);
    }
    const detalhes = document.createElement('span');
    detalhes.className = 'upload-preview-name';
    detalhes.textContent = `${file.name} · ${formatarTamanho(file.size)}`;
    item.append(detalhes);
    lista.append(item);
  }
  preview.append(lista);
  if (estado) estado.blobUrls = blobUrls;
  meta.textContent = `${files.length} arquivo${files.length === 1 ? '' : 's'} selecionado${files.length === 1 ? '' : 's'} · ${files.map((f) => formatarTamanho(f.size)).join(', ')}`;
}

function erroUpload(input, texto, estado) {
  const { campo, meta } = limparPreview(input);
  const erro = campo?.querySelector('.upload-error');
  revogarBlobUrls(estado);
  input.setAttribute('aria-invalid', 'true');
  campo?.setAttribute('data-upload-state', 'error');
  if (meta) meta.textContent = 'Seleção recusada. Escolha outro arquivo.';
  if (erro) { erro.textContent = texto; erro.hidden = false; }
}

/** Valida os arquivos selecionados usando extensão, MIME, assinatura e limite configurado. */
export async function validarUpload(input, categoria, limiteBytes, arquivos = arquivosDoInput(input)) {
  const limite = Number.isFinite(limiteBytes) ? limiteBytes : (await obterLimitesUpload())[categoria];
  const validos = [];
  for (const file of arquivos) {
    const resultado = await validarArquivo(file, categoria, limite);
    if (!resultado.valido) return { valido: false, arquivos: [], erro: resultado.erro, limite };
    validos.push(file);
  }
  return { valido: true, arquivos: validos, limite };
}

function resultadoDeErro(e) {
  return { valido: false, arquivos: [], erro: e?.message ?? 'Não foi possível validar o arquivo.' };
}

function prometerResultado(resultado) {
  return Promise.resolve(resultado);
}

function iniciarValidacao(input, estado, { categoria, limiteBytes, onChange }, arquivos) {
  const token = ++estado.generation;
  estado.token = token;
  estado.selecionados = arquivos.slice();
  estado.arquivos = [];
  estado.pendente = true;
  estado.valido = false;
  estado.erro = '';
  revogarBlobUrls(estado);
  if (input.isConnected) mostrarPreview(input, [], estado);
  const validacao = validarUpload(input, categoria, limiteBytes, arquivos).catch(resultadoDeErro);
  estado.promise = validacao.then((resultado) => {
    if (input._uploadState !== estado || estado.token !== token || estado.disconnected) return resultado;
    estado.pendente = false;
    estado.arquivos = resultado.valido ? resultado.arquivos : [];
    estado.valido = Boolean(resultado.valido);
    estado.erro = resultado.erro ?? '';
    estado.limite = resultado.limite;
    if (input.isConnected) {
      if (resultado.valido) {
        input.removeAttribute('aria-invalid');
        const campo = input.closest('.upload-field') ?? input.parentElement;
        campo?.setAttribute('data-upload-state', estado.arquivos.length ? 'ready' : 'empty');
        mostrarPreview(input, estado.arquivos, estado);
      } else erroUpload(input, estado.erro, estado);
      try { onChange?.(estado); } catch { /* callbacks de tela não podem rejeitar a validação */ }
    }
    return resultado;
  });
  return estado.promise;
}

/** Instala validação/previsão. O estado fica no input para o módulo consumir antes do upload. */
export function instalarUpload(input, { categoria, limiteBytes, onChange } = {}) {
  if (!input) return null;
  input._uploadState?.dispose?.();
  input.dataset.uploadCategory = categoria ?? '';
  const estado = input._uploadState = {
    arquivos: [],
    selecionados: [],
    blobUrls: [],
    pendente: false,
    valido: !arquivosDoInput(input).length,
    erro: '',
    limite: limiteBytes,
    generation: 0,
    token: 0,
    promise: prometerResultado({ valido: true, arquivos: [] }),
    desconectado: false,
  };
  const campo = input.closest('.upload-field') ?? input.parentElement;
  const remover = campo?.querySelector('[data-upload-remove]');
  const removerSelecao = () => {
    if (input._uploadState !== estado) return;
    estado.token = ++estado.generation;
    estado.selecionados = [];
    estado.arquivos = [];
    estado.pendente = false;
    estado.valido = true;
    estado.erro = '';
    estado.promise = prometerResultado({ valido: true, arquivos: [], limite: estado.limite });
    revogarBlobUrls(estado);
    if (input.isConnected) {
      input.value = '';
      mostrarPreview(input, [], estado);
      input.removeAttribute('aria-invalid');
      campo?.setAttribute('data-upload-state', 'empty');
    }
    try { onChange?.(estado); } catch { /* callback opcional */ }
  };
  remover?.addEventListener('click', removerSelecao);
  const onChangeInput = () => {
    if (input._uploadState !== estado || estado.disconnected) return;
    const arquivos = arquivosDoInput(input);
    iniciarValidacao(input, estado, { categoria, limiteBytes, onChange }, arquivos);
  };
  input.addEventListener('change', onChangeInput);
  estado.dispose = () => {
    if (estado.disconnected) return;
    estado.disconnected = true;
    estado.token = ++estado.generation;
    estado.pendente = false;
    revogarBlobUrls(estado);
    remover?.removeEventListener('click', removerSelecao);
    input.removeEventListener('change', onChangeInput);
    estado.observer?.disconnect();
  };
  const documento = input.ownerDocument;
  if (typeof MutationObserver !== 'undefined' && documento?.documentElement) {
    estado.observer = new MutationObserver(() => {
      if (!input.isConnected) estado.dispose();
    });
    estado.observer.observe(documento.documentElement, { childList: true, subtree: true });
  }
  return estado;
}

/** Valida a seleção atual, aguardando a validação mais recente e cobrindo FileList injetado por testes. */
export async function validarSelecaoUpload(input, categoria, limiteBytes) {
  if (!input) return { valido: true, arquivos: [] };
  const estado = input._uploadState;
  if (!estado) return validarUpload(input, categoria, limiteBytes);
  if (estado.pendente) await estado.promise;
  const atuais = arquivosDoInput(input);
  if (!atuais.length) {
    if (estado.selecionados.length && estado.erro) return { valido: false, arquivos: [], erro: estado.erro, limite: estado.limite };
    return { valido: true, arquivos: [] };
  }
  if (mesmosArquivos(estado.selecionados, atuais) && !estado.pendente) {
    return { valido: estado.valido, arquivos: estado.valido ? estado.arquivos.slice() : [], erro: estado.erro, limite: estado.limite };
  }
  return iniciarValidacao(input, estado, { categoria, limiteBytes }, atuais);
}

/** Retorna somente arquivos aprovados pelo componente; sem componente, preserva o FileList nativo. */
export function arquivosDoUpload(input) {
  if (input?._uploadState) {
    if (input._uploadState.pendente || !input._uploadState.valido) return [];
    return input._uploadState.arquivos.slice();
  }
  return arquivosDoInput(input);
}

export const getUploadFiles = arquivosDoUpload;

/** Estado visual indeterminado durante uma operação de rede, sem inventar percentual. */
export function marcarUpload(input, enviando, texto = 'Enviando arquivo…') {
  const campo = input?.closest('.upload-field') ?? input?.parentElement;
  if (!campo) return;
  campo.setAttribute('aria-busy', String(Boolean(enviando)));
  const estado = input?._uploadState;
  const visual = enviando ? 'uploading' : (estado?.erro ? 'error' : (estado?.arquivos?.length ? 'ready' : 'empty'));
  campo.setAttribute('data-upload-state', visual);
  const meta = campo.querySelector('.upload-meta');
  if (enviando && meta) meta.textContent = texto;
}
