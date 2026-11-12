import { esc } from '../core/dom.js';
import { marca } from './pagina.js';
import { icon } from './icons.js';

export function authLayout({
  eyebrow = 'Scipione Cred', title, description = '', content = '', footer = '',
  asideTitle = 'Crédito com clareza.',
  asideText = 'Clientes, dívidas e pagamentos em um só lugar. Precisão em cada registro, confiança em cada decisão.',
} = {}) {
  return `<main class="auth-layout"><section class="auth-story" aria-label="Scipione Cred">
    <a class="brand auth-brand" href="#/login" aria-label="Scipione Cred">${marca()}</a>
    <div class="auth-story-body"><p class="auth-eyebrow">SCIPIONE AFFARE · GESTÃO FINANCEIRA</p><h2>${esc(asideTitle)}</h2><div class="auth-story-rule" aria-hidden="true"></div><p class="auth-story-copy">${esc(asideText)}</p></div>
    <footer>${icon('shield-check', 16)} <span>Crédito, controle e confiança.</span></footer></section>
    <section class="auth auth-layout-panel" aria-labelledby="auth-title"><div class="auth-panel">
    <p class="auth-eyebrow">${esc(eyebrow)}</p><h1 id="auth-title">${esc(title ?? '')}</h1>${description ? `<p class="auth-description">${esc(description)}</p>` : ''}${content}${footer ? `<div class="auth-footer">${footer}</div>` : ''}</div></section></main>`;
}

export function montarAuth(raiz, opcoes) {
  raiz.innerHTML = authLayout(opcoes);
  document.title = `${opcoes.title || 'Acesso'} · Scipione Cred`;
  bindPasswordVisibility(raiz);
  return raiz.querySelector('.auth-layout-panel');
}

export function campoSenha({ id, label, autocomplete = 'current-password', describedby = '' } = {}) {
  const ref = esc(id);
  return `<div class="field password-field"><label for="${ref}">${esc(label)}<span class="password-control"><input id="${ref}" type="password" autocomplete="${esc(autocomplete)}" required${describedby ? ` aria-describedby="${esc(describedby)}"` : ''}><button type="button" class="password-toggle" data-password-toggle="${ref}" aria-label="Mostrar senha" aria-pressed="false">${icon('eye', 18)}</button></span></label></div>`;
}

export function bindPasswordVisibility(raiz = document) {
  raiz.querySelectorAll('[data-password-toggle]').forEach((botao) => {
    if (botao.dataset.bound === 'true') return;
    botao.dataset.bound = 'true';
    botao.addEventListener('click', () => {
      const input = raiz.getElementById?.(botao.dataset.passwordToggle) ?? raiz.querySelector(`#${botao.dataset.passwordToggle}`);
      if (!input) return;
      const visivel = input.type === 'text';
      input.type = visivel ? 'password' : 'text';
      botao.innerHTML = icon(visivel ? 'eye' : 'eye-off', 18);
      botao.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
      botao.setAttribute('aria-pressed', String(!visivel));
    });
  });
}
