const TRADUCOES = [
  [/\bdevedores\b/gi, (t) => t[0] === t[0].toUpperCase() ? 'Clientes' : 'clientes'],
  [/\bdevedor\b/gi, (t) => t[0] === t[0].toUpperCase() ? 'Cliente' : 'cliente'],
];
const traduzir = (texto) => TRADUCOES.reduce((v, [re, fn]) => v.replace(re, fn), texto);

/** Só copy declarada: nomes, descrições, observações e auditoria nunca são traduzidos. */
export function iniciarTerminologiaClientes(raiz) {
  const atualizar = () => {
    raiz.querySelectorAll('[data-ui-copy]').forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let no;
      while ((no = walker.nextNode())) {
        if (no.parentElement?.closest('[data-user-content], textarea, script, style')) continue;
        const novo = traduzir(no.nodeValue);
        if (novo !== no.nodeValue) no.nodeValue = novo;
      }
      for (const attr of ['aria-label', 'placeholder', 'title']) {
        if (!el.hasAttribute(attr)) continue;
        const antes = el.getAttribute(attr);
        const depois = traduzir(antes);
        if (depois !== antes) el.setAttribute(attr, depois);
      }
    });
  };
  atualizar();
  const observador = new MutationObserver(atualizar);
  observador.observe(raiz, { childList: true, subtree: true, characterData: true });
  return observador;
}
