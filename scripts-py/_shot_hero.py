# 临时工具: 截首页 hero 与 hero-fade 衔接区 (桌面/移动/米色主题)
from playwright.sync_api import sync_playwright

OUT = r'D:\WorkBuddy-Outputs\Football-Daily'
URL = 'http://127.0.0.1:4567/'
with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')

    def shoot(pg, tag, scroll_frac=0.55):
        pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
        pg.wait_for_selector('#asciiRiver', timeout=30000)
        pg.wait_for_timeout(6000)
        vh = pg.evaluate('window.innerHeight')
        pg.evaluate(f'window.scrollTo(0, {int(vh * scroll_frac)})')
        pg.wait_for_timeout(1500)
        pg.screenshot(path=rf'{OUT}\_hero_{tag}.png')
        print(tag, 'ok')

    pg = b.new_page(viewport={'width': 1600, 'height': 900})
    shoot(pg, 'seam')
    pg.close()

    pg = b.new_page(viewport={'width': 390, 'height': 844})
    shoot(pg, 'mob')
    pg.close()

    ctx = b.new_context(viewport={'width': 1600, 'height': 900})
    pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('axtrivc_theme_v2', 'beige-lite')")
    shoot(pg, 'beige')
    pg.close()

    b.close()
