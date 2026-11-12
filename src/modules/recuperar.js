import { solicitarRecuperacao } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';

export function renderRecuperar(raiz) {
  raiz.innerHTML = `
    <main class="auth">
      <h1>Recuperar senha</h1>
      <form id="form" novalidate>
        <label>E-mail <input id="email" type="email" autocomplete="username" required></label>
        <p class="msg" id="msg" role="status" hidden></p>
        <button type="submit">Enviar link de recuperação</button>
      </form>
      <p><a href="#/login">Voltar ao login</a></p>
    </main>`;
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('#email').value.trim();
    if (!email) return mostrarMensagem($('#msg'), 'Informe o e-mail.');
    const botao = $('button[type=submit]');
    ocupado(botao, true, 'Enviando…');
    try {
      await solicitarRecuperacao(email);
      mostrarMensagem($('#msg'), 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. Abra-o neste mesmo navegador.', 'ok');
    } catch (e) { mostrarMensagem($('#msg'), traduzirErro(e)); }
    finally { ocupado(botao, false); }
  });
}
