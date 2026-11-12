import { solicitarRecuperacao } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';
import { montarAuth } from '../components/auth-layout.js';

export function renderRecuperar(raiz) {
  montarAuth(raiz, {
    eyebrow: 'Recuperação segura',
    title: 'Recupere o acesso.',
    description: 'Informe seu e-mail administrativo. A resposta é sempre discreta para proteger sua conta.',
    content: `<form id="form" class="form-panel-form" novalidate>
        <div class="field"><label for="email">E-mail
          <input id="email" type="email" autocomplete="username" inputmode="email" required aria-describedby="email-erro">
        </label><p class="erro-campo" id="email-erro" role="alert" hidden></p></div>
        <p class="msg" id="msg" role="status" aria-live="polite" hidden></p>
        <button type="submit" class="btn-primary">Enviar link de recuperação</button>
      </form>`,
    footer: '<a href="#/login">Voltar ao login</a>',
  });
  const form = $('#form', raiz); const email = $('#email', raiz); const erro = $('#email-erro', raiz); const msg = $('#msg', raiz);
  email.addEventListener('input', () => { email.removeAttribute('aria-invalid'); erro.hidden = true; erro.textContent = ''; });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    email.removeAttribute('aria-invalid'); erro.hidden = true; erro.textContent = ''; mostrarMensagem(msg, '');
    const valor = email.value.trim();
    if (!valor) { email.setAttribute('aria-invalid', 'true'); erro.hidden = false; erro.textContent = 'Informe o e-mail.'; email.focus(); return; }
    const botao = form.querySelector('button[type=submit]');
    ocupado(botao, true, 'Enviando…');
    try {
      await solicitarRecuperacao(valor);
      mostrarMensagem(msg, 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. Abra-o neste mesmo navegador.', 'ok');
    } catch (e) { mostrarMensagem(msg, traduzirErro(e)); }
    finally { ocupado(botao, false); }
  });
}
