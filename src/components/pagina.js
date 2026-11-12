import { esc, $ } from '../core/dom.js';
import { sair } from '../services/auth.js';
import { navegar } from '../core/router.js';

/** Casca das telas internas (estrutura simples; identidade visual na Etapa 5). Devolve o contêiner de conteúdo. */
export function pagina(raiz, { titulo, voltar = null }) {
  raiz.innerHTML = `
    <header class="topo"><a class="marca" href="#/">Scipione Cred</a>
      <nav><a href="#/">Início</a><a href="#/devedores">Devedores</a><button type="button" id="sair" class="sec">Sair</button></nav></header>
    <main class="pg">${voltar ? `<p><a href="#${esc(voltar.href)}">← ${esc(voltar.texto)}</a></p>` : ''}
      <h1>${esc(titulo)}</h1><div id="conteudo"></div></main>`;
  $('#sair').addEventListener('click', async () => { await sair(); navegar('/login'); });
  return $('#conteudo');
}

export const badgeStatus = (s) => `<span class="badge ${esc(s)}">${{ ativo: 'Ativo', inativo: 'Inativo', em_aberto: 'Em aberto', quitada: 'Quitada', valido: 'Válido', estornado: 'Estornado' }[s] ?? esc(s)}</span>`;
