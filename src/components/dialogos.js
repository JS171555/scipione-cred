import { esc } from '../core/dom.js';
import { icon } from './icons.js';

function abrir(html, aoMontar) {
  return new Promise((resolve) => {
    const anterior = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = 'dialogo';
    dlg.setAttribute('aria-labelledby', 'dialog-title');
    dlg.innerHTML = html;
    document.body.appendChild(dlg);
    const fechar = (valor) => {
      dlg.close(); dlg.remove();
      if (anterior?.isConnected) anterior.focus();
      resolve(valor);
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(null); });
    dlg.showModal();
    aoMontar(dlg, fechar);
  });
}

export function confirmar(mensagem, { confirmarTexto = 'Confirmar', perigo = false } = {}) {
  return abrir(`<form method="dialog"><div class="dialog-head${perigo ? ' aviso' : ''}">${icon(perigo ? 'alert-circle' : 'shield-check', 22)}<h2 id="dialog-title">${perigo ? 'Confirmar alteração' : 'Antes de continuar'}</h2></div><p>${esc(mensagem)}</p>
    <div class="acoes"><button type="button" data-n class="sec">Cancelar</button><button type="button" data-s class="${perigo ? 'perigo' : ''}">${esc(confirmarTexto)}</button></div></form>`,
  (d, fechar) => {
    d.querySelector('[data-n]').onclick = () => fechar(false);
    d.querySelector('[data-s]').onclick = () => fechar(true);
    d.querySelector('[data-n]').focus();
  }).then((v) => v === true);
}

export function pedirTexto(mensagem, { minimo = 3, rotulo = 'Motivo', confirmarTexto = 'Confirmar' } = {}) {
  return abrir(`<form><h2 id="dialog-title">${esc(confirmarTexto)}</h2><p>${esc(mensagem)}</p><label>${esc(rotulo)}<textarea rows="3" required aria-describedby="dialog-error"></textarea></label>
    <p class="msg erro" id="dialog-error" role="alert" hidden></p>
    <div class="acoes"><button type="button" data-n class="sec">Cancelar</button><button type="submit">${esc(confirmarTexto)}</button></div></form>`,
  (d, fechar) => {
    const ta = d.querySelector('textarea');
    const msg = d.querySelector('.msg');
    d.querySelector('[data-n]').onclick = () => fechar(null);
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ta.value.trim();
      if (v.length < minimo) { msg.textContent = `Informe ao menos ${minimo} caracteres.`; msg.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
      fechar(v);
    });
    ta.focus();
  });
}

/** Confirmação de perfil, só com o texto e as ações. Retorna true para encerrar a sessão. */
export function cartaoPerfil() {
  return abrir(`<div class="perfil-card"><h2 id="dialog-title" class="sr-only">Perfil de administrador</h2>
      <p class="perfil-note">Perfil de administrador da Scipione Affare. O acesso é exclusivo e os documentos são privados.</p>
      <div class="acoes"><button type="button" data-n class="sec">Fechar</button><button type="button" data-s>Encerrar sessão</button></div>
    </div>`,
  (d, fechar) => {
    d.querySelector('[data-n]').onclick = () => fechar(false);
    d.querySelector('[data-s]').onclick = () => fechar(true);
    d.querySelector('[data-n]').focus();
  }).then((v) => v === true);
}
