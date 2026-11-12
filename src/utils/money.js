// Dinheiro: sempre em centavos inteiros no frontend (sem ponto flutuante); banco usa numeric(14,2).
const MAX_CENTAVOS = 99_999_999_999_999; // numeric(14,2)

/** "1.500,25" | "1500,25" | "1500.25" | "R$ 300" → centavos (int) ou null se inválido/≤ 0. */
export function parseMoeda(texto) {
  let s = String(texto ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  const centavos = Math.round(Number(s) * 100);
  return Number.isSafeInteger(centavos) && centavos > 0 && centavos <= MAX_CENTAVOS ? centavos : null;
}

/** Valor que o banco devolve (number ou string numérica) → centavos inteiros. */
export const paraCentavos = (v) => Math.round(Number(v ?? 0) * 100);
/** centavos → string decimal "1500.25" para enviar ao banco (evita float). */
export const centavosParaDecimal = (c) => `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, '0')}`;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatarCentavos = (c) => BRL.format(c / 100);
/** Formata o valor do banco (numeric) em R$. */
export const formatarBRL = (v) => formatarCentavos(paraCentavos(v));
