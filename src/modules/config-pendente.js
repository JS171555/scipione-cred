import { diagnostico } from '../core/supabase.js';
import { $ } from '../core/dom.js';

export function renderConfigPendente(raiz) {
  raiz.innerHTML = `<main class="auth"><h1>Configuração pendente</h1><p id="m"></p>
    <p>Consulte <code>docs/supabase-setup.md</code>.</p></main>`;
  $('#m').textContent = diagnostico.mensagem;
}
