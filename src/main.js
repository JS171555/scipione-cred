import '@ionic/core/css/core.css';
import './styles/base.css';
import { defineCustomElements } from '@ionic/core/loader';
import { supabase, diagnostico } from './core/supabase.js';
import { iniciarRouter, navegar } from './core/router.js';
import { limparCache } from './services/auth.js';
import { renderLogin } from './modules/login.js';
import { renderRecuperar } from './modules/recuperar.js';
import { renderRedefinir } from './modules/redefinir.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderListaDevedores } from './modules/devedores-lista.js';
import { renderDevedorForm } from './modules/devedor-form.js';
import { renderDevedorDetalhe } from './modules/devedor-detalhe.js';
import { renderDividaForm } from './modules/divida-form.js';
import { renderPagamentoForm } from './modules/pagamento-form.js';
import { renderConfigPendente } from './modules/config-pendente.js';

defineCustomElements(window);
const raiz = document.getElementById('app');

if (!diagnostico.ok) {
  renderConfigPendente(raiz);
} else {
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') navegar('/redefinir-senha');
    if (evento === 'SIGNED_OUT') { limparCache(); if (!['/login', '/recuperar-senha'].includes(location.hash.slice(1))) navegar('/login'); }
  });
  iniciarRouter({
    raiz,
    rotas: {
      '/': { render: renderDashboard },
      '/login': { render: renderLogin, publica: true, soDeslogado: true },
      '/recuperar-senha': { render: renderRecuperar, publica: true },
      '/redefinir-senha': { render: renderRedefinir, publica: true },
      '/devedores': { render: renderListaDevedores },
      '/devedores/novo': { render: renderDevedorForm },
      '/devedores/:id': { render: renderDevedorDetalhe },
      '/devedores/:id/editar': { render: renderDevedorForm },
      '/devedores/:id/dividas/nova': { render: renderDividaForm },
      '/dividas/:dividaId/editar': { render: renderDividaForm },
      '/dividas/:dividaId/pagamento': { render: renderPagamentoForm },
      '/404': { render: () => navegar('/') },
    },
  });
}
