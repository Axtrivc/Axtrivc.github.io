# 临时工具: 第五轮(TOC激活主题化/归档入场/theme glide/图片淡入/页脚)目检
# 用法: PYTHONUTF8=1 python scripts-py/_shot_ui5.py   前置: node serve.js 已起 4000
import io
import sys
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BLOG = Path(__file__).parent.parent.resolve()
OUT = BLOG / '.tmp-ui5'
OUT.mkdir(exist_ok=True)

def log(*a):
    print(*a, flush=True)

ARTICLE = '/2026/08/27/github-daily-2026-08-27/'

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append('PC: ' + str(e)))

    # ── 1) 归档页: 时间轴条目入场 ──
    pg.goto('http://127.0.0.1:4000/archives/', wait_until='load')
    pg.wait_for_timeout(1800)
    arc = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('.article-sort-item')];
        return {total: items.length,
                revealed: items.filter(e => !e.classList.contains('ui-reveal')).length,
                opacities: items.slice(0,4).map(e => getComputedStyle(e).opacity)};
    }""")
    log('1) archives:', arc)
    pg.screenshot(path=str(OUT / '01-archives.png'))

    # ── 2) 文章页: TOC 激活态主题色 + 图片淡入 ──
    pg.goto('http://127.0.0.1:4000' + ARTICLE, wait_until='load')
    pg.wait_for_timeout(1500)
    pg.evaluate('window.scrollTo({top: 900, behavior: "instant"})')
    pg.wait_for_timeout(900)
    toc = pg.evaluate("""() => {
        const act = document.querySelector('#card-toc .toc-link.active');
        if (!act) return {active: false};
        const cs = getComputedStyle(act);
        return {active: true, bg: cs.backgroundColor, color: cs.color,
                borderLeft: cs.borderLeftColor, text: act.textContent.trim().slice(0, 20)};
    }""")
    log('2) toc active:', toc)
    imgs = pg.evaluate("""() => {
        const list = [...document.querySelectorAll('#article-container img[data-lazy-src]')];
        return {total: list.length,
                wait: list.filter(i => i.classList.contains('ui-img-wait')).length,
                done: list.filter(i => i.classList.contains('ui-img-done')).length,
                unmarked: list.filter(i => !i.classList.contains('ui-img-wait') && !i.classList.contains('ui-img-done')).length};
    }""")
    log('3) article imgs:', imgs)
    pg.screenshot(path=str(OUT / '02-article-toc.png'))

    # ── 3) 主题切换: glide 类挂载 + 深色主题观感 ──
    pg.goto('http://127.0.0.1:4000/', wait_until='load')
    pg.wait_for_timeout(2000)
    # 直接调用主题系统的切换 API(若有),否则模拟点击主题面板
    glide = pg.evaluate("""() => {
        return new Promise(res => {
            let saw = false;
            const obs = new MutationObserver(() => {
                if (document.documentElement.classList.contains('theme-gliding')) saw = true;
            });
            obs.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
            window.dispatchEvent(new CustomEvent('themechange', {detail: {id: 'x', theme: {}}}));
            setTimeout(() => { obs.disconnect(); res({saw, cls: document.documentElement.className}); }, 800);
        });
    }""")
    log('4) theme-gliding hook:', glide)
    # 真实切一个深色主题截图
    pg.evaluate("""() => {
        const t = document.querySelector('#nav-theme-trigger') || document.querySelector('[id*=theme]');
        if (t) t.click();
    }""")
    pg.wait_for_timeout(700)
    panel = pg.evaluate("""() => {
        const items = [...document.querySelectorAll('.theme-panel [data-theme], .theme-select [data-theme], [data-theme-id]')];
        return items.slice(0, 8).map(e => e.dataset.theme || e.dataset.themeId);
    }""")
    log('5) theme panel items:', panel)
    if panel:
        pg.evaluate("""() => {
            const items = [...document.querySelectorAll('.theme-panel [data-theme], .theme-select [data-theme], [data-theme-id]')];
            const dark = items.find(e => /night|dark|晚|夜|暮/i.test((e.dataset.theme||'') + (e.dataset.themeId||'') + e.textContent)) || items[items.length-1];
            dark.click();
        }""")
        pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / '03-theme-dark.png'))
    log('6) theme switched, html cls:', pg.evaluate('document.documentElement.className'))

    # ── 4) 页脚入场 + 链接下划线 ──
    pg.evaluate('window.scrollTo({top: document.body.scrollHeight, behavior: "instant"})')
    pg.wait_for_timeout(1400)
    foot = pg.evaluate("""() => {
        const f = document.querySelector('#footer .footer-other');
        return f ? {revealed: !f.classList.contains('ui-reveal'), opacity: getComputedStyle(f).opacity} : null;
    }""")
    log('7) footer reveal:', foot)
    pg.screenshot(path=str(OUT / '04-footer.png'))

    # ── 5) 标签页/分类页入场冒烟 ──
    pg.goto('http://127.0.0.1:4000/tags/', wait_until='load')
    pg.wait_for_timeout(1200)
    tag = pg.evaluate("""() => {
        const tc = document.querySelector('.tag-cloud');
        return tc ? {revealed: !tc.classList.contains('ui-reveal')} : {missing: true};
    }""")
    log('8) tags page tag-cloud:', tag)

    b.close()
    log('JS errors:', errs if errs else 'none')

log('done ->', OUT)
