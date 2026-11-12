import { redefinirSenha, temSessao } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { REQUISITOS_SENHA } from '../utils/password.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';

export async function renderRedefinir(raiz) {
  if (!(await temSessao())) {
    raiz.innerHTML = `<main class="auth"><h1>Link inválido ou expirado</h1>
      <p>Solicite um novo link de recuperação.</p><p><a href="#/recuperar-senha">Recuperar senha</a></p></main>`;
    return;
  }
  raiz.innerHTML = `
    <main class="auth">
      <h1>Nova senha</h1>
      <form id="form" novalidate>
        <label>Nova senha <input id="s1" type="password" autocomplete="new-password" required></label>
        <label>Confirme a senha <input id="s2" type="password" autocomplete="new-password" required></label>
        <ul class="req" id="req">${REQUISITOS_SENHA.map((r) => `<li data-id="${r.id}">${r.texto}</li>`).join('')}</ul>
        <p class="msg erro" id="msg" role="alert" hidden></p>
        <button type="submit">Salvar nova senha</button>
      </form>
    </main>`;
  $('#s1').addEventListener('input', (e) => {
    for (const r of REQUISITOS_SENHA) $(`#req [data-id=${r.id}]`).classList.toggle('ok', r.ok(e.target.value));
  });
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if ($('#s1').value !== $('#s2').value) return mostrarMensagem($('#msg'), 'As senhas não coincidem.');
    const botao = $('button[type=submit]');
    ocupado(botao, true, 'Salvando…');
    try { await redefinirSenha($('#s1').value); definirAviso('Senha alterada. Entre com a nova senha.'); navegar('/login'); }
    catch (e) { mostrarMensagem($('#msg'), traduzirErro(e)); }
    finally { ocupado(botao, false); }
  });
}
