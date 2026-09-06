# 临时冒烟: river-hero.js 重构后启动管线验证 (console 错误 / 预热图撤岗 / 画面动态)
from playwright.sync_api import sync_playwright
import hashlib

URL = 'http://127.0.0.1:4000/'
errors, pageerrors = [], []

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pageerrors.append(str(e)))
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    pg.wait_for_selector('#asciiRiver', timeout=30000)

    # 轮询: 等预热 still 撤岗(is-shown 移除 = live loop 真起来了) — SwiftShader 编译巨 shader 需 ~35s+
    import time
    t0 = time.time()
    timeline, live, still_shown, frozen = [], None, None, None
    while time.time() - t0 < 150:
        state = pg.evaluate('''() => ({
            live: window.__riverLive === true,
            shown: document.getElementById('heroStill')?.classList.contains('is-shown') ?? null,
            cycleDone: document.body.classList.contains('hero-cycle-done'),
        })''')
        cur = (state['live'], state['shown'], state['cycleDone'])
        if not timeline or timeline[-1][1] != cur:
            timeline.append((round(time.time() - t0, 1), cur))
        live, still_shown, frozen = state['live'], state['shown'], state['cycleDone']
        # 撤岗后再观察一小段供截图
        if live and still_shown is False and time.time() - t0 > 8 and len(timeline) >= 2:
            if any(t[1][2] for t in timeline) or time.time() - t0 > 40:
                break
        time.sleep(0.5)

    print('timeline(live, stillShown, cycleDone):', timeline)
    print('__riverLive =', live, '| still shown =', still_shown, '| cycleDone =', frozen)

    a = pg.screenshot(path='scripts-py/_smoke_a.png')
    pg.wait_for_timeout(1200)
    b.write = pg.screenshot(path='scripts-py/_smoke_b.png')

    ha = hashlib.md5(open('scripts-py/_smoke_a.png','rb').read()).hexdigest()
    hb = hashlib.md5(open('scripts-py/_smoke_b.png','rb').read()).hexdigest()
    print('frames differ (动画在跑):', ha != hb)
    print('console errors:', [e for e in errors if 'favicon' not in e][:10] or 'NONE')
    print('pageerrors:', pageerrors[:10] or 'NONE')
    b.close()
