# -*- coding: utf-8 -*-
"""生成站点 favicon: 深夜色圆角方块 + 等宽字母 A + 绿色光标下划线。

配色取自首页 hero(夜色系 #101E38 → #0B1220)与 typed 副标题的
主题 accent(#07C160), 呼应 ASCII river / 终端光标的美学。
输出 source/img/favicon.png(64x64, 8x 超采样抗锯齿)。

用法: python scripts-py/gen_favicon.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

SS = 8                      # 超采样倍数
OUT = 64                    # 最终边长
S = OUT * SS
RADIUS = int(S * 0.22)

BG_TOP = (16, 30, 56)       # #101E38
BG_BOT = (11, 18, 32)       # #0B1220
FG = (240, 246, 255)        # 字母色
ACCENT = (7, 193, 96)       # #07C160 光标

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "source", "img", "favicon.png")


def load_font(size):
    for name in ("consolab.ttf", "consola.ttf", "courbd.ttf", "cour.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            for base in (r"C:\Windows\Fonts", "/usr/share/fonts"):
                p = os.path.join(base, name)
                if os.path.exists(p):
                    return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # 竖向渐变底, 圆角蒙版
    grad = Image.new("RGB", (1, S))
    for y in range(S):
        t = y / (S - 1)
        grad.putpixel((0, y), tuple(round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t) for i in range(3)))
    grad = grad.resize((S, S))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    font = load_font(int(S * 0.60))
    bbox = d.textbbox((0, 0), "A", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]

    # "A_" 作为一个整体居中
    gap = int(S * 0.045)
    cw, ch = int(S * 0.20), int(S * 0.055)
    total = w + gap + cw
    x = (S - total) / 2 - bbox[0]
    y = (S - h) / 2 - bbox[1] - int(S * 0.01)
    d.text((x, y), "A", font=font, fill=FG + (255,))

    # 光标下划线(基线处, 圆头)
    cx = x + bbox[2] + gap
    cy = y + bbox[3] - ch
    d.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=ch // 2, fill=ACCENT + (255,))

    img = img.resize((OUT, OUT), Image.LANCZOS)
    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    img.save(DEST)
    print("written:", DEST)


if __name__ == "__main__":
    main()
