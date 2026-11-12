const TRADUCOES = [
  [/\bdevedores\b/gi, (termo) => termo[0] === termo[0].toUpperCase() ? 'Clientes' : 'clientes'],
  [/\bdevedor\b/gi, (termo) => termo[0] === termo[0].toUpperCase() ? 'Cliente' : 'cliente'],
];

function traduzir(texto) {
  return TRADUCOES.reduce((resultado, [expressao, substituicao]) => resultado.replace(expressao, substituicao), texto);
}

function traduzirTexto(no) {
  const novo = traduzir(no.nodeValue);
  if (novo !== no.nodeValue) no.nodeValue = novo;
}

function traduzirAtributos(elemento) {
  for (const atributo of ['aria-label', 'placeholder', 'title']) {
    if (!elemento.hasAttribute(atributo)) continue;
    const valor = elemento.getAttribute(atributo);
    const novo = traduzir(valor);
    if (novo !== valor) elemento.setAttribute(atributo, novo);
  }
}

function traduzirElementos(raiz) {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let no;
  while ((no = walker.nextNode())) traduzirTexto(no);
  if (raiz.nodeType === Node.ELEMENT_NODE) traduzirAtributos(raiz);
  raiz.querySelectorAll?.('[aria-label], [placeholder], [title]').forEach(traduzirAtributos);
}

/** Atualiza os termos visíveis da interface sem alterar nomes internos, rotas ou o modelo de dados. */
export function iniciarTerminologiaClientes(raiz) {
  traduzirElementos(raiz);
  const observador = new MutationObserver((mutacoes) => {
    for (const mutacao of mutacoes) {
      if (mutacao.type === 'characterData') {
        traduzirTexto(mutacao.target);
      } else {
        mutacao.addedNodes.forEach((no) => {
          if (no.nodeType === Node.TEXT_NODE) traduzirTexto(no);
          else if (no.nodeType === Node.ELEMENT_NODE) traduzirElementos(no);
        });
        if (mutacao.type === 'attributes') traduzirAtributos(mutacao.target);
      }
    }
  });
  observador.observe(raiz, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title'] });
  return observador;
}
