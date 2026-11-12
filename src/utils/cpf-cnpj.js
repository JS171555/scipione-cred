// Validação e máscaras de documentos/contatos (espelha as regras do banco: valida_cpf_cnpj).
export const apenasDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function validarCPF(valor) {
  const c = apenasDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function validarCNPJ(valor) {
  const c = apenasDigitos(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (pesos) => {
    const soma = pesos.reduce((s, p, i) => s + Number(c[i]) * p, 0) % 11;
    return soma < 2 ? 0 : 11 - soma;
  };
  return dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[12])
      && dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(c[13]);
}

/** Documento é opcional (D-02): vazio é válido; informado precisa ser CPF (PF) ou CNPJ (PJ) válido. */
export function validarDocumento(tipoPessoa, valor) {
  if (!apenasDigitos(valor)) return true;
  return tipoPessoa === 'PJ' ? validarCNPJ(valor) : validarCPF(valor);
}

export function formatarCPF(v) { return apenasDigitos(v).slice(0, 11).replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, (_, a, b, c, d) => `${a}.${b}.${c}${d ? '-' + d : ''}`); }
export function formatarCNPJ(v) { return apenasDigitos(v).slice(0, 14).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, (_, a, b, c, d, e) => `${a}.${b}.${c}/${d}${e ? '-' + e : ''}`); }

/** Formata para exibição; se incompleto, devolve só os dígitos. */
export function formatarDocumento(valor) {
  const d = apenasDigitos(valor);
  if (d.length === 11) return formatarCPF(d);
  if (d.length === 14) return formatarCNPJ(d);
  return d;
}

export function formatarTelefone(valor) {
  const d = apenasDigitos(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function formatarCEP(valor) {
  const d = apenasDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
