import { pagina, badgeStatus } from '../components/pagina.js';
import * as dividas from '../services/dividas.js';
import { formatarBRL } from '../utils/money.js';
import { formatarData } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc } from '../core/dom.js';
import { loadingState, emptyState, errorState } from '../components/states.js';
import { botaoFiltros, instalarBotaoFiltros } from '../components/filtros.js';

const POR_PAGINA = 20;
const ORDENS = new Set(['recentes', 'antigos', 'vencimento']);
const estados = {
  loading: loadingState,
  empty: (texto) => emptyState(texto),
  error: errorState,
};
const opc = (lista, atual) => lista.map(([valor, texto]) => `<option value="${esc(valor)}" ${valor === atual ? 'selected' : ''}>${esc(texto)}</option>`).join('');
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

function linha(v) {
  const nome = v.devedor_nome ?? v.nome_razao_social ?? '—';
  return `<tr>
    <td data-label="Cliente"><a href="#/devedores/${esc(v.devedor_id)}">${esc(nome)}</a></td>
    <td data-label="Descrição"><strong>${esc(v.descricao)}</strong>${v.observacoes ? `<br><small>${esc(v.observacoes)}</small>` : ''}</td>
    <td data-label="Registro">${formatarData(v.data_registro)}</td>
    <td data-label="Vencimento">${formatarData(v.data_vencimento)}</td>
    <td data-label="Original" class="num">${dinheiro(v.valor_original)}</td>
    <td data-label="Saldo" class="num"><strong>${dinheiro(v.saldo)}</strong></td>
    <td data-label="Status">${badgeStatus(v.status)}</td>
    <td data-label="Ações"><span class="acoes-linha">
      <a class="btn sec peq" href="#/devedores/${esc(v.devedor_id)}">Abrir cliente</a>
      <a class="btn sec peq" href="#/dividas/${esc(v.id)}/editar">Editar</a>
      ${v.status === 'em_aberto' ? `<a class="btn peq" href="#/dividas/${esc(v.id)}/pagamento">Registrar pagamento</a>` : ''}
    </span></td>
  </tr>`;
}

/** Lista global de dívidas; filtros e página são refletidos no hash. */
export async function renderListaDividas(raiz, { consulta = new URLSearchParams(), admin, signal } = {}) {
  const el = pagina(raiz, { titulo: 'Dívidas', descricao: 'Todas as dívidas registradas, abertas ou quitadas.', admin });
  const estado = {
    busca: consulta.get('q') ?? '',
    status: ['', 'em_aberto', 'quitada'].includes(consulta.get('status')) ? consulta.get('status') : '',
    ordem: ORDENS.has(consulta.get('ordem')) ? consulta.get('ordem') : 'recentes',
    pagina: Math.max(1, Number.parseInt(consulta.get('p'), 10) || 1),
  };
  el.innerHTML = `<div class="list-toolbar barra"><label class="search-field"><span class="sr-only">Buscar dívidas</span><input id="busca" type="search" aria-label="Buscar dívidas" placeholder="Buscar cliente ou descrição" value="${esc(estado.busca)}"></label>
      <a class="btn" href="#/dividas/nova">Nova dívida</a>${botaoFiltros()}</div>
    <div class="filter-bar filtros" id="filtros-painel" data-aberto="false"><label>Status<select id="f-status">${opc([['', 'Todas'], ['em_aberto', 'Em aberto'], ['quitada', 'Quitadas']], estado.status)}</select></label>
      <label>Ordenar por<select id="f-ordem">${opc([['recentes', 'Mais recentes'], ['antigos', 'Mais antigas'], ['vencimento', 'Vencimento']], estado.ordem)}</select></label>
      <button type="button" id="limpar" class="sec peq">Limpar filtros</button></div>
    <div id="tabela" data-lista="dividas" aria-live="polite">${estados.loading()}</div><div id="paginacao" class="paginacao"></div>`;

  const q = (seletor) => el.querySelector(seletor);
  const gravarUrl = () => {
    const qs = new URLSearchParams();
    if (estado.busca) qs.set('q', estado.busca);
    if (estado.status) qs.set('status', estado.status);
    if (estado.ordem !== 'recentes') qs.set('ordem', estado.ordem);
    if (estado.pagina > 1) qs.set('p', String(estado.pagina));
    history.replaceState(null, '', `#/dividas${qs.size ? `?${qs}` : ''}`);
  };
  let sequencia = 0;
  const carregar = async () => {
    if (signal?.aborted || !el.isConnected) return;
    const atual = ++sequencia;
    q('#tabela').innerHTML = estados.loading();
    try {
      const resposta = await dividas.listarPagina({ busca: estado.busca, status: estado.status, ordem: estado.ordem, pagina: estado.pagina, porPagina: POR_PAGINA });
      if (atual !== sequencia || signal?.aborted || !el.isConnected) return;
      estado.pagina = resposta.pagina;
      gravarUrl();
      const itens = resposta.itens ?? [];
      q('#tabela').innerHTML = itens.length
        ? `<div class="rolagem"><table class="financial-table"><thead><tr><th>Cliente</th><th>Descrição</th><th>Registro</th><th>Vencimento</th><th class="num">Original</th><th class="num">Saldo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${itens.map(linha).join('')}</tbody></table></div>`
        : estados.empty(estado.busca || estado.status ? 'Nenhuma dívida encontrada com estes filtros.' : 'Nenhuma dívida registrada ainda.');
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
  q('#tabela').addEventListener('click', (event) => { if (event.target.closest('[data-retry], [data-acao="retry"]')) carregar(); });
  carregar();
}
