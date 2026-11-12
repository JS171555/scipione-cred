import { pagina } from '../components/pagina.js';
import * as dividas from '../services/dividas.js';
import * as devedores from '../services/devedores.js';
import * as pagamentos from '../services/pagamentos.js';
import { validarPagamento } from '../domain/financeiro.js';
import { parseMoeda, paraCentavos, centavosParaDecimal, formatarCentavos } from '../utils/money.js';
import { hojeISO } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';
import { uploadField, instalarUpload, validarSelecaoUpload, marcarUpload } from '../components/upload.js';

const q = (sel, raiz) => $(sel, raiz);

/** Registro de pagamento (/dividas/:dividaId/pagamento). */
export async function renderPagamentoForm(raiz, { params, admin, signal } = {}) {
  const divida = await dividas.obter(params?.dividaId);
  if (signal?.aborted) return;
  const devedor = divida?.devedor_id && typeof devedores.obter === 'function' ? await devedores.obter(divida.devedor_id) : null;
  if (signal?.aborted) return;
  const el = pagina(raiz, { titulo: 'Registrar pagamento', descricao: 'Atualize o saldo com um lançamento auditável.', voltar: { href: `/devedores/${divida?.devedor_id ?? ''}`, texto: 'Voltar ao cliente' }, admin });
  if (!divida) { el.innerHTML = '<div class="error-state" role="alert"><h2>Dívida não encontrada.</h2></div>'; return; }
  const saldoC = paraCentavos(divida.saldo);
  if (saldoC <= 0) { el.innerHTML = '<div class="empty-state"><h2>Esta dívida já está quitada.</h2><p>Nenhum novo pagamento pode ser registrado.</p></div>'; return; }
  const originalC = paraCentavos(divida.valor_original); const pagoC = paraCentavos(divida.total_pago); const hoje = hojeISO();
  const chave = crypto.randomUUID(); // uma chave por abertura; reenvio/duplo clique não duplica
  el.innerHTML = `<div class="form-summary"><span class="auth-eyebrow">Pagamento</span><strong>${esc(devedor?.nome_razao_social ?? 'Cliente')}</strong><small>${esc(divida.descricao)}</small></div>
    <section class="form-section" aria-labelledby="saldo-atual-titulo"><h2 id="saldo-atual-titulo" class="form-section-title">Posição atual</h2>
      <dl class="resumo"><div><dt>Valor original</dt><dd>${formatarCentavos(originalC)}</dd></div><div><dt>Total pago</dt><dd>${formatarCentavos(pagoC)}</dd></div><div><dt>Saldo restante</dt><dd id="saldo-restante"><strong>${formatarCentavos(saldoC)}</strong></dd></div></dl>
    </section>
    <form id="form" class="form-panel" novalidate><section class="form-section" aria-labelledby="novo-pagamento-titulo"><h2 id="novo-pagamento-titulo" class="form-section-title">Novo pagamento</h2>
      <div class="form-grid"><div class="field"><label for="valor">Valor pago (R$)<input id="valor" inputmode="decimal" placeholder="0,00" required aria-describedby="valor-erro"></label><p class="erro-campo" id="valor-erro" data-erro="valor" role="alert" hidden></p><button type="button" id="quitar" class="btn sec peq">Quitar total (${esc(formatarCentavos(saldoC))})</button></div>
      <div class="field"><label for="data">Data do pagamento<input id="data" type="date" min="${esc(divida.data_registro)}" max="${hoje}" value="${hoje}" required aria-describedby="data-erro"></label><p class="erro-campo" id="data-erro" data-erro="data" role="alert" hidden></p></div>
      ${uploadField({ id: 'arquivo', label: 'Comprovante', categoria: 'comprovante', accept: '.png,.jpg,.jpeg,.avif,.webp,.pdf', help: 'Opcional · PNG, JPG, JPEG, AVIF, WEBP ou PDF.' })}</div>
      <label for="obs">Observação <small>(opcional)</small><textarea id="obs" rows="3"></textarea></label>
    </section>
    <section class="form-section form-summary-live" aria-labelledby="apos-titulo"><h2 id="apos-titulo" class="form-section-title">Após este lançamento</h2><dl class="resumo"><div><dt>Novo pagamento</dt><dd id="novo-pagamento">—</dd></div><div><dt>Saldo após o pagamento</dt><dd id="saldo-apos"><strong>${formatarCentavos(saldoC)}</strong></dd></div></dl><p class="field-note">O banco confirma o saldo final e a idempotência da operação.</p></section>
    <p class="msg erro" id="msg" role="alert" aria-live="assertive" hidden></p><div class="form-actions"><a class="btn sec" href="#/devedores/${esc(divida.devedor_id)}">Cancelar</a><button type="submit" id="salvar" class="btn-primary">Registrar pagamento</button></div></form>`;

  instalarUpload(q('#arquivo', raiz), { categoria: 'comprovante' });
  const atualizarResumo = () => {
    const valorC = parseMoeda(q('#valor', raiz).value) ?? 0; const restante = Math.max(0, saldoC - valorC);
    q('#novo-pagamento', raiz).textContent = valorC ? formatarCentavos(valorC) : '—';
    q('#saldo-apos', raiz).innerHTML = `<strong>${formatarCentavos(restante)}</strong>`;
  };
  q('#valor', raiz).addEventListener('input', atualizarResumo); atualizarResumo();
  q('#quitar', raiz).addEventListener('click', () => { q('#valor', raiz).value = centavosParaDecimal(saldoC).replace('.', ','); atualizarResumo(); q('#valor', raiz).focus(); });

  let submetendo = false;
  q('#form', raiz).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (submetendo || signal?.aborted || !el.isConnected) return;
    submetendo = true;
    const botao = q('#salvar', raiz); ocupado(botao, true, 'Validando…'); mostrarMensagem(q('#msg', raiz), '');
    try {
      const valorC = parseMoeda(q('#valor', raiz).value);
      const erros = validarPagamento({ valorC, saldoC, dataISO: q('#data', raiz).value, dataRegistroISO: divida.data_registro, hojeISO: hoje });
      const arquivoInput = q('#arquivo', raiz);
      const resultadoArquivo = await validarSelecaoUpload(arquivoInput, 'comprovante');
      if (signal?.aborted || !el.isConnected) return;
      if (!resultadoArquivo.valido) { mostrarMensagem(q('#msg', raiz), `Comprovante: ${resultadoArquivo.erro ?? 'Seleção inválida.'}`); arquivoInput.focus(); return; }
      const arquivo = resultadoArquivo.arquivos[0] ?? null;
      if (erros.length) { mostrarMensagem(q('#msg', raiz), erros.join(' ')); return; }
      marcarUpload(arquivoInput, true, 'Enviando comprovante…'); ocupado(botao, true, 'Registrando…');
      await pagamentos.registrar({ dividaId: divida.id, valorC, data: q('#data', raiz).value, observacao: q('#obs', raiz).value.trim(), arquivo, chave });
      if (signal?.aborted || !el.isConnected) return;
      const restante = saldoC - valorC;
      definirAviso(restante === 0 ? `Pagamento de ${formatarCentavos(valorC)} registrado. Dívida quitada.` : `Pagamento de ${formatarCentavos(valorC)} registrado. Saldo restante: ${formatarCentavos(restante)}.`);
      navegar(`/devedores/${divida.devedor_id}`);
    } catch (e) { if (!signal?.aborted && el.isConnected) mostrarMensagem(q('#msg', raiz), traduzirErro(e)); }
    finally { submetendo = false; if (el.isConnected) { ocupado(botao, false); marcarUpload(q('#arquivo', raiz), false); } }
  });
}
