import { esc } from '../core/dom.js';
import { icon } from './icons.js';

export const loadingState = (texto = 'Carregando registros…') => `<div class="loading-state" role="status"><span class="spinner" aria-hidden="true"></span><span>${esc(texto)}</span></div>`;
export const emptyState = (titulo, descricao = '', acaoHTML = '') => `<div class="empty-state">${icon('inbox', 28)}<h3>${esc(titulo)}</h3>${descricao ? `<p>${esc(descricao)}</p>` : ''}${acaoHTML}</div>`;
export const errorState = (texto) => `<div class="error-state" role="alert">${icon('alert-circle', 24)}<h3>Não foi possível carregar</h3><p>${esc(texto)}</p><button type="button" class="sec" data-retry>Tentar novamente</button></div>`;
