const TRADUCOES = [
  [/\bdevedores\b/gi, (termo) => termo[0] === termo[0].toUpperCase() ? 'Clientes' : 'clientes'],
  [/\bdevedor\b/gi, (termo) => termo[0] === termo[0].toUpperCase() ? 'Cliente' : 'cliente'],
];

function traduzir(texto) {
  return TRADUCOES.reduce((resultado, [expressao, substituicao]) => resultado.replace(expressao, substituicao), texto);
}

function traduzirElementos(raiz) {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let no;
  while ((no = walker.nextNode())) {
    const novo = traduzir(no.nodeValue);
    if (novo !== no.nodeValue) no.nodeValue = novo;
  }
  if (raiz.nodeType === Node.ELEMENT_NODE) {
    for (const atributo of ['aria-label', 'placeholder', 'title']) {
      if (raiz.hasAttribute(atributo)) raiz.setAttribute(atributo, traduzir(raiz.getAttribute(atributo)));
    }
  }
  raiz.querySelectorAll?.('[aria-label], [placeholder], [title]').forEach((elemento) => {
    for (const atributo of ['aria-label', 'placeholder', 'title']) {
      if (elemento.hasAttribute(atributo)) elemento.setAttribute(atributo, traduzir(elemento.getAttribute(atributo)));
    }
  });
}

/** Atualiza os termos visíveis da interface sem alterar nomes internos, rotas ou o modelo de dados. */
export function iniciarTerminologiaClientes(raiz) {
  traduzirElementos(raiz);
  const observador = new MutationObserver((mutacoes) => {
    for (const mutacao of mutacoes) {
      if (mutacao.type === 'characterData') {
        mutacao.target.nodeValue = traduzir(mutacao.target.nodeValue);
      } else {
        mutacao.addedNodes.forEach((no) => {
          if (no.nodeType === Node.TEXT_NODE) no.nodeValue = traduzir(no.nodeValue);
          else if (no.nodeType === Node.ELEMENT_NODE) traduzirElementos(no);
        });
        if (mutacao.type === 'attributes') {
          const alvo = mutacao.target;
          const atributo = mutacao.attributeName;
          alvo.setAttribute(atributo, traduzir(alvo.getAttribute(atributo) ?? ''));
        }
      }
    }
  });
  observador.observe(raiz, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'placeholder', 'title'] });
  return observador;
}
