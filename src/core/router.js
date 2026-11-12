import { obterAdmin } from '../services/auth.js';
import { traduzirErro } from './errors.js';

let aviso = '';
export const definirAviso = (t) => { aviso = t; };
export const consumirAviso = () => { const a = aviso; aviso = ''; return a; };
export const navegar = (caminho) => { if (location.hash !== `#${caminho}`) location.hash = caminho; else resolver(); };

let ctx;

/** Rotas com parâmetros: '/devedores/:id/editar'. Parâmetros chegam em `params`. */
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
  const [caminho, qs = ''] = (location.hash.slice(1) || '/').split('?');
  const consulta = new URLSearchParams(qs);
  const { rota, params } = encontrarRota(caminho);
  try {
    const admin = await obterAdmin();
    if (!rota.publica && !admin) return navegar('/login');
    if (rota.soDeslogado && admin) return navegar('/');
    await rota.render(ctx.raiz, { admin, params, consulta });
  } catch (e) {
    ctx.raiz.textContent = traduzirErro(e);
  }
}

export function iniciarRouter({ raiz, rotas }) {
  ctx = { raiz, rotas };
  window.addEventListener('hashchange', resolver);
  return resolver();
}
