import { esc } from '../core/dom.js';
import { sair } from '../services/auth.js';
import { navegar, invalidarNavegacao } from '../core/router.js';
import { icon } from './icons.js';
import { confirmar } from './dialogos.js';
import { adaptarTabelas } from './tabelas.js';

let adminAtual = null;
export const definirAdminPagina = (admin) => { adminAtual = admin; };
const marcaImagem = (lado) => `<img class="brand-mark" src="/brand/selo-96.png" srcset="/brand/selo-96.png 1x, /brand/selo-192.png 2x" width="${lado}" height="${lado}" alt="" aria-hidden="true" decoding="async">`;
export const marca = () => `${marcaImagem(44)}<span class="brand-name">SCIPIONE<span>CRED</span></span>`;
const links = [['/', 'Dashboard', 'layout-dashboard'], ['/devedores', 'Clientes', 'users'], ['/dividas', 'Dívidas', 'receipt-text'], ['/pagamentos', 'Pagamentos', 'wallet']];
function ativo(href) {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  if (href === '/') return path === '/';
  if (href === '/pagamentos') return path.startsWith('/pagamentos') || path.endsWith('/pagamento');
  if (href === '/dividas') return (path.startsWith('/dividas') || path.includes('/dividas/')) && !path.endsWith('/pagamento');
  return path.startsWith(href) && !path.includes('/dividas/');
}

/** Casca compartilhada. O perfil vem da sessão autenticada. */
export function pagina(raiz, { titulo, descricao = '', voltar = null, admin = adminAtual }) {
  let collapsed = false;
  try { collapsed = localStorage.getItem('scipione.sidebar') === 'collapsed'; } catch { /* preferência opcional */ }
  const nav = links.map(([href, nome, ico]) => `<a href="#${href}" class="nav-link ${ativo(href) ? 'active' : ''}" ${ativo(href) ? 'aria-current="page"' : ''} title="${nome}">${icon(ico, 20)}<span>${nome}</span>${ativo(href) ? '<i class="nav-dot" aria-hidden="true"></i>' : ''}</a>`).join('');
  raiz.innerHTML = `<div class="app-shell ${collapsed ? 'sidebar-collapsed' : ''}">
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <aside class="sidebar" aria-label="Menu principal">
      <a class="brand" href="#/" aria-label="Scipione Cred — dashboard">${marca()}</a>
      <nav class="sidebar-nav" aria-label="Navegação principal">${nav}</nav>
      <div class="sidebar-bottom">
      <button type="button" id="sair" class="logout" title="Encerrar sessão">${icon('log-out', 18)}<span>Encerrar sessão</span></button></div>
    </aside>
    <div class="workspace"><header class="topo"><a class="mobile-brand" href="#/">${marcaImagem(30)}SCIPIONE <span>CRED</span></a>
    <div class="topo-right"><button type="button" id="sair-mobile" class="icon-button logout-mobile" aria-label="Encerrar sessão" title="Encerrar sessão">${icon('log-out', 20)}</button></div></header>
    <main class="pg" id="pagina-principal">${voltar ? `<a class="back-link" href="#${esc(voltar.href)}">${icon('arrow-left', 16)} ${esc(voltar.texto)}</a>` : ''}<div class="page-heading"><button type="button" id="recolher-menu" class="icon-button menu-toggle" aria-label="${collapsed ? 'Expandir' : 'Recolher'} menu" aria-expanded="${!collapsed}" title="${collapsed ? 'Expandir' : 'Recolher'} menu">${icon(collapsed ? 'panel-left-open' : 'panel-left-close', 20)}</button><h1>${esc(titulo)}</h1><span class="page-date">${esc(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date()))}</span></div>${descricao ? `<p class="page-description">${esc(descricao)}</p>` : ''}<div id="conteudo" tabindex="-1"></div></main></div>
    <nav class="mobile-nav" aria-label="Navegação mobile">${nav}</nav></div>`;
  const q = (s) => raiz.querySelector(s);
  q('.skip-link').addEventListener('click', (event) => { event.preventDefault(); q('#conteudo').focus(); });
  q('#recolher-menu').addEventListener('click', () => {
    collapsed = !collapsed;
    q('.app-shell').classList.toggle('sidebar-collapsed', collapsed);
    const button = q('#recolher-menu');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', `${collapsed ? 'Expandir' : 'Recolher'} menu`);
    button.title = `${collapsed ? 'Expandir' : 'Recolher'} menu`;
    button.innerHTML = icon(collapsed ? 'panel-left-open' : 'panel-left-close', 20);
    try { localStorage.setItem('scipione.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch { /* sem persistência */ }
  });
  const logout = async (button) => {
    if (!button || button.disabled) return;
    button.disabled = true;
    invalidarNavegacao();
    q('#conteudo').replaceChildren();
    try { await sair(); definirAdminPagina(null); navegar('/login'); }
    catch { button.disabled = false; await confirmar('Não foi possível encerrar a sessão. Tente novamente.', { confirmarTexto: 'Entendi' }); }
  };
  const pedirSaida = async (button) => {
    const seguir = await confirmar('Encerrar a sessão neste dispositivo? Você precisará entrar novamente com e-mail e senha para acessar os dados.', { confirmarTexto: 'Encerrar sessão', perigo: true, titulo: 'Encerrar sessão' });
    if (seguir) await logout(button);
  };
  q('#sair').addEventListener('click', (event) => pedirSaida(event.currentTarget));
  q('#sair-mobile').addEventListener('click', (event) => pedirSaida(event.currentTarget));
  document.title = `${titulo} · Scipione Cred`;
  adaptarTabelas(q('#conteudo'));
  return q('#conteudo');
}

export const badgeStatus = (s) => `<span class="badge ${esc(s)}">${{ ativo: 'Ativo', inativo: 'Inativo', em_aberto: 'Em aberto', quitada: 'Quitada', valido: 'Válido', estornado: 'Estornado' }[s] ?? esc(s)}</span>`;
