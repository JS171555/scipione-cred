import { pagina, badgeStatus } from '../components/pagina.js';
import * as devedores from '../services/devedores.js';
import * as dividas from '../services/dividas.js';
import { formatarBRL } from '../utils/money.js';
import { formatarData } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc } from '../core/dom.js';
import { loadingState, emptyState, errorState } from '../components/states.js';

const POR_PAGINA = 20;
const estadoView = {
  loading: loadingState,
  empty: (texto) => emptyState(texto),
  error: errorState,
};
const paginacao = (r) => {
  if (!r.total) return '';
  const ultima = Math.max(1, Math.ceil(r.total / r.porPagina));
  const de = (r.pagina - 1) * r.porPagina + 1;
  const ate = Math.min(r.total, r.pagina * r.porPagina);
  return `<span>Mostrando ${de}–${ate} de ${r.total}</span><span class="acoes-linha"><button type="button" class="sec peq" data-pg="${r.pagina - 1}" ${r.pagina <= 1 ? 'disabled' : ''}>Anterior</button><span>Página ${r.pagina} de ${ultima}</span><button type="button" class="sec peq" data-pg="${r.pagina + 1}" ${r.pagina >= ultima ? 'disabled' : ''}>Próxima</button></span>`;
};

function montar(raiz, { consulta, admin, signal, tipo }) {
  const pagamento = tipo === 'pagamento';
  const rota = pagamento ? '/pagamentos/novo' : '/dividas/nova';
  const el = pagina(raiz, { titulo: pagamento ? 'Selecionar dívida' : 'Selecionar cliente', descricao: pagamento ? 'Escolha uma dívida em aberto para registrar o recebimento.' : 'Escolha um cliente ativo para registrar uma nova dívida.', voltar: { href: pagamento ? '/pagamentos' : '/dividas', texto: pagamento ? 'Pagamentos' : 'Dívidas' }, admin });
  const estado = { busca: consulta.get('q') ?? '', pagina: Math.max(1, Number.parseInt(consulta.get('p'), 10) || 1) };
  el.innerHTML = `<div data-selecao="${tipo}"><div class="list-toolbar barra"><label class="search-field"><span class="sr-only">Buscar</span><input id="busca" type="search" aria-label="Buscar" placeholder="${pagamento ? 'Buscar cliente ou descrição da dívida' : 'Buscar cliente por nome ou documento'}" value="${esc(estado.busca)}"></label></div>
    <p class="msg" aria-live="polite">${pagamento ? 'Somente dívidas em aberto podem receber pagamentos.' : 'Clientes inativos não podem receber novas dívidas.'}</p>
    <div id="lista" aria-live="polite">${estadoView.loading()}</div><div id="paginacao" class="paginacao"></div></div>`;

  const q = (seletor) => el.querySelector(seletor);
  const gravarUrl = () => {
    const qs = new URLSearchParams();
    if (estado.busca) qs.set('q', estado.busca);
    if (estado.pagina > 1) qs.set('p', String(estado.pagina));
    history.replaceState(null, '', `#${rota}${qs.size ? `?${qs}` : ''}`);
  };
  let sequencia = 0;
  const carregar = async () => {
    if (signal?.aborted || !el.isConnected) return;
    const atual = ++sequencia;
    q('#lista').innerHTML = estadoView.loading();
    try {
      const resposta = pagamento
        ? await dividas.listarPagina({ busca: estado.busca, status: 'em_aberto', ordem: 'recentes', pagina: estado.pagina, porPagina: POR_PAGINA })
        : await devedores.listarPagina({ busca: estado.busca, status: 'ativo', situacao: '', ordem: 'nome_asc', pagina: estado.pagina, porPagina: POR_PAGINA });
      if (atual !== sequencia || signal?.aborted || !el.isConnected) return;
      estado.pagina = resposta.pagina;
      gravarUrl();
      const itens = resposta.itens ?? [];
      q('#lista').innerHTML = itens.length
        ? pagamento ? `<div class="rolagem"><table class="financial-table"><thead><tr><th>Cliente</th><th>Dívida</th><th>Registro</th><th class="num">Saldo</th><th>Status</th><th></th></tr></thead><tbody>${itens.map((item) => `<tr><td data-label="Cliente">${esc(item.devedor_nome ?? item.nome_razao_social ?? '—')}</td><td data-label="Dívida"><strong>${esc(item.descricao ?? '—')}</strong></td><td data-label="Registro">${formatarData(item.data_registro)}</td><td data-label="Saldo" class="num">${item.saldo == null ? '—' : formatarBRL(item.saldo)}</td><td data-label="Status">${badgeStatus(item.status)}</td><td data-label="Ação"><a class="btn" data-selecionar="${esc(item.id)}" href="#/dividas/${esc(item.id)}/pagamento">Selecionar</a></td></tr>`).join('')}</tbody></table></div>`
          : `<div class="rolagem"><table class="financial-table"><thead><tr><th>Cliente</th><th>Documento</th><th>Status</th><th class="num">Em aberto</th><th></th></tr></thead><tbody>${itens.map((item) => `<tr><td data-label="Cliente"><strong>${esc(item.nome_razao_social)}</strong></td><td data-label="Documento">${esc(item.cpf_cnpj ?? '') || '—'}</td><td data-label="Status">${badgeStatus(item.status)}</td><td data-label="Em aberto" class="num">${item.total_em_aberto == null ? '—' : formatarBRL(item.total_em_aberto)}</td><td data-label="Ação"><a class="btn" data-selecionar="${esc(item.id)}" href="#/devedores/${esc(item.id)}/dividas/nova">Selecionar</a></td></tr>`).join('')}</tbody></table></div>`
        : estadoView.empty(estado.busca ? 'Nenhum registro encontrado com esta busca.' : pagamento ? 'Nenhuma dívida em aberto disponível.' : 'Nenhum cliente ativo disponível.');
      q('#paginacao').innerHTML = paginacao(resposta);
    } catch (erro) {
      if (atual !== sequencia || signal?.aborted || !el.isConnected) return;
      q('#lista').innerHTML = estadoView.error(traduzirErro(erro));
      q('#paginacao').innerHTML = '';
    }
  };
  const mudou = () => { estado.pagina = 1; carregar(); };
  let timer;
  q('#busca').addEventListener('input', (event) => { estado.busca = event.target.value.trim(); clearTimeout(timer); timer = setTimeout(mudou, 300); });
  q('#paginacao').addEventListener('click', (event) => { const botao = event.target.closest('[data-pg]'); if (botao && !botao.disabled) { estado.pagina = Number(botao.dataset.pg); carregar(); } });
  q('#lista').addEventListener('click', (event) => { if (event.target.closest('[data-retry], [data-acao="retry"]')) carregar(); });
  carregar();
}

export async function renderSelecionarDivida(raiz, { consulta = new URLSearchParams(), admin, signal } = {}) {
  return montar(raiz, { consulta, admin, signal, tipo: 'divida' });
}

export async function renderSelecionarPagamento(raiz, { consulta = new URLSearchParams(), admin, signal } = {}) {
  return montar(raiz, { consulta, admin, signal, tipo: 'pagamento' });
}
