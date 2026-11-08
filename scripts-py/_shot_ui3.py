# 临时工具: 第三轮动效(ui-polish v3 + hero v13.1)运行时目检
# 用法: PYTHONUTF8=1 python scripts-py/_shot_ui3.py
# 前置: node serve.js 已起 4000 端口
import io
import sys
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BLOG = Path(__file__).parent.parent.resolve()
OUT = BLOG / '.tmp-ui3'
OUT.mkdir(exist_ok=True)

def log(*a):
    print(*a, flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.goto('http://127.0.0.1:4000/', wait_until='load')
    pg.wait_for_timeout(3500)

    # 1) hero 顶部: 提示光线存在且可见
    hint = pg.evaluate("""() => {
        const el = document.querySelector('.hero-scroll-hint');
        if (!el) return {exists: false};
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {exists: true, display: cs.display, opacity: cs.opacity,
                bottom: Math.round(r.bottom), h: Math.round(r.height),
                centered: Math.abs((r.left + r.width/2) - innerWidth/2) < 2};
    }""")
    log('1) scroll-hint:', hint)
    pg.screenshot(path=str(OUT / '01-hero-top.png'))

    # 2) 滚动 300px: typed 文案渐隐 + hero-leaving 类
    pg.evaluate('window.scrollTo({top: 300, behavior: "instant"})')
    pg.wait_for_timeout(750)
    leaving = pg.evaluate("""() => {
        const tw = document.querySelector('.hero-typed-wrap');
        return {cls: document.body.className.includes('hero-leaving'),
                typedOpacity: tw ? getComputedStyle(tw).opacity : null};
    }""")
    log('2) leaving@300px:', leaving)

    # 3) 回顶: 恢复
    pg.evaluate('window.scrollTo({top: 0, behavior: "instant"})')
    pg.wait_for_timeout(750)
    back = pg.evaluate("""() => {
        const tw = document.querySelector('.hero-typed-wrap');
        return {cls: document.body.className.includes('hero-leaving'),
                typedOpacity: tw ? getComputedStyle(tw).opacity : null};
    }""")
    log('3) back-to-top:', back)

    # 4) 快速滚到卡片区,抓入场中间帧 + 终态
    pg.evaluate('window.scrollTo({top: window.innerHeight + 200, behavior: "instant"})')
    pg.wait_for_timeout(280)
    pg.screenshot(path=str(OUT / '02-cards-mid-entrance.png'))
    pg.wait_for_timeout(1400)
    cards = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('#recent-posts.masonry .recent-post-item')];
        const widgets = [...document.querySelectorAll('#aside-content .card-widget')];
        const vis = el => getComputedStyle(el).opacity;
        return {cards: items.length, cardPending: items.filter(e => e.classList.contains('ui-reveal')).length,
                cardOpacity: items.slice(0,3).map(vis), widgetPending: widgets.filter(e => e.classList.contains('ui-reveal')).length,
                widgetOpacity: widgets.slice(0,2).map(vis)};
    }""")
    log('4) cards after settle:', cards)
    pg.screenshot(path=str(OUT / '03-cards-settled.png'))

    # 5) 释放态: hero-released + nav 背景 + rightside
    pg.evaluate('window.scrollTo({top: window.innerHeight * 2.2, behavior: "instant"})')
    pg.wait_for_timeout(900)
    released = pg.evaluate("""() => {
        const nav = document.getElementById('nav');
        const rs = document.getElementById('rightside');
        return {released: document.body.className.includes('hero-released'),
                navBg: nav ? getComputedStyle(nav).backgroundColor : null,
                rsOpacity: rs ? getComputedStyle(rs).opacity : null};
    }""")
    log('5) released:', released)
    pg.screenshot(path=str(OUT / '04-released.png'))

    # 6) /page/2/ 无 hero 页: 入场即在首屏,应直接显现且摘除类
    pg.goto('http://127.0.0.1:4000/page/2/', wait_until='load')
    pg.wait_for_timeout(1600)
    p2 = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('#recent-posts.masonry .recent-post-item')];
        return {cards: items.length, pending: items.filter(e => e.classList.contains('ui-reveal')).length,
                opacities: items.slice(0,3).map(e => getComputedStyle(e).opacity)};
    }""")
    log('6) /page/2/:', p2)

    # 7) 移动端 hero
    m = b.new_page(viewport={'width': 390, 'height': 844})
    m.goto('http://127.0.0.1:4000/', wait_until='load')
    m.wait_for_timeout(3000)
    mh = m.evaluate("""() => {
        const el = document.querySelector('.hero-scroll-hint');
        return el ? {display: getComputedStyle(el).display, h: Math.round(el.getBoundingClientRect().height)} : {display: 'missing'};
    }""")
    log('7) mobile hint:', mh)
    m.screenshot(path=str(OUT / '05-mobile-hero.png'))

    # 8) 控制台错误收集
    b.close()

log('done ->', OUT)
