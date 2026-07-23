# 临时工具: 把 preview md 包成 HTML 并用 playwright + 系统 Edge 截图目检
# 用法: PYTHONUTF8=1 python scripts-py/_shot_preview.py [morning|evening] [YYYY-MM-DD]
import re
import sys
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright

editions = sys.argv[1:2] or ['morning', 'evening']
date = sys.argv[2] if len(sys.argv) > 2 else datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d')
OUT = r'D:\WorkBuddy-Outputs\Football-Daily'

for ed in editions:
    p = rf'{OUT}\football-{ed}-preview-{date}.md'
    t = open(p, encoding='utf-8').read()
    body = re.sub(r'^---.*?---\s*', '', t, flags=re.S)
    html = ('<!DOCTYPE html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '</head><body style="margin:0;background:#dfe3e8;padding:24px 0">'
            + body + '</body></html>')
    out = rf'{OUT}\_preview_{ed}.html'
    open(out, 'w', encoding='utf-8').write(html)
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel='msedge')
        pg = b.new_page(viewport={'width': 800, 'height': 1000})
        pg.goto('file:///' + out.replace('\\', '/'))
        # 滚动整页触发 lazy 图片加载, 再回顶部截图
        pg.evaluate("""(async () => {
            for (let y = 0; y <= document.body.scrollHeight; y += 600) {
                window.scrollTo(0, y);
                await new Promise(r => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
        })()""")
        pg.wait_for_timeout(4000)
        pg.screenshot(path=rf'{OUT}\_shot_{ed}.png', full_page=True)
        b.close()
    print(ed, 'ok ->', rf'{OUT}\_shot_{ed}.png')
