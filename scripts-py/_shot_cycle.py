# 临时工具: 90s 全周期巡检, 找亮场景帧并核对 fade 带顶颜色
from playwright.sync_api import sync_playwright

OUT = r'C:\Users\leecl\blog\.workbuddy'
URL = 'http://127.0.0.1:4000/'

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1830, 'height': 930})
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_selector('#asciiRiver', timeout=30000)

    probe = '''() => {
      const fcv = document.getElementById('heroFadeAscii');
      const q = document.createElement('canvas');
      q.width = 64; q.height = 1;
      const qc = q.getContext('2d', { willReadFrequently: true });
      function rowAt(frac) {
        qc.clearRect(0, 0, 64, 1);
        qc.drawImage(fcv, 0, Math.floor(fcv.height * frac), fcv.width, 1, 0, 0, 64, 1);
        const d = qc.getImageData(0, 0, 64, 1).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
        return [Math.round(r/64), Math.round(g/64), Math.round(b/64)];
      }
      return { top: rowAt(0.01), q25: rowAt(0.25), mid: rowAt(0.5) };
    }'''

    for i in range(23):
        info = pg.evaluate(probe)
        print(f't={i*4:02d}s fade top={info["top"]} q25={info["q25"]} mid={info["mid"]}', flush=True)
        pg.screenshot(path=rf'{OUT}\_cyc_{i:02d}.png')
        pg.wait_for_timeout(4000)
    b.close()
