import { describe, it, expect } from 'vitest';
import { validarArquivo, extensaoDe, gerarCaminho } from '../../src/utils/files.js';

const arq = (nome, bytes, type) => new File([new Uint8Array(bytes)], nome, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const AVIF = [0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66];

describe('validarArquivo', () => {
  it('aceita formatos válidos com assinatura correta', async () => {
    expect((await validarArquivo(arq('f.png', PNG, 'image/png'), 'foto')).valido).toBe(true);
    expect((await validarArquivo(arq('f.JPG', JPG, 'image/jpeg'), 'foto')).valido).toBe(true);
    expect((await validarArquivo(arq('f.avif', AVIF, 'image/avif'), 'foto')).valido).toBe(true);
    expect((await validarArquivo(arq('d.pdf', PDF, 'application/pdf'), 'documento')).valido).toBe(true);
    expect((await validarArquivo(arq('d.webp', WEBP, 'image/webp'), 'comprovante')).valido).toBe(true);
  });
  it('foto não aceita PDF nem WEBP', async () => {
    expect((await validarArquivo(arq('d.pdf', PDF, 'application/pdf'), 'foto')).valido).toBe(false);
    expect((await validarArquivo(arq('d.webp', WEBP, 'image/webp'), 'foto')).valido).toBe(false);
  });
  it('rejeita extensão proibida e dupla extensão', async () => {
    expect((await validarArquivo(arq('x.exe', PNG, ''), 'documento')).valido).toBe(false);
    expect((await validarArquivo(arq('x.png.exe', PNG, ''), 'documento')).valido).toBe(false);
  });
  it('rejeita MIME divergente da extensão', async () => {
    const r = await validarArquivo(arq('f.png', PNG, 'application/pdf'), 'foto');
    expect(r.valido).toBe(false);
  });
  it('rejeita conteúdo que não bate com a extensão (arquivo falsificado)', async () => {
    const r = await validarArquivo(arq('falso.png', [0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'image/png'), 'foto');
    expect(r.valido).toBe(false);
    expect(r.erro).toMatch(/conteúdo/);
  });
  it('respeita limite de tamanho configurável e rejeita vazio', async () => {
    const grande = arq('f.png', 2000, 'image/png');
    expect((await validarArquivo(grande, 'foto', 1000)).valido).toBe(false);
    expect((await validarArquivo(grande, 'foto', 5000)).valido).toBe(false); // sem assinatura PNG
    expect((await validarArquivo(arq('v.png', 0, 'image/png'), 'foto')).valido).toBe(false);
  });
  it('categoria desconhecida e arquivo ausente', async () => {
    expect((await validarArquivo(arq('f.png', PNG, 'image/png'), 'xyz')).valido).toBe(false);
    expect((await validarArquivo(null, 'foto')).valido).toBe(false);
  });
});

describe('utilitários', () => {
  it('extensaoDe', () => { expect(extensaoDe('A.b.PDF')).toBe('pdf'); expect(extensaoDe('semext')).toBe(''); });
  it('gerarCaminho não usa o nome do usuário', () => {
    const p = gerarCaminho('pasta', 'png', 'uuid-1');
    expect(p).toBe('pasta/uuid-1.png');
  });
});
