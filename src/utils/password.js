// Política de senha do escopo: ≥ 8 caracteres, maiúscula, minúscula, número e caractere especial.
const ESPECIAIS = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export const REQUISITOS_SENHA = [
  { id: 'tamanho', texto: 'mínimo de 8 caracteres', ok: (s) => s.length >= 8 },
  { id: 'maiuscula', texto: 'uma letra maiúscula', ok: (s) => /[A-Z]/.test(s) },
  { id: 'minuscula', texto: 'uma letra minúscula', ok: (s) => /[a-z]/.test(s) },
  { id: 'numero', texto: 'um número', ok: (s) => /[0-9]/.test(s) },
  { id: 'especial', texto: 'um caractere especial (ex.: ! @ # $ %)', ok: (s) => ESPECIAIS.test(s) },
];

export function validarSenha(senha) {
  const s = typeof senha === 'string' ? senha : '';
  const faltando = REQUISITOS_SENHA.filter((r) => !r.ok(s)).map((r) => r.texto);
  return { valida: faltando.length === 0 && s.length <= 72, faltando };
}
