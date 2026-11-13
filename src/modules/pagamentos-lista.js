import { pagina, badgeStatus } from '../components/pagina.js';
import * as pagamentos from '../services/pagamentos.js';
import { formatarBRL } from '../utils/money.js';
import { formatarData, formatarDataHora } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc } from '../core/dom.js';
import { loadingState, emptyState, errorState } from '../components/states.js';
import { botaoFiltros, instalarBotaoFiltros } from '../components/filtros.js';

const POR_PAGINA = 20;
const estados = {
  loading: loadingState,
  empty: (texto) => emptyState(texto),
  error: errorState,
};
const opc = (lista, atual) => lista.map(([valor, texto]) => `<option value="${esc(valor)}" ${valor === atual ? 'selected' : ''}>${esc(texto)}</option>`).join('');
const abrirUrl = async (gerar) => {
  const janela = window.open('about:blank', '_blank');
  try {
    const url = await gerar();
    if (janela) { janela.opener = null; janela.location.href = url; }
  } catch (erro) {
    janela?.close();
    throw erro;
  }
};
const dinheiro = (valor) => valor === null || valor === undefined ? '—' : formatarBRL(valor);

function paginacao(r) {
  if (!r.total) return '';
  const ultima = Math.max(1, Math.ceil(r.total / r.porPagina));
  const de = (r.pagina - 1) * r.porPagina + 1;
  const ate = Math.min(r.total, r.pagina * r.porPagina);
  return `<span>Mostrando ${de}–${ate} de ${r.total}</span><span class="acoes-linha">
    <button type="button" class="sec peq" data-pg="${r.pagina - 1}" ${r.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
    <span>Página ${r.pagina} de ${ultima}</span>
    <button type="button" class="sec peq" data-pg="${r.pagina + 1}" ${r.pagina >= ultima ? 'disabled' : ''}>Próxima</button></span>`;
}

function linha(p) {
  const nome = p.devedor_nome ?? p.nome_razao_social ?? '—';
  const descricao = p.divida_descricao ?? p.descricao ?? '—';
  const estornado = p.status === 'estornado';
  return `<tr class="${estornado ? 'estornado' : ''}">
    <td data-label="Cliente"><a href="#/devedores/${esc(p.devedor_id ?? '')}">${esc(nome)}</a></td>
    <td data-label="Dívida"><a href="#/dividas/${esc(p.divida_id)}/editar">${esc(descricao)}</a></td>
    <td data-label="Data">${formatarData(p.data_pagamento)}</td>
    <td data-label="Valor" class="num">${dinheiro(p.valor)}</td>
    <td data-label="Situação">${badgeStatus(p.status)}${estornado && p.motivo_estorno ? `<br><small>Em ${formatarDataHora(p.estornado_em)}: ${esc(p.motivo_estorno)}</small>` : ''}</td>
    <td data-label="Observação">${esc(p.observacao ?? '') || '—'}</td>
    <td data-label="Ações"><span class="acoes-linha">
      <a class="btn sec peq" href="#/devedores/${esc(p.devedor_id ?? '')}">Abrir cliente</a>
      <a class="btn sec peq" href="#/dividas/${esc(p.divida_id)}/editar">Editar dívida</a>
      ${p.divida_status === 'em_aberto' ? `<a class="btn peq" href="#/dividas/${esc(p.divida_id)}/pagamento">Registrar pagamento</a>` : ''}
      ${p.comprovante_path ? `<button type="button" class="sec peq" data-acao="comprovante" data-path="${esc(p.comprovante_path)}">Ver comprovante</button>` : ''}
    </span></td>
  </tr>`;
}

/** Lista global de pagamentos, inclusive registros estornados. */
export async function renderListaPagamentos(raiz, { consulta = new URLSearchParams(), admin, signal } = {}) {
  const el = pagina(raiz, { titulo: 'Pagamentos', descricao: 'Histórico completo de recebimentos e estornos.', admin });
  const estado = {
    busca: consulta.get('q') ?? '',
    status: ['', 'valido', 'estornado'].includes(consulta.get('status')) ? consulta.get('status') : '',
    ordem: ['recentes', 'antigos'].includes(consulta.get('ordem')) ? consulta.get('ordem') : 'recentes',
    pagina: Math.max(1, Number.parseInt(consulta.get('p'), 10) || 1),
  };
  el.innerHTML = `<div class="list-toolbar barra"><label class="search-field"><span class="sr-only">Buscar pagamentos</span><input id="busca" type="search" aria-label="Buscar pagamentos" placeholder="Buscar cliente ou descrição da dívida" value="${esc(estado.busca)}"></label>
      <a class="btn" href="#/pagamentos/novo">Registrar pagamento</a>${botaoFiltros()}</div>
    <div class="filter-bar filtros" id="filtros-painel" data-aberto="false"><label>Situação<select id="f-status">${opc([['', 'Todos'], ['valido', 'Válidos'], ['estornado', 'Estornados']], estado.status)}</select></label>
      <label>Ordenar por<select id="f-ordem">${opc([['recentes', 'Mais recentes'], ['antigos', 'Mais antigos']], estado.ordem)}</select></label>
      <button type="button" id="limpar" class="sec peq">Limpar filtros</button></div>
    <div id="tabela" data-lista="pagamentos" aria-live="polite">${estados.loading()}</div><div id="paginacao" class="paginacao"></div>`;

  const q = (seletor) => el.querySelector(seletor);
  const gravarUrl = () => {
    const qs = new URLSearchParams();
    if (estado.busca) qs.set('q', estado.busca);
    if (estado.status) qs.set('status', estado.status);
    if (estado.ordem !== 'recentes') qs.set('ordem', estado.ordem);
    if (estado.pagina > 1) qs.set('p', String(estado.pagina));
    history.replaceState(null, '', `#/pagamentos${qs.size ? `?${qs}` : ''}`);
  };
  let sequencia = 0;
  const carregar = async () => {
    if (signal?.aborted || !el.isConnected) return;
    const atual = ++sequencia;
    q('#tabela').innerHTML = estados.loading();
    try {
      const resposta = await pagamentos.listarPagina({ busca: estado.busca, status: estado.status, ordem: estado.ordem, pagina: estado.pagina, porPagina: POR_PAGINA });
      if (atual !== sequencia || signal?.aborted || !el.isConnected) return;
      estado.pagina = resposta.pagina;
      gravarUrl();
      const itens = resposta.itens ?? [];
      q('#tabela').innerHTML = itens.length
        ? `<div class="rolagem"><table class="financial-table"><thead><tr><th>Cliente</th><th>Dívida</th><th>Data</th><th class="num">Valor</th><th>Situação</th><th>Observação</th><th>Ações</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
        : estados.empty(estado.busca || estado.status ? 'Nenhum pagamento encontrado com estes filtros.' : 'Nenhum pagamento registrado ainda.');
      sincronizarFiltros();
      q('#paginacao').innerHTML = paginacao(resposta);
    } catch (erro) {
      if (atual !== sequencia || signal?.aborted || !el.isConnected) return;
      q('#tabela').innerHTML = estados.error(traduzirErro(erro));
      q('#paginacao').innerHTML = '';
    }
  };
  const marcarFiltrosAtivos = instalarBotaoFiltros(el);
  const mudou = () => { estado.pagina = 1; carregar(); };
  let timer;
  q('#busca').addEventListener('input', (event) => { estado.busca = event.target.value.trim(); clearTimeout(timer); timer = setTimeout(mudou, 300); });
  q('#f-status').addEventListener('change', (event) => { estado.status = event.target.value; mudou(); });
  q('#f-ordem').addEventListener('change', (event) => { estado.ordem = event.target.value; mudou(); });
  const sincronizarFiltros = () => marcarFiltrosAtivos(estado.status || estado.ordem !== 'recentes');
  q('#limpar').addEventListener('click', () => { estado.busca = ''; estado.status = ''; estado.ordem = 'recentes'; q('#busca').value = ''; q('#f-status').value = ''; q('#f-ordem').value = 'recentes'; mudou(); });
  q('#paginacao').addEventListener('click', (event) => { const botao = event.target.closest('[data-pg]'); if (botao && !botao.disabled) { estado.pagina = Number(botao.dataset.pg); carregar(); } });
  q('#tabela').addEventListener('click', async (event) => {
    const alvo = event.target.closest('[data-acao], [data-retry]');
    if (!alvo) return;
    if (alvo.dataset.acao === 'retry' || alvo.dataset.retry !== undefined) return carregar();
    if (alvo.dataset.acao !== 'comprovante') return;
    alvo.disabled = true;
    try { await abrirUrl(() => pagamentos.urlComprovante(alvo.dataset.path)); } catch (erro) { q('#tabela').insertAdjacentHTML('afterbegin', estados.error(traduzirErro(erro))); } finally { alvo.disabled = false; }
  });
  carregar();
}
