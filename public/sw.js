// PWA administrativa: deliberadamente sem fetch handler, cache ou armazenamento.
// API, autenticação, páginas e arquivos privados sempre dependem da rede.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
