import { diagnostico } from '../core/supabase.js';
import { $ } from '../core/dom.js';
import { montarAuth } from '../components/auth-layout.js';

export function renderConfigPendente(raiz) {
  montarAuth(raiz, {
    eyebrow: 'Ambiente',
    title: 'Configuração pendente.',
    description: 'O aplicativo está instalado, mas ainda não consegue se conectar ao ambiente configurado.',
    content: `<div class="config-status" role="status"><p id="m"></p><p>Consulte <code>docs/supabase-setup.md</code> para concluir a configuração.</p></div>`,
    footer: '<a href="#/login">Voltar ao login</a>',
  });
  $('#m', raiz).textContent = diagnostico?.mensagem ?? 'Verifique as variáveis de ambiente do Supabase.';
}
