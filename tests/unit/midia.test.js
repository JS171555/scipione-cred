import { describe, it, expect } from 'vitest';
import {
  nomeComExtensao, dimensoesAlvo, suportaCanvas, converterImagemParaWebp, otimizarPdf, prepararArquivo,
} from '../../src/utils/midia.js';

const arq = (nome, bytes, type) => new File([new Uint8Array(bytes)], nome, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];

describe('nomeComExtensao', () => {
  it('troca a extensão preservando o nome base', () => {
    expect(nomeComExtensao('RG frente.JPG', 'webp')).toBe('RG frente.webp');
    expect(nomeComExtensao('comprovante.png', 'webp')).toBe('comprovante.webp');
  });
  it('usa um nome padrão quando o arquivo não tem nome', () => {
    expect(nomeComExtensao('', 'webp')).toBe('arquivo.webp');
    expect(nomeComExtensao(undefined, 'webp')).toBe('arquivo.webp');
  });
  it('não confunde pontos do nome com extensão', () => {
    expect(nomeComExtensao('foto.2026.11.jpg', 'webp')).toBe('foto.2026.11.webp');
  });
});

describe('dimensoesAlvo', () => {
  it('reduz o maior lado mantendo a proporção', () => {
    expect(dimensoesAlvo(4000, 3000, 1600)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesAlvo(3000, 4000, 1600)).toEqual({ largura: 1200, altura: 1600 });
  });
  it('nunca amplia imagens menores que o limite', () => {
    expect(dimensoesAlvo(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
  });
  it('mantém ao menos 1 px e tolera valores inválidos', () => {
    expect(dimensoesAlvo(10000, 1, 1600)).toEqual({ largura: 1600, altura: 1 });
    expect(dimensoesAlvo(0, 0, 1600)).toEqual({ largura: 1, altura: 1 });
    expect(dimensoesAlvo(2000, 1000, Number.NaN)).toEqual({ largura: 2000, altura: 1000 });
  });
});

describe('prepararArquivo', () => {
  it('mantém o original quando o navegador não consegue recodificar a imagem', async () => {
    const foto = arq('foto.png', PNG, 'image/png');
    expect(suportaCanvas()).toBe(false);
    const r = await prepararArquivo(foto, 'foto');
    expect(r.convertido).toBe(false);
    expect(r.arquivo).toBe(foto);
    expect(r.formato).toBe('png');
  });
  it('mantém o original de um PDF inválido sem lançar erro', async () => {
    const pdf = arq('rg.pdf', PDF, 'application/pdf');
    const r = await prepararArquivo(pdf, 'documento');
    expect(r.convertido).toBe(false);
    expect(r.arquivo).toBe(pdf);
  });
  it('devolve null quando a imagem não pode ser decodificada', async () => {
    expect(await converterImagemParaWebp(arq('x.png', PNG, 'image/png'))).toBeNull();
  });
  it('devolve null para PDF que não é um documento válido', async () => {
    expect(await otimizarPdf(arq('x.pdf', PDF, 'application/pdf'))).toBeNull();
  });
  it('preserva PDF assinado digitalmente, que perderia a assinatura se fosse reescrito', async () => {
    const assinado = arq('contrato-assinado.pdf', [...PDF, ...new TextEncoder().encode('/Type /Sig /ByteRange [0 100 200 300]')], 'application/pdf');
    expect(await otimizarPdf(assinado)).toBeNull();
    const r = await prepararArquivo(assinado, 'documento');
    expect(r.arquivo).toBe(assinado);
    expect(r.convertido).toBe(false);
  });
  it('não tenta converter formatos que não são imagem nem PDF', async () => {
    const arquivo = arq('nota.txt', [0x41], 'text/plain');
    const r = await prepararArquivo(arquivo, 'documento');
    expect(r).toEqual({ arquivo, convertido: false, formato: 'txt' });
  });
});
