# 临时工具: 第四轮(hero 指针视差 / View Transitions / 文章页头视差 / 目录徽标脉冲)目检
# 用法: PYTHONUTF8=1 python scripts-py/_shot_ui4.py   前置: node serve.js 已起 4000
import io
import sys
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat

BLOG = Path(__file__).parent.parent.resolve()
OUT = BLOG / '.tmp-ui4'
OUT.mkdir(exist_ok=True)

def log(*a):
    print(*a, flush=True)

def river_centroid(png_path, band=(600, 780)):
    """河流亮带的水平亮度质心(归一化 0..1)。视差拉扯会让它左右移动。"""
    im = Image.open(png_path).convert('L')
    w, h = im.size
    crop = im.crop((0, band[0], w, band[1]))
    px = crop.load()
    cw, ch = crop.size
    total = 0.0
    moment = 0.0
    for y in range(ch):
        for x in range(cw):
            v = px[x, y]
            if v > 110:        # 只数亮部(河面 ASCII 点阵)
                total += v
                moment += v * x
    return (moment / total / cw) if total else None

with sync_playwright() as pw:
    b = pw.chromium.launch(channel='msedge')
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append('PC: ' + str(e)))
    pg.on('console', lambda m: errs.append('PC-console: ' + m.text) if m.type == 'error' else None)

    # ── 1) hero 加载 + 视差 ──
    pg.goto('http://127.0.0.1:4000/', wait_until='load')
    pg.wait_for_timeout(3800)   # 等 intro 完毕、循环稳定
    live = pg.evaluate('window.__riverLive === true')
    log('1) river live:', live)

    # 基线: 鼠标停在天际线上方(mOn=0, 视差不生效)
    pg.mouse.move(720, 100)
    pg.wait_for_timeout(1600)
    pg.screenshot(path=str(OUT / 'p0-baseline.png'))
    # 鼠标拉到左下河床
    pg.mouse.move(380, 700, steps=12)
    pg.wait_for_timeout(1800)
    pg.screenshot(path=str(OUT / 'p1-left.png'))
    # 鼠标拉到右下河床
    pg.mouse.move(1060, 700, steps=20)
    pg.wait_for_timeout(1800)
    pg.screenshot(path=str(OUT / 'p2-right.png'))

    c0 = river_centroid(OUT / 'p0-baseline.png')
    c1 = river_centroid(OUT / 'p1-left.png')
    c2 = river_centroid(OUT / 'p2-right.png')
    log('2) river centroid x (base/left/right):',
        None if c0 is None else round(c0, 4),
        None if c1 is None else round(c1, 4),
        None if c2 is None else round(c2, 4),
        '| left<right?', (c1 is not None and c2 is not None and c1 < c2),
        '| spread px@1440:', None if (c1 is None or c2 is None) else round((c2 - c1) * 1440))

    # 视差淡出: 鼠标离开窗口(blur 等价——用 evaluate 移出视口不可行, 直接等淡出)
    # 滚动到 0.6vh(超过 0.5vh 门),amt 应淡出 → 质心回到基线附近
    pg.evaluate('window.scrollTo({top: 560, behavior: "instant"})')
    pg.wait_for_timeout(1800)
    pg.screenshot(path=str(OUT / 'p3-scrolled.png'))
    c3 = river_centroid(OUT / 'p3-scrolled.png')
    log('3) centroid after scroll-out:', None if c3 is None else round(c3, 4))

    # 回顶, 视差应恢复(鼠标仍在窗口内右下)
    pg.evaluate('window.scrollTo({top: 0, behavior: "instant"})')
    pg.wait_for_timeout(1800)
    pg.screenshot(path=str(OUT / 'p4-back.png'))
    c4 = river_centroid(OUT / 'p4-back.png')
    log('4) centroid back-to-top (mouse still right):', None if c4 is None else round(c4, 4),
        '| near right?', (c4 is not None and c2 is not None and abs(c4 - c2) < 0.02))

    # 尾部溶解回归: 滚到接缝区截图
    pg.evaluate('window.scrollTo({top: window.innerHeight - 120, behavior: "instant"})')
    pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / 'p5-seam.png'))

    # ── 2) View Transitions ──
    pg.evaluate('window.scrollTo({top: 0, behavior: "instant"})')
    pg.wait_for_timeout(400)
    names = pg.evaluate("""[...document.querySelectorAll('#recent-posts .article-title')]
        .slice(0,3).map(a => a.style.viewTransitionName)""")
    log('5) card title VT names:', names)
    # 点击第一张卡标题, 抓过渡中段 + 落点校验
    first_href = pg.evaluate("document.querySelector('#recent-posts .article-title').href")
    pg.click('#recent-posts .article-title')
    try:
        pg.wait_for_url(first_href, timeout=8000)
    except Exception as e:
        log('   nav wait warn:', e)
    pg.wait_for_timeout(260)   # 过渡 0.32s, 抓个尾巴
    pg.screenshot(path=str(OUT / 'v1-mid-transition.png'))
    pg.wait_for_timeout(900)
    art = pg.evaluate("""() => ({
        url: location.pathname,
        h1name: (document.querySelector('#post-info .post-title')||{}).style?.viewTransitionName || null})""")
    log('6) article landed:', art)
    pg.screenshot(path=str(OUT / 'v2-article.png'))

    # ── 3) 文章页头视差 ──
    para0 = pg.evaluate("""() => { const i = document.getElementById('post-info');
        return i ? {t: i.style.transform, o: i.style.opacity} : null; }""")
    pg.evaluate('window.scrollTo({top: 120, behavior: "instant"})')
    pg.wait_for_timeout(500)
    para1 = pg.evaluate("""() => { const i = document.getElementById('post-info');
        return i ? {t: i.style.transform, o: i.style.opacity} : null; }""")
    log('7) post-info parallax @0 / @120:', para0, para1)

    # ── 4) 目录徽标脉冲(滚动采样 toc-pulse) ──
    pulses = 0
    for y in (300, 700, 1200, 1800, 2400):
        pg.evaluate(f'window.scrollTo({{top: {y}, behavior: "instant"}})')
        pg.wait_for_timeout(350)
        hit = pg.evaluate("""() => { const b = document.querySelector('#card-toc .toc-percentage');
            return b ? b.classList.contains('toc-pulse') : null; }""")
        if hit:
            pulses += 1
    badge_state = pg.evaluate("""() => { const b = document.querySelector('#card-toc .toc-percentage');
        return b ? {text: b.textContent, exists: true} : {exists: false}; }""")
    log('8) toc badge:', badge_state, '| pulses caught in 5 samples:', pulses)

    # 返回首页(bfcache/过渡不报错)
    pg.go_back()
    pg.wait_for_timeout(1200)
    log('9) back to home:', pg.evaluate('location.pathname'), '| river live:', pg.evaluate('window.__riverLive === true'))

    # ── 5) 移动端冒烟 ──
    m = b.new_page(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    merrs = []
    m.on('pageerror', lambda e: merrs.append('MOB: ' + str(e)))
    m.goto('http://127.0.0.1:4000/', wait_until='load')
    m.wait_for_timeout(2500)
    log('10) mobile errors:', merrs if merrs else 'none')
    m.screenshot(path=str(OUT / 'm1-mobile.png'))

    b.close()
    log('JS errors:', errs if errs else 'none')

log('done ->', OUT)
