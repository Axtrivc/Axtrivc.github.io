/**
 * Hero 注入：将 source/hero/ 下的 hero 区块插入到博客主页内容之前。
 *
 * v11 重大重构（2026-06-23）：
 *   用户反复反馈：
 *     1) "动画界面不要 nav" → hero 阶段彻底没有 nav（不只是不挡）
 *     2) "转场动画太一般了" → 重做三段式数学（更明显的"阻力→释放"）
 *     3) "首页 full_page 信息不要" → 彻底净化
 *
 * 阶段布局：
 *   ┌─────────────────────────────────────────────┐
 *   │ HERO 阶段 (raw ∈ [0, 0.55])                  │
 *   │  - 满屏 hero 动画                            │
 *   │  - 顶部 nav 完全不显示（不只是不挡）         │
 *   │  - 底部 SCROLL 提示                          │
 *   │  - 右侧进度导轨 + 脉动点                     │
 *   └─────────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────────┐
 *   │ 转场 (raw ∈ [0.30, 0.70])                    │
 *   │  - 0.30 → 0.50  阻力蓄力（hero 几乎不动）   │
 *   │  - 0.50 → 0.70  急速释放（hero 飞走）       │
 *   │  - 0.30 同步  ：nav 渐渐淡入                 │
 *   │  - 0.55 同步  ：nav 完全显示 + main 滑入     │
 *   └─────────────────────────────────────────────┘
 *   ┌─────────────────────────────────────────────┐
 *   │ MAIN 阶段 (raw ≥ 0.70)                       │
 *   │  - nav 完整显示（金棕渐变背景）              │
 *   │  - 博客内容正常显示                          │
 *   └─────────────────────────────────────────────┘
 *
 * JS ↔ CSS 通信（CSS 只引用变量，不再算数学）：
 *   --hero-raw        实际滚动量 0→1
 *   --hero-visual     视觉进度 0→1（已由 computeVisual 计算好）
 *   --hero-pin        pin 段原始进度 0→1
 *   --hero-easeout    release 段 easeOutExpo 输出 0→1
 *   --hero-nav        nav 淡入进度 0→1（hero 阶段 0，main 阶段 1）
 */
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function (data) {
  if (!data || typeof data !== 'string') return data;

  // 幂等检查
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

  // ── CSS 清洗：去除通用选择器 ──
  heroCss = heroCss
    .replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/gm, '')
    .replace(/^\s*\*,\s*\*::before,\s\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ── 注入专用 scoped 样式 ──
  heroCss += `
/* ─────────── hero-inject scoped CSS v11 「nav 分阶段 + 阻力释放」 ─────────── */

/* hero-shell：占满整个首屏
 * z-index 1000，nav 在 hero 阶段完全不显示（opacity 0） */
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

/* canvas：锁住独立 GPU 层 */
.hero-shell canvas.hero-ascii {
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* ─────────────────────────────────────────────────
 * v11 「滚动阻力 → 临界爆发 → 急速飞走」三段式
 *
 *   raw ∈ [0, 0.30]     → 阻力段：visual 0 → 0.10（easeInQuart）
 *                           hero 几乎不动 —— 像在压弹簧
 *   raw ∈ [0.30, 0.50]  → 临界过渡：visual 0.10 → 0.22（线性）
 *                           阻力感消失，蓄能溢出
 *   raw ∈ [0.50, 1.00]  → 爆发释放：visual 0.22 → 1.0（easeOutExpo）
 *                           hero 急速向上飞出 -200vh，main 从 +88vh 升起
 *
 * 性能铁律（v3→v4→...→v11 经验）：
 *   ❌ 不在 hero-shell 上用 CSS filter / SVG filter
 *   ❌ 不 mix-blend-mode: overlay/screen + 多层叠加
 *   ❌ 不给装饰元素加 will-change: transform
 *   ✅ 只用 transform: translate3d + scale + opacity
 *   ✅ canvas 单独加 translateZ(0) 锁独立 GPU 层
 *   ✅ 0 transition → 滚动 100% 跟手
 * ───────────────────────────────────────────────── */

.hero-shell {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  /* 蓄力段基本不淡（保持 0.92），释放段急速淡出 */
  opacity: calc(0.92 - var(--ease) * 1.05);
  /* 蓄力往下 + 释放往上飞出 */
  transform: translate3d(
    0,
    calc(var(--pin) * 7vh - var(--ease) * 207vh),
    0
  );
}

/* 蓄力段"压力感"：径向暗化 vignette 在蓄力段逐渐加深
 * 用 ::after 伪元素实现，纯 background 不参与 filter 计算 → 性能安全
 * 临界点（raw 0.50）最暗，释放后 vignette 跟随 hero 一起飞走 */
.hero-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.45) 95%
  );
  opacity: var(--hero-pin, 0);
  z-index: 4;
  transition: none;
}

/* hero 内部 section：蓄力时被压紧 scale 1→1.08（鼓胀），释放段恢复 1.0 */
.hero-shell > section.hero {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  transform: scale(calc(1.0 + var(--pin) * 0.08 - var(--ease) * 0.08));
  transform-origin: center center;
}

/* ── 博客内容：紧跟 hero 后面（z-index 1100，高于 hero-shell 1000）
 * visual 0.15 开始浮现，与 hero 飞走完全 overlap */
body.hero-page-active #content-inner,
body.hero-page-active .layout,
body.hero-page-active main {
  --p: var(--hero-visual, 0);
  position: relative;
  z-index: 1100;
  margin-top: 100dvh;
  background: #faf8f5;
  transform: translate3d(0, calc((0.88 - var(--p) * 1.32) * 100vh), 0);
  opacity: clamp((var(--p) - 0.15) * 1.6, 0, 1);
}

/* ── 「v11 nav 分阶段显示」
 *
 * 用户要求：动画界面不要 nav，只有切到博客时才有。
 *
 * 实现：
 *   - hero 阶段（raw 0~0.30）       → nav 不可见，pointer-events: none
 *   - 临界段（raw 0.30~0.55）       → nav 渐渐淡入
 *   - main 阶段（raw ≥ 0.55）        → nav 完整显示
 *
 * 用 --hero-nav 变量控制：JS 端计算好后 setProperty 到 :root
 *   --hero-nav = 0   （hero 阶段，nav 隐藏）
 *   --hero-nav = 1   （main 阶段，nav 完全显示）
 *
 * 渐变曲线：hero 阶段保持 0.5s，0.30~0.55 线性上升，0.55+ 保持 1
 */
body.hero-page-active #page-header.full_page {
  position: relative;
  height: 60px;
  background: transparent;
  pointer-events: none;
}
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down,
body.hero-page-active #site-info,
body.hero-page-active #scroll-down {
  display: none !important;
}

/* nav 渐变：opacity 由 --hero-nav 驱动 */
body.hero-page-active #nav,
body.hero-page-active #page-header.full_page #nav {
  --nav-p: var(--hero-nav, 0);
  opacity: var(--nav-p) !important;
  transform: none !important;
  pointer-events: auto;
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
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 0 20px;
  align-items: center;
  transition: opacity 0.4s ease, background 0.4s ease, box-shadow 0.4s ease;
}

/* hero 滚走后（main 阶段）：背景变成纯色 */
body.hero-page-active.hero-past #nav {
  background: #b8860b !important;
}

/* #menus flex 布局 */
body.hero-page-active #menus {
  opacity: 1 !important;
  transform: none !important;
  pointer-events: auto;
  display: flex !important;
  flex: 0 0 auto !important;
  width: auto !important;
  height: 60px;
  align-items: center;
  justify-content: flex-end;
  background: transparent !important;
}

/* nav 内 logo（Axtrivc's Blog 标题） */
body.hero-page-active #blog-info,
body.hero-page-active #nav #blog-info,
body.hero-page-active #page-header.full_page #blog-info {
  display: flex !important;
  position: relative;
  left: 0;
  margin-right: 20px;
  flex-shrink: 0;
  visibility: visible !important;
  opacity: 1 !important;
}
body.hero-page-active #blog-info .site-name,
body.hero-page-active #blog-info a,
body.hero-page-active #blog-info .nav-site-title,
body.hero-page-active #nav #site-title,
body.hero-page-active #nav .site-name,
body.hero-page-active #nav .nav-site-title {
  color: #ffffff !important;
  font-weight: 700 !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
  opacity: 1 !important;
  visibility: visible !important;
}

/* ── 「首页净化」：去掉浮动播放器 + 右下角按钮 + 生日倒计时 + 发布按钮 */
body.hero-page-active #music-bar,
body.hero-page-active #music-panel,
body.hero-page-active #rightside,
body.hero-page-active #go-up,
body.hero-page-active #rightside-config,
body.hero-page-active #aside,
body.hero-page-active .bday-countdown,
body.hero-page-active #publish-button,
body.hero-page-active .fab-publish,
body.hero-page-active [class*="publish"],
body.hero-page-active #card-sponsors,
body.hero-page-active .announcement,
body.hero-page-active .card-announcement,
body.hero-page-active #axtrivc-fab,
body.hero-page-active .hexo-fab,
body.hero-page-active #live2d,
body.hero-page-active #live2d-widget,
body.hero-page-active [class*="live2d"],
body.hero-page-active #article-container .need-to-hide {
  display: none !important;
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
  background: rgba(14, 47, 126, 0.18);
  border-radius: 1px;
  z-index: 1500;
  overflow: hidden;
  pointer-events: none;
  opacity: calc(1 - var(--hero-visual, 0) * 1.05);
}
.hero-progress-fill {
  position: absolute;
  top: 0;
  left: -1px;
  width: 4px;
  height: calc(var(--hero-visual, 0) * 100%);
  background: linear-gradient(180deg, #5078d0 0%, #0E2F7E 100%);
  opacity: calc(0.55 + var(--hero-easeout, 0) * 0.45);
  border-radius: 2px;
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
  opacity: calc(1 - var(--hero-visual, 0) * 1.6);
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
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}
.hero-scroll-rail-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(var(--hero-visual, 0) * 100%);
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

/* ── 蓄力段的"蓄能"提示：进度导轨上方的脉动圆点 ── */
.hero-progress-pulse {
  position: fixed;
  right: 22px;
  top: calc(50% - 70px);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0E2F7E;
  z-index: 1500;
  pointer-events: none;
  animation: heroProgressPulse 1.2s ease-in-out infinite;
  opacity: calc((1 - var(--hero-visual, 0) * 6) * (0.5 + var(--hero-pin, 0) * 0.5));
}
@keyframes heroProgressPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.8); }
}
@media (max-width: 768px) {
  .hero-progress-pulse { display: none; }
}

/* ── hero 内部文字：蓄力段跟着被压紧（轻微缩小 + 暗化），释放段急速散开飞走 ──
 * 不同文字用 alternate direction 让效果更"爆裂"：
 *   headline / sub  → -25vh（向左侧）
 *   cta / label     → +25vh（向右侧）
 *   quote           → 0（垂直飞走）
 */
.hero-text-headline,
.hero-text-sub {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  opacity: calc(0.95 - var(--ease) * 1.05);
  transform: translate3d(
    calc(-1 * var(--ease) * 25vh),
    calc(var(--pin) * -2vh - var(--ease) * 58vh),
    0
  );
}
.hero-cta,
a.hero-cta,
.hero-text-label {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  opacity: calc(0.95 - var(--ease) * 1.05);
  transform: translate3d(
    calc(var(--ease) * 25vh),
    calc(var(--pin) * -2vh - var(--ease) * 58vh),
    0
  );
}
.hero-text-quote {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  opacity: calc(0.95 - var(--ease) * 1.05);
  transform: translate3d(
    0,
    calc(var(--pin) * -2vh - var(--ease) * 58vh),
    0
  );
}
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=8"') : '';

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

  const progressPulse = `<div class="hero-progress-pulse" aria-hidden="true"></div>`;

  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n${scrollHint}\n</div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  const progressRail = `
<div class="hero-progress-rail" aria-hidden="true">
  <div class="hero-progress-fill"></div>
</div>
${progressPulse}
`;

  // 滚动驱动 JS：rAF 节流 + 蓄力释放数学 + nav 阶段变量
  const scrollDriverJs = `
<script>
(function() {
  var rafId = null;
  var html = document.documentElement;

  function easeOutExpo(t) {
    return t >= 1 ? 1 : (1 - Math.pow(1 - t, 3));
  }
  function easeInQuad(t) {
    return t * t;
  }
  function easeInQuart(t) {
    return t * t * t * t;
  }

  // v11 三段式
  function computeVisual(raw) {
    if (raw <= 0.30) {
      return easeInQuart(raw / 0.30) * 0.10;
    }
    if (raw <= 0.50) {
      return 0.10 + ((raw - 0.30) / 0.20) * 0.12;
    }
    return 0.22 + easeOutExpo((raw - 0.50) / 0.50) * 0.78;
  }

  // v11 nav 阶段变量
  //   raw ∈ [0, 0.30]     → nav 0
  //   raw ∈ [0.30, 0.55]  → nav 0 → 1（线性，淡入）
  //   raw ∈ [0.55, 1.0]   → nav 1
  function computeNav(raw) {
    if (raw <= 0.30) return 0;
    if (raw <= 0.55) return (raw - 0.30) / 0.25;
    return 1;
  }

  function update() {
    if (rafId) return;
    rafId = requestAnimationFrame(function() {
      var heroH = window.innerHeight;
      var rawOverride = null;
      try {
        var qsRaw = new URLSearchParams(window.location.search).get('raw');
        if (qsRaw !== null) rawOverride = parseFloat(qsRaw);
      } catch (e) {}
      var raw;
      if (rawOverride !== null && !isNaN(rawOverride)) {
        raw = Math.max(0, Math.min(1, rawOverride));
      } else {
        raw = Math.max(0, Math.min(1, window.scrollY / heroH));
      }
      var visual = computeVisual(raw);
      var pin = Math.min(raw / 0.50, 1);
      var release = Math.max((raw - 0.50) / 0.50, 0);
      var easeOut = easeOutExpo(release);
      var spring = easeInQuad(pin);
      var nav = computeNav(raw);

      html.style.setProperty('--hero-raw', raw.toFixed(4));
      html.style.setProperty('--hero-visual', visual.toFixed(4));
      html.style.setProperty('--hero-pin', pin.toFixed(4));
      html.style.setProperty('--hero-release', release.toFixed(4));
      html.style.setProperty('--hero-easeout', easeOut.toFixed(4));
      html.style.setProperty('--hero-spring', spring.toFixed(4));
      html.style.setProperty('--hero-nav', nav.toFixed(4));

      if (visual >= 0.55) {
        document.body.classList.add('hero-past');
      } else {
        document.body.classList.remove('hero-past');
      }

      rafId = null;
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
</script>
`;

  const heroScripts = heroScriptTag + '\n' + heroInitScript + progressRail + scrollDriverJs;
  content = content.replace('</body>', heroScripts + '\n</body>');

  // 给 body 加 class hero-page-active
  content = content.replace(
    /<body([^>]*)>/,
    '<body$1 class="hero-page-active">'
  );

  hexo.log.info('[hero-inject] ✅ v11 「nav 分阶段 + 阻力释放」: ' + canonical);
  return content;
});
