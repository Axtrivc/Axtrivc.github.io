# 临时工具: 截 public/ 已构建的日报页 (带 Butterfly 主题), 桌面+移动双宽度
# 用法: PYTHONUTF8=1 python scripts-py/_shot_public.py [morning|evening] [YYYY-MM-DD]
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
date = next((a for a in args if '-' in a), None) or datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
editions = [a for a in args if a in ('morning', 'evening')] or ['morning']
BLOG = Path(__file__).parent.parent.resolve()
OUT = r'D:\WorkBuddy-Outputs\Football-Daily'
y, m, d = date.split('-')

for ed in editions:
    p = BLOG / 'public' / y / m / d / f'football-{ed}-{date}' / 'index.html'
    if not p.exists():
        print(ed, 'missing:', p)
        continue
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel='msedge')
        url = f'http://127.0.0.1:4000/{y}/{m}/{d}/football-{ed}-{date}/'
        for tag, w in (('pc', 800), ('mob', 390)):
            pg = b.new_page(viewport={'width': w, 'height': 1000})
            pg.goto(url, wait_until='domcontentloaded')
            pg.wait_for_timeout(2500)
            pg.evaluate("""(async () => {
                for (let y = 0; y <= document.body.scrollHeight; y += 800) {
                    window.scrollTo(0, y);
                    await new Promise(r => setTimeout(r, 1200));
                }
                window.scrollTo(0, 0);
            })()""")
            pg.wait_for_timeout(4000)
            pg.screenshot(path=rf'{OUT}\_pub_{ed}_{tag}.png', full_page=True)
            pg.close()
            print(ed, tag, 'ok')
        b.close()
