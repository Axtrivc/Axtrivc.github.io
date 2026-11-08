# 临时工具: 复现用户白天亮场景下的 hero-fade 分割线
# 场景 90s 循环一整天: 等待 ~35s 进入白天, 再测 hero 底边 vs 渐变带顶
from playwright.sync_api import sync_playwright
import json

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'http://127.0.0.1:4000/'

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1830, 'height': 930})
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_selector('#asciiRiver', timeout=30000)

    for wait_s, tag in [(8, 't08'), (35, 't35'), (60, 't60')]:
        pg.wait_for_timeout(wait_s * 1000 if tag == 't08' else (27 if tag == 't35' else 25) * 1000)
        info = pg.evaluate('''() => {
          const c = document.getElementById('asciiRiver');
          const fcv = document.getElementById('heroFadeAscii');
          // hero canvas 底边行(经 2D 读出, 与 fade 取样同路径)
          const p = document.createElement('canvas');
          p.width = 64; p.height = 1;
          const pc = p.getContext('2d', { willReadFrequently: true });
          function bottomRow(src, w, h) {
            pc.clearRect(0, 0, 64, 1);
            pc.drawImage(src, 0, h - 2, w, 2, 0, 0, 64, 1);
            const d = pc.getImageData(0, 0, 64, 1).data;
            let r = 0, g = 0, b = 0, a = 0;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; a += d[i+3]; }
            return [Math.round(r/64), Math.round(g/64), Math.round(b/64), Math.round(a/64)];
          }
          const heroRow = bottomRow(c, c.width, c.height);
          const fadeRow = bottomRow(fcv, fcv.width, fcv.height);
          // fade 带顶 1/4 处均值
          const q = document.createElement('canvas');
          q.width = 64; q.height = 1;
          const qc = q.getContext('2d', { willReadFrequently: true });
          qc.drawImage(fcv, 0, Math.floor(fcv.height * 0.25), fcv.width, 1, 0, 0, 64, 1);
          const qd = qc.getImageData(0, 0, 64, 1).data;
          let qr = 0, qg = 0, qb = 0;
          for (let i = 0; i < qd.length; i += 4) { qr += qd[i]; qg += qd[i+1]; qb += qd[i+2]; }
          return {
            heroBottom: heroRow, fadeTop: fadeRow,
            fadeQuarter: [Math.round(qr/64), Math.round(qg/64), Math.round(qb/64)],
            canvasOpacity: getComputedStyle(c).opacity,
            stillShown: document.getElementById('heroStill').classList.contains('is-shown'),
          };
        }''')
        print(tag, json.dumps(info))
        pg.screenshot(path=rf'{OUT}\_day_{tag}.png')
    b.close()
