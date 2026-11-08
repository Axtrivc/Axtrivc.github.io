# 临时工具: 直连线上站点复现用户所见分割线 + 现场诊断
from playwright.sync_api import sync_playwright
import json

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'https://axtrivc.github.io/'

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1830, 'height': 930})
    pg.goto(URL, wait_until='domcontentloaded', timeout=90000)
    try:
        pg.wait_for_selector('#asciiRiver', timeout=30000)
    except Exception as e:
        print('no #asciiRiver:', e)
        pg.screenshot(path=rf'{OUT}\_live_now.png')
        b.close()
        raise SystemExit
    # 等场景走一段, 复现用户"亮底边"状态
    pg.wait_for_timeout(25000)

    diag = pg.evaluate('''() => {
      const c = document.getElementById('asciiRiver');
      const fade = document.querySelector('.hero-fade');
      const fcv = document.getElementById('heroFadeAscii');
      const still = document.getElementById('heroStill');
      // fade canvas 探针
      const q = document.createElement('canvas');
      q.width = 64; q.height = 1;
      const qc = q.getContext('2d', { willReadFrequently: true });
      function rowAt(frac) {
        qc.clearRect(0, 0, 64, 1);
        qc.drawImage(fcv, 0, Math.max(0, Math.floor(fcv.height * frac) - 1), fcv.width, 1, 0, 0, 64, 1);
        const d = qc.getImageData(0, 0, 64, 1).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
        return [Math.round(r/64), Math.round(g/64), Math.round(b/64)];
      }
      return {
        hasHook: typeof window.__heroFrameHook === 'function',
        riverLive: window.__riverLive,
        canvasBuf: c ? [c.width, c.height] : null,
        canvasCss: c ? [c.clientWidth, c.clientHeight] : null,
        canvasOpacity: c ? getComputedStyle(c).opacity : null,
        stillShown: still ? still.classList.contains('is-shown') : null,
        stillSrc: still ? (still.src || '').slice(0, 60) : null,
        fadeRect: fade ? fade.getBoundingClientRect().toJSON() : null,
        fadeBuf: fcv ? [fcv.width, fcv.height] : null,
        fadeTop: rowAt(0.005), fadeQ10: rowAt(0.10), fadeQ25: rowAt(0.25),
        vh: window.innerHeight, dpr: window.devicePixelRatio,
        scrollY: window.scrollY,
      };
    }''')
    print(json.dumps(diag, indent=1))

    seam = diag['fadeRect']['y'] + diag['scrollY']
    pg.evaluate(f'window.scrollTo(0, {int(seam - 500)})')
    pg.wait_for_timeout(1200)
    pg.screenshot(path=rf'{OUT}\_live_seam.png')
    print('live_seam ok')
    pg.evaluate('window.scrollTo(0, 0)')
    pg.wait_for_timeout(800)
    pg.screenshot(path=rf'{OUT}\_live_top.png')
    print('live_top ok')
    b.close()
