// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
vi.mock('../../src/services/auth.js', () => ({ temSessao: vi.fn(), redefinirSenha: vi.fn() }));
import { montarAuth, campoSenha } from '../../src/components/auth-layout.js';
import { uploadField, instalarUpload, arquivosDoUpload } from '../../src/components/upload.js';
import { validarArquivo } from '../../src/utils/files.js';
import { temSessao } from '../../src/services/auth.js';
import { renderRedefinir } from '../../src/modules/redefinir.js';

let raiz;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  raiz = document.querySelector('#app');
});

describe('componentes do redesign de formulários', () => {
  it('monta auth com marca, campos acessíveis e visibilidade de senha', () => {
    montarAuth(raiz, { title: 'Acesso', content: `<form id="form">${campoSenha({ id: 'senha', label: 'Senha' })}</form>` });
    const input = raiz.querySelector('#senha');
    const toggle = raiz.querySelector('[data-password-toggle="senha"]');
    expect(raiz.querySelector('.auth-layout')).toBeTruthy();
    expect(raiz.querySelector('.auth-story')).toBeTruthy();
    expect(input.type).toBe('password');
    toggle.click();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    expect(input.type).toBe('password');
  });

  it('recusa assinatura falsa no componente de upload e não inventa percentual', async () => {
    raiz.innerHTML = uploadField({ id: 'arquivo', label: 'Documento', categoria: 'documento' });
    const input = raiz.querySelector('#arquivo');
    instalarUpload(input, { categoria: 'documento', limiteBytes: 10 * 1024 * 1024 });
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0])], 'arquivo.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { configurable: true, value: [falso] });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(raiz.querySelector('.upload-error').textContent).toMatch(/conteúdo/);
    expect(raiz.querySelector('[data-upload-progress]')).toBeNull();
  });

  it('aceita uma imagem sintética apenas quando extensão, MIME e assinatura coincidem', async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'foto.png', { type: 'image/png' });
    await expect(validarArquivo(png, 'foto', 5 * 1024 * 1024)).resolves.toMatchObject({ valido: true, extensao: 'png' });
  });

  it('mantém somente a validação mais recente quando changes concorrentes terminam fora de ordem', async () => {
    raiz.innerHTML = uploadField({ id: 'arquivo', label: 'Documento', categoria: 'documento' });
    const input = raiz.querySelector('#arquivo');
    const antigo = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'antigo.pdf', { type: 'application/pdf' });
    let liberarAntigo;
    Object.defineProperty(antigo, 'slice', { value: () => ({ arrayBuffer: () => new Promise((resolve) => { liberarAntigo = resolve; }) }) });
    const atual = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'atual.pdf', { type: 'application/pdf' });
    instalarUpload(input, { categoria: 'documento', limiteBytes: 10 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { configurable: true, value: [antigo] });
    input.dispatchEvent(new Event('change'));
    expect(input._uploadState.pendente).toBe(true);
    Object.defineProperty(input, 'files', { configurable: true, value: [atual] });
    input.dispatchEvent(new Event('change'));
    await input._uploadState.promise;
    expect(input._uploadState.arquivos).toEqual([atual]);
    liberarAntigo(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await Promise.resolve();
    expect(arquivosDoUpload(input)).toEqual([atual]);
  });

  it('marca validação rejeitada e não expõe arquivos para o submit', async () => {
    raiz.innerHTML = uploadField({ id: 'arquivo', label: 'Documento', categoria: 'documento' });
    const input = raiz.querySelector('#arquivo');
    instalarUpload(input, { categoria: 'documento', limiteBytes: 10 * 1024 * 1024 });
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'arquivo.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { configurable: true, value: [falso] });
    input.dispatchEvent(new Event('change'));
    await input._uploadState.promise;
    expect(input._uploadState.pendente).toBe(false);
    expect(input._uploadState.valido).toBe(false);
    expect(input._uploadState.erro).toMatch(/conteúdo/);
    expect(arquivosDoUpload(input)).toEqual([]);
  });

  it('não renderiza recuperação depois que o signal é abortado durante temSessao', async () => {
    let liberar;
    temSessao.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }));
    const controller = new AbortController();
    const render = renderRedefinir(raiz, { signal: controller.signal });
    controller.abort();
    liberar(true);
    await render;
    expect(raiz.innerHTML).toBe('');
  });
});
