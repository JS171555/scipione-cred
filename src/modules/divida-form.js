import { pagina } from '../components/pagina.js';
import * as dividas from '../services/dividas.js';
import * as devedores from '../services/devedores.js';
import { validarDivida } from '../domain/financeiro.js';
import { parseMoeda, paraCentavos, centavosParaDecimal } from '../utils/money.js';
import { hojeISO } from '../utils/dates.js';
import { traduzirErro } from '../core/errors.js';
import { esc, $, mostrarMensagem, ocupado } from '../core/dom.js';
import { navegar, definirAviso } from '../core/router.js';

/** Nova dívida (/devedores/:id/dividas/nova) e edição (/dividas/:id/editar). */
export async function renderDividaForm(raiz, { params }) {
  const editando = Boolean(params.dividaId);
  const divida = editando ? await dividas.obter(params.dividaId) : null;
  const devedorId = editando ? divida?.devedor_id : params.id;
  const devedor = devedorId ? await devedores.obter(devedorId) : null;
  const el = pagina(raiz, { titulo: editando ? 'Editar dívida' : 'Nova dívida', voltar: { href: `/devedores/${devedorId ?? ''}`, texto: 'Voltar ao devedor' } });
  if (!devedor || (editando && !divida)) { el.textContent = 'Registro não encontrado.'; return; }
  if (!editando && devedor.status !== 'ativo') { el.innerHTML = '<p class="msg erro">Devedor inativo: reative o cadastro antes de registrar uma nova dívida.</p>'; return; }

  const pagoC = editando ? paraCentavos(divida.total_pago) : 0;
  const hoje = hojeISO();
  el.innerHTML = `<p>Devedor: <strong>${esc(devedor.nome_razao_social)}</strong></p>
    <form id="form" novalidate><div class="grade">
      <label>Descrição / motivo<input id="descricao" maxlength="300" required value="${esc(divida?.descricao ?? '')}"></label>
      <label>Valor (R$)<input id="valor" inputmode="decimal" required placeholder="0,00" value="${divida ? esc(centavosParaDecimal(paraCentavos(divida.valor_original)).replace('.', ',')) : ''}">
        ${editando && pagoC ? `<small>Não pode ser menor que o total já pago (${esc(centavosParaDecimal(pagoC).replace('.', ','))}).</small>` : ''}</label>
      ${editando ? '' : `<label>Data do registro<input id="registro" type="date" max="${hoje}" value="${hoje}" required></label>`}
      <label>Vencimento (opcional)<input id="vencimento" type="date" value="${esc(divida?.data_vencimento ?? '')}" ${editando ? `min="${esc(divida.data_registro)}"` : ''}></label>
    </div><label>Observações<textarea id="obs" rows="3">${esc(divida?.observacoes ?? '')}</textarea></label>
    <p class="msg erro" id="msg" role="alert" hidden></p>
    <div class="acoes"><a class="btn sec" href="#/devedores/${esc(devedorId)}">Cancelar</a><button type="submit" id="salvar">${editando ? 'Salvar' : 'Registrar dívida'}</button></div></form>`;

  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const valorC = parseMoeda($('#valor').value);
    const dataRegistroISO = editando ? divida.data_registro : $('#registro').value;
    const erros = validarDivida({ descricao: $('#descricao').value, valorC, dataRegistroISO, vencimentoISO: $('#vencimento').value, hojeISO: hoje, valorMinimoC: pagoC });
    if (erros.length) return mostrarMensagem($('#msg'), erros.join(' '));
    const botao = $('#salvar');
    ocupado(botao, true, 'Salvando…');
    try {
      if (editando) {
        await dividas.editar(divida.id, { descricao: $('#descricao').value.trim(), observacoes: $('#obs').value.trim(), vencimento: $('#vencimento').value });
        if (valorC !== paraCentavos(divida.valor_original)) await dividas.alterarValor(divida.id, valorC);
      } else {
        await dividas.registrar({ devedorId, descricao: $('#descricao').value, valorC, dataRegistro: dataRegistroISO, vencimento: $('#vencimento').value, observacoes: $('#obs').value.trim() });
      }
      definirAviso(editando ? 'Dívida atualizada.' : 'Dívida registrada.');
      navegar(`/devedores/${devedorId}`);
    } catch (e) { mostrarMensagem($('#msg'), traduzirErro(e)); }
    finally { ocupado(botao, false); }
  });
}
