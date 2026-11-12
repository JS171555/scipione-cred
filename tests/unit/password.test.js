import { describe, it, expect } from 'vitest';
import { validarSenha } from '../../src/utils/password.js';

describe('validarSenha', () => {
  it('aceita senha forte', () => expect(validarSenha('Abcdef1!').valida).toBe(true));
  it.each([
    ['Abc1!', 'mínimo de 8 caracteres'],
    ['abcdefg1!', 'uma letra maiúscula'],
    ['ABCDEFG1!', 'uma letra minúscula'],
    ['Abcdefgh!', 'um número'],
    ['Abcdefg12', 'um caractere especial'],
  ])('rejeita %s', (senha, falta) => {
    const r = validarSenha(senha);
    expect(r.valida).toBe(false);
    expect(r.faltando.some((f) => f.startsWith(falta))).toBe(true);
  });
  it('rejeita não-string e senhas acima de 72 caracteres', () => {
    expect(validarSenha(undefined).valida).toBe(false);
    expect(validarSenha('Aa1!' + 'x'.repeat(70)).valida).toBe(false);
  });
});
