# Hospedagem e validação do redesign

O aplicativo continua sendo uma SPA estática Vite com navegação por hash. O resultado de `npm run build` fica em `dist`. Não foi criado servidor próprio, banco novo ou ambiente Manus. A implantação deve usar o domínio e a hospedagem escolhidos pela Scipione Affare.

## Configuração pública

Preencher `.env` a partir de `.env.example` com a URL do projeto Supabase existente, chave anon/publishable e a origem HTTPS do aplicativo. Não usar chave service_role/secret com prefixo VITE_. As migrations, o cadastro do administrador, o SMTP e a lista de redirecionamentos de recuperação devem ser verificados no projeto existente. Nenhuma operação foi executada em dados remotos nesta entrega.

## Cabeçalhos HTTP

O build conserva CSP de scripts, estilos, imagens e conexões. As fontes são locais. A diretiva `frame-ancestors` não funciona em meta tags; a proteção contra incorporação deve ser enviada pelo servidor/CDN no cabeçalho HTTP. O arquivo `public/_headers`, copiado para `dist`, é um modelo para hospedagens que aceitam esse formato, como Netlify/Cloudflare Pages. Em outro provedor, configurar os mesmos cabeçalhos no painel ou servidor. Não presumir que o arquivo seja aplicado por toda hospedagem.

Requeridos em produção: `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer`. Evitar cache compartilhado do HTML administrativo e de respostas autenticadas. Validar os cabeçalhos do domínio final antes de disponibilizar o acesso.

Referência oficial: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors

## PWA e privacidade

O manifest é da aplicação, com ícones de 192 e 512 px e exibição standalone. O service worker não possui fetch handler nem usa Cache Storage, IndexedDB ou dados financeiros offline. A PWA exige HTTPS fora de localhost e internet para os fluxos operacionais. A instalação depende das capacidades e políticas do navegador; a validação desta entrega foi feita no Chromium, não em aparelhos físicos Android/iOS.

## Testes visuais reproduzíveis

A suíte `tests/visual/run.mjs` intercepta os serviços somente dentro do navegador de teste. Não existe modo demo nem bypass de autenticação no bundle. Os dados fictícios identificados como sintéticos são mantidos em memória; nunca são enviados ao Supabase. Pode-se instalar Playwright em uma pasta externa, sem mudar as dependências da aplicação:

```sh
npm install --prefix /tmp/scipione-ui-tools playwright
npm run dev -- --host 127.0.0.1 --port 5173
# Em outro terminal:
PLAYWRIGHT_MODULE=/tmp/scipione-ui-tools/node_modules/playwright/index.mjs node tests/visual/run.mjs
```

O script usa Chromium em `/usr/bin/chromium`, ajustável por `CHROMIUM_BIN`. `UI_TEST_URL` e `UI_TEST_OUTPUT` também são configuráveis. Para verificar o build sem configuração remota, servir `npm run preview -- --port 4173` e executar `tests/visual/production.mjs` com o mesmo módulo Playwright.

## Pendências preexistentes

CPF/CNPJ obrigatório, limites finais dos anexos, domínio/hospedagem, políticas LGPD e rotina de backup continuam sujeitos às decisões em `docs/decisoes.md`. Arquivos privados podem ficar órfãos se o upload funcionar e a escrita vinculante falhar; esse comportamento documentado preexistente foi preservado, sem contornar as políticas dos buckets. Reconciliação deve ser definida e executada pelo responsável pelo projeto Supabase, não por testes visuais.
