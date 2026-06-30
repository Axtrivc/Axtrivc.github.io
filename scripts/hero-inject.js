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
  visibility: hidden !important;
  pointer-events: none !important;
}
body.hero-released main {
  margin-top: 0;
  background: #faf8f5;
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
  // typed 副标题 HTML（保留，但 JS 用 setInterval 而非递归 setTimeout）
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

  // typed 副标题（setInterval 而非递归 setTimeout，更稳）
  var lines = [
    '水满则溢,月盈则亏',
    '抽刀断水,举杯消愁',
    '人生若只如初见',
    '生活不止眼前的代码',
    '还有远方的诗和球场',
    '记录每一个灵光乍现的瞬间',
    '欲穷千里目,更上一层楼',
    '行到水穷处,坐看云起时'
  ];
  var el = document.getElementById('hero-typed-text');
  if (el) {
    var li = 0, ci = 0, del = false;
    setInterval(function() {
      if (!el) return;
      var line = lines[li % lines.length];
      if (!del) {
        ci++;
        el.textContent = line.slice(0, ci);
        if (ci >= line.length) { del = true; }
      } else {
        ci--;
        el.textContent = line.slice(0, ci);
        if (ci <= 0) { del = false; li++; }
      }
    }, 95);
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
