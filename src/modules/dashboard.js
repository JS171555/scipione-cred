import { pagina, badgeStatus } from '../components/pagina.js';
import { itemHistorico } from '../components/historico.js';
import * as dashboard from '../services/dashboard.js';
import * as auditoria from '../services/auditoria.js';
import { nomesPorId } from '../services/devedores.js';
import { formatarBRL } from '../utils/money.js';
import { formatarData } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc } from '../core/dom.js';

export async function renderDashboard(raiz, { admin }) {
  const el = pagina(raiz, { titulo: 'Visão geral' });
  el.innerHTML = '<p>Carregando…</p>';
  try {
    const [ind, ultimos, recentes] = await Promise.all([dashboard.obterIndicadores(), dashboard.ultimosCadastros(5), auditoria.listarRecentes(10)]);
    const nomes = await nomesPorId(recentes.map((r) => r.devedor_id));
    const card = (rotulo, valor, extra = '') => `<div class="card ${extra}"><span class="rot">${esc(rotulo)}</span><strong>${esc(valor)}</strong></div>`;
    el.innerHTML = `<div class="atalhos"><a class="btn" href="#/devedores/novo">Cadastrar novo devedor</a><a class="btn sec" href="#/devedores">Consultar todos os devedores</a></div>
      <div class="cards">
        ${card('Devedores cadastrados', ind.total_devedores)}${card('Clientes ativos', ind.devedores_ativos)}${card('Clientes inativos', ind.devedores_inativos)}
        ${card('Dívidas em aberto', ind.dividas_em_aberto)}${card('Dívidas quitadas', ind.dividas_quitadas)}${card('Valor total em aberto', formatarBRL(ind.valor_total_em_aberto), 'destaque')}
      </div>
      <h2>Últimos cadastros</h2>
      ${ultimos.length ? `<div class="rolagem"><table><thead><tr><th>Nome / razão social</th><th>Cadastro</th><th>Status</th><th class="num">Em aberto</th></tr></thead><tbody>
        ${ultimos.map((d) => `<tr><td><a href="#/devedores/${esc(d.id)}">${esc(d.nome_razao_social)}</a></td><td>${formatarData(d.created_at)}</td><td>${badgeStatus(d.status)}</td><td class="num">${formatarBRL(d.total_em_aberto)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="vazio">Nenhum devedor cadastrado ainda. Comece em “Cadastrar novo devedor”.</p>'}
      <h2>Registros recentes</h2>
      ${recentes.length ? `<ol class="historico">${recentes.map((m) => itemHistorico(m, { admin, nomes })).join('')}</ol>` : '<p class="vazio">Nenhuma movimentação registrada.</p>'}`;
  } catch (e) { el.innerHTML = `<p class="msg erro" role="alert">${esc(traduzirErro(e))}</p>`; }
}
