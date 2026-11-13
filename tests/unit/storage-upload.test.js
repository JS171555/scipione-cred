import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ error: null })),
  prepararArquivo: vi.fn(),
}));

vi.mock('../../src/core/supabase.js', () => ({
  supabase: { storage: { from: () => ({ upload: mock.upload }) } },
}));
vi.mock('../../src/services/configuracoes.js', () => ({
  obterLimitesUpload: async () => ({ foto: 5 * 1024 * 1024, documento: 10 * 1024 * 1024, comprovante: 10 * 1024 * 1024 }),
}));
vi.mock('../../src/utils/midia.js', () => ({ prepararArquivo: mock.prepararArquivo }));

import { enviarArquivo } from '../../src/services/storage.js';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const PASTA = '11111111-1111-4111-8111-111111111111';
const foto = () => new File([new Uint8Array(PNG)], 'RG frente.png', { type: 'image/png' });

beforeEach(() => {
  mock.upload.mockClear();
  mock.prepararArquivo.mockReset();
});

describe('enviarArquivo', () => {
  it('envia o WebP convertido, com caminho, MIME e tamanho do arquivo final', async () => {
    const convertido = new File([new Uint8Array(WEBP)], 'RG frente.webp', { type: 'image/webp' });
    mock.prepararArquivo.mockResolvedValue({ arquivo: convertido, convertido: true, formato: 'webp' });
    const r = await enviarArquivo('foto', PASTA, foto());
    expect(r.path.startsWith(`${PASTA}/`)).toBe(true);
    expect(r.path.endsWith('.webp')).toBe(true);
    expect(r.mime_type).toBe('image/webp');
    expect(r.nome_original).toBe('RG frente.webp');
    expect(r.tamanho_bytes).toBe(convertido.size);
    expect(mock.upload).toHaveBeenCalledTimes(1);
    const [caminho, arquivo, opcoes] = mock.upload.mock.calls[0];
    expect(caminho).toBe(r.path);
    expect(arquivo).toBe(convertido);
    expect(opcoes).toMatchObject({ contentType: 'image/webp', upsert: false });
  });

  it('mantém o original quando a conversão não acontece', async () => {
    const original = foto();
    mock.prepararArquivo.mockResolvedValue({ arquivo: original, convertido: false, formato: 'png' });
    const r = await enviarArquivo('foto', PASTA, original);
    expect(r.path.endsWith('.png')).toBe(true);
    expect(r.mime_type).toBe('image/png');
    expect(r.nome_original).toBe('RG frente.png');
    expect(mock.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
  });

  it('recusa a seleção antes de tentar converter', async () => {
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'x.png', { type: 'image/png' });
    await expect(enviarArquivo('foto', PASTA, falso)).rejects.toThrow(/conteúdo/);
    expect(mock.prepararArquivo).not.toHaveBeenCalled();
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it('não envia nada quando a conversão produz um arquivo inválido', async () => {
    mock.prepararArquivo.mockResolvedValue({
      arquivo: new File([new Uint8Array([1, 2, 3])], 'quebrado.webp', { type: 'image/webp' }),
      convertido: true,
      formato: 'webp',
    });
    await expect(enviarArquivo('foto', PASTA, foto())).rejects.toThrow(/conteúdo/);
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it('volta ao original quando o bucket ainda recusa o WebP', async () => {
    const convertido = new File([new Uint8Array(WEBP)], 'RG frente.webp', { type: 'image/webp' });
    mock.prepararArquivo.mockResolvedValue({ arquivo: convertido, convertido: true, formato: 'webp' });
    mock.upload.mockResolvedValueOnce({ error: { message: 'mime type image/webp is not supported', statusCode: 415 } });
    mock.upload.mockResolvedValueOnce({ error: null });
    const original = foto();
    const r = await enviarArquivo('foto', PASTA, original);
    expect(r.path.endsWith('.png')).toBe(true);
    expect(r.mime_type).toBe('image/png');
    expect(r.nome_original).toBe('RG frente.png');
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(mock.upload.mock.calls[1][1]).toBe(original);
  });

  it('propaga erros que não são de formato', async () => {
    const convertido = new File([new Uint8Array(WEBP)], 'RG frente.webp', { type: 'image/webp' });
    mock.prepararArquivo.mockResolvedValue({ arquivo: convertido, convertido: true, formato: 'webp' });
    mock.upload.mockResolvedValueOnce({ error: { message: 'new row violates row-level security policy', statusCode: 403 } });
    await expect(enviarArquivo('foto', PASTA, foto())).rejects.toMatchObject({ statusCode: 403 });
    expect(mock.upload).toHaveBeenCalledTimes(1);
  });
});
