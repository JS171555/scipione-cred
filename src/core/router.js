import { obterAdmin } from '../services/auth.js';
import { traduzirErro } from './errors.js';
import { definirAdminPagina } from '../components/pagina.js';

let aviso = '';
let ctx;
let controller;
export const definirAviso = (t) => { aviso = t; };
export const consumirAviso = () => { const a = aviso; aviso = ''; return a; };
export const invalidarNavegacao = () => { controller?.abort(); };
export const navegar = (caminho) => {
  invalidarNavegacao();
  if (location.hash !== `#${caminho}`) location.hash = caminho;
  else resolver();
};

function encontrarRota(caminho) {
  if (ctx.rotas[caminho]) return { rota: ctx.rotas[caminho], params: {} };
  const partes = caminho.split('/');
  for (const [padrao, rota] of Object.entries(ctx.rotas)) {
    const pp = padrao.split('/');
    if (pp.length !== partes.length || !padrao.includes(':')) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(partes[i])), true) : seg === partes[i]))) return { rota, params };
  }
  return { rota: ctx.rotas['/404'], params: {} };
}

async function resolver() {
  invalidarNavegacao();
  controller = new AbortController();
  const { signal } = controller;
  try {
    const [caminho, qs = ''] = (location.hash.slice(1) || '/').split('?');
    const consulta = new URLSearchParams(qs);
    const { rota, params } = encontrarRota(caminho);
    const admin = await obterAdmin();
    if (signal.aborted) return;
    if (!rota.publica && !admin) { definirAdminPagina(null); return navegar('/login'); }
    if (rota.soDeslogado && admin) return navegar('/');
    definirAdminPagina(admin);
    await rota.render(ctx.raiz, { admin, params, consulta, signal });
  } catch (e) {
    if (signal.aborted) return;
    ctx.raiz.textContent = traduzirErro(e);
  }
}

export function iniciarRouter({ raiz, rotas }) {
  invalidarNavegacao();
  ctx = { raiz, rotas };
  window.removeEventListener('hashchange', resolver);
  window.addEventListener('hashchange', resolver);
  return resolver();
}
