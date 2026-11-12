// Regras financeiras centralizadas (espelham o banco, que é a fonte final de verdade).
// Saldo = valor original − soma dos pagamentos válidos. Sem juros, multas ou parcelamento.
import { dataISOValida } from '../utils/dates.js';

export const pagamentoValido = (p) => p.status === 'valido';

export function totalPagoCentavos(pagamentos) {
  return pagamentos.filter(pagamentoValido).reduce((s, p) => s + p.valorC, 0);
}

export const calcularSaldo = (valorOriginalC, pagamentos) => valorOriginalC - totalPagoCentavos(pagamentos);
export const statusDivida = (valorOriginalC, pagoC) => (valorOriginalC - pagoC <= 0 ? 'quitada' : 'em_aberto');

/** Validação de UX antes de chamar o banco. Retorna lista de erros (vazia = ok). */
export function validarPagamento({ valorC, saldoC, dataISO, dataRegistroISO, hojeISO }) {
  const erros = [];
  if (!Number.isInteger(valorC) || valorC <= 0) erros.push('Informe um valor maior que zero.');
  else if (valorC > saldoC) erros.push('O pagamento não pode ser maior que o saldo restante.');
  if (!dataISOValida(dataISO)) erros.push('Informe uma data de pagamento válida.');
  else {
    if (dataISO > hojeISO) erros.push('A data do pagamento não pode ser futura.');
    if (dataRegistroISO && dataISO < dataRegistroISO) erros.push('A data do pagamento não pode ser anterior ao registro da dívida.');
  }
  return erros;
}

export function validarDivida({ descricao, valorC, dataRegistroISO, vencimentoISO, hojeISO, valorMinimoC = 0 }) {
  const erros = [];
  if (String(descricao ?? '').trim().length < 2) erros.push('Informe a descrição ou motivo da dívida.');
  if (!Number.isInteger(valorC) || valorC <= 0) erros.push('Informe um valor maior que zero.');
  else if (valorC < valorMinimoC) erros.push('O valor não pode ser menor que o total já pago.');
  if (dataRegistroISO !== undefined) {
    if (!dataISOValida(dataRegistroISO)) erros.push('Informe uma data de registro válida.');
    else if (dataRegistroISO > hojeISO) erros.push('A data do registro não pode ser futura.');
  }
  if (vencimentoISO) {
    if (!dataISOValida(vencimentoISO)) erros.push('Data de vencimento inválida.');
    else if (dataRegistroISO && vencimentoISO < dataRegistroISO) erros.push('O vencimento não pode ser anterior ao registro.');
  }
  return erros;
}

/** Totais de um devedor a partir das dívidas (cada uma com valor_original, total_pago, saldo, status do banco). */
export function totaisDevedor(dividas, paraC) {
  const t = { registradoC: 0, pagoC: 0, emAbertoC: 0, abertas: 0, quitadas: 0 };
  for (const d of dividas) {
    t.registradoC += paraC(d.valor_original);
    t.pagoC += paraC(d.total_pago);
    t.emAbertoC += paraC(d.saldo);
    if (d.status === 'quitada') t.quitadas += 1; else t.abertas += 1;
  }
  return t;
}
