"""Gera os ativos da marca Scipione Cred a partir da fotografia do chapéu.

A imagem enviada pela cliente é usada como marca: no aplicativo ela aparece
como um medalhão circular com anel dourado; nos ícones da PWA, do favicon e
do atalho iOS ela vai em recorte quadrado sobre o fundo do tema.

Uso: python3 tools/marca.py [caminho-da-foto]
Requer apenas Pillow.
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
FOTO = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / 'tools/origem/chapeu.webp'
BRAND = RAIZ / 'public/brand'
ICONES = RAIZ / 'public/icons'

OURO = (206, 176, 120)
FUNDO = (8, 8, 8)
# recorte da foto usado no medalhão (chapéu e gravata)
CAIXA_MEDALHAO = (48, 108, 470, 472)


def _quadrada(foto: Image.Image, lado: int, caixa: tuple | None = None) -> Image.Image:
    """Recorte quadrado (ou a caixa indicada), com redução de alta qualidade."""
    foto = foto.convert('RGB')
    if caixa:
        esquerda, topo, direita, base = caixa
    else:
        largura, altura = foto.size
        corte = min(largura, altura)
        esquerda = (largura - corte) // 2
        topo = (altura - corte) // 2
        direita, base = esquerda + corte, topo + corte
    return foto.crop((esquerda, topo, direita, base)).resize((lado, lado), Image.LANCZOS)


def _vinheta(imagem: Image.Image, forca: float = 0.55) -> Image.Image:
    """Escurece as bordas para a foto se fundir ao tema escuro."""
    lado = imagem.size[0]
    sombra = Image.new('L', (lado, lado), 0)
    pincel = ImageDraw.Draw(sombra)
    pincel.ellipse((0, 0, lado, lado), fill=255)
    sombra = sombra.filter(ImageFilter.GaussianBlur(radius=lado * 0.09))
    escuro = Image.new('RGB', (lado, lado), (0, 0, 0))
    return Image.composite(imagem, Image.blend(imagem, escuro, forca), sombra)


def medalhao(foto: Image.Image, lado: int) -> Image.Image:
    """Marca do aplicativo: foto circular com anel dourado e borda suave."""
    escala = 4
    tam = lado * escala
    # aproxima o chapéu e a gravata: no tamanho da interface o conjunto precisa ler
    base = _vinheta(_quadrada(foto, tam, CAIXA_MEDALHAO), 0.35).convert('RGBA')

    # máscara circular com borda suavizada
    mascara = Image.new('L', (tam, tam), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, tam - 1, tam - 1), fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(radius=tam * 0.004))
    base.putalpha(mascara)

    final = base.resize((lado, lado), Image.LANCZOS)
    desenho = ImageDraw.Draw(final)
    # aro escuro por fora: separa o medalhão de fundos claros e de fotos
    aro = max(1, round(lado * 0.012))
    desenho.ellipse((0, 0, lado - 1, lado - 1), outline=(6, 6, 6, 190), width=aro)
    esp = max(1, round(lado * 0.022))
    desenho.ellipse(
        (esp / 2, esp / 2, lado - esp / 2, lado - esp / 2),
        outline=OURO + (235,),
        width=esp,
    )
    return final


def icone(foto: Image.Image, lado: int) -> Image.Image:
    """Ícone instalável: a fotografia inteira, quadrada, sem aro e sem recorte redondo."""
    return _quadrada(foto, lado)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    ICONES.mkdir(parents=True, exist_ok=True)
    foto = Image.open(FOTO)

    for lado in (96, 192, 512):
        medalhao(foto, lado).save(BRAND / f'selo-{lado}.png')

    icone(foto, 192).save(ICONES / 'icon-192.png')
    icone(foto, 512).save(ICONES / 'icon-512.png')
    icone(foto, 180).save(ICONES / 'apple-touch-icon.png')
    icone(foto, 32).save(ICONES / 'favicon-32.png')
    print('marca gerada em public/brand e public/icons')


if __name__ == '__main__':
    main()
