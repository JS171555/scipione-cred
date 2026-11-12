import { esc } from '../core/dom.js';
import { sair } from '../services/auth.js';
import { navegar, invalidarNavegacao } from '../core/router.js';
import { icon } from './icons.js';
import { confirmar } from './dialogos.js';
import { adaptarTabelas } from './tabelas.js';

let adminAtual = null;
export const definirAdminPagina = (admin) => { adminAtual = admin; };
export const marca = () => `<span class="brand-mark" aria-hidden="true">S<span>c</span></span><span class="brand-name">SCIPIONE<span>CRED</span></span>`;
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
  const nome = admin?.nome || 'Administrador';
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  raiz.innerHTML = `<div class="app-shell ${collapsed ? 'sidebar-collapsed' : ''}">
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <aside class="sidebar" aria-label="Menu principal">
      <a class="brand" href="#/" aria-label="Scipione Cred — dashboard">${marca()}</a>
      <span class="nav-caption">ÁREA ADMINISTRATIVA</span><nav class="sidebar-nav" aria-label="Navegação principal">${nav}</nav>
      <div class="sidebar-bottom"><div class="sidebar-security">${icon('shield-check', 18)}<span>Acesso restrito<span>Scipione Affare</span></span></div>
      <button type="button" id="perfil-admin" class="admin-profile" title="Perfil administrativo"><span class="admin-avatar">${esc(iniciais)}</span><span class="admin-info"><strong>${esc(nome)}</strong><small>Administrador</small></span>${icon('chevron-right', 16)}</button>
      <button type="button" id="sair" class="logout" title="Encerrar sessão">${icon('log-out', 18)}<span>Encerrar sessão</span></button></div>
    </aside>
    <div class="workspace"><header class="topo"><div class="topo-left"><button type="button" id="recolher-menu" class="icon-button" aria-label="${collapsed ? 'Expandir' : 'Recolher'} menu" aria-expanded="${!collapsed}" title="${collapsed ? 'Expandir' : 'Recolher'} menu">${icon(collapsed ? 'panel-left-open' : 'panel-left-close', 20)}</button><span class="topo-context">Scipione Affare <span>/</span> <strong>${esc(titulo)}</strong></span><a class="mobile-brand" href="#/">SCIPIONE <span>CRED</span></a></div>
    <div class="topo-right"><span class="access-label">${icon('lock-keyhole', 14)} Ambiente administrativo</span><button type="button" class="admin-avatar mobile-profile" id="perfil-mobile" aria-label="Perfil e sessão">${esc(iniciais)}</button><a class="btn peq sec header-action" href="#/devedores/novo">${icon('plus', 15)} Novo cliente</a></div></header>
    <main class="pg" id="pagina-principal">${voltar ? `<a class="back-link" href="#${esc(voltar.href)}">${icon('arrow-left', 16)} ${esc(voltar.texto)}</a>` : ''}<div class="page-heading"><div><p class="eyebrow">SCIPIONE CRED</p><h1>${esc(titulo)}</h1>${descricao ? `<p class="page-description">${esc(descricao)}</p>` : ''}</div><span class="page-date">${esc(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date()))}</span></div><div id="conteudo" tabindex="-1"></div><footer class="page-footer"><span>SCIPIONE CRED</span><span>Crédito, controle e confiança.</span></footer></main></div>
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
  const logout = async () => {
    const button = q('#sair');
    if (button.disabled) return;
    button.disabled = true;
    invalidarNavegacao();
    q('#conteudo').replaceChildren();
    try { await sair(); definirAdminPagina(null); navegar('/login'); }
    catch { button.disabled = false; await confirmar('Não foi possível encerrar a sessão. Tente novamente.', { confirmarTexto: 'Entendi' }); }
  };
  q('#sair').addEventListener('click', logout);
  const perfil = async () => {
    if (await confirmar(`${nome} — perfil de administrador da Scipione Affare. O acesso é exclusivo e os documentos são privados.`, { confirmarTexto: 'Encerrar sessão' })) await logout();
  };
  q('#perfil-admin').addEventListener('click', perfil);
  q('#perfil-mobile').addEventListener('click', perfil);
  document.title = `${titulo} · Scipione Cred`;
  adaptarTabelas(q('#conteudo'));
  return q('#conteudo');
}

export const badgeStatus = (s) => `<span class="badge ${esc(s)}"><i aria-hidden="true"></i>${{ ativo: 'Ativo', inativo: 'Inativo', em_aberto: 'Em aberto', quitada: 'Quitada', valido: 'Válido', estornado: 'Estornado' }[s] ?? esc(s)}</span>`;
