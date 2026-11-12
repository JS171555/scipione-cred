import { apenasDigitos, validarDocumento } from '../utils/cpf-cnpj.js';

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const vazioParaNull = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };

/**
 * Valida e normaliza os dados do formulário.
 * @returns {{ erros: Record<string,string>, dados: object }} dados prontos para o banco (strings vazias → null).
 */
export function validarDevedor(f) {
  const erros = {};
  const tipo = f.tipo_pessoa === 'PJ' ? 'PJ' : 'PF';
  const nome = String(f.nome_razao_social ?? '').replace(/\s+/g, ' ').trim();
  if (nome.length < 2) erros.nome_razao_social = tipo === 'PJ' ? 'Informe a razão social.' : 'Informe o nome completo.';

  const doc = apenasDigitos(f.cpf_cnpj);
  if (doc && !validarDocumento(tipo, doc)) erros.cpf_cnpj = tipo === 'PJ' ? 'CNPJ inválido.' : 'CPF inválido.';

  const email = vazioParaNull(f.email)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.email = 'E-mail inválido.';

  const tel = apenasDigitos(f.telefone); const cel = apenasDigitos(f.celular); const cep = apenasDigitos(f.cep);
  if (tel && !/^\d{10,11}$/.test(tel)) erros.telefone = 'Telefone deve ter DDD + número (10 ou 11 dígitos).';
  if (cel && !/^\d{10,11}$/.test(cel)) erros.celular = 'Celular deve ter DDD + número (10 ou 11 dígitos).';
  if (cep && cep.length !== 8) erros.cep = 'CEP deve ter 8 dígitos.';
  const uf = vazioParaNull(f.uf)?.toUpperCase() ?? null;
  if (uf && !UFS.includes(uf)) erros.uf = 'UF inválida.';

  return {
    erros,
    dados: {
      tipo_pessoa: tipo, nome_razao_social: nome, cpf_cnpj: doc || null, rg: vazioParaNull(f.rg),
      telefone: tel || null, celular: cel || null, email,
      cep: cep || null, logradouro: vazioParaNull(f.logradouro), numero: vazioParaNull(f.numero),
      complemento: vazioParaNull(f.complemento), bairro: vazioParaNull(f.bairro), cidade: vazioParaNull(f.cidade),
      uf, observacoes: vazioParaNull(f.observacoes),
    },
  };
}
