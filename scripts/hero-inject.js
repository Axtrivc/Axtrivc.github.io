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

/* ── 滚动驱动的 hero 转场（核心效果） ── */
/* --hero-progress: 0 = hero 在视口顶部，1 = hero 完全滚出
 *
 * 设计原则：
 *   1. 不用 scale（缩放会让 canvas 被强制重采样导致模糊）
 *   2. 不用 will-change（强制合成层反而触发滚动降采样）
 *   3. hero 用 position: fixed 脱离文档流，main 用 margin-top: 100dvh 紧跟后面
 *   4. 组合 translateY + clip-path + 双重渐隐 实现"翻页 + 渐隐"转场：
 *        - hero 整体向上漂浮（-30vh）
 *        - 同时从顶部被"裁掉"（像被一只手向上卷起来）
 *        - 配以 vignette 暗角渐入做"沉浸感"过渡
 *        - 前 35% 不淡出（保留峡谷画面感），中段轻微淡出，后段快速消失
 *        - 加 saturation 渐退和 blur 微增，制造"动画→静态"的呼吸感
 *   5. canvas 始终以容器原始尺寸 × dpr 渲染，滚动时不被降采样
 */
.hero-shell {
  --p: var(--hero-progress, 0);
  /* 离场向上漂浮：25vh 内先静后动，更像被风"吹起" */
  transform: translate3d(0, calc(min(var(--p) * 1.4, 1) * -28vh), 0);
  /* clip-path：顶部"卷起" */
  clip-path: inset(calc(var(--p) * 100%) 0 0 0);
  /* filter：色调渐退 + 极淡 blur → 让转场有"远去"的呼吸感而非硬切 */
  filter:
    brightness(calc(1 - var(--p) * 0.18))
    saturate(calc(1 - var(--p) * 0.35))
    blur(calc(var(--p) * 0.6px));
  /* 透明度分三段：
   *   0.00 - 0.35：保持清晰
   *   0.35 - 0.65：缓慢淡出
   *   0.65 - 1.00：快速消失
   * 这是关键 — 之前从 0.5 直接 hard cut 太突兀 */
  opacity: calc(
    1
    - max(0, var(--p) - 0.35) * 0.8   /* 0.35→0.65: 渐出 80% */
    - max(0, var(--p) - 0.65) * 2.4   /* 0.65→1.00: 加速消失 */
  );
  transition: filter 0.15s ease-out;
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
  opacity: var(--p);
  transition: opacity 0.2s ease-out;
}

@media (max-width: 768px) {
  .hero-shell {
    transform: translate3d(0, calc(var(--hero-progress, 0) * -20vh), 0);
    clip-path: inset(calc(var(--hero-progress, 0) * 95%) 0 0 0);
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

  // 用 .hero-shell 包裹 hero section + 滚动提示（hint 必须在 hero-shell 内部）
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