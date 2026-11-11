#!/usr/bin/env python3
"""Gera as imagens de arranque do iPhone (apple-touch-startup-image): fundo #0a0a0a, Phi branco e anel laranja fino,
com as mesmas medidas do #evSplash da página (Phi 78 px de altura, anel 79 px, em px CSS), para a passagem ser invisível.
Uso: python3 scripts/gerar-ecras-arranque.py   (escreve em splash/)"""
import os
from PIL import Image, ImageDraw

BG = (10, 10, 10)
ORANGE = (232, 93, 38)
RING_ALPHA = 0.65
PHI_H = 78.0     # px CSS
RING_D = 79.0    # px CSS
RING_W = 0.67    # px CSS
SS = 4           # sobreamostragem

# (largura CSS, altura CSS, escala) -> imagem de largura*escala x altura*escala
DEVICES = [
    (440, 956, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3), (390, 844, 3),
    (375, 812, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3), (375, 667, 2), (320, 568, 2),
]

def mark(cw, ch, k):
    """Desenha o Phi + anel num quadro de cw x ch px (centro = centro do quadro)."""
    big = Image.new("RGB", (cw * SS, ch * SS), BG)
    d = ImageDraw.Draw(big)
    cx, cy = cw * SS / 2.0, ch * SS / 2.0
    h = PHI_H * k * SS
    r_out, r_in = h * 100 / 320, h * 80 / 320
    lw = h * 20 / 320
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(255, 255, 255))
    d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=BG)
    d.rectangle([cx - lw / 2, cy - h / 2, cx + lw / 2, cy + h / 2], fill=(255, 255, 255))
    rr = RING_D * k * SS / 2.0 * 0.99
    col = tuple(int(round(BG[i] * (1 - RING_ALPHA) + ORANGE[i] * RING_ALPHA)) for i in range(3))
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=col, width=max(1, int(round(RING_W * k * SS))))
    return big.resize((cw, ch), Image.LANCZOS)

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "splash")
    os.makedirs(out, exist_ok=True)
    for (w, h, k) in DEVICES:
        W, H = w * k, h * k
        cw = int(RING_D * k * 1.6) // 2 * 2 + (W % 2)   # mesma paridade do ecrã: o centro do quadro é o centro da imagem
        ch = int(RING_D * k * 1.6) // 2 * 2 + (H % 2)
        img = Image.new("RGB", (W, H), BG)
        img.paste(mark(cw, ch, k), ((W - cw) // 2, (H - ch) // 2))
        name = "arranque-%dx%d.png" % (W, H)
        img.save(os.path.join(out, name), optimize=True)
        print(name, "->", w, "x", h, "@", k)

if __name__ == "__main__":
    main()
