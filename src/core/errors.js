// Traduz erros técnicos (Auth, PostgREST, Storage, rede) em mensagens claras, sem vazar detalhes internos.
const MAPA_CONSTRAINTS = {
  devedores_cpf_cnpj_key: 'Já existe um devedor cadastrado com este CPF/CNPJ.',
  devedores_cpf_cnpj_valido: 'CPF/CNPJ inválido.',
  pagamentos_chave_idempotencia_key: 'Este pagamento já foi registrado.',
};

export function traduzirErro(erro) {
  if (!erro) return 'Ocorreu um erro inesperado.';
  if (erro instanceof ErroValidacao || erro instanceof AcessoRestritoError) return erro.message;
  const msg = String(erro.message ?? erro);
  const code = erro.code ?? erro.status;

  if (/invalid login credentials|invalid_credentials/i.test(msg)) return 'E-mail ou senha inválidos.';
  if (/rate limit|too many|over_.*_rate_limit/i.test(msg) || code === 429) return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (/same.*password|different from the old/i.test(msg)) return 'A nova senha deve ser diferente da atual.';
  if (/weak.?password|password should/i.test(msg)) return 'A senha não atende aos requisitos de segurança.';
  if (/jwt|token.*expired|session.*(missing|not found)/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';

  if (code === '23505' || code === '23514') {
    for (const [chave, texto] of Object.entries(MAPA_CONSTRAINTS)) if (msg.includes(chave)) return texto;
    return code === '23505' ? 'Registro duplicado.' : 'Algum dado informado é inválido.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Acesso negado.';
  if (code === 'P0001' || code === '22023') return msg; // mensagens de regra de negócio já estão em português
  if (/Payload too large|exceeded the maximum allowed size/i.test(msg)) return 'Arquivo acima do tamanho permitido.';
  if (/mime type|not allowed/i.test(msg)) return 'Tipo de arquivo não permitido.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

/** Falha de validação local (ex.: arquivo inválido); a mensagem já é amigável. */
export class ErroValidacao extends Error {}
/** Usuário autenticado que não é o administrador. */
export class AcessoRestritoError extends Error {
  constructor() { super('Acesso restrito ao administrador.'); }
}
