import { entrar } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, consumirAviso } from '../core/router.js';

export function renderLogin(raiz) {
  raiz.innerHTML = `
    <main class="auth">
      <h1>Scipione Cred</h1>
      <p class="msg ok" id="aviso" hidden></p>
      <form id="form" novalidate>
        <label>E-mail <input id="email" type="email" autocomplete="username" required></label>
        <label>Senha <input id="senha" type="password" autocomplete="current-password" required></label>
        <p class="msg erro" id="msg" role="alert" hidden></p>
        <button type="submit">Entrar</button>
      </form>
      <p><a href="#/recuperar-senha">Esqueci minha senha</a></p>
    </main>`;
  mostrarMensagem($('#aviso'), consumirAviso(), 'ok');
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = $('button[type=submit]');
    const email = $('#email').value; const senha = $('#senha').value;
    if (!email || !senha) return mostrarMensagem($('#msg'), 'Informe e-mail e senha.');
    mostrarMensagem($('#msg'), '');
    ocupado(botao, true, 'Entrando…');
    try { await entrar(email, senha); navegar('/'); }
    catch (e) { mostrarMensagem($('#msg'), traduzirErro(e)); $('#senha').value = ''; }
    finally { ocupado(botao, false); }
  });
}
