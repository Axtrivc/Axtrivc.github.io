/**
 * Hero 注入：将 source/hero/ 下的 hero 区块插入到博客主页内容之前。
 *
 * 行为：
 *   - 只对主页（根 index.html）注入，不影响其他页面和分页
 *   - 注入位置：</header> 之后、<main> 之前
 *   - hero 占满首屏（PC + 移动端均为 100dvh），下方接博客列表
 *
 * 关键设计（2026-06-23 升级）：
 *   1. CSS 清洗：去除 hero/index.html 的 html, body 通用选择器
 *   2. body.hero-page-active 激活注入的样式 + 折叠 full_page banner
 *   3. 滚动驱动转场（核心）：
 *      - JS 通过 rAF 节流监听 scroll，写 --hero-progress (0→1) 到 <html>
 *      - hero 随 progress 进行：scale up + translate up + dim + desaturate + fade
 *      - 右侧进度导轨（PC）随 progress 填充 + 渐隐
 *      - 底部 SCROLL 提示（SCROLL label + rail + arrow）随 progress 渐隐
 *      - 博客内容浮起阴影
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

/* ── 滚动驱动的 hero 转场（GLITCH 故障风 v3 · 2026-06-23） ── */
/* --hero-progress: 0 = hero 在视口顶部，1 = hero 完全滚出
 *
 * 设计思路（Glitch 故障风）：
 *   1. canvas 整体保持原样不切片（避免模糊），只在 35%-65% 区间快速淡出
 *   2. SVG filter #hero-rgb-split 做 RGB 三通道分离（chromatic aberration）
 *      - 红色通道左移 3px，蓝色通道右移 3px → 经典故障色差
 *      - intensity 由 --p 驱动（滚动越多越强）
 *   3. 8 条 .hero-glitch-bar 错峰向上飞溅，每条携带 river.ai 主题的蓝白渐变
 *      - 用 mix-blend-mode: screen 让它们和 canvas 颜色叠加发光
 *      - 错峰偏移：(i-3.5) * 14px 横向 + (-95vh - i*9vh) 纵向
 *   4. 文字标题 skew + translate 破碎飞出
 *   5. 底部 CTA 反向缩放飞出（"按我"的反向运动）
 *   6. RGB shift 暗角叠加层（hero-shell::before）做视觉增强
 */
.hero-shell {
  --p: var(--hero-progress, 0);
  /* RGB 色差 + 色调渐退 + 极淡 blur → "远去 + 故障"的呼吸感 */
  filter:
    url(#hero-rgb-split)
    brightness(calc(1 - var(--p) * 0.18))
    saturate(calc(1 - var(--p) * 0.35))
    blur(calc(var(--p) * 0.8px));
  /* 透明度分三段：
   *   0.00 - 0.35：保持清晰（让用户看到峡谷画面感）
   *   0.35 - 0.65：缓慢淡出（glitch bar 开始接管视觉）
   *   0.65 - 1.00：快速消失（被博客内容浮起阴影覆盖） */
  opacity: calc(
    1
    - max(0, var(--p) - 0.35) * 0.6
    - max(0, var(--p) - 0.65) * 2.5
  );
  transition: filter 0.18s ease-out;
}

/* RGB shift 暗角：左右两侧的彩色光晕跟随滚动偏移 */
.hero-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background:
    radial-gradient(ellipse at 25% 50%,
      rgba(255, 50, 90, 0.4) 0%,
      transparent 45%),
    radial-gradient(ellipse at 75% 50%,
      rgba(50, 130, 255, 0.4) 0%,
      transparent 45%);
  mix-blend-mode: screen;
  opacity: calc(var(--p) * 0.85);
  transform: translateX(calc((var(--p) - 0.5) * 14px));
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}
/* 渐入暗角（vignette overlay）让转场有"进入文章"的感觉 */
.hero-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  background:
    radial-gradient(ellipse at 50% 60%,
      transparent 0%,
      transparent 35%,
      rgba(8, 14, 36, 0.15) 65%,
      rgba(8, 14, 36, 0.45) 100%);
  opacity: calc(var(--p) * 0.9);
  transition: opacity 0.2s ease-out;
}

@media (max-width: 768px) {
  .hero-shell {
    filter:
      url(#hero-rgb-split)
      brightness(calc(1 - var(--p) * 0.18))
      saturate(calc(1 - var(--p) * 0.35))
      blur(calc(var(--p) * 0.6px));
  }
}

/* ── 博客内容：紧跟 hero 后面（hero 是 fixed，主内容从 100dvh 开始） ── */
body.hero-page-active #content-inner,
body.hero-page-active .layout,
body.hero-page-active main {
  position: relative;
  z-index: 2;
  margin-top: 100dvh;        /* 把博客内容推到 hero 后面 */
  background: #faf8f5;
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.08);
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
  background: rgba(255, 255, 255, 0.22);
  border-radius: 1px;
  z-index: 50;
  overflow: hidden;
  pointer-events: none;
  opacity: calc(1 - var(--hero-progress, 0) * 1.6);
  transition: opacity 0.25s ease;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
}
.hero-progress-fill {
  position: absolute;
  top: 0;
  left: -1px;
  width: 4px;
  height: calc(var(--hero-progress, 0) * 100%);
  background: linear-gradient(180deg, #ffffff 0%, #b9d2ff 100%);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.7);
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
  opacity: calc(1 - var(--hero-progress, 0) * 2.2);
  transition: opacity 0.3s ease;
}
.hero-scroll-label {
  font-size: 11px;
  letter-spacing: 0.32em;
  font-weight: 600;
  text-transform: uppercase;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55), 0 0 12px rgba(0, 0, 0, 0.3);
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
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));
}
@keyframes heroScrollBob {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%      { transform: translateY(5px); opacity: 1; }
}
@media (max-width: 768px) {
  .hero-scroll-hint { bottom: 18px; gap: 8px; }
  .hero-scroll-label { display: none; }
}

/* ───────── GLITCH 切片飞溅层（核心酷炫效果） ───────── */
.hero-glitch-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
  overflow: hidden;
  --p: var(--hero-progress, 0);
}
.hero-glitch-bar {
  position: absolute;
  left: -4%;
  right: -4%;
  top: calc(var(--i, 0) * 12.5%);
  height: 12.5%;
  background: linear-gradient(
    180deg,
    rgba(120, 160, 255, 0)    0%,
    rgba(140, 180, 255, 0.5)  25%,
    rgba(200, 220, 255, 0.95) 50%,
    rgba(140, 180, 255, 0.5)  75%,
    rgba(120, 160, 255, 0)    100%
  );
  mix-blend-mode: screen;
  filter: blur(0.5px) hue-rotate(calc(var(--i, 0) * 22deg));
  will-change: transform, opacity;
  --trigger: max(0, calc(var(--p) - 0.12));
  --fadeout: max(0, calc(var(--p) - 0.72));
  /* 错峰飞出：
   *   横向偏移：(i-3.5) * 14px → 中间条几乎不动，两侧条大幅外飞
   *   纵向偏移：-95vh - i*9vh → 上面条先飞得更远（增强层次感）
   *   旋转：±8deg 随机倾斜，模拟画面被打碎的感觉 */
  transform: translate3d(
    calc((var(--i, 0) - 3.5) * var(--trigger) * 14px),
    calc(var(--trigger) * (-95vh - var(--i, 0) * 9vh)),
    0
  ) rotate(calc((var(--i, 0) - 3.5) * var(--trigger) * 2.5deg));
  opacity: calc(
    min(var(--trigger) * 1.8, 1)
    * (1 - min(var(--fadeout) * 3.5, 1))
  );
}
/* 噪点飞溅：覆盖全屏的颗粒 */
.hero-noise-spray {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  --p: var(--hero-progress, 0);
  background-image:
    repeating-linear-gradient(0deg,
      rgba(255,255,255,0.04) 0px,
      rgba(255,255,255,0.04) 1px,
      transparent 1px,
      transparent 3px),
    repeating-linear-gradient(90deg,
      rgba(255,255,255,0.03) 0px,
      rgba(255,255,255,0.03) 1px,
      transparent 1px,
      transparent 4px);
  mix-blend-mode: overlay;
  opacity: calc(var(--p) * 0.9);
  animation: noiseShift 0.4s steps(8) infinite;
}
@keyframes noiseShift {
  0%   { background-position: 0 0, 0 0; }
  25%  { background-position: -7px 3px, 4px -2px; }
  50%  { background-position: 5px -4px, -3px 6px; }
  75%  { background-position: -4px -2px, 7px 1px; }
  100% { background-position: 0 0, 0 0; }
}

/* 文字标题破碎飞出（覆盖 hero/index.html 的样式） */
.hero-text-headline {
  --p: var(--hero-progress, 0);
  --trigger: max(0, calc(var(--p) - 0.05));
  transform: translate3d(
    calc((var(--p) - 0.5) * 20px),
    calc(var(--trigger) * -32vh),
    0
  ) skewY(calc(var(--trigger) * -10deg));
  opacity: calc(1 - max(0, calc(var(--p) - 0.2)) * 2.6);
  filter: blur(calc(max(0, calc(var(--p) - 0.2)) * 2.5px))
          hue-rotate(calc(var(--p) * 30deg));
  will-change: transform, opacity;
}
.hero-text-sub {
  --p: var(--hero-progress, 0);
  --trigger: max(0, calc(var(--p) - 0.08));
  transform: translate3d(
    calc((var(--p) - 0.5) * -16px),
    calc(var(--trigger) * -28vh),
    0
  ) skewY(calc(var(--trigger) * 8deg));
  opacity: calc(1 - max(0, calc(var(--p) - 0.25)) * 2.8);
  filter: blur(calc(max(0, calc(var(--p) - 0.25)) * 2px));
  will-change: transform, opacity;
}
.hero-cta,
a.hero-cta {
  --p: var(--hero-progress, 0);
  transform: translateY(calc(max(0, calc(var(--p) - 0.1)) * 25vh))
             scale(calc(1 - max(0, calc(var(--p) - 0.1)) * 0.4))
             rotate(calc((var(--p) - 0.5) * 12deg));
  opacity: calc(1 - max(0, calc(var(--p) - 0.15)) * 2.6);
  filter: blur(calc(max(0, calc(var(--p) - 0.2)) * 1.5px));
}
.hero-text-label,
.hero-text-quote {
  --p: var(--hero-progress, 0);
  opacity: calc(1 - max(0, calc(var(--p) - 0.05)) * 3);
  filter: blur(calc(max(0, calc(var(--p) - 0.1)) * 1.5px));
}

/* SVG filter 定义区（藏起来，纯供 url(#hero-rgb-split) 引用） */
.hero-filters-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: -1;
}

/* 移动端：减少 glitch bar 数量（用 i 限制）、降低强度 */
@media (max-width: 768px) {
  .hero-glitch-bar {
    height: 16.66%;
    top: calc(var(--i, 0) * 16.66%);
    filter: blur(0.3px) hue-rotate(calc(var(--i, 0) * 22deg));
  }
  .hero-glitch-bar[style*="--i: 6"],
  .hero-glitch-bar[style*="--i: 7"] {
    display: none;  /* 移动端只显示 6 条 */
  }
  .hero-noise-spray { opacity: calc(var(--p) * 0.6); }
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

  // SVG filter 定义（藏起来，提供 RGB split 色差分离效果）
  const svgFilters = `
<svg class="hero-filters-defs" aria-hidden="true" focusable="false">
  <defs>
    <filter id="hero-rgb-split" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <!-- 红色通道：左移 4px -->
      <feColorMatrix in="SourceGraphic" type="matrix" values="
        1   0   0   0   0
        0   0   0   0   0
        0   0   0   0   0
        0   0   0   1   0" result="redOnly"/>
      <feOffset in="redOnly" dx="-4" dy="0" result="redOff"/>

      <!-- 绿色通道：原位 -->
      <feColorMatrix in="SourceGraphic" type="matrix" values="
        0   0   0   0   0
        0   1   0   0   0
        0   0   0   0   0
        0   0   0   1   0" result="greenOnly"/>

      <!-- 蓝色通道：右移 4px -->
      <feColorMatrix in="SourceGraphic" type="matrix" values="
        0   0   0   0   0
        0   0   0   0   0
        0   0   1   0   0
        0   0   0   1   0" result="blueOnly"/>
      <feOffset in="blueOnly" dx="4" dy="0" result="blueOff"/>

      <!-- 三通道 screen 模式混合 -->
      <feBlend in="redOff" in2="greenOnly" mode="screen" result="rg"/>
      <feBlend in="rg" in2="blueOff" mode="screen"/>
    </filter>
  </defs>
</svg>
`;

  // Glitch 切片飞溅层：8 条横向条带，错峰上滑飞出
  const glitchLayer = `
<div class="hero-glitch-layer" aria-hidden="true">
  <div class="hero-glitch-bar" style="--i: 0"></div>
  <div class="hero-glitch-bar" style="--i: 1"></div>
  <div class="hero-glitch-bar" style="--i: 2"></div>
  <div class="hero-glitch-bar" style="--i: 3"></div>
  <div class="hero-glitch-bar" style="--i: 4"></div>
  <div class="hero-glitch-bar" style="--i: 5"></div>
  <div class="hero-glitch-bar" style="--i: 6"></div>
  <div class="hero-glitch-bar" style="--i: 7"></div>
</div>
<div class="hero-noise-spray" aria-hidden="true"></div>
`;

  // 用 .hero-shell 包裹 hero section + 滚动提示 + glitch 层（必须在 hero-shell 内部）
  // SVG filter 定义放在 hero-shell 之前（确保 url(#hero-rgb-split) 能找到定义节点）
  const heroWrapped = `${svgFilters}\n<div class="hero-shell">\n${heroSection}\n${glitchLayer}\n${scrollHint}\n</div>`;

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