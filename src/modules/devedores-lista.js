import { pagina, badgeStatus } from '../components/pagina.js';
import { listarPagina, urlsFotos, ORDENS } from '../services/devedores.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem } from '../core/dom.js';
import { formatarDocumento, formatarTelefone } from '../utils/cpf-cnpj.js';
import { formatarBRL } from '../utils/money.js';

const POR_PAGINA = 20;
const opcoes = (lista, atual) => lista.map(([v, t]) => `<option value="${v}" ${v === atual ? 'selected' : ''}>${esc(t)}</option>`).join('');
const iniciais = (n) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

/** Lista com busca, filtros, ordenação e paginação. O estado fica na URL (#/devedores?q=…&status=…&situacao=…&ordem=…&p=…). */
export async function renderListaDevedores(raiz, { consulta = new URLSearchParams() } = {}) {
  const el = pagina(raiz, { titulo: 'Devedores' });
  const estado = {
    q: consulta.get('q') ?? '', status: ['ativo', 'inativo'].includes(consulta.get('status')) ? consulta.get('status') : '',
    situacao: ['em_aberto', 'quitados'].includes(consulta.get('situacao')) ? consulta.get('situacao') : '',
    ordem: ORDENS[consulta.get('ordem')] ? consulta.get('ordem') : 'nome_asc', p: Math.max(1, parseInt(consulta.get('p'), 10) || 1),
  };
  el.innerHTML = `<div class="barra"><input id="busca" type="search" placeholder="Buscar por nome, CPF, CNPJ, RG ou telefone" aria-label="Buscar" value="${esc(estado.q)}">
      <a class="btn" href="#/devedores/novo">Novo devedor</a></div>
    <div class="filtros">
      <label>Situação do cadastro<select id="f-status">${opcoes([['', 'Todos'], ['ativo', 'Clientes ativos'], ['inativo', 'Clientes inativos']], estado.status)}</select></label>
      <label>Situação das dívidas<select id="f-situacao">${opcoes([['', 'Todas'], ['em_aberto', 'Com dívidas em aberto'], ['quitados', 'Dívidas quitadas (nenhuma em aberto)']], estado.situacao)}</select></label>
      <label>Ordenar por<select id="f-ordem">${opcoes([['nome_asc', 'Nome (A–Z)'], ['nome_desc', 'Nome (Z–A)'], ['recentes', 'Cadastros mais recentes'], ['antigos', 'Cadastros mais antigos']], estado.ordem)}</select></label>
      <button type="button" id="limpar" class="sec peq">Limpar filtros</button></div>
    <p class="msg erro" id="msg" role="alert" hidden></p><div id="tabela" aria-live="polite">Carregando…</div><div id="paginacao" class="paginacao"></div>`;

  const gravarUrl = () => {
    const qs = new URLSearchParams();
    if (estado.q) qs.set('q', estado.q); if (estado.status) qs.set('status', estado.status); if (estado.situacao) qs.set('situacao', estado.situacao);
    if (estado.ordem !== 'nome_asc') qs.set('ordem', estado.ordem); if (estado.p > 1) qs.set('p', String(estado.p));
    history.replaceState(null, '', `#/devedores${qs.size ? `?${qs}` : ''}`);
  };
  let seq = 0;
  const carregar = async () => {
    const minha = ++seq;
    try {
      const r = await listarPagina({ busca: estado.q, status: estado.status, situacao: estado.situacao, ordem: estado.ordem, pagina: estado.p, porPagina: POR_PAGINA });
      if (minha !== seq) return;
      estado.p = r.pagina; gravarUrl();
      mostrarMensagem($('#msg'), '');
      const filtrando = estado.q || estado.status || estado.situacao;
      $('#tabela').innerHTML = r.itens.length ? `<div class="rolagem"><table><thead><tr><th></th><th>Nome / razão social</th><th>CPF/CNPJ</th><th>Contato</th><th>Status</th><th class="num">Em aberto</th></tr></thead><tbody>
        ${r.itens.map((d) => `<tr><td><span class="mini" data-foto="${esc(d.foto_path ?? '')}" aria-hidden="true">${esc(iniciais(d.nome_razao_social))}</span></td>
        <td><a href="#/devedores/${esc(d.id)}">${esc(d.nome_razao_social)}</a></td><td>${esc(formatarDocumento(d.cpf_cnpj)) || '—'}</td>
        <td>${esc(formatarTelefone(d.celular || d.telefone)) || '—'}</td><td>${badgeStatus(d.status)}</td><td class="num">${formatarBRL(d.total_em_aberto)}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="vazio">${filtrando ? 'Nenhum devedor encontrado com estes filtros.' : 'Nenhum devedor cadastrado ainda.'}</p>`;
      const ultima = Math.max(1, Math.ceil(r.total / r.porPagina));
      const de = r.total ? (r.pagina - 1) * r.porPagina + 1 : 0; const ate = Math.min(r.total, r.pagina * r.porPagina);
      $('#paginacao').innerHTML = r.total ? `<span>Mostrando ${de}–${ate} de ${r.total}</span><span class="acoes-linha">
        <button type="button" class="sec peq" data-pg="${r.pagina - 1}" ${r.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${r.pagina} de ${ultima}</span>
        <button type="button" class="sec peq" data-pg="${r.pagina + 1}" ${r.pagina >= ultima ? 'disabled' : ''}>Próxima</button></span>` : '';
      carregarFotos(r.itens);
    } catch (e) { if (minha === seq) { $('#tabela').innerHTML = ''; $('#paginacao').innerHTML = ''; mostrarMensagem($('#msg'), traduzirErro(e)); } }
  };
  async function carregarFotos(itens) {
    const urls = await urlsFotos(itens.map((i) => i.foto_path)).catch(() => ({}));
    document.querySelectorAll('#tabela .mini[data-foto]').forEach((m) => {
      const u = urls[m.dataset.foto];
      if (u) m.innerHTML = `<img src="${esc(u)}" alt="">`;
    });
  }
  const mudou = () => { estado.p = 1; carregar(); };
  let timer;
  $('#busca').addEventListener('input', (e) => { estado.q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(mudou, 300); });
  $('#f-status').addEventListener('change', (e) => { estado.status = e.target.value; mudou(); });
  $('#f-situacao').addEventListener('change', (e) => { estado.situacao = e.target.value; mudou(); });
  $('#f-ordem').addEventListener('change', (e) => { estado.ordem = e.target.value; mudou(); });
  $('#limpar').addEventListener('click', () => {
    Object.assign(estado, { q: '', status: '', situacao: '', ordem: 'nome_asc' });
    $('#busca').value = ''; $('#f-status').value = ''; $('#f-situacao').value = ''; $('#f-ordem').value = 'nome_asc'; mudou();
  });
  $('#paginacao').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg]');
    if (b && !b.disabled) { estado.p = Number(b.dataset.pg); carregar(); }
  });
  carregar();
}
