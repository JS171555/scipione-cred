# Ativos de identidade

A interface usa Cormorant Garamond nos títulos institucionais e DM Sans nos controles operacionais, conforme os documentos fornecidos. As fontes são hospedadas localmente em public/fonts para evitar enviar informações de navegação a um fornecedor de tipografia. As licenças SIL Open Font License acompanham os arquivos.

Fontes oficiais verificadas em 12 de novembro de 2026: https://fonts.google.com/specimen/Cormorant+Garamond e https://fonts.google.com/specimen/DM+Sans. Arquivos obtidos pela API Google Fonts e licenças pelo repositório google/fonts.

Os ícones operacionais são Lucide, dependência já presente no projeto. Não são utilizadas fotografias de clientes reais, imagens de banco de imagens ou ilustrações decorativas.

## Marca
- Origem: arte do chapéu dourado enviada pelo cliente (`file_000000004c20820eae554071b7381120.png`, 1254 × 1254 px), arquivada em `tools/origem/chapeu.png`.
- Tratamento: nenhum além do redimensionamento. A arte é usada inteira, quadrada, com a moldura que já faz parte da própria imagem — sem aro, sem vinheta, sem recorte circular e sem sombra adicionados pelo sistema.
- Geração: `python3 tools/marca.py` grava todos os derivados a partir do arquivo original (requer apenas Pillow).
- Aplicação na interface: `public/brand/marca-96.png` e `marca-192.png` formam o ícone exibido ao lado do nome na barra lateral (44 px), no cabeçalho mobile (30 px) e no painel do login (60 px). O texto alternativo é vazio porque a marca é decorativa e o nome está escrito ao lado.
- Instalação (PWA): `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180 px) e `favicon-32.png` recebem a mesma arte, sem borda e sem arredondamento. O ícone de 512 px é declarado como `any maskable`, então o sistema aplica a própria máscara sobre a imagem.
- Licença: a origem e o direito de uso da imagem são de responsabilidade do cliente; o arquivo não é redistribuído fora deste projeto.
