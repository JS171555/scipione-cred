import { redefinirSenha, temSessao } from '../services/auth.js';
import { traduzirErro } from '../core/errors.js';
import { REQUISITOS_SENHA, validarSenha } from '../utils/password.js';
import { $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';
import { montarAuth, campoSenha } from '../components/auth-layout.js';

export async function renderRedefinir(raiz, { signal } = {}) {
  if (signal?.aborted || !raiz.isConnected) return;
  const sessao = await temSessao();
  if (signal?.aborted || !raiz.isConnected) return;
  if (!sessao) {
    montarAuth(raiz, {
      eyebrow: 'Link indisponível',
      title: 'Link inválido ou expirado.',
      description: 'Solicite um novo link para continuar a recuperação no mesmo navegador.',
      content: '<p class="msg erro" role="alert">Sua sessão de recuperação não está mais disponível.</p>',
      footer: '<a href="#/recuperar-senha">Solicitar novo link</a>',
    });
    return;
  }
  montarAuth(raiz, {
    eyebrow: 'Recuperação segura',
    title: 'Escolha uma nova senha.',
    description: 'Use uma senha forte e exclusiva para proteger sua operação.',
    content: `<form id="form" class="form-panel-form" novalidate>
        ${campoSenha({ id: 's1', label: 'Nova senha', autocomplete: 'new-password', describedby: 's1-erro' })}
        <p class="erro-campo" id="s1-erro" role="alert" hidden></p>
        ${campoSenha({ id: 's2', label: 'Confirme a senha', autocomplete: 'new-password', describedby: 's2-erro' })}
        <p class="erro-campo" id="s2-erro" role="alert" hidden></p>
        <ul class="req" id="req" aria-label="Requisitos da senha">${REQUISITOS_SENHA.map((r) => `<li data-id="${r.id}">${r.texto}</li>`).join('')}</ul>
        <p class="msg erro" id="msg" role="alert" hidden></p>
        <button type="submit" class="btn-primary">Salvar nova senha</button>
      </form>`,
  });
  const form = $('#form', raiz); const s1 = $('#s1', raiz); const s2 = $('#s2', raiz); const msg = $('#msg', raiz);
  const marcar = () => {
    for (const requisito of REQUISITOS_SENHA) {
      $(`#req [data-id=${requisito.id}]`, raiz)?.classList.toggle('ok', requisito.ok(s1.value));
    }
  };
  s1.addEventListener('input', marcar); s2.addEventListener('input', () => s2.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault(); mostrarMensagem(msg, ''); s1.removeAttribute('aria-invalid'); s2.removeAttribute('aria-invalid');
    if (signal?.aborted || !raiz.isConnected) return;
    if (!validarSenha(s1.value).valida) { s1.setAttribute('aria-invalid', 'true'); mostrarMensagem(msg, 'A senha ainda não atende a todos os requisitos.'); s1.focus(); return; }
    if (s1.value !== s2.value) { s2.setAttribute('aria-invalid', 'true'); mostrarMensagem(msg, 'As senhas não coincidem.'); s2.focus(); return; }
    const botao = form.querySelector('button[type=submit]'); ocupado(botao, true, 'Salvando…');
    try {
      await redefinirSenha(s1.value);
      if (signal?.aborted || !raiz.isConnected) return;
      definirAviso('Senha alterada. Entre com a nova senha.'); navegar('/login');
    } catch (e) { if (!signal?.aborted && raiz.isConnected) mostrarMensagem(msg, traduzirErro(e)); }
    finally { if (raiz.isConnected) ocupado(botao, false); }
  });
  marcar();
}
