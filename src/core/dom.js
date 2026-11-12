export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, raiz = document) => raiz.querySelector(sel);

export function mostrarMensagem(el, texto, tipo = 'erro') {
  if (!el) return;
  el.textContent = texto ?? '';
  el.className = `msg ${tipo}`;
  el.hidden = !texto;
}

export function ocupado(botao, estado, textoOcupado = 'Aguarde…') {
  if (!botao) return;
  if (estado) { botao.dataset.texto = botao.textContent; botao.textContent = textoOcupado; }
  else if (botao.dataset.texto) { botao.textContent = botao.dataset.texto; }
  botao.disabled = estado;
}
