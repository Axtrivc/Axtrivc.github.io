/**
 * Hero 注入：将 source/hero/ 下的 hero 区块插入到博客主页内容之前。
 *
 * 行为：
 *   - 只对主页（根 index.html）注入，不影响其他页面和分页
 *   - 注入位置：</header> 之后、<main> 之前
 *   - hero 占满首屏（PC + 移动端均为 100dvh），下方接博客列表
 *
 * 关键设计（2026-06-23 v5 「河水奔涌而去」）：
 *   1. CSS 清洗：去除 hero/index.html 的 html, body 通用选择器
 *   2. body.hero-page-active 激活注入的样式 + 折叠 full_page banner
 *   3. 滚动驱动转场（明显版）：
 *      - JS 通过 rAF 节流监听 scroll，写 --hero-progress (0→1) 到 <html>
 *      - hero 整体大幅向上飘（-110vh），明显"飞出屏幕"
 *      - opacity 从 progress=0 开始淡，到 0.55 时几乎不可见
 *      - 文字比 canvas 飞得更快（-30vh）+ 横向散开（±6vh）
 *      - 博客内容从下方 -60vh 滑入 + 淡入（"河水让位"的视觉）
 *      - 右侧进度导轨（PC）随 progress 填充 + 渐隐
 *      - 底部 SCROLL 提示随 progress 渐隐
 *      ❌ 无 CSS filter / SVG filter / mix-blend-mode / glitch bar
 *      ✅ 仅 transform + opacity → GPU 合成器原生，零掉帧
 *      ✅ 0 transition → 滚动 100% 跟手
 *   4. 移动端：100dvh 全屏，隐藏侧边进度条，简化底部提示
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

  // ── CSS 清洗：去除通用选择器（避免污染博客全局） ──
  heroCss = heroCss
    .replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/gm, '')
    .replace(/^\s*\*,\s*\*::before,\s*\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ── 注入专用 scoped 样式 ──
  heroCss += `
/* ─────────── hero-inject scoped CSS ─────────── */

/* hero-shell：占满首屏容器（PC + 移动端均 100dvh） */
.hero-shell {
  position: fixed;
  inset: 60px 0 0 0;            /* 顶部 60px 留给导航栏，不覆盖 nav */
  width: 100%;
  height: calc(100vh - 60px);
  height: calc(100dvh - 60px);
  overflow: hidden;
  background: #0E2F7E;
  margin: 0;
  padding: 0;
  z-index: 1;
  /* 关键：不声明 will-change！
   * 声明 will-change: transform 会强制元素常驻独立合成层，
   * Chromium 在滚动时会对这种层降采样渲染，导致 canvas 模糊。
   * 这里只在 transform 实际变化时让浏览器自动提升合成层即可。 */
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

/* canvas：锁住独立 GPU 层，避免滚动时被 Chromium 降采样 */
.hero-shell canvas.hero-ascii {
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* ── 滚动驱动的 hero 转场（「河水奔涌而去」v5 · 2026-06-23） ── */
/* --hero-progress: 0 = hero 在视口顶部，1 = hero 完全滚出
 *
 * 设计目标：转场要"明显且特别"，但仍 0 掉帧：
 *   ❌ 不使用 CSS filter（blur / saturate / brightness / hue-rotate）
 *      → filter 在大 viewport 上每帧重新栅格化 canvas 输出，是掉帧主因
 *   ❌ 不使用 SVG filter（feColorMatrix / feOffset）
 *      → 对整个 hero-shell 应用会强制 layout 重算
 *   ❌ 不使用 mix-blend-mode / overlay layers
 *      → 合成器在每个 glitch bar 上重新混合像素，n 条 = n 倍开销
 *   ❌ 不使用 will-change（除 canvas 自身）
 *      → 强制常驻独立合成层，Chromium 滚动时会降采样
 *   ❌ 不使用 transition
 *      → transition 会让 transform/opacity 跟不上滚动方向，产生延迟感和"卡顿感"
 *   ✅ 只用 transform: translateY/translateX + opacity
 *      → 这两个属性是 GPU 合成器原生路径，零 CPU 开销
 *
 * 视觉效果：用户一开始滚动 → hero 整体被"河水"冲向上方屏幕外
 *          + 文字比 canvas 飞得更快 + 横向散开
 *          + 博客内容从下方滑入顶替位置
 *          → 有方向感、有层次、不卡顿。
 */
.hero-shell {
  --p: var(--hero-progress, 0);
  /* 透明度：滚动一开始就快速淡出，到 0.55 时 hero 几乎不可见 */
  opacity: calc(1 - clamp(var(--p) * 1.8, 0, 1));
  /* 大幅向上飘：-110vh 让 hero 直接飞出屏幕顶部上方（视口外） */
  transform: translate3d(0, calc(var(--p) * -110vh), 0);
  /* 无 transition：滚动 100% 跟手，无延迟感 */
}

/* ── 博客内容：紧跟 hero 后面（hero 是 fixed，主内容从 100dvh 开始） ── */
body.hero-page-active #content-inner,
body.hero-page-active .layout,
body.hero-page-active main {
  --p: var(--hero-progress, 0);
  position: relative;
  z-index: 2;
  margin-top: 100dvh;        /* 把博客内容推到 hero 后面 */
  background: #faf8f5;
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.08);
  /* 博客内容从下方滑入：progress=0 时在屏幕下方 60vh，progress=0.4 时到位 */
  transform: translate3d(0, calc((1 - min(var(--p) * 2.5, 1)) * 60vh), 0);
  /* 同步淡入：progress=0 → 0，progress=0.4 → 1 */
  opacity: clamp(var(--p) * 2.5, 0, 1);
}

/* ── 折叠 Butterfly 的 full_page banner 到只剩 nav ── */
body.hero-page-active #page-header.full_page {
  height: auto !important;
  min-height: 0 !important;
  visibility: visible;
  z-index: 10;               /* 让 nav 在 hero 上面 */
}
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down {
  display: none !important;
}

/* 让页面可以正常滚动 */
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
  z-index: 50;
  overflow: hidden;
  pointer-events: none;
  opacity: calc(1 - var(--hero-progress, 0) * 1.8);
  transition: opacity 0.25s ease;
}
.hero-progress-fill {
  position: absolute;
  top: 0;
  left: -1px;
  width: 4px;
  height: calc(var(--hero-progress, 0) * 100%);
  background: linear-gradient(180deg, #0E2F7E 0%, #5078d0 100%);
  border-radius: 2px;
}
@media (max-width: 768px) {
  .hero-progress-rail { display: none; }
}

/* ── 底部 SCROLL 提示（hero 内，绝对定位） ── */
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
  opacity: calc(1 - var(--hero-progress, 0) * 2.5);
  transition: opacity 0.25s ease;
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
  height: calc(var(--hero-progress, 0) * 100%);
  background: rgba(255, 255, 255, 0.95);
}
.hero-scroll-arrow {
  animation: heroScrollBob 1.8s ease-in-out infinite;
}
@keyframes heroScrollBob {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%      { transform: translateY(5px); opacity: 1; }
}
@media (max-width: 768px) {
  .hero-scroll-hint { bottom: 18px; gap: 8px; }
  .hero-scroll-label { display: none; }
}

/* ── hero 内部文字：「比 canvas 飞得更快 + 横向散开」 ──
 * 视觉解读：hero 整图是被"河水"冲走，文字作为更轻的"浮萍"会被冲得更快、
 *           飘得更远，且方向不一致（向左 / 向右都被河水打散）。
 * 实现：translate3d 中 x/y 都用 CSS 变量算出来，0 transition 让滚动完全跟手。
 * 性能：仍然只动 transform + opacity，无 filter/blend，安全。
 */
.hero-text-headline,
.hero-text-sub,
.hero-cta,
a.hero-cta,
.hero-text-label,
.hero-text-quote {
  --p: var(--hero-progress, 0);
  /* 透明度：滚动一点点就开始淡，到 0.45 时完全看不见 */
  opacity: calc(1 - clamp(var(--p) * 2.2, 0, 1));
  /* 飞的方向：向上 -30vh + 横向 (p-0.5)*14vh
   *   p=0 时 x = -7vh（偏左）
   *   p=0.5 时 x = 0（居中）
   *   p=1 时 x = +7vh（偏右）
   *   → 像文字被水流"扭"着飘走 */
  transform: translate3d(
    calc((var(--p) - 0.5) * 14vh),
    calc(var(--p) * -30vh),
    0
  );
  /* 无 transition：滚动 100% 跟手 */
}
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=5"') : '';

  const afterScriptIdx = heroSrc.indexOf(heroScriptTag) + heroScriptTag.length;
  const inlineScriptMatch = heroSrc.slice(afterScriptIdx).match(/<script>[\s\S]*?<\/script>/);
  const heroInitScript = inlineScriptMatch ? inlineScriptMatch[0] : '';

  const heroStyleTag = `<style id="hero-inline-css">\n${heroCss}\n</style>`;
  let content = data.replace('</head>', heroStyleTag + '\n</head>');

  // 增强版滚动提示（放在 hero-shell 内部，position:absolute 相对 .hero-shell 定位）
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

  // ── 用 .hero-shell 包裹 hero section + 滚动提示 ──
  // 极简 v4：删除 SVG filter 定义、删除 glitch bar 层、删除 noise 噪点层
  // 渲染开销：只剩 hero 自身的 canvas + 几个文字 div + 1 个 scroll hint
  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n${scrollHint}\n</div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  // 右侧进度导轨（PC only）
  const progressRail = `
<div class="hero-progress-rail" aria-hidden="true">
  <div class="hero-progress-fill"></div>
</div>
`;

  // 滚动驱动 JS（rAF 节流，避免每帧多次计算）
  const scrollDriverJs = `
<script>
(function() {
  var rafId = null;
  function update() {
    if (rafId) return;
    rafId = requestAnimationFrame(function() {
      var p = Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
      document.documentElement.style.setProperty('--hero-progress', p);
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

  hexo.log.info('[hero-inject] ✅ hero injected with scroll transition: ' + canonical);
  return content;
});