import { pagina } from '../components/pagina.js';
import * as dividas from '../services/dividas.js';
import * as pagamentos from '../services/pagamentos.js';
import { validarPagamento } from '../domain/financeiro.js';
import { parseMoeda, paraCentavos, centavosParaDecimal, formatarCentavos } from '../utils/money.js';
import { hojeISO } from '../utils/dates.js';
import { validarArquivo } from '../utils/files.js';
import { obterLimitesUpload } from '../services/configuracoes.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';

/** Registro de pagamento (/dividas/:dividaId/pagamento). */
export async function renderPagamentoForm(raiz, { params }) {
  const divida = await dividas.obter(params.dividaId);
  const el = pagina(raiz, { titulo: 'Registrar pagamento', voltar: { href: `/devedores/${divida?.devedor_id ?? ''}`, texto: 'Voltar ao devedor' } });
  if (!divida) { el.textContent = 'Dívida não encontrada.'; return; }
  const saldoC = paraCentavos(divida.saldo);
  if (saldoC <= 0) { el.innerHTML = '<p>Esta dívida já está quitada.</p>'; return; }
  const hoje = hojeISO();
  const chave = crypto.randomUUID();   // gerada uma vez por abertura: duplo clique/reenvio não duplica

  el.innerHTML = `<dl class="resumo"><div><dt>Dívida</dt><dd>${esc(divida.descricao)}</dd></div>
      <div><dt>Valor original</dt><dd>${formatarCentavos(paraCentavos(divida.valor_original))}</dd></div>
      <div><dt>Total pago</dt><dd>${formatarCentavos(paraCentavos(divida.total_pago))}</dd></div>
      <div><dt>Saldo restante</dt><dd><strong>${formatarCentavos(saldoC)}</strong></dd></div></dl>
    <form id="form" novalidate><div class="grade">
      <label>Valor pago (R$)<input id="valor" inputmode="decimal" placeholder="0,00" required>
        <button type="button" id="quitar" class="sec peq">Quitar total (${esc(formatarCentavos(saldoC))})</button></label>
      <label>Data do pagamento<input id="data" type="date" min="${esc(divida.data_registro)}" max="${hoje}" value="${hoje}" required></label>
      <label>Comprovante (opcional)<input id="arquivo" type="file" accept=".png,.jpg,.jpeg,.avif,.webp,.pdf"></label>
    </div><label>Observação (opcional)<textarea id="obs" rows="2"></textarea></label>
    <p class="msg erro" id="msg" role="alert" hidden></p>
    <div class="acoes"><a class="btn sec" href="#/devedores/${esc(divida.devedor_id)}">Cancelar</a><button type="submit" id="salvar">Registrar pagamento</button></div></form>`;

  $('#quitar').addEventListener('click', () => { $('#valor').value = centavosParaDecimal(saldoC).replace('.', ','); });
  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const valorC = parseMoeda($('#valor').value);
    const erros = validarPagamento({ valorC, saldoC, dataISO: $('#data').value, dataRegistroISO: divida.data_registro, hojeISO: hoje });
    const arquivo = $('#arquivo').files[0] ?? null;
    if (arquivo) {
      const v = await validarArquivo(arquivo, 'comprovante', (await obterLimitesUpload()).comprovante);
      if (!v.valido) erros.push(`Comprovante: ${v.erro}`);
    }
    if (erros.length) return mostrarMensagem($('#msg'), erros.join(' '));
    const botao = $('#salvar');
    ocupado(botao, true, 'Registrando…');
    try {
      await pagamentos.registrar({ dividaId: divida.id, valorC, data: $('#data').value, observacao: $('#obs').value.trim(), arquivo, chave });
      const restante = saldoC - valorC;
      definirAviso(restante === 0 ? `Pagamento de ${formatarCentavos(valorC)} registrado. Dívida quitada.` : `Pagamento de ${formatarCentavos(valorC)} registrado. Saldo restante: ${formatarCentavos(restante)}.`);
      navegar(`/devedores/${divida.devedor_id}`);
    } catch (e) { mostrarMensagem($('#msg'), traduzirErro(e)); }
    finally { ocupado(botao, false); }
  });
}
