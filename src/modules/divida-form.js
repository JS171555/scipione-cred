import { pagina } from '../components/pagina.js';
import * as dividas from '../services/dividas.js';
import * as devedores from '../services/devedores.js';
import { validarDivida, statusDivida } from '../domain/financeiro.js';
import { parseMoeda, paraCentavos, centavosParaDecimal, formatarCentavos } from '../utils/money.js';
import { hojeISO } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';

const q = (sel, raiz) => $(sel, raiz);
const statusTexto = (status) => status === 'quitada' ? 'Quitada' : 'Em aberto';

/** Nova dívida (/devedores/:id/dividas/nova) e edição (/dividas/:id/editar). */
export async function renderDividaForm(raiz, { params, admin, signal } = {}) {
  const editando = Boolean(params?.dividaId);
  const divida = editando ? await dividas.obter(params.dividaId) : null;
  if (signal?.aborted) return;
  const devedorId = editando ? divida?.devedor_id : params?.id;
  const devedor = devedorId ? await devedores.obter(devedorId) : null;
  if (signal?.aborted) return;
  const el = pagina(raiz, { titulo: editando ? 'Editar dívida' : 'Nova dívida', descricao: 'Registre somente o valor principal e acompanhe o saldo real.', voltar: { href: `/devedores/${devedorId ?? ''}`, texto: 'Voltar ao cliente' }, admin });
  if (!devedor || (editando && !divida)) { el.innerHTML = '<div class="error-state" role="alert"><h2>Registro não encontrado.</h2></div>'; return; }
  if (!editando && devedor.status !== 'ativo') { el.innerHTML = '<div class="error-state" role="alert"><h2>Devedor inativo.</h2><p>Devedor inativo: reative o cadastro antes de registrar uma nova dívida.</p></div>'; return; }

  const pagoC = editando ? paraCentavos(divida.total_pago) : 0;
  const hoje = hojeISO();
  const valorInicial = divida ? centavosParaDecimal(paraCentavos(divida.valor_original)).replace('.', ',') : '';
  el.innerHTML = `<form id="form" class="form-panel" novalidate>
    <div class="form-summary"><span class="auth-eyebrow">Cliente</span><strong>${esc(devedor.nome_razao_social)}</strong><small>O status é calculado a partir do valor e dos pagamentos válidos.</small></div>
    <section class="form-section" aria-labelledby="divida-dados-titulo"><h2 id="divida-dados-titulo" class="form-section-title">Dados da dívida</h2>
      <div class="form-grid">
        <div class="field"><label for="descricao">Descrição / motivo<input id="descricao" maxlength="300" required value="${esc(divida?.descricao ?? '')}" aria-describedby="descricao-erro"></label><p class="erro-campo" id="descricao-erro" data-erro="descricao" role="alert" hidden></p></div>
        <div class="field"><label for="valor">Valor principal (R$)<input id="valor" inputmode="decimal" required placeholder="0,00" value="${esc(valorInicial)}" aria-describedby="valor-erro"></label><p class="erro-campo" id="valor-erro" data-erro="valor" role="alert" hidden></p>${editando && pagoC ? `<small>Não pode ser menor que o total já pago (${esc(centavosParaDecimal(pagoC).replace('.', ','))}).</small>` : ''}</div>
        ${editando ? '' : `<div class="field"><label for="registro">Data do registro<input id="registro" type="date" max="${hoje}" value="${hoje}" required aria-describedby="registro-erro"></label><p class="erro-campo" id="registro-erro" data-erro="registro" role="alert" hidden></p></div>`}
        <div class="field"><label for="vencimento">Vencimento <small>(opcional)</small><input id="vencimento" type="date" value="${esc(divida?.data_vencimento ?? '')}" ${editando ? `min="${esc(divida.data_registro)}"` : ''} aria-describedby="vencimento-erro"></label><p class="erro-campo" id="vencimento-erro" data-erro="vencimento" role="alert" hidden></p></div>
      </div>
      <label for="obs">Observações <small>(opcional)</small><textarea id="obs" rows="4">${esc(divida?.observacoes ?? '')}</textarea>
    </section>
    <section class="form-section form-summary-live" aria-labelledby="resumo-titulo"><h2 id="resumo-titulo" class="form-section-title">Resumo antes de registrar</h2>
      <dl class="resumo"><div><dt>Valor informado</dt><dd id="resumo-valor">—</dd></div><div><dt>Status derivado</dt><dd id="resumo-status"><span class="badge em_aberto">Em aberto</span></dd></div></dl>
      <p id="resumo-nota" class="field-note">Sem juros, multas, encargos ou parcelamento. O saldo final considera pagamentos válidos no banco.</p>
    </section>
    <p class="msg erro" id="msg" role="alert" aria-live="assertive" hidden></p>
    <div class="form-actions"><a class="btn sec" href="#/devedores/${esc(devedorId)}">Cancelar</a><button type="submit" id="salvar" class="btn-primary">${editando ? 'Salvar dívida' : 'Registrar dívida'}</button></div>
  </form>`;

  const atualizarResumo = () => {
    const valorC = parseMoeda(q('#valor', raiz).value);
    q('#resumo-valor', raiz).textContent = valorC ? formatarCentavos(valorC) : '—';
    const status = statusDivida(valorC ?? 0, pagoC);
    q('#resumo-status', raiz).innerHTML = `<span class="badge ${status}">${statusTexto(status)}</span>`;
  };
  q('#valor', raiz).addEventListener('input', atualizarResumo); atualizarResumo();
  const limparCampos = () => raiz.querySelectorAll('[data-erro]').forEach((span) => { span.textContent = ''; span.hidden = true; });
  const indicarErro = (id) => { const input = q(`#${id}`, raiz); const span = q(`[data-erro="${id}"]`, raiz); input?.setAttribute('aria-invalid', 'true'); if (span) { span.textContent = 'Revise este campo.'; span.hidden = false; } };
  let submetendo = false;
  q('#form', raiz).addEventListener('submit', async (ev) => {
    ev.preventDefault(); limparCampos(); raiz.querySelectorAll('[aria-invalid=true]').forEach((x) => x.removeAttribute('aria-invalid')); mostrarMensagem(q('#msg', raiz), '');
    if (submetendo || signal?.aborted || !el.isConnected) return;
    const valorC = parseMoeda(q('#valor', raiz).value); const dataRegistroISO = editando ? divida.data_registro : q('#registro', raiz).value;
    const erros = validarDivida({ descricao: q('#descricao', raiz).value, valorC, dataRegistroISO, vencimentoISO: q('#vencimento', raiz).value, hojeISO: hoje, valorMinimoC: pagoC });
    if (erros.length) { if (!q('#descricao', raiz).value.trim()) indicarErro('descricao'); if (!valorC || (valorC < pagoC)) indicarErro('valor'); mostrarMensagem(q('#msg', raiz), erros.join(' ')); (q('[aria-invalid=true]', raiz) ?? q('#descricao', raiz)).focus(); return; }
    const botao = q('#salvar', raiz); submetendo = true; ocupado(botao, true, 'Salvando…');
    try {
      if (editando) {
        await dividas.editar(divida.id, { descricao: q('#descricao', raiz).value.trim(), observacoes: q('#obs', raiz).value.trim(), vencimento: q('#vencimento', raiz).value });
        if (signal?.aborted || !el.isConnected) return;
        if (valorC !== paraCentavos(divida.valor_original)) { await dividas.alterarValor(divida.id, valorC); if (signal?.aborted || !el.isConnected) return; }
      }
      else await dividas.registrar({ devedorId, descricao: q('#descricao', raiz).value, valorC, dataRegistro: dataRegistroISO, vencimento: q('#vencimento', raiz).value, observacoes: q('#obs', raiz).value.trim() });
      if (signal?.aborted || !el.isConnected) return;
      definirAviso(editando ? 'Dívida atualizada.' : 'Dívida registrada.'); navegar(`/devedores/${devedorId}`);
    } catch (e) { if (!signal?.aborted && el.isConnected) mostrarMensagem(q('#msg', raiz), traduzirErro(e)); }
    finally { submetendo = false; if (el.isConnected) ocupado(botao, false); }
  });
}
