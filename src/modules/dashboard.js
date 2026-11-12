import { pagina, badgeStatus } from '../components/pagina.js';
import { itemHistorico } from '../components/historico.js';
import * as dashboard from '../services/dashboard.js';
import * as auditoria from '../services/auditoria.js';
import { nomesPorId } from '../services/devedores.js';
import { formatarBRL, formatarCentavos, paraCentavos } from '../utils/money.js';
import { formatarData } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc } from '../core/dom.js';
import { icon } from '../components/icons.js';
import { loadingState, errorState } from '../components/states.js';

const RECENTES = 5;

export async function renderDashboard(raiz, { admin }) {
  const el = pagina(raiz, { titulo: 'Visão geral', admin });
  el.innerHTML = loadingState('Carregando indicadores…');
  try {
    const totais = Object.keys(dashboard).includes('obterTotaisFinanceiros') ? dashboard.obterTotaisFinanceiros() : Promise.resolve(null);
    const [ind, ultimos, recentes, financeiros] = await Promise.all([dashboard.obterIndicadores(), dashboard.ultimosCadastros(RECENTES), auditoria.listarRecentes(RECENTES), totais]);
    if (!el.isConnected) return;
    const nomes = await nomesPorId(recentes.map((r) => r.devedor_id));
    if (!el.isConnected) return;
    const card = (rotulo, valor, ico, extra = '') => `<div class="card ${extra}"><span class="metric-icon">${icon(ico, 22)}</span><span class="rot" data-ui-copy>${esc(rotulo)}</span><strong>${esc(valor)}</strong></div>`;
    const centavos = (obj, campoC, campoDecimal) => {
      if (Number.isSafeInteger(obj?.[campoC])) return obj[campoC];
      if (obj?.[campoDecimal] != null && Number.isFinite(Number(obj[campoDecimal]))) return paraCentavos(obj[campoDecimal]);
      return null;
    };
    const registradoC = centavos(financeiros, 'totalRegistradoC', 'total_registrado');
    const recebidoC = centavos(financeiros, 'totalRecebidoC', 'total_recebido');
    const abertoC = centavos(financeiros, 'totalEmAbertoC', 'total_em_aberto');
    const visao = financeiros ? `<section class="financial-overview" aria-labelledby="resumo-financeiro">
        <div class="financial-hero"><span class="rot" id="resumo-financeiro">Saldo em aberto</span><strong>${abertoC === null ? '—' : formatarCentavos(abertoC)}</strong></div>
        <dl class="financial-breakdown"><div><dt>Total registrado</dt><dd>${registradoC === null ? '—' : formatarCentavos(registradoC)}</dd></div><div><dt>Total recebido</dt><dd>${recebidoC === null ? '—' : formatarCentavos(recebidoC)}</dd></div></dl></section>` : '';
    el.innerHTML = `<div class="atalhos"><a class="btn" data-ui-copy href="#/devedores/novo">${icon('user-plus', 16)} Cadastrar novo devedor</a><a class="btn sec" href="#/dividas/nova">${icon('plus', 16)} Registrar dívida</a><a class="btn sec" href="#/pagamentos/novo">${icon('wallet', 16)} Registrar pagamento</a><a class="btn sec" data-ui-copy href="#/devedores">${icon('users', 16)} Consultar todos os devedores</a></div>
      ${visao}
      <div class="cards">${card('Devedores cadastrados', ind.total_devedores, 'users')}${card('Clientes ativos', ind.devedores_ativos, 'user-round')}${card('Clientes inativos', ind.devedores_inativos, 'clock')}${card('Dívidas em aberto', ind.dividas_em_aberto, 'receipt-text')}${card('Dívidas quitadas', ind.dividas_quitadas, 'check-circle')}${card('Valor total em aberto', formatarBRL(ind.valor_total_em_aberto), 'banknote', 'destaque')}</div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-header"><h2>Últimos cadastros</h2><a href="#/devedores">Ver todos ${icon('arrow-up-right', 13)}</a></div>${ultimos.length ? `<div class="rolagem"><table class="financial-table"><thead><tr><th>Nome / razão social</th><th>Cadastro</th><th>Status</th><th class="num">Em aberto</th></tr></thead><tbody>${ultimos.map((d) => `<tr><td data-label="Nome / razão social"><a href="#/devedores/${esc(d.id)}">${esc(d.nome_razao_social)}</a></td><td data-label="Cadastro">${formatarData(d.created_at)}</td><td data-label="Status">${badgeStatus(d.status)}</td><td data-label="Em aberto" class="num">${formatarBRL(d.total_em_aberto)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state vazio" data-ui-copy>Nenhum devedor cadastrado ainda.</p>'}</section>
      <section class="panel"><div class="panel-header"><h2>Atividades recentes</h2><a href="#/dividas">Ver movimentações ${icon('arrow-up-right', 13)}</a></div>${recentes.length ? `<ol class="historico">${recentes.map((m) => itemHistorico(m, { admin, nomes })).join('')}</ol>` : '<p class="vazio">Nenhuma movimentação registrada.</p>'}</section></div>`;
  } catch (e) {
    if (!el.isConnected) return;
    el.innerHTML = errorState(traduzirErro(e));
    el.querySelector('[data-retry]').addEventListener('click', () => renderDashboard(raiz, { admin }));
  }
}
