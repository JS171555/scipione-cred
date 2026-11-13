"""Gera os ícones da Scipione Cred a partir da arte do chapéu.

A imagem enviada pela cliente é usada inteira, quadrada e sem qualquer moldura
adicional: o aplicativo, o favicon, o atalho do iOS e a instalação da PWA
recebem a mesma arte, apenas redimensionada.

Uso: python3 tools/marca.py [caminho-da-arte]
Requer apenas Pillow.
"""
from pathlib import Path
import sys

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ARTE = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / 'tools/origem/chapeu.png'
BRAND = RAIZ / 'public/brand'
ICONES = RAIZ / 'public/icons'


def quadrada(arte: Image.Image, lado: int) -> Image.Image:
    """Recorte quadrado central e redução de alta qualidade, sem molduras."""
    arte = arte.convert('RGB')
    largura, altura = arte.size
    corte = min(largura, altura)
    esquerda = (largura - corte) // 2
    topo = (altura - corte) // 2
    return arte.crop((esquerda, topo, esquerda + corte, topo + corte)).resize((lado, lado), Image.LANCZOS)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    ICONES.mkdir(parents=True, exist_ok=True)
    arte = Image.open(ARTE)

    # marca exibida dentro do aplicativo (barra lateral, cabeçalho mobile e login)
    for lado in (96, 192, 512):
        quadrada(arte, lado).save(BRAND / f'marca-{lado}.png')

    # ícones do sistema: a mesma arte, sem borda e sem recorte redondo
    quadrada(arte, 192).save(ICONES / 'icon-192.png')
    quadrada(arte, 512).save(ICONES / 'icon-512.png')
    quadrada(arte, 180).save(ICONES / 'apple-touch-icon.png')
    quadrada(arte, 32).save(ICONES / 'favicon-32.png')
    print('ícones gerados em public/brand e public/icons')


if __name__ == '__main__':
    main()
