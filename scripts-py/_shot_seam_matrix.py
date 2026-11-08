# 临时工具: 多配置 hero-fade 分割线复现矩阵 + 行跳变检测
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'http://127.0.0.1:4000/'

def analyze(path):
    im = np.asarray(Image.open(path).convert('RGB'), dtype=float)
    h, w, _ = im.shape
    strip = im[:, int(w*0.125):int(w*0.875), :]
    rows = strip.mean(axis=(1, 2))
    d = np.abs(np.diff(rows))
    # 排除文章区(取前 85%)找最大单行走跳变
    lim = int(h * 0.85)
    idx = np.argsort(d[:lim])[::-1][:6]
    print(path.split('\\')[-1], 'shape', im.shape,
          'jumps:', sorted([(int(i), round(float(d[i]), 1)) for i in idx]))

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')

    cases = [
        ('dpr2',   dict(viewport={'width': 1600, 'height': 900}, device_scale_factor=2), None),
        ('small',  dict(viewport={'width': 1280, 'height': 720}), None),
        ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True), None),
        ('beige',  dict(viewport={'width': 1600, 'height': 900}), 'beige-lite'),
        ('dark',   dict(viewport={'width': 1600, 'height': 900}), 'dark-night'),
    ]
    for tag, kw, theme in cases:
        ctx = b.new_context(**kw)
        pg = ctx.new_page()
        if theme:
            pg.add_init_script(f"localStorage.setItem('axtrivc_theme_v2', '{theme}')")
        pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
        pg.wait_for_selector('#asciiRiver', timeout=30000)
        pg.wait_for_timeout(6000)
        seam = pg.evaluate("document.querySelector('.hero-fade').getBoundingClientRect().top + window.scrollY")
        vh = pg.evaluate('window.innerHeight')
        pg.evaluate(f'window.scrollTo(0, {int(seam - vh * 0.5)})')
        pg.wait_for_timeout(1500)
        p = rf'{OUT}\_seam_{tag}.png'
        pg.screenshot(path=p)
        analyze(p)
        pg.close()
        ctx.close()
    b.close()
