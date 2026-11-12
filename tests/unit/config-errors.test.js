import { describe, it, expect } from 'vitest';
import { chaveEhPrivilegiada, diagnosticoConfig } from '../../src/core/config.js';
import { traduzirErro, ErroValidacao, AcessoRestritoError } from '../../src/core/errors.js';

const jwt = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

describe('chaves do Supabase', () => {
  it('detecta service_role e sb_secret', () => {
    expect(chaveEhPrivilegiada(jwt({ role: 'service_role' }))).toBe(true);
    expect(chaveEhPrivilegiada('sb_secret_abc')).toBe(true);
  });
  it('aceita anon e publishable', () => {
    expect(chaveEhPrivilegiada(jwt({ role: 'anon' }))).toBe(false);
    expect(chaveEhPrivilegiada('sb_publishable_abc')).toBe(false);
  });
  it('diagnóstico: pendente, privilegiada e ok', () => {
    expect(diagnosticoConfig({ supabaseUrl: '', supabaseAnonKey: '' }).motivo).toBe('pendente');
    expect(diagnosticoConfig({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'sb_secret_1' }).motivo).toBe('chave-privilegiada');
    expect(diagnosticoConfig({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: jwt({ role: 'anon' }) }).ok).toBe(true);
  });
});

describe('traduzirErro', () => {
  it('Auth, rede e limites', () => {
    expect(traduzirErro({ message: 'Invalid login credentials' })).toBe('E-mail ou senha inválidos.');
    expect(traduzirErro({ message: 'Failed to fetch' })).toMatch(/conexão/);
    expect(traduzirErro({ status: 429, message: 'x' })).toMatch(/Muitas tentativas/);
  });
  it('banco: duplicidade de CPF/CNPJ, RLS e regra de negócio', () => {
    expect(traduzirErro({ code: '23505', message: 'duplicate key ... "devedores_cpf_cnpj_key"' })).toMatch(/CPF\/CNPJ/);
    expect(traduzirErro({ code: '42501', message: 'new row violates row-level security policy' })).toBe('Acesso negado.');
    expect(traduzirErro({ code: 'P0001', message: 'Pagamento (10) excede o saldo da dívida (5).' })).toMatch(/excede o saldo/);
  });
  it('erros locais e genérico sem vazar detalhes', () => {
    expect(traduzirErro(new ErroValidacao('Arquivo vazio'))).toBe('Arquivo vazio');
    expect(traduzirErro(new AcessoRestritoError())).toMatch(/restrito/);
    expect(traduzirErro({ message: 'relation "x" does not exist at 10.0.0.5' })).not.toMatch(/10\.0\.0\.5/);
  });
});
