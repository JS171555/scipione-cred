import { describe, it, expect } from 'vitest';
import { descreverMovimentacao as d } from '../../src/domain/movimentacoes.js';

const m = (entidade, operacao, antes, depois) => ({ entidade, operacao, dados_antes: antes, dados_depois: depois });

describe('descreverMovimentacao', () => {
  it('devedor: cadastro, status, edição (só rótulos, sem dados pessoais) e foto', () => {
    expect(d(m('devedores', 'INSERT', null, { nome_razao_social: 'Ana' }))).toEqual({ titulo: 'Devedor cadastrado', detalhe: 'Ana' });
    expect(d(m('devedores', 'STATUS', { status: 'ativo' }, { status: 'inativo' })).titulo).toBe('Cadastro inativado');
    expect(d(m('devedores', 'STATUS', { status: 'inativo' }, { status: 'ativo' })).titulo).toBe('Cadastro reativado');
    const ed = d(m('devedores', 'UPDATE', { nome_razao_social: 'Ana', celular: '1', cpf_cnpj: '5' }, { nome_razao_social: 'Ana Maria', celular: '2', cpf_cnpj: '5' }));
    expect(ed).toEqual({ titulo: 'Cadastro atualizado', detalhe: 'Campos: Nome/razão social, Celular' });
    expect(ed.detalhe).not.toMatch(/\d{2}/);
    expect(d(m('devedores', 'UPDATE', { foto_path: 'a' }, { foto_path: 'b' })).titulo).toBe('Foto atualizada');
  });
  it('dívidas: registro, mudança de valor, edição e quitação/reabertura', () => {
    expect(d(m('dividas', 'INSERT', null, { descricao: 'Empréstimo', valor_original: 1500 })).detalhe).toMatch(/Empréstimo — R\$\s1\.500,00/);
    expect(d(m('dividas', 'UPDATE', { valor_original: 1500, descricao: 'X' }, { valor_original: 1800, descricao: 'X' })))
      .toMatchObject({ titulo: 'Valor da dívida alterado' });
    expect(d(m('dividas', 'UPDATE', { valor_original: 1500, descricao: 'X' }, { valor_original: 1500, descricao: 'Y' }))).toEqual({ titulo: 'Dívida editada', detalhe: 'Y (Descrição)' });
    expect(d(m('dividas', 'STATUS', { status: 'em_aberto' }, { status: 'quitada', descricao: 'X' })).titulo).toBe('Dívida quitada');
    expect(d(m('dividas', 'STATUS', { status: 'quitada' }, { status: 'em_aberto', descricao: 'X' })).titulo).toBe('Dívida reaberta');
  });
  it('pagamentos: registro, estorno com motivo, comprovante; documentos', () => {
    expect(d(m('pagamentos', 'INSERT', null, { valor: 300, data_pagamento: '2026-11-05' }), { descricaoDivida: 'Dívida 01' }).detalhe).toMatch(/R\$\s300,00 em 05\/11\/2026 — Dívida 01/);
    expect(d(m('pagamentos', 'ESTORNO', { status: 'valido' }, { valor: 300, status: 'estornado', motivo_estorno: 'engano' }))).toMatchObject({ titulo: 'Pagamento estornado' });
    expect(d(m('pagamentos', 'ESTORNO', {}, { valor: 300, motivo_estorno: 'engano' })).detalhe).toContain('motivo: engano');
    expect(d(m('pagamentos', 'UPDATE', {}, { valor: 10 })).titulo).toBe('Comprovante anexado ao pagamento');
    expect(d(m('devedor_documentos', 'INSERT', null, { nome_original: 'rg.pdf' }))).toEqual({ titulo: 'Documento anexado', detalhe: 'rg.pdf' });
    expect(d(m('devedor_documentos', 'REMOCAO', {}, { nome_original: 'rg.pdf' })).titulo).toBe('Documento removido');
  });
  it('registro desconhecido tem fallback', () => {
    expect(d(m('x', 'Y', null, null)).titulo).toBe('Y em x');
  });
});
