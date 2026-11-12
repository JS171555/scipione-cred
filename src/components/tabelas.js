let observadorAtual;

/** Mantém os cabeçalhos disponíveis em cada célula quando a tabela vira cards. */
export function adaptarTabelas(conteudo) {
  observadorAtual?.disconnect();
  const adaptar = () => {
    conteudo.querySelectorAll('table').forEach((table) => {
      const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach((tr) => {
        [...tr.cells].forEach((td, i) => {
          if (!td.hasAttribute('data-label') && labels[i]) td.setAttribute('data-label', labels[i]);
        });
      });
    });
  };
  adaptar();
  observadorAtual = new MutationObserver(adaptar);
  observadorAtual.observe(conteudo, { childList: true, subtree: true });
}
