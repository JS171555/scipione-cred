import { icon } from './icons.js';

/**
 * Botão que abre e fecha o cartão de filtros. O cartão nasce recolhido em qualquer largura
 * (ver base.css) e o botão fica na mesma linha e com a mesma altura da ação principal da lista.
 */
export function botaoFiltros(painelId = 'filtros-painel', rotulo = 'Filtros') {
  return `<button type="button" class="btn sec filtro-toggle" id="filtro-toggle" aria-expanded="false" aria-controls="${painelId}">${icon('sliders-horizontal', 15)} ${rotulo}</button>`;
}

/** Liga o botão ao painel recolhível e devolve o marcador de filtros ativos. */
export function instalarBotaoFiltros(raiz, painelId = 'filtros-painel') {
  const painel = raiz?.querySelector?.(`#${painelId}`);
  const botao = raiz?.querySelector?.('#filtro-toggle');
  botao?.addEventListener('click', () => {
    if (!painel) return;
    const aberto = painel.dataset.aberto === 'true';
    painel.dataset.aberto = String(!aberto);
    botao.setAttribute('aria-expanded', String(!aberto));
  });
  return (ativos) => botao?.setAttribute('data-ativos', String(Boolean(ativos)));
}
