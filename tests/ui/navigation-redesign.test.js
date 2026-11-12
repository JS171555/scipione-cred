// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../src/services/auth.js', () => ({ obterAdmin: vi.fn(), sair: vi.fn() }));
import { obterAdmin } from '../../src/services/auth.js';
import { iniciarRouter } from '../../src/core/router.js';
import { iniciarTerminologiaClientes } from '../../src/core/terminologia.js';
import { adaptarTabelas } from '../../src/components/tabelas.js';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  history.replaceState(null, '', '#/');
});

describe('navegação e textos preservados', () => {
  it('não deixa autenticação atrasada pintar a rota anterior', async () => {
    let concluir;
    obterAdmin.mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; })).mockResolvedValue(null);
    const root = document.querySelector('#app');
    const antiga = vi.fn((r) => { r.textContent = 'Dados antigos'; });
    const rotas = { '/': { render: antiga }, '/login': { publica: true, render: (r) => { r.textContent = 'Login atual'; } }, '/404': { render: () => {} } };
    const pendente = iniciarRouter({ raiz: root, rotas });
    history.replaceState(null, '', '#/login');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await vi.waitFor(() => expect(root.textContent).toBe('Login atual'));
    concluir({ id: 'admin', nome: 'Admin sintético' });
    await pendente;
    expect(antiga).not.toHaveBeenCalled();
    expect(root.textContent).toBe('Login atual');
  });

  it('traduz só copy explícita, sem alterar nomes, observações ou atributos de dados', async () => {
    const root = document.querySelector('#app');
    root.innerHTML = '<span data-ui-copy>Devedores cadastrados</span><a title="Devedor original">Devedor &amp; Associados</a><p>Observação: devedor informou pagamento</p>';
    const obs = iniciarTerminologiaClientes(root);
    expect(root.querySelector('[data-ui-copy]').textContent).toBe('Clientes cadastrados');
    expect(root.querySelector('a').textContent).toBe('Devedor & Associados');
    expect(root.querySelector('a').title).toBe('Devedor original');
    expect(root.querySelector('p').textContent).toBe('Observação: devedor informou pagamento');
    root.insertAdjacentHTML('beforeend', '<strong>Devedor de teste</strong>');
    await Promise.resolve();
    expect(root.querySelector('strong').textContent).toBe('Devedor de teste');
    obs.disconnect();
  });

  it('acrescenta rótulos mobile sem substituir rótulos específicos', async () => {
    const root = document.querySelector('#app');
    adaptarTabelas(root);
    root.innerHTML = '<table><thead><tr><th>Data</th><th>Valor</th></tr></thead><tbody><tr><td>12/11/2026</td><td data-label="Pago">100,00</td></tr></tbody></table>';
    await Promise.resolve();
    expect(root.querySelector('td').dataset.label).toBe('Data');
    expect(root.querySelector('td:nth-child(2)').dataset.label).toBe('Pago');
  });
});
