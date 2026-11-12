import { describe, it, expect } from 'vitest';
import { validarCPF, validarCNPJ, validarDocumento, formatarDocumento, formatarTelefone, formatarCEP, apenasDigitos } from '../../src/utils/cpf-cnpj.js';
import { parseMoeda, centavosParaDecimal, paraCentavos, formatarCentavos, formatarBRL } from '../../src/utils/money.js';
import { hojeISO, dataISOValida, formatarData } from '../../src/utils/dates.js';
import { calcularSaldo, statusDivida, validarPagamento, validarDivida, totaisDevedor } from '../../src/domain/financeiro.js';
import { validarDevedor } from '../../src/domain/devedor.js';

describe('CPF/CNPJ', () => {
  it('valida documentos reais e rejeita inválidos', () => {
    expect(validarCPF('529.982.247-25')).toBe(true);
    expect(validarCPF('11144477735')).toBe(true);
    expect(validarCPF('52998224726')).toBe(false);
    expect(validarCPF('11111111111')).toBe(false);
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true);
    expect(validarCNPJ('11222333000182')).toBe(false);
    expect(validarCNPJ('00000000000000')).toBe(false);
  });
  it('documento é opcional e depende do tipo', () => {
    expect(validarDocumento('PF', '')).toBe(true);
    expect(validarDocumento('PF', '52998224725')).toBe(true);
    expect(validarDocumento('PJ', '52998224725')).toBe(false);
    expect(validarDocumento('PJ', '11222333000181')).toBe(true);
  });
  it('máscaras', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(formatarCEP('01310100')).toBe('01310-100');
    expect(apenasDigitos('(11) 9-8888')).toBe('1198888');
  });
});

describe('dinheiro', () => {
  it.each([['1.500,25', 150025], ['1500,25', 150025], ['1500.25', 150025], ['R$ 300', 30000], ['1.500', 150000], ['0,5', 50], ['10', 1000]])('parseMoeda(%s)', (t, c) => expect(parseMoeda(t)).toBe(c));
  it.each(['', 'abc', '0', '0,00', '-5', '1,234', '1.50.0', '12,345', null])('rejeita %s', (t) => expect(parseMoeda(t)).toBeNull());
  it('conversões sem erro de ponto flutuante', () => {
    expect(centavosParaDecimal(150025)).toBe('1500.25');
    expect(centavosParaDecimal(5)).toBe('0.05');
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
    expect(paraCentavos('1500.00')).toBe(150000);
    expect(formatarCentavos(150025).replace(/\s/g, ' ')).toBe('R$ 1.500,25');
    expect(formatarBRL(1000)).toMatch(/1\.000,00/);
  });
});

describe('datas', () => {
  it('hoje no fuso de Brasília', () => {
    expect(hojeISO(new Date('2026-11-12T01:30:00Z'))).toBe('2026-11-11'); // 22:30 em Brasília
    expect(hojeISO(new Date('2026-11-12T12:00:00Z'))).toBe('2026-11-12');
  });
  it('validação e formato', () => {
    expect(dataISOValida('2026-02-29')).toBe(false);
    expect(dataISOValida('2028-02-29')).toBe(true);
    expect(dataISOValida('12/11/2026')).toBe(false);
    expect(formatarData('2026-11-05')).toBe('05/11/2026');
    expect(formatarData(null)).toBe('—');
  });
});

describe('regras financeiras', () => {
  const pg = (valorC, status = 'valido') => ({ valorC, status });
  it('exemplo do escopo: 1.500 − 300 − 200 = 1.000', () => {
    expect(calcularSaldo(150000, [pg(30000), pg(20000)])).toBe(100000);
  });
  it('estornados não contam; quitação em saldo zero', () => {
    expect(calcularSaldo(150000, [pg(30000), pg(20000, 'estornado')])).toBe(120000);
    expect(statusDivida(150000, 150000)).toBe('quitada');
    expect(statusDivida(150000, 149999)).toBe('em_aberto');
  });
  const base = { dataISO: '2026-11-10', dataRegistroISO: '2026-11-01', hojeISO: '2026-11-12' };
  it('pagamento: valor, saldo e datas', () => {
    expect(validarPagamento({ ...base, valorC: 1000, saldoC: 1000 })).toEqual([]);
    expect(validarPagamento({ ...base, valorC: 1001, saldoC: 1000 })[0]).toMatch(/maior que o saldo/);
    expect(validarPagamento({ ...base, valorC: 0, saldoC: 1000 })[0]).toMatch(/maior que zero/);
    expect(validarPagamento({ ...base, valorC: 1, saldoC: 10, dataISO: '2026-11-13' })[0]).toMatch(/futura/);
    expect(validarPagamento({ ...base, valorC: 1, saldoC: 10, dataISO: '2026-10-31' })[0]).toMatch(/anterior/);
  });
  it('dívida: campos e vencimento', () => {
    const ok = { descricao: 'Empréstimo', valorC: 100, dataRegistroISO: '2026-11-01', hojeISO: '2026-11-12' };
    expect(validarDivida(ok)).toEqual([]);
    expect(validarDivida({ ...ok, descricao: ' ' })).toHaveLength(1);
    expect(validarDivida({ ...ok, vencimentoISO: '2026-10-01' })[0]).toMatch(/vencimento/);
    expect(validarDivida({ ...ok, valorC: 50, valorMinimoC: 80 })[0]).toMatch(/total já pago/);
  });
  it('totais do devedor (exemplo do escopo: 3.000 − 500 = 2.500)', () => {
    const d = [
      { valor_original: 1500, total_pago: 500, saldo: 1000, status: 'em_aberto' },
      { valor_original: 800, total_pago: 0, saldo: 800, status: 'em_aberto' },
      { valor_original: 700, total_pago: 0, saldo: 700, status: 'em_aberto' },
    ];
    expect(totaisDevedor(d, paraCentavos)).toEqual({ registradoC: 300000, pagoC: 50000, emAbertoC: 250000, abertas: 3, quitadas: 0 });
  });
});

describe('validarDevedor', () => {
  it('normaliza dados válidos', () => {
    const { erros, dados } = validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: '  Ana   Souza ', cpf_cnpj: '529.982.247-25', telefone: '', celular: '(11) 98888-7777', email: 'ANA@X.com', cep: '01310-100', uf: 'sp', rg: ' ' });
    expect(erros).toEqual({});
    expect(dados).toMatchObject({ nome_razao_social: 'Ana Souza', cpf_cnpj: '52998224725', telefone: null, celular: '11988887777', email: 'ana@x.com', cep: '01310100', uf: 'SP', rg: null });
  });
  it('aponta erros por campo; documento vazio é aceito', () => {
    const { erros } = validarDevedor({ tipo_pessoa: 'PJ', nome_razao_social: 'A', cpf_cnpj: '52998224725', email: 'x', telefone: '123', cep: '123', uf: 'ZZ' });
    expect(Object.keys(erros).sort()).toEqual(['cep', 'cpf_cnpj', 'email', 'nome_razao_social', 'telefone', 'uf']);
    expect(validarDevedor({ tipo_pessoa: 'PF', nome_razao_social: 'Bruno', cpf_cnpj: '' }).erros).toEqual({});
  });
});
