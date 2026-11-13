// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/auditoria.js', () => ({ listarPorDevedor: vi.fn(async () => []), listarRecentes: vi.fn(async () => []) }));
vi.mock('../../src/services/devedores.js', () => ({ listarPagina: vi.fn(), urlsFotos: vi.fn(async () => ({})), nomesPorId: vi.fn(async () => ({})), ORDENS: { nome_asc: [], nome_desc: [], recentes: [], antigos: [] }, obter: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), alterarStatus: vi.fn(), definirFoto: vi.fn(), urlFoto: vi.fn() }));
vi.mock('../../src/services/dividas.js', () => ({ listarPorDevedor: vi.fn(), obter: vi.fn(), registrar: vi.fn(), editar: vi.fn(), alterarValor: vi.fn(), remover: vi.fn() }));
vi.mock('../../src/services/pagamentos.js', () => ({ listarPorDevedor: vi.fn(), registrar: vi.fn(), estornar: vi.fn(), urlComprovante: vi.fn() }));
vi.mock('../../src/services/documentos.js', () => ({ listar: vi.fn(), adicionar: vi.fn(), remover: vi.fn(), urlDocumento: vi.fn(), TIPOS_DOCUMENTO: { identificacao: 'Identificação', comprovante_endereco: 'Comprovante de endereço', outro: 'Outro' } }));
vi.mock('../../src/services/configuracoes.js', () => ({ obterLimitesUpload: vi.fn(async () => ({ foto: 5e6, documento: 1e7, comprovante: 1e7 })) }));
vi.mock('../../src/services/viacep.js', () => ({ buscarCEP: vi.fn() }));

import * as devedores from '../../src/services/devedores.js';
import * as dividas from '../../src/services/dividas.js';
import * as pagamentos from '../../src/services/pagamentos.js';
import * as documentos from '../../src/services/documentos.js';
import { buscarCEP } from '../../src/services/viacep.js';
import { renderListaDevedores } from '../../src/modules/devedores-lista.js';
import { renderDevedorForm } from '../../src/modules/devedor-form.js';
import { renderDevedorDetalhe } from '../../src/modules/devedor-detalhe.js';
import { renderDividaForm } from '../../src/modules/divida-form.js';
import { renderPagamentoForm } from '../../src/modules/pagamento-form.js';

const ID = '11111111-1111-4111-8111-111111111111';
const DIV = '22222222-2222-4222-8222-222222222222';
let raiz;
const $ = (s) => raiz.querySelector(s);
const texto = () => raiz.textContent.replace(/\s+/g, ' ');
const digitar = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
const enviar = () => $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
const tick = () => new Promise((r) => setTimeout(r, 0));

const devedor = { id: ID, tipo_pessoa: 'PF', nome_razao_social: 'José <b>da</b> Silva', cpf_cnpj: '52998224725', rg: '123', telefone: '1133334444', celular: '11988887777', email: 'j@x.com', cep: '01310100', logradouro: 'Av. Paulista', numero: '1', complemento: null, bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', observacoes: null, status: 'ativo', foto_path: null, created_at: '2026-11-01T12:00:00Z', total_em_aberto: 2500, qtd_dividas_abertas: 3, qtd_dividas_quitadas: 0 };
const divida = { id: DIV, devedor_id: ID, descricao: 'Empréstimo A', valor_original: 1500, total_pago: 500, saldo: 1000, status: 'em_aberto', data_registro: '2026-11-01', data_vencimento: null, observacoes: null };

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  raiz = document.getElementById('app');
  location.hash = '';
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('lista de devedores', () => {
  const pagina = (itens, total = itens.length) => ({ itens, total, pagina: 1, porPagina: 20 });
  it('renderiza linhas, escapa HTML e mostra estado vazio', async () => {
    devedores.listarPagina.mockResolvedValueOnce(pagina([devedor]));
    await renderListaDevedores(raiz, {});
    await vi.waitFor(() => expect(texto()).toContain('Em aberto'));
    expect(texto()).toContain('529.982.247-25');
    expect(texto()).toContain('R$ 2.500,00');
    expect(raiz.querySelector('table b')).toBeNull();                 // HTML do nome não é interpretado
    expect(raiz.querySelector('a[href="#/devedores/' + ID + '"]')).toBeTruthy();
    devedores.listarPagina.mockResolvedValueOnce(pagina([]));
    digitar('#busca', 'zzz');
    await vi.waitFor(() => expect(texto()).toContain('Nenhum devedor encontrado'), { timeout: 2000 });
    expect(devedores.listarPagina).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'zzz', pagina: 1 }));
  });
});

describe('cadastro de devedor', () => {
  it('valida, destaca campos e só então grava; navega ao perfil', async () => {
    await renderDevedorForm(raiz, { params: {} });
    enviar(); await tick();
    expect(devedores.criar).not.toHaveBeenCalled();
    expect($('[data-erro=nome_razao_social]').textContent).toMatch(/nome completo/);
    digitar('#nome_razao_social', 'Ana  Souza'); digitar('#cpf_cnpj', '52998224726');
    enviar(); await tick();
    expect($('[data-erro=cpf_cnpj]').textContent).toBe('CPF inválido.');
    digitar('#cpf_cnpj', '529.982.247-25'); digitar('#celular', '(11) 98888-7777');
    devedores.criar.mockResolvedValueOnce({ id: ID });
    enviar(); await vi.waitFor(() => expect(devedores.criar).toHaveBeenCalled());
    expect(devedores.criar.mock.calls[0][0]).toMatchObject({ tipo_pessoa: 'PF', nome_razao_social: 'Ana Souza', cpf_cnpj: '52998224725', celular: '11988887777', rg: null });
    await vi.waitFor(() => expect(location.hash).toBe(`#/devedores/${ID}`));
  });
  it('troca rótulos para PJ, exibe erro de CPF duplicado vindo do banco e preenche endereço pelo ViaCEP', async () => {
    await renderDevedorForm(raiz, { params: {} });
    document.querySelector('input[value=PJ]').click();
    expect($('#rot-doc').textContent).toBe('CNPJ');
    buscarCEP.mockResolvedValueOnce({ logradouro: 'Rua X', bairro: 'Centro', cidade: 'Campinas', uf: 'SP' });
    digitar('#cep', '13010-000'); $('#cep').dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect($('#cidade').value).toBe('Campinas'));
    expect($('#logradouro').value).toBe('Rua X'); expect($('#uf').value).toBe('SP');
    digitar('#nome_razao_social', 'Empresa Ltda'); digitar('#cpf_cnpj', '11222333000181');
    devedores.criar.mockRejectedValueOnce({ code: '23505', message: 'duplicate key value violates unique constraint "devedores_cpf_cnpj_key"' });
    enviar(); await vi.waitFor(() => expect($('[data-erro=cpf_cnpj]').textContent).toMatch(/já existe/i));
  });
  it('edição carrega e formata os dados atuais', async () => {
    devedores.obter.mockResolvedValueOnce(devedor);
    await renderDevedorForm(raiz, { params: { id: ID } });
    expect($('#cpf_cnpj').value).toBe('529.982.247-25');
    expect($('#celular').value).toBe('(11) 98888-7777'); expect($('#cep').value).toBe('01310-100');
    devedores.atualizar.mockResolvedValueOnce({ id: ID });
    digitar('#observacoes', 'nota'); enviar();
    await vi.waitFor(() => expect(devedores.atualizar).toHaveBeenCalledWith(ID, expect.objectContaining({ observacoes: 'nota' })));
  });
});

describe('perfil do devedor', () => {
  const pag = (o) => ({ id: 'p' + Math.random(), divida_id: DIV, valor: 300, data_pagamento: '2026-11-05', observacao: null, comprovante_path: null, status: 'valido', estornado_em: null, motivo_estorno: null, ...o });
  beforeEach(() => {
    devedores.obter.mockResolvedValue(devedor);
    dividas.listarPorDevedor.mockResolvedValue([divida, { ...divida, id: 'x2', descricao: 'Empréstimo B', valor_original: 800, total_pago: 0, saldo: 800 }, { ...divida, id: 'x3', descricao: 'Empréstimo C', valor_original: 700, total_pago: 0, saldo: 700 }]);
    pagamentos.listarPorDevedor.mockResolvedValue([pag({ id: 'pg1', valor: 300 }), pag({ id: 'pg2', valor: 200 }), pag({ id: 'pg3', valor: 100, status: 'estornado', estornado_em: '2026-11-06T12:00:00Z', motivo_estorno: 'engano <script>x</script>' })]);
    documentos.listar.mockResolvedValue([{ id: 'd1', tipo: 'identificacao', nome_original: '<img src=x onerror=alert(1)>.pdf', storage_path: `${ID}/a.pdf`, tamanho_bytes: 2048, created_at: '2026-11-02T10:00:00Z' }]);
  });
  it('mostra o resumo do escopo (3.000 − 500 = 2.500), histórico, estorno e escapa conteúdo', async () => {
    await renderDevedorDetalhe(raiz, { params: { id: ID } });
    expect(texto()).toContain('R$ 3.000,00'); expect(texto()).toContain('R$ 500,00'); expect(texto()).toContain('R$ 2.500,00');
    expect(texto()).toContain('Empréstimo A'); expect(texto()).toContain('Estornado'); expect(texto()).toContain('engano <script>x</script>');
    expect(raiz.querySelector('script')).toBeNull(); expect(raiz.querySelector('img[onerror]')).toBeNull();
    expect(raiz.querySelectorAll('[data-acao=estornar]')).toHaveLength(2);            // só pagamentos válidos
    expect(raiz.querySelectorAll('a[href$="/pagamento"]')).toHaveLength(3);
    expect(raiz.querySelector(`a[href="#/devedores/${ID}/dividas/nova"]`)).toBeTruthy();
  });
  it('inativar com dívidas em aberto pede confirmação antes de concluir', async () => {
    devedores.alterarStatus.mockResolvedValueOnce({ alterado: false, requer_confirmacao: true, qtd_dividas_abertas: 3, valor_em_aberto: 2500 })
      .mockResolvedValueOnce({ alterado: true });
    await renderDevedorDetalhe(raiz, { params: { id: ID } });
    $('[data-acao=status]').click();
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeTruthy());
    expect(document.querySelector('dialog').textContent).toMatch(/3 dívida\(s\) em aberto.*R\$\s2\.500,00/);
    document.querySelector('dialog [data-s]').click();
    await vi.waitFor(() => expect(devedores.alterarStatus).toHaveBeenCalledTimes(2));
    expect(devedores.alterarStatus).toHaveBeenLastCalledWith(ID, 'inativo', true);
  });
  it('cancelar a confirmação não inativa; estorno exige motivo', async () => {
    devedores.alterarStatus.mockResolvedValueOnce({ alterado: false, requer_confirmacao: true, qtd_dividas_abertas: 1, valor_em_aberto: 10 });
    await renderDevedorDetalhe(raiz, { params: { id: ID } });
    $('[data-acao=status]').click();
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeTruthy());
    document.querySelector('dialog [data-n]').click(); await tick();
    expect(devedores.alterarStatus).toHaveBeenCalledTimes(1);
    $('[data-acao=estornar][data-id=pg1]').click();
    await vi.waitFor(() => expect(document.querySelector('dialog textarea')).toBeTruthy());
    document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(document.querySelector('dialog .msg').textContent).toMatch(/ao menos 3/);
    document.querySelector('dialog textarea').value = 'Valor incorreto';
    pagamentos.estornar.mockResolvedValueOnce({});
    document.querySelector('dialog form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(pagamentos.estornar).toHaveBeenCalledWith('pg1', 'Valor incorreto'));
  });
  it('apaga dívida sem pagamentos depois da confirmação e esconde o botão quando há pagamento', async () => {
    const semPagamento = { ...divida, id: '33333333-3333-4333-8333-333333333333', total_pago: 0, saldo: 1500 };
    devedores.obter.mockResolvedValue(devedor);
    dividas.listarPorDevedor.mockResolvedValue([divida, semPagamento]);
    pagamentos.listarPorDevedor.mockResolvedValue([]);
    documentos.listar.mockResolvedValue([]);
    await renderDevedorDetalhe(raiz, { params: { id: ID } });
    await vi.waitFor(() => expect($('[data-acao="apagar-divida"]')).toBeTruthy());
    expect(raiz.querySelectorAll('[data-acao="apagar-divida"]')).toHaveLength(1);
    expect($('[data-acao="apagar-divida"]').dataset.id).toBe(semPagamento.id);
    $('[data-acao="apagar-divida"]').click();
    await vi.waitFor(() => expect(document.querySelector('dialog [data-s]')).toBeTruthy());
    expect(document.querySelector('dialog').textContent).toMatch(/não pode ser desfeita/);
    dividas.remover.mockResolvedValueOnce();
    document.querySelector('dialog [data-s]').click();
    await vi.waitFor(() => expect(dividas.remover).toHaveBeenCalledWith(semPagamento.id));
  });
  it('exibe erro traduzido quando a operação falha', async () => {
    documentos.remover.mockRejectedValueOnce({ code: '42501', message: 'permission denied' });
    await renderDevedorDetalhe(raiz, { params: { id: ID } });
    $('[data-acao=rem-doc]').click();
    await vi.waitFor(() => expect(document.querySelector('dialog [data-s]')).toBeTruthy());
    document.querySelector('dialog [data-s]').click();
    await vi.waitFor(() => expect($('#msg').textContent).toBe('Acesso negado.'));
  });
});

describe('dívida', () => {
  it('registra convertendo "1.500,25" em centavos e validando campos', async () => {
    devedores.obter.mockResolvedValue(devedor);
    await renderDividaForm(raiz, { params: { id: ID } });
    digitar('#descricao', 'Empréstimo'); digitar('#valor', '0,00'); enviar(); await tick();
    expect($('#msg').textContent).toMatch(/maior que zero/); expect(dividas.registrar).not.toHaveBeenCalled();
    digitar('#valor', '1.500,25'); dividas.registrar.mockResolvedValueOnce({});
    enviar(); await vi.waitFor(() => expect(dividas.registrar).toHaveBeenCalled());
    expect(dividas.registrar.mock.calls[0][0]).toMatchObject({ devedorId: ID, descricao: 'Empréstimo', valorC: 150025 });
  });
  it('devedor inativo não recebe nova dívida', async () => {
    devedores.obter.mockResolvedValue({ ...devedor, status: 'inativo' });
    await renderDividaForm(raiz, { params: { id: ID } });
    expect(texto()).toMatch(/reative o cadastro/); expect($('form')).toBeNull();
  });
  it('edição respeita o total já pago como valor mínimo', async () => {
    dividas.obter.mockResolvedValue(divida); devedores.obter.mockResolvedValue(devedor);
    await renderDividaForm(raiz, { params: { dividaId: DIV } });
    expect($('#valor').value).toBe('1500,00');
    digitar('#valor', '400'); enviar(); await tick();
    expect($('#msg').textContent).toMatch(/total já pago/); expect(dividas.alterarValor).not.toHaveBeenCalled();
  });
});

describe('pagamento', () => {
  beforeEach(() => { dividas.obter.mockResolvedValue(divida); });
  it('bloqueia valor acima do saldo; "Quitar total" preenche o saldo; registra com chave de idempotência', async () => {
    await renderPagamentoForm(raiz, { params: { dividaId: DIV } });
    expect(texto()).toContain('R$ 1.000,00');
    digitar('#valor', '1000,01'); enviar(); await tick();
    expect($('#msg').textContent).toMatch(/maior que o saldo/); expect(pagamentos.registrar).not.toHaveBeenCalled();
    $('#quitar').click(); expect($('#valor').value).toBe('1000,00');
    pagamentos.registrar.mockResolvedValue({});
    enviar(); await vi.waitFor(() => expect(pagamentos.registrar).toHaveBeenCalledTimes(1));
    const arg = pagamentos.registrar.mock.calls[0][0];
    expect(arg).toMatchObject({ dividaId: DIV, valorC: 100000 }); expect(arg.chave).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(() => expect(location.hash).toBe(`#/devedores/${ID}`));
  });
  it('dívida quitada não oferece formulário', async () => {
    dividas.obter.mockResolvedValue({ ...divida, saldo: 0, status: 'quitada' });
    await renderPagamentoForm(raiz, { params: { dividaId: DIV } });
    expect(texto()).toMatch(/já está quitada/); expect($('form')).toBeNull();
  });
  it('arquivo de comprovante inválido é recusado antes de enviar', async () => {
    await renderPagamentoForm(raiz, { params: { dividaId: DIV } });
    digitar('#valor', '100');
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'rec.pdf', { type: 'application/pdf' });
    Object.defineProperty($('#arquivo'), 'files', { value: [falso] });
    enviar(); await vi.waitFor(() => expect($('#msg').textContent).toMatch(/Comprovante: .*conteúdo/));
    expect(pagamentos.registrar).not.toHaveBeenCalled();
  });
});
