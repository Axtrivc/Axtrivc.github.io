# 临时工具: hero 底边羽化兜底双路径验证
# A) 正常: 取样成功 → body.hero-fade-live, 遮罩摘除, 交界无跳变
# B) 断链: 吞掉 __heroFrameHook → 无 live 类, 羽化保持, 交界必须软
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
import json

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'http://127.0.0.1:4000/'

TRAP = """Object.defineProperty(window, '__heroFrameHook', {
  configurable: true, get() { return null; }, set(v) {}
});"""

def measure(path, seam_y):
    im = np.asarray(Image.open(path).convert('RGB'), dtype=float)
    strip = im[:, 200:1400, :]
    rows = strip.mean(axis=(1, 2))
    lo, hi = max(0, seam_y - 60), min(im.shape[0], seam_y + 60)
    d = np.abs(np.diff(rows[lo:hi]))
    return round(float(d.max()), 1), round(float(rows[seam_y - 4]), 1), round(float(rows[seam_y + 4]), 1)

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')

    for tag, trap in [('ok', None), ('broken', TRAP)]:
        pg = b.new_page(viewport={'width': 1600, 'height': 900})
        if trap:
            pg.add_init_script(trap)
        pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
        pg.wait_for_selector('#asciiRiver', timeout=30000)
        pg.wait_for_timeout(12000)
        info = pg.evaluate('''() => ({
          live: document.body.classList.contains('hero-fade-live'),
          mask: getComputedStyle(document.getElementById('asciiRiver')).webkitMaskImage
                || getComputedStyle(document.getElementById('asciiRiver')).maskImage,
          seamY: document.querySelector('.hero-fade').getBoundingClientRect().top + window.scrollY,
        })''')
        seam = int(info['seamY'])
        pg.evaluate(f'window.scrollTo(0, {seam - 450})')
        pg.wait_for_timeout(1500)
        p = rf'{OUT}\_guard_{tag}.png'
        pg.screenshot(path=p)
        vp_seam = 450
        mx, above, below = measure(p, vp_seam)
        print(tag, json.dumps({
          'heroFadeLive': info['live'],
          'maskOn': info['mask'] != 'none',
          'maxRowJumpAtSeam': mx, 'rowAbove': above, 'rowBelow': below,
        }))
        pg.close()
    b.close()
