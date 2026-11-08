# 临时工具: hero ↔ hero-fade 衔接区分割线复现 + 像素测量
from playwright.sync_api import sync_playwright
import json

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'http://127.0.0.1:4000/'

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_selector('#asciiRiver', timeout=30000)
    pg.wait_for_timeout(6000)

    info = pg.evaluate('''() => {
      const c = document.getElementById('asciiRiver');
      const fade = document.querySelector('.hero-fade');
      const fcv = document.getElementById('heroFadeAscii');
      const r = c.getBoundingClientRect();
      const fr = fade.getBoundingClientRect();
      return {
        dpr: window.devicePixelRatio,
        innerW: window.innerWidth, innerH: window.innerHeight,
        canvasBuf: [c.width, c.height],
        canvasCss: [r.width, r.height],
        canvasOpacity: getComputedStyle(c).opacity,
        fadeRect: [fr.x, fr.y, fr.width, fr.height],
        fadeCanvasBuf: [fcv.width, fcv.height],
        scrollY: window.scrollY,
      };
    }''')
    print(json.dumps(info, indent=1))

    # 滚到 hero 底边与渐变带交界处居中
    seamY = info['fadeRect'][1] + info['scrollY']
    pg.evaluate(f'window.scrollTo(0, {int(seamY - 450)})')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=rf'{OUT}\_seam_live.png')
    print('seam_live ok')

    # 静态兜底模式（context lost → heroStill 取样路径）
    pg.evaluate('window.scrollTo(0, 0)')
    pg.evaluate('window.riverFreezeHero && window.riverFreezeHero()')
    pg.wait_for_timeout(2000)
    pg.evaluate(f'window.scrollTo(0, {int(seamY - 450)})')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=rf'{OUT}\_seam_frozen.png')
    print('seam_frozen ok')

    b.close()
