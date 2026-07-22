/**
 * Hero 注入 v13「单 pipeline + 原生滚动」(2026-06-27)
 *
 * 基于 river.ai 性能分析重写：
 *   ✅ 单 GPU pipeline（shader rAF，无第二个 rAF）
 *   ✅ 原生滚动（无 wheel/touch/keyboard hijack）
 *   ✅ 零 CSS 变量 transform（无 calc() 每帧重算）
 *   ✅ hero 绝对定位 100dvh + main margin-top 100dvh
 *   ✅ scrollY >= vh（hero 完全滚出视口）→ hero-released → hero display:none
 *   ✅ body 深蓝兜底，防止下滑过程中露出白色背景
 *   ✅ 滚回顶部 → hero 重新显示
 *
 * 保留：
 *   - hero shader（river-hero.js 自己的 rAF，40fps cap）
 *   - nav 透明背景 + 白字（hero 阶段）
 *   - nav 主题色（released 阶段）
 *   - widget 隐藏/显示切换
 *   - 左下角 typed 副标题（纯 CSS animation，无 setTimeout）
 */
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function (data) {
  if (!data || typeof data !== 'string') return data;

  if (data.indexOf('id="asciiRiver"') !== -1) return data;

  const canonicalMatch = data.match(/canonical["']?\s*href=["']([^"']+)["']/);
  if (!canonicalMatch) return data;
  const canonical = canonicalMatch[1];
  if (!/axtrivc\.github\.io\/(index\.html)?$/.test(canonical)) return data;

  if (data.indexOf('full_page') === -1) return data;
  if (data.indexOf('</header>') === -1 || data.indexOf('</body>') === -1) return data;

  const heroHtmlPath = path.join(hexo.source_dir, 'hero', 'index.html');
  if (!fs.existsSync(heroHtmlPath)) {
    hexo.log.warn('[hero-inject] source/hero/index.html not found');
    return data;
  }
  const heroSrc = fs.readFileSync(heroHtmlPath, 'utf8');

  const sectionMatch = heroSrc.match(/<section class="hero"[\s\S]*?<\/section>/);
  if (!sectionMatch) return data;
  const heroSection = sectionMatch[0]
    .replace('src="hero-static.jpg"', 'src="/hero/hero-static.jpg"');

  const styleMatch = heroSrc.match(/<style>([\s\S]*?)<\/style>/);
  let heroCss = styleMatch ? styleMatch[1] : '';

  heroCss = heroCss
    .replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/gm, '')
    .replace(/^\s*\*,\s*\*::before,\s\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ═══════════════════════════════════════════════════════════════
  // v13 CSS：零 CSS 变量、零 calc() transform、零 hijack
  // ═══════════════════════════════════════════════════════════════
  heroCss += `

/* ══ v13 单 pipeline + 原生滚动 ══
 * hero-shell: 绝对定位 100dvh, z-index 0 (背景层)
 * main: margin-top 100dvh, z-index 1 (前景层, 白底)
 * nav: fixed top, z-index 1200 (overlay)
 * 无 CSS 变量, 无 calc() transform, 无 hijack
 * ═════════════════════════════════════════════════════════════ */

/* hero-shell：绝对定位占 100dvh，在文档流中 */
.hero-shell {
  position: relative;
  top: auto;
  left: auto;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #0E2F7E;
  margin: 0;
  padding: 0;
  z-index: 0;
  pointer-events: none;
}
.hero-shell > section.hero {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #0E2F7E;
}
.hero-shell, .hero-shell * {
  font-family: -apple-system, BlinkMacSystemFont, "Inter Tight", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* canvas：独立 GPU 层 */
.hero-shell canvas.hero-ascii {
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* hero 内部文字：静态定位，无 transform 动画 */
.hero-text {
  position: absolute;
  bottom: clamp(20px, 4vw, 56px);
  left: clamp(20px, 4vw, 56px);
  right: clamp(20px, 4vw, 56px);
  z-index: 3;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.95);
}

/* ── main：紧跟 hero 下方，z-index 1 白底 ── */
body.hero-page-active main {
  position: relative;
  z-index: 1;
  margin-top: 0;
  background: #faf8f5;
}
body.hero-released .hero-shell {
  pointer-events: none !important;
}
body.hero-released main {
  margin-top: 0;
  background: #faf8f5;
}

/* ── 2026-06-30 修复：覆盖 butterfly 的 #web_bg 白底 ──
   真因：butterfly 主题注入 <div id="web_bg" style="background:#FFFFFF; position:fixed; z-index:-1">，
   它在 body 和内容之间，遮住 body 的深蓝色。任何 hero ↔ main 过渡缝隙、亚像素间隙都暴露 #FFFFFF。
   修复：hero 阶段把 #web_bg 改成深蓝，与 body 同色；离开 hero 阶段恢复白色（正常浏览）。 */
body.hero-page-active #web_bg {
  background-color: #0E2F7E !important;
}
body.hero-released #web_bg {
  background-color: #FFFFFF !important;
}

/* ── nav：hero 阶段透明 + 白字 ── */
body.hero-page-active #nav,
body.hero-page-active #page-header.full_page #nav {
  opacity: 1 !important;
  visibility: visible !important;
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 1200;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  padding: 0 20px;
  align-items: center;
  transform: translateZ(0);
}
body.hero-page-active #nav a,
body.hero-page-active #nav .site-name,
body.hero-page-active #nav a.site-page,
body.hero-page-active #nav .menus a,
body.hero-page-active #nav .menus_item a {
  color: rgba(255, 255, 255, 0.92) !important;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55), 0 0 12px rgba(80, 180, 130, 0.25);
  transition: color 0.2s ease;
}
body.hero-page-active #nav a:hover,
body.hero-page-active #nav .menus a:hover {
  color: var(--theme-accent-current, #07C160) !important;
  text-shadow: 0 0 14px color-mix(in srgb, var(--theme-accent-current, #07C160) 60%, transparent);
}

/* hero 阶段隐藏 page-header banner */
body.hero-page-active #page-header.full_page {
  position: relative;
  height: 0;
  overflow: hidden;
}
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down,
body.hero-page-active #site-info,
body.hero-page-active #scroll-down {
  display: none !important;
}
body.hero-released #page-header.full_page {
  height: auto;
  overflow: visible;
}
body.hero-released #site-info,
body.hero-released #scroll-down {
  display: block !important;
}

/* nav 内 logo */
body.hero-page-active #blog-info,
body.hero-page-active #nav #blog-info {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  flex-shrink: 0;
  margin-right: 20px;
  position: relative;
  left: 0;
}
body.hero-page-active #blog-info .site-name,
body.hero-page-active #blog-info a,
body.hero-page-active #nav .site-name {
  color: #ffffff !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
}
body.hero-page-active #menus {
  display: flex !important;
  align-items: center;
  background: transparent !important;
  height: 60px;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* ── hero 阶段隐藏 fixed widget ── */
body.hero-page-active:not(.hero-released) #music-bar,
body.hero-page-active:not(.hero-released) #music-panel,
body.hero-page-active:not(.hero-released) #rightside,
body.hero-page-active:not(.hero-released) #go-up,
body.hero-page-active:not(.hero-released) #rightside-config,
body.hero-page-active:not(.hero-released) #axtrivc-fab,
body.hero-page-active:not(.hero-released) .fab-publish,
body.hero-page-active:not(.hero-released) #announcement-bg,
body.hero-page-active:not(.hero-released) .announcement,
body.hero-page-active:not(.hero-released) .card-announcement,
body.hero-page-active:not(.hero-released) #dbgToggle,
body.hero-page-active:not(.hero-released) #debugBar {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* 释放后：恢复 widget */
body.hero-released #music-bar,
body.hero-released #music-panel.show,
body.hero-released #rightside,
body.hero-released #axtrivc-fab {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* 释放后：nav 恢复主题色 */
body.hero-released #nav,
body.hero-released #page-header.full_page #nav {
  background: var(--theme-nav-current, rgba(255, 255, 255, 0.94)) !important;
  background-image: none !important;
}
body.hero-released #nav a,
body.hero-released #nav .site-name,
body.hero-released #nav a.site-page {
  color: var(--theme-text-current, #1a1a1a) !important;
}

/* 卡片融底 */
body.hero-page-active #article-container,
body.hero-page-active .recent-post-item,
body.hero-page-active .card-widget,
body.hero-page-active .card-recent-post,
body.hero-page-active #recent-posts > .recent-post-item {
  border-color: transparent !important;
  box-shadow: none !important;
}
body.hero-page-active .recent-post-item {
  background: transparent !important;
}
body.hero-page-active .card-widget {
  background: transparent !important;
}
body.hero-page-active #recent-posts {
  background: transparent !important;
}

body.hero-page-active {
  background: #0E2F7E;
  overflow-x: hidden;
  overflow-y: auto;
}
body.hero-released {
  background: #faf8f5;
}

/* ── 左下角 typed 副标题（纯 CSS animation，无 setTimeout） ── */
.hero-typed-wrap {
  position: absolute;
  left: clamp(20px, 4vw, 56px);
  bottom: clamp(8px, 1.6vw, 22px);
  z-index: 5;
  color: rgba(255, 255, 255, 0.88);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif;
  font-size: 15px;
  font-weight: 300;
  letter-spacing: 0.04em;
  pointer-events: none;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 14px rgba(80, 180, 130, 0.22);
  max-width: 56ch;
}
.hero-typed-wrap .hero-typed-prefix {
  color: color-mix(in srgb, var(--theme-accent-current, #07C160) 85%, transparent);
  margin-right: 0.4em;
  font-weight: 400;
}
.hero-typed-wrap .hero-typed-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  margin-left: 2px;
  background: color-mix(in srgb, var(--theme-accent-current, #07C160) 95%, transparent);
  vertical-align: -0.15em;
  animation: heroTypedBlink 1.05s steps(2, start) infinite;
  box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent-current, #07C160) 55%, transparent);
}
@keyframes heroTypedBlink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
@media (max-width: 768px) {
  .hero-typed-wrap { left: 16px; bottom: 18px; font-size: 13px; max-width: 70vw; }
}
`;

  const heroStyleTag = `<style id="hero-inline-css">\n${heroCss}\n</style>`;
  let content = data.replace('</head>', heroStyleTag + '\n</head>');

  // ═══════════════════════════════════════════════════════════════
  // typed 副标题 HTML（打字逻辑在下方 heroJs, 分阶段 setTimeout 控速）
  // ═══════════════════════════════════════════════════════════════
  const typedHtml = `
<div class="hero-typed-wrap" id="hero-typed-wrap">
  <span class="hero-typed-prefix">// </span><span class="hero-typed-text" id="hero-typed-text"></span><span class="hero-typed-cursor"></span>
</div>
`;

  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n${typedHtml}\n</div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  // ═══════════════════════════════════════════════════════════════
  // v13 极简 JS：原生滚动 + scroll 监听切换 hero-released
  // 无 hijack, 无 RAF, 无 preventDefault
  // ═══════════════════════════════════════════════════════════════
  const heroJs = `
<script>
(function() {
  'use strict';
  var body = document.body;
  var vh = window.innerHeight;
  var released = false;

  // typed 副标题（分阶段 setTimeout: 打字 150ms/字, 停留 2.8s, 删除 70ms/字）
  // 文案池 90 条不重复, 每次访问洗牌随机播放, 一轮播完前不重复
  var lines = [
    '水满则溢,月盈则亏',
    '行到水穷处,坐看云起时',
    '欲穷千里目,更上一层楼',
    '人生若只如初见,何事秋风悲画扇',
    '山重水复疑无路,柳暗花明又一村',
    '海内存知己,天涯若比邻',
    '长风破浪会有时,直挂云帆济沧海',
    '会当凌绝顶,一览众山小',
    '天生我材必有用,千金散尽还复来',
    '仰天大笑出门去,我辈岂是蓬蒿人',
    '竹杖芒鞋轻胜马,一蓑烟雨任平生',
    '且将新火试新茶,诗酒趁年华',
    '人间有味是清欢',
    '一点浩然气,千里快哉风',
    '落霞与孤鹜齐飞,秋水共长天一色',
    '星垂平野阔,月涌大江流',
    '大漠孤烟直,长河落日圆',
    '春江潮水连海平,海上明月共潮生',
    '青山依旧在,几度夕阳红',
    '采菊东篱下,悠然见南山',
    '纸上得来终觉浅,绝知此事要躬行',
    '问渠那得清如许,为有源头活水来',
    '不畏浮云遮望眼,自缘身在最高层',
    '沉舟侧畔千帆过,病树前头万木春',
    '千淘万漉虽辛苦,吹尽狂沙始到金',
    '千磨万击还坚劲,任尔东西南北风',
    '不要人夸好颜色,只留清气满乾坤',
    '等闲识得东风面,万紫千红总是春',
    '沾衣欲湿杏花雨,吹面不寒杨柳风',
    '窗含西岭千秋雪,门泊东吴万里船',
    '劝君更尽一杯酒,西出阳关无故人',
    '桃花潭水深千尺,不及汪伦送我情',
    '孤帆远影碧空尽,唯见长江天际流',
    '明月松间照,清泉石上流',
    '人闲桂花落,夜静春山空',
    '夜来风雨声,花落知多少',
    '路漫漫其修远兮,吾将上下而求索',
    '莫愁前路无知己,天下谁人不识君',
    '读书不觉已春深,一寸光阴一寸金',
    '黑发不知勤学早,白首方悔读书迟',
    '少年易老学难成,一寸光阴不可轻',
    '梅须逊雪三分白,雪却输梅一段香',
    '小舟从此逝,江海寄余生',
    '此中有真意,欲辨已忘言',
    '古今多少事,都付笑谈中',
    '两个黄鹂鸣翠柳,一行白鹭上青天',
    '独在异乡为异客,每逢佳节倍思亲',
    '春眠不觉晓,处处闻啼鸟',
    '抽刀断水水更流,举杯消愁愁更愁',
    '三更灯火五更鸡,正是男儿读书时',
    '记录生活,分享思考',
    '生活不止眼前的代码,还有远方的诗和球场',
    '记录每一个灵光乍现的瞬间',
    '保持热爱,奔赴山海',
    '种一棵树最好的时间是十年前,其次是现在',
    '人生没有白走的路,每一步都算数',
    '愿你出走半生,归来仍是少年',
    '心之所向,素履以往',
    '生如逆旅,一苇以航',
    '凡是过往,皆为序章',
    '星光不问赶路人,时光不负有心人',
    '少年不惧岁月长,彼方尚有荣光在',
    '知足且坚定,温柔且上进',
    '把日子过成诗,把代码写成歌',
    '在代码与足球之间,找到生活的平衡',
    '凌晨的 bug 和清晨的球场,都是青春',
    '足球是圆的,一切皆有可能',
    '不到终场哨响,绝不轻言放弃',
    '每一个不曾起舞的日子,都是对生命的辜负',
    '慢慢来,比较快',
    '今天的 bug,是明天的经验',
    '先让它跑起来,再让它跑得好',
    '代码如诗,简洁即美',
    'Hola, mundo. 你好,世界',
    '¡Vamos! 加油!',
    'El fútbol es vida. 足球即生活',
    'Poco a poco, se va lejos. 慢慢来,走得远',
    '塞翁失马,焉知非福',
    '西语、代码、足球,三倍的快乐',
    '一天一行代码,一天一个单词',
    '把每一篇博客,都当作写给未来的信',
    '少年心事当拏云',
    '热爱可抵岁月漫长',
    '自律给我自由',
    '跑起来,就有风',
    '山高路远,看世界,也找自己',
    '风物长宜放眼量',
    '永远相信美好的事情即将发生'
  ];
  var el = document.getElementById('hero-typed-text');
  if (el) {
    // Fisher-Yates 洗牌: 每轮顺序随机且不重复
    for (var i = lines.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = lines[i]; lines[i] = lines[j]; lines[j] = tmp;
    }
    var li = 0, ci = 0;
    var TYPE_MS = 150, DELETE_MS = 70, HOLD_MS = 2800, GAP_MS = 600;
    function typeLine() {
      var line = lines[li % lines.length];
      if (ci <= line.length) {
        el.textContent = line.slice(0, ci);
        ci++;
        setTimeout(typeLine, TYPE_MS);
      } else {
        setTimeout(eraseLine, HOLD_MS);
      }
    }
    function eraseLine() {
      if (ci >= 0) {
        el.textContent = lines[li % lines.length].slice(0, ci);
        ci--;
        setTimeout(eraseLine, DELETE_MS);
      } else {
        li++;
        setTimeout(typeLine, GAP_MS);
      }
    }
    typeLine();
  }

  // scroll 监听：scrollY >= vh（hero 完全滚出视口）→ released
  // 修复：原 0.5vh 触发太早，hero display:none 后 main 还没到 viewport 顶部，
  // 中间露出 body 白色背景。改为 hero 完全滚出才释放，并用 body 深蓝兜底。
  function onScroll() {
    var sy = window.scrollY;
    if (!released && sy >= vh) {
      released = true;
      body.classList.add('hero-released');
      // 通知 hero shader 冻结
      window.dispatchEvent(new Event('hero-frozen'));
    } else if (released && sy < 50) {
      released = false;
      body.classList.remove('hero-released');
      // 通知 hero shader 恢复
      window.dispatchEvent(new Event('hero-unfrozen'));
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function() {
    vh = window.innerHeight;
  }, { passive: true });
})();
</script>
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=13"') : '';

  const afterScriptIdx = heroSrc.indexOf(heroScriptTag) + heroScriptTag.length;
  const inlineScriptMatch = heroSrc.slice(afterScriptIdx).match(/<script>[\s\S]*?<\/script>/);
  const heroInitScript = inlineScriptMatch ? inlineScriptMatch[0] : '';

  const heroScripts = heroScriptTag + '\n' + heroInitScript + heroJs;
  content = content.replace('</body>', heroScripts + '\n</body>');

  // mobile sidebar fix
  const sidebarFix = `
<script>
(function () {
  function bindMobileSidebar() {
    var toggleMenu = document.getElementById('toggle-menu');
    var sidebar = document.getElementById('sidebar-menus');
    var menuMask = document.getElementById('menu-mask');
    if (!toggleMenu || !sidebar) return;
    if (toggleMenu.dataset.heroFixed) return;
    toggleMenu.dataset.heroFixed = '1';
    toggleMenu.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.add('open');
      if (menuMask) {
        menuMask.style.cssText = 'display:block;animation:to_show 0.5s';
      }
      document.body.style.overflow = 'hidden';
    });
    if (menuMask) {
      menuMask.addEventListener('click', function () {
        sidebar.classList.remove('open');
        menuMask.style.cssText = 'animation:to_hide 0.5s';
        setTimeout(function () { menuMask.style.cssText = ''; }, 500);
        document.body.style.overflow = '';
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMobileSidebar);
  } else {
    bindMobileSidebar();
  }
  setTimeout(bindMobileSidebar, 500);
})();
</script>
`;
  content = content.replace('</body>', sidebarFix + '\n</body>');

  // 给 body 加 class hero-page-active
  content = content.replace(
    /<body([^>]*)>/,
    '<body$1 class="hero-page-active">'
  );

  hexo.log.info('[hero-inject] ✅ v13 单 pipeline + 原生滚动: ' + canonical);
  return content;
});
