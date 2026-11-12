import { entrar } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, consumirAviso } from '../core/router.js';
import { montarAuth, campoSenha } from '../components/auth-layout.js';

export function renderLogin(raiz) {
  montarAuth(raiz, {
    eyebrow: 'Acesso restrito',
    title: 'Entre na sua operação.',
    description: 'Acesse o controle financeiro da Scipione Cred com suas credenciais administrativas.',
    content: `<p class="msg ok" id="aviso" role="status" hidden></p>
      <form id="form" class="form-panel-form" novalidate>
        <div class="field"><label for="email">E-mail
          <input id="email" type="email" autocomplete="username" inputmode="email" required aria-describedby="email-erro">
        </label><p class="erro-campo" id="email-erro" role="alert" hidden></p></div>
        ${campoSenha({ id: 'senha', label: 'Senha', autocomplete: 'current-password', describedby: 'senha-erro' })}
        <p class="erro-campo" id="senha-erro" role="alert" hidden></p>
        <p class="msg erro" id="msg" role="alert" hidden></p>
        <button type="submit" class="btn-primary">Entrar</button>
      </form>`,
    footer: '<a href="#/recuperar-senha">Esqueci minha senha</a>',
  });

  mostrarMensagem($('#aviso'), consumirAviso(), 'ok');
  const form = $('#form', raiz);
  const email = $('#email', raiz);
  const senha = $('#senha', raiz);
  const mensagem = $('#msg', raiz);
  const emailErro = $('#email-erro', raiz);
  const senhaErro = $('#senha-erro', raiz);
  const limparCampo = (input, erro) => { input?.removeAttribute('aria-invalid'); if (erro) { erro.hidden = true; erro.textContent = ''; } };
  const falhar = (input, erro, texto) => {
    input?.setAttribute('aria-invalid', 'true');
    if (erro) { erro.hidden = false; erro.textContent = texto; }
    mostrarMensagem(mensagem, 'Corrija os campos destacados.');
    input?.focus();
  };

  email.addEventListener('input', () => limparCampo(email, emailErro));
  senha.addEventListener('input', () => limparCampo(senha, senhaErro));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    limparCampo(email, emailErro); limparCampo(senha, senhaErro); mostrarMensagem(mensagem, '');
    const emailValor = email.value.trim(); const senhaValor = senha.value;
    if (!emailValor) return falhar(email, emailErro, 'Informe o e-mail.');
    if (!senhaValor) return falhar(senha, senhaErro, 'Informe a senha.');
    const botao = form.querySelector('button[type=submit]');
    ocupado(botao, true, 'Entrando…');
    try { await entrar(emailValor, senhaValor); navegar('/'); }
    catch (e) { mostrarMensagem(mensagem, traduzirErro(e)); senha.value = ''; senha.focus(); }
    finally { ocupado(botao, false); }
  });
}
