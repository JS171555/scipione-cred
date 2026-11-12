// Traduz registros de auditoria em frases legíveis (histórico de movimentações). Não expõe dados pessoais além do necessário.
import { formatarBRL } from '../utils/money.js';
import { formatarData } from '../utils/dates.js';

const ROTULOS = {
  tipo_pessoa: 'Tipo de pessoa', nome_razao_social: 'Nome/razão social', cpf_cnpj: 'CPF/CNPJ', rg: 'RG', telefone: 'Telefone', celular: 'Celular',
  email: 'E-mail', cep: 'CEP', logradouro: 'Logradouro', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade',
  uf: 'UF', observacoes: 'Observações', foto_path: 'Foto', descricao: 'Descrição', data_vencimento: 'Vencimento',
};

const camposAlterados = (antes = {}, depois = {}) =>
  Object.keys(ROTULOS).filter((k) => JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(depois?.[k] ?? null));

/** @returns {{ titulo: string, detalhe: string }} */
export function descreverMovimentacao(m, { descricaoDivida } = {}) {
  const a = m.dados_antes ?? {}; const d = m.dados_depois ?? {};
  const chave = `${m.entidade}:${m.operacao}`;
  switch (chave) {
    case 'devedores:INSERT': return { titulo: 'Devedor cadastrado', detalhe: d.nome_razao_social ?? '' };
    case 'devedores:STATUS': return { titulo: d.status === 'inativo' ? 'Cadastro inativado' : 'Cadastro reativado', detalhe: '' };
    case 'devedores:UPDATE': {
      const campos = camposAlterados(a, d);
      if (campos.length === 1 && campos[0] === 'foto_path') return { titulo: 'Foto atualizada', detalhe: '' };
      return { titulo: 'Cadastro atualizado', detalhe: campos.length ? `Campos: ${campos.map((c) => ROTULOS[c]).join(', ')}` : '' };
    }
    case 'dividas:INSERT': return { titulo: 'Dívida registrada', detalhe: `${d.descricao ?? ''} — ${formatarBRL(d.valor_original)}` };
    case 'dividas:STATUS': return { titulo: d.status === 'quitada' ? 'Dívida quitada' : 'Dívida reaberta', detalhe: d.descricao ?? '' };
    case 'dividas:UPDATE': {
      if (a.valor_original !== d.valor_original) return { titulo: 'Valor da dívida alterado', detalhe: `${d.descricao ?? ''}: ${formatarBRL(a.valor_original)} → ${formatarBRL(d.valor_original)}` };
      const campos = camposAlterados(a, d);
      return { titulo: 'Dívida editada', detalhe: `${d.descricao ?? ''}${campos.length ? ` (${campos.map((c) => ROTULOS[c]).join(', ')})` : ''}` };
    }
    case 'pagamentos:INSERT': return { titulo: 'Pagamento registrado', detalhe: `${formatarBRL(d.valor)} em ${formatarData(d.data_pagamento)}${descricaoDivida ? ` — ${descricaoDivida}` : ''}` };
    case 'pagamentos:ESTORNO': return { titulo: 'Pagamento estornado', detalhe: `${formatarBRL(d.valor)}${d.motivo_estorno ? ` — motivo: ${d.motivo_estorno}` : ''}${descricaoDivida ? ` (${descricaoDivida})` : ''}` };
    case 'pagamentos:UPDATE': return { titulo: 'Comprovante anexado ao pagamento', detalhe: `${formatarBRL(d.valor)}` };
    case 'devedor_documentos:INSERT': return { titulo: 'Documento anexado', detalhe: d.nome_original ?? '' };
    case 'devedor_documentos:REMOCAO': return { titulo: 'Documento removido', detalhe: d.nome_original ?? '' };
    default: return { titulo: `${m.operacao} em ${m.entidade}`, detalhe: '' };
  }
}
