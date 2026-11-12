// Diálogos simples (elemento <dialog> nativo) — confirmação e entrada de texto. Refinados na Etapa 5.
import { esc } from '../core/dom.js';

function abrir(html, aoMontar) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialogo';
    dlg.innerHTML = html;
    document.body.appendChild(dlg);
    const fechar = (valor) => { dlg.close(); dlg.remove(); resolve(valor); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(null); });
    aoMontar(dlg, fechar);
    dlg.showModal();
  });
}

/** @returns {Promise<boolean>} */
export function confirmar(mensagem, { confirmarTexto = 'Confirmar', perigo = false } = {}) {
  return abrir(`<form method="dialog"><p>${esc(mensagem)}</p>
    <div class="acoes"><button type="button" data-n class="sec">Cancelar</button><button type="button" data-s class="${perigo ? 'perigo' : ''}">${esc(confirmarTexto)}</button></div></form>`,
  (d, fechar) => {
    d.querySelector('[data-n]').onclick = () => fechar(false);
    d.querySelector('[data-s]').onclick = () => fechar(true);
    d.querySelector('[data-s]').focus();
  }).then((v) => v === true);
}

/** @returns {Promise<string|null>} texto digitado (≥ minimo caracteres) ou null se cancelado */
export function pedirTexto(mensagem, { minimo = 3, rotulo = 'Motivo', confirmarTexto = 'Confirmar' } = {}) {
  return abrir(`<form><p>${esc(mensagem)}</p><label>${esc(rotulo)}<textarea rows="3" required></textarea></label>
    <p class="msg erro" role="alert" hidden></p>
    <div class="acoes"><button type="button" data-n class="sec">Cancelar</button><button type="submit">${esc(confirmarTexto)}</button></div></form>`,
  (d, fechar) => {
    const ta = d.querySelector('textarea'); const msg = d.querySelector('.msg');
    d.querySelector('[data-n]').onclick = () => fechar(null);
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ta.value.trim();
      if (v.length < minimo) { msg.textContent = `Informe ao menos ${minimo} caracteres.`; msg.hidden = false; return; }
      fechar(v);
    });
    ta.focus();
  });
}
