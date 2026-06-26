/**
 * Hero 注入 v12「阻力 → 临界爆发 → 直滑到主页」(2026-06-23)
 *
 * 用户新需求（基于截图）：
 *   1. Hero 阶段：顶部 nav（金棕色）+ 全屏 river.ai 动画，其他 widget 全部隐藏
 *   2. 转场：向下滚动先有阻力（push-back 感），到达临界点后突然放手「直滑到底」
 *   3. Main 阶段：原版博客主页（所有 widget 恢复：nav、music-bar、aside、FAB）
 *
 * 关键改动 vs v11：
 *   - 不再用原生 scrollY 驱动，而是 hijack wheel/touch/keyboard，自己算 progress
 *   - 阻力段 (target < 0.45)：spring damping ×0.08，target 累积很慢（像在推重物）
 *   - 临界段 (target >= 0.45)：releaseArmed=true，target 强制 1
 *   - 释放段：progress 直接跟 target 同步（×0.32），无 inertia → 直冲到底
 *   - progress >= 0.998 后退出 hijack，scrollTo 到 hero 高度，浏览器接管原生滚动
 *
 * 通信变量（CSS 只引用，不再算数学）：
 *   --hero-raw       0..1 线性（用户滚轮目标 progress）
 *   --hero-fly       0..1 视觉进度（已含 ease-out）
 *   --hero-pin       0..1 蓄力强度（峰值在 raw=0.45）
 *   --hero-released  0/1  是否已释放
 */
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function (data) {
  if (!data || typeof data !== 'string') return data;

  if (data.indexOf('id="asciiRiver"') !== -1) return data;

  // 只在主页注入
  const canonicalMatch = data.match(/canonical["']?\s*href=["']([^"']+)["']/);
  if (!canonicalMatch) return data;
  const canonical = canonicalMatch[1];
  if (!/axtrivc\.github\.io\/(index\.html)?$/.test(canonical)) {
    return data;
  }

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

  heroCss += `
/* ═════════════════════════════════════════════════════════════
 * v12 「阻力 → 临界爆发 → 直滑到主页」
 *
 * Hero stage:
 *   - nav 固定顶部（金棕色），始终可见
 *   - hero-shell 全屏（z-index 1000，在 nav 1200 之下）
 *   - 其他 fixed widget 隐藏（music-bar、rightside、FAB、countdown）
 *
 * 转场数学：
 *   raw ∈ [0, 0.45]  阻力段（damping 0.08）→ hero 几乎不动
 *   raw ∈ [0.45, 1]  释放段（damping 0.32）→ hero 急速飞出
 *   fly = easeOutExpo(raw) → 让释放曲线更"急"
 *
 * 性能铁律（v3→v12 经验）：
 *   ❌ 不用 CSS filter（blur/brightness/saturate）
 *   ❌ 不用 SVG filter / mix-blend-mode
 *   ❌ 不加 will-change: transform（触发 canvas 降采样）
 *   ✅ 只用 transform: translate3d + scale + opacity
 *   ✅ canvas 单独加 translateZ(0) 锁独立 GPU 层
 *   ✅ 0 transition → hijack 时 100% 跟手
 * ═════════════════════════════════════════════════════════════ */

:root {
  --hero-raw: 0;
  --hero-fly: 0;
  --hero-pin: 0;
}

/* ── hero-shell：满屏 fixed（z-index 1000） ── */
.hero-shell {
  position: fixed;
  inset: 0 0 0 0;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #0E2F7E;
  margin: 0;
  padding: 0;
  z-index: 1000;
  --raw: var(--hero-raw, 0);
  --fly: var(--hero-fly, 0);
  --pin: var(--hero-pin, 0);

  /* 阻力段：蓄力向下鼓胀（+0.5vh）、暗化微弱
   * 释放段：急速向上飞出 -130vh、暗化变深 */
  transform: translate3d(0, calc(var(--pin) * 0.5vh - var(--fly) * 130vh), 0);
  opacity: calc(1 - max(0, var(--fly) - 0.55) * 2.2);
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

/* canvas：独立 GPU 层避免降采样 */
.hero-shell canvas.hero-ascii {
  transform: translate3d(0, calc(var(--pin, 0) * 1.5vh), 0) translateZ(0);
  -webkit-transform: translate3d(0, calc(var(--pin, 0) * 1.5vh), 0) translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* 阻力段的 vignette 暗化（伪元素，0 filter 性能安全） */
.hero-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.55) 100%
  );
  opacity: calc(var(--pin, 0) * 1.1);
  z-index: 4;
}

/* hero 内部文字：阻力段跟着被压（暗化+微弱下压），释放段急速飞散 */
.hero-text-headline,
.hero-text-sub {
  --fly: var(--hero-fly, 0);
  --pin: var(--hero-pin, 0);
  transform: translate3d(
    calc(var(--fly) * -8vh),
    calc(var(--pin) * -1vh - var(--fly) * 65vh),
    0
  );
  opacity: calc(0.96 - var(--fly) * 1.05);
}
.hero-cta,
.hero-text-label {
  --fly: var(--hero-fly, 0);
  --pin: var(--hero-pin, 0);
  transform: translate3d(
    calc(var(--fly) * 8vh),
    calc(var(--pin) * -1vh - var(--fly) * 65vh),
    0
  );
  opacity: calc(0.96 - var(--fly) * 1.05);
}
.hero-text-quote {
  --fly: var(--hero-fly, 0);
  --pin: var(--hero-pin, 0);
  transform: translate3d(0, calc(var(--pin) * -1vh - var(--fly) * 70vh), 0);
  opacity: calc(0.96 - var(--fly) * 1.05);
}

/* ── 博客主页：紧跟 hero 后面（z-index 1100） ── */
body.hero-page-active #content-inner,
body.hero-page-active .layout,
body.hero-page-active main {
  position: relative;
  z-index: 1100;
  margin-top: 100dvh;
  background: #faf8f5;
  transform: translate3d(0, calc((1 - var(--hero-fly, 0)) * 50vh), 0);
  opacity: clamp(var(--hero-fly, 0), 0, 1);
  will-change: transform, opacity;
}
/* 释放后：清掉 transform/opacity，让原生滚动接管 */
body.hero-released #content-inner,
body.hero-released .layout,
body.hero-released main {
  transform: none !important;
  opacity: 1 !important;
  margin-top: 100dvh !important;
}

/* ── v12 导航：始终显示（金棕色），hero 阶段就可见 ── */
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
  background: linear-gradient(180deg, #b8860b 0%, #cd9b1d 50%, #daa520 100%) !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  padding: 0 20px;
  align-items: center;
  transform: translateZ(0);
}

/* hero 阶段隐藏大 banner 标题（hero 占满屏，标题被挡） */
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
/* 释放后恢复 banner */
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

/* #menus */
body.hero-page-active #menus {
  display: flex !important;
  align-items: center;
  background: transparent !important;
  height: 60px;
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* ── v12 首页净化：hero 阶段隐藏 fixed widget，释放后恢复 ── */
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

/* 释放后：恢复所有 widget（CSS 默认值即可，但我们明确覆盖） */
body.hero-released #music-bar,
body.hero-released #music-panel,
body.hero-released #rightside,
body.hero-released #axtrivc-fab {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* 卡片融底（保留以维持视觉风格统一） */
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

/* 全局滚动：hero 阶段我们自己 hijack，释放后浏览器接管 */
body.hero-page-active {
  overflow-x: hidden;
  overflow-y: auto;
}

/* ── 右侧滚动进度导轨（PC only） ── */
.hero-progress-rail {
  position: fixed;
  right: 26px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 110px;
  background: rgba(255, 255, 255, 0.32);
  border-radius: 1px;
  z-index: 1500;
  overflow: hidden;
  pointer-events: none;
  opacity: calc(1 - var(--hero-fly, 0) * 1.1);
}
.hero-progress-fill {
  position: absolute;
  top: 0;
  left: -1px;
  width: 4px;
  height: calc(var(--hero-raw, 0) * 100%);
  background: linear-gradient(180deg, #ffffff 0%, #ffd970 100%);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(255, 217, 112, 0.6);
}
@media (max-width: 768px) {
  .hero-progress-rail { display: none; }
}

/* ── 底部 SCROLL 提示 ── */
.hero-scroll-hint {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, 0.95);
  pointer-events: none;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  opacity: calc(1 - var(--hero-fly, 0) * 1.4);
}
.hero-scroll-label {
  font-size: 11px;
  letter-spacing: 0.32em;
  font-weight: 600;
  text-transform: uppercase;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
}
.hero-scroll-rail {
  position: relative;
  width: 1px;
  height: 38px;
  background: rgba(255, 255, 255, 0.32);
  overflow: hidden;
}
.hero-scroll-rail-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(var(--hero-raw, 0) * 100%);
  background: rgba(255, 255, 255, 0.95);
}
.hero-scroll-arrow {
  animation: heroScrollBob 1.8s ease-in-out infinite;
}
@keyframes heroScrollBob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(5px); }
}
@media (max-width: 768px) {
  .hero-scroll-hint { bottom: 18px; gap: 8px; }
  .hero-scroll-label { display: none; }
}
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=9"') : '';

  const afterScriptIdx = heroSrc.indexOf(heroScriptTag) + heroScriptTag.length;
  const inlineScriptMatch = heroSrc.slice(afterScriptIdx).match(/<script>[\s\S]*?<\/script>/);
  const heroInitScript = inlineScriptMatch ? inlineScriptMatch[0] : '';

  const heroStyleTag = `<style id="hero-inline-css">\n${heroCss}\n</style>`;
  let content = data.replace('</head>', heroStyleTag + '\n</head>');

  const scrollHint = `
<div class="hero-scroll-hint" aria-hidden="true">
  <span class="hero-scroll-label">SCROLL</span>
  <div class="hero-scroll-rail"><div class="hero-scroll-rail-fill"></div></div>
  <div class="hero-scroll-arrow">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9L12 15L18 9"/>
    </svg>
  </div>
</div>
`;

  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n${scrollHint}\n</div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  const progressRail = `
<div class="hero-progress-rail" aria-hidden="true">
  <div class="hero-progress-fill"></div>
</div>
`;

  // ═══════════════════════════════════════════════════════════════
  // v12 「Wheel/Touch Hijack + Resistance → Snap → Release」
  //
  // 设计：
  //   1. 监听 wheel/touch/keydown，preventDefault，自己算 progress
  //   2. 阻力段：target += deltaY * 0.6 / windowHeight，progress 用 ×0.08 缓慢跟随
  //      → 用户感觉"在推重物"，滚动慢
  //   3. 临界段：target >= 0.45 → releaseArmed = true，target 强制 1
  //   4. 释放段：progress 直接同步 target（×0.32），无 inertia
  //      → hero 急速飞出
  //   5. progress >= 0.998 → 退出 hijack，body.hero-released，scrollTo 到 hero 底部
  //   6. 释放后：原生滚动接管，用户继续滚动浏览博客
  // ═══════════════════════════════════════════════════════════════
  const scrollDriverJs = `
<script>
(function() {
  'use strict';
  var html = document.documentElement;
  var body = document.body;
  var rafId = null;
  var hijacking = true;
  var heroH = 0;

  // 内部状态
  var progress = 0;        // 视觉进度（被 spring 平滑过）0..1
  var target = 0;          // wheel 累积的目标 0..1
  var releaseArmed = false;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutExpo(t) { return t >= 1 ? 1 : (1 - Math.pow(1 - t, 3)); }
  function easeInQuad(t) { return t * t; }

  function measure() {
    heroH = window.innerHeight;
  }
  measure();
  window.addEventListener('resize', function() {
    measure();
    applyVars(progress);
  });

  // URL 调试参数：?raw=0.3 直接设定 progress（用于截图测试）
  function getDebugRaw() {
    try {
      var qsRaw = new URLSearchParams(window.location.search).get('raw');
      if (qsRaw !== null) {
        var v = parseFloat(qsRaw);
        if (!isNaN(v)) return clamp01(v);
      }
    } catch (e) {}
    return null;
  }
  var debugRaw = getDebugRaw();
  if (debugRaw !== null) {
    progress = debugRaw;
    target = debugRaw;
    releaseArmed = debugRaw >= 0.45;
  }

  function applyVars(p) {
    var pin = p < 0.45 ? easeInQuad(p / 0.45) : 1 - easeOutExpo((p - 0.45) / 0.55) * 0.3;
    var fly = easeOutExpo(p);
    html.style.setProperty('--hero-raw', p.toFixed(4));
    html.style.setProperty('--hero-fly', fly.toFixed(4));
    html.style.setProperty('--hero-pin', pin.toFixed(4));
  }

  function tick() {
    rafId = null;
    if (!hijacking) return;

    if (releaseArmed) {
      target = 1;  // 强制冲顶
      // 释放段：无 inertia，直接同步
      progress += (target - progress) * 0.32;
      if (progress > 0.998) {
        progress = 1;
        hijacking = false;
        applyVars(1);
        // 释放：移除 main 的 transform/opacity，scrollTo 到 hero 底部
        body.classList.add('hero-released');
        // scrollTo 让博客内容的自然位置生效（main 顶部 = viewport 顶部）
        window.scrollTo(0, heroH);
        return;
      }
    } else {
      // 阻力段：缓慢跟随 target（push-back 感）
      progress += (target - progress) * 0.08;
    }

    applyVars(progress);
    rafId = requestAnimationFrame(tick);
  }

  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  // ── Wheel：核心 hijack ──
  function onWheel(e) {
    if (!hijacking) return;
    if (releaseArmed) return;  // 释放阶段不再响应 wheel（让动画完成）
    if (e.deltaY <= 0) return;  // 向上滚：交给原生（hero 阶段无效果）
    e.preventDefault();
    // 阻力：deltaY 缩 40%
    var dx = (e.deltaY * 0.6) / heroH;
    target = clamp01(target + dx);
    if (target >= 0.45) releaseArmed = true;
    schedule();
  }

  // ── Touch：移动端 ──
  var touchY = 0;
  function onTouchStart(e) {
    if (!hijacking || releaseArmed) return;
    if (e.touches.length !== 1) return;
    touchY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (!hijacking || releaseArmed) return;
    if (e.touches.length !== 1) return;
    var y = e.touches[0].clientY;
    var dy = touchY - y;
    touchY = y;
    if (dy <= 0) return;  // 向下 swipe 才算向下滚
    e.preventDefault();
    target = clamp01(target + dy * 0.0035);  // 阻力：每像素 0.35%
    if (target >= 0.45) releaseArmed = true;
    schedule();
  }

  // ── Keyboard：可访问性 + 桌面键盘用户 ──
  function onKey(e) {
    if (!hijacking || releaseArmed) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      target = clamp01(target + 0.18);
      if (target >= 0.45) releaseArmed = true;
      schedule();
    }
  }

  // ── 注册监听 ──
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('keydown', onKey, { passive: false });

  // ── visibilitychange：处理后台 tab 累积时间 ──
  var hiddenAccum = 0;
  var hiddenStart = 0;
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      hiddenStart = performance.now();
    } else if (hiddenStart > 0) {
      hiddenAccum += performance.now() - hiddenStart;
      hiddenStart = 0;
    }
  });

  // ── 初始化 ──
  applyVars(progress);
  if (!debugRaw) {
    rafId = requestAnimationFrame(tick);
  } else {
    applyVars(progress);
  }
})();
</script>
`;

  const heroScripts = heroScriptTag + '\n' + heroInitScript + progressRail + scrollDriverJs;
  content = content.replace('</body>', heroScripts + '\n</body>');

  // ── v12.1 Bug 修复:手绑 #toggle-menu(原 btf.addEventListenerPjax 在非 PJAX 下不触发) ──
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
  // 兜底:某些主题会延迟注入 nav,500ms 后再试一次
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

  hexo.log.info('[hero-inject] ✅ v12 「阻力 → 临界爆发 → 直滑到底」: ' + canonical);
  return content;
});
