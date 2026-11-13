# Ativos de identidade

A interface usa Cormorant Garamond nos títulos institucionais e DM Sans nos controles operacionais, conforme os documentos fornecidos. As fontes são hospedadas localmente em public/fonts para evitar enviar informações de navegação a um fornecedor de tipografia. As licenças SIL Open Font License acompanham os arquivos.

Fontes oficiais verificadas em 12 de novembro de 2026: https://fonts.google.com/specimen/Cormorant+Garamond e https://fonts.google.com/specimen/DM+Sans. Arquivos obtidos pela API Google Fonts e licenças pelo repositório google/fonts.

Os ícones operacionais são Lucide, dependência já presente no projeto. Não são utilizadas fotografias de clientes reais, imagens de banco de imagens ou ilustrações decorativas.

## Marca
- Origem: fotografia do chapéu e da gravata enviada pelo cliente (`D_NQ_NP_642061-MLA104241562614_012026-O-fantasia-gangster-mafia-chapeu-suspensorio-gravata-3pcs.webp`, 500 × 500 px), arquivada em `tools/origem/chapeu.webp`.
- Tratamento: recorte quadrado sobre o chapéu e a gravata, leve vinheta para fundir as bordas ao tema escuro e aro duplo (escuro por fora, dourado por dentro) formando um medalhão circular. A fotografia não é redesenhada nem convertida em vetor.
- Geração: `python3 tools/marca.py` grava todos os derivados a partir do arquivo original (requer apenas Pillow).
- Aplicação na interface: medalhão de 44 px na barra lateral, 30 px no cabeçalho mobile e 60 px no painel do login, sempre com o texto alternativo vazio porque a marca é decorativa e o nome está escrito ao lado.
- Instalação (PWA): `public/icons/icon-192.png` e `public/icons/icon-512.png` usam a foto inteira; `icon-512-maskable.png` traz o medalhão sobre `#080808` dentro da área segura de recorte; `apple-touch-icon.png` (180 px) repete a foto inteira; `favicon-32.png` usa o medalhão.
- Licença: a origem e o direito de uso da imagem são de responsabilidade do cliente; o arquivo não é redistribuído fora deste projeto.

## Fotografia do login

- Arquivo recebido: `360_F_376877408_tahYXzHkO7ZgLERw43ErDjcIVQtyTWYC.jpg` (510 × 360 px), fornecido pelo cliente.
- Tratamento: restauração e ampliação por IA preservando o conteúdo original, seguida de leve nitidez e conversão para WebP.
- Derivados publicados: `public/images/login-desk-1492.webp` (desktop, painel lateral, 1280 × 1280 px) e `public/images/login-desk-800.webp` (mobile, faixa superior, 800 × 516 px).
- Conteúdo: ambos são a mesma fotografia da mesa de trabalho, sem composição ou retrato adicional. O recorte quadrado do desktop ocupa o painel lateral e o recorte horizontal de 800 px alimenta a faixa superior mobile.
- Uso: decorativo, servido como `alt=""` e coberto por gradiente para manter o contraste do texto.
- Licença: a origem e o direito de uso da imagem são de responsabilidade do cliente; o arquivo não é redistribuído fora deste projeto.
