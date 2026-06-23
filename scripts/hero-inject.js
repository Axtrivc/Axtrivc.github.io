/**
 * Hero 注入：将 source/hero/ 下的 hero 区块插入到博客主页内容之前。
 *
 * 行为：
 *   - 只对主页（根 index.html）注入，不影响其他页面和分页
 *   - 注入位置：</header> 之后、<main> 之前
 *   - hero 占满首屏（PC + 移动端均为 100dvh），下方接博客列表
 *
 * 关键设计（2026-06-23 v7 「弹簧蓄力→爆裂释放」重构）：
 *   1. CSS 清洗：去除 hero/index.html 的 html, body 通用选择器
 *   2. body.hero-page-active 激活注入的样式
 *   3. 删除首页的浮动播放器 / 右下角按钮 / 侧边栏 widget
 *      → 满屏 hero + 顶部 nav 是唯一的首屏
 *   4. **弹簧蓄力→爆裂释放转场**（两段式 + easeOutExpo）：
 *
 *        raw     = scrollY / innerHeight        (0→1)
 *        spring  = sin(raw × π / 2)             (0→1, 起步慢中段快)
 *        pin     = min(raw / 0.45, 1)            (蓄力段 0→1)
 *        release = max((raw - 0.45) / 0.55, 0)  (释放段 0→1)
 *        ease    = 1 - (1 - release)^3          (easeOutExpo)
 *        visual  = pin < 1
 *                  ? easeInQuad(pin) × 0.22
 *                  : 0.22 + ease × 0.78
 *
 *      ┌────────── 蓄力段 (raw ∈ [0, 0.45]) ──────────┐
 *      │ hero 被往下"压"：translateY 0 → +7vh           │
 *      │ scale 1.0 → 1.08（视觉上"被压扁的鼓胀"）       │
 *      │ 文字缩小 → 1.04（被压紧）                       │
 *      │ 蓄力视觉进度 0 → 0.22（曲线前慢后快）          │
 *      └────────────────────────────────────────────┘
 *                              ↓
 *                      raw = 0.45 临界点
 *                              ↓
 *      ┌────────── 释放段 (raw ∈ [0.45, 1]) ──────────┐
 *      │ easeOutExpo：前 15% 缓慢，后 85% 急速        │
 *      │ hero 急速向上飞 → -200vh                      │
 *      │ 文字散开 ±25vh + 飞走 -60vh                    │
 *      │ 博客 main 从 +100vh 滑入                       │
 *      │ 颜色恢复、透明度 1                              │
 *      └────────────────────────────────────────────┘
 *
 *      ❌ 无 CSS filter / SVG filter / mix-blend-mode / glitch bar
 *      ❌ 无 will-change（除 canvas 自身）+ 无 transition
 *      ✅ 仅 transform: translate3d + scale + opacity → GPU 合成器原生
 *
 *   5. 移动端：100dvh 全屏，隐藏侧边进度条，简化底部提示
 *
 * JS ↔ CSS 通信：scroll listener 计算所有中间值（raw/spring/pin/release/ease/visual）
 * 直接 setProperty 到 :root，CSS 只引用变量，不再算数学。
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
    .replace(/^\s*\*,\s*\*::before,\s\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ── 注入专用 scoped 样式 ──
  heroCss += `
/* ─────────── hero-inject scoped CSS v6 ─────────── */

/* hero-shell：占满整个首屏（hero 阶段连 nav 都隐藏）
 * z-index 提到 1000 覆盖 Butterfly nav（默认 z-index: 100~200） */
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
 * 「弹簧蓄力→爆裂释放」v7 转场（2026-06-23 重构）
 *
 * JS 写入的变量（scroll listener 在 :root 上更新）：
 *   --hero-raw      实际滚动量 0→1 (scrollY/innerHeight)
 *   --hero-visual   视觉进度 0→1 (蓄力 + 释放曲线，已计算好)
 *   --hero-pin      蓄力段进度 0→1 (0~0.45, easeInQuad 曲线)
 *   --hero-release  释放段原始进度 0→1 (0.45~1.00, 线性)
 *   --hero-easeout  释放段 easeOutExpo 输出 0→1
 *   --hero-spring   蓄力段 easeInQuad 输出 0→0.22
 *
 * 两段效果：
 *   - raw ∈ [0, 0.45]    → 蓄力：被"压"向下（+7vh）、鼓胀 scale 1.08、暗化
 *                          文字稍微压紧（缩 1.04）、蓄能到 22%
 *   - raw ∈ [0.45, 1.00] → 释放：easeOutExpo 前慢后快、急速飞走 -200vh
 *                          文字散开 ±25vh + 飞走 -60vh、博客从 +100vh 滑入
 *
 * 性能铁律（v3→v4→v5→v6 经验）：
 *   ❌ 不在 hero-shell 上用 CSS filter / SVG filter
 *   ❌ 不 mix-blend-mode: overlay/screen + 多层叠加
 *   ❌ 不给装饰元素加 will-change: transform
 *   ✅ 只用 transform: translate3d + scale + opacity
 *   ✅ canvas 单独加 translateZ(0) 锁独立 GPU 层
 *   ✅ 0 transition → 滚动 100% 跟手
 * ───────────────────────────────────────────────── */

/* ── 主体：两段独立控制 ──
 * 蓄力段（visual 0→0.22, pin 0→1）：
 *   translateY 0 → +7vh（被往下压）
 *   scale 1.0 → 1.08（鼓胀感）
 *
 * 释放段（visual 0.22→1, ease 0→1）：
 *   translateY +7vh → -200vh（先快后慢冲到屏幕外）
 *   scale 1.08 → 1.0（恢复原状）
 *
 * 用 --hero-pin 和 --hero-easeout 两个变量分开表达：
 *   pin 0→1 时 shell translateY = pin × 7vh（向下）
 *   release 段：shell translateY = 7vh + ease × (-207vh) = 7vh - 207vh × ease
 *   合并：shell translateY = pin × 7vh - ease × 207vh
 */
.hero-shell {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  /* 视觉进度控制透明度：蓄力段基本不淡（保持 0.85），释放段急速淡出 */
  opacity: calc(0.88 - var(--ease) * 1.0);
  /* 蓄力往下 + 释放往上飞出 */
  transform: translate3d(
    0,
    calc(var(--pin) * 7vh - var(--ease) * 207vh),
    0
  );
  /* 蓄力段鼓胀（scale 1.0→1.08），释放段恢复（1.08→1.0） */
  /* scale 用两段组合：pin 段 1.0 + pin × 0.08，释放段减 ease × 0.08 */
}

/* hero 内部 section：蓄力时被压紧 scale 1→1.08（鼓胀），释放段恢复 1.0
 * 用 hero-shell 的 pin 和 ease 单独驱动 */
.hero-shell > section.hero {
  --pin: var(--hero-pin, 0);
  --ease: var(--hero-easeout, 0);
  transform: scale(calc(1.0 + var(--pin) * 0.08 - var(--ease) * 0.08));
  transform-origin: center center;
}

/* ── 博客内容：紧跟 hero 后面（z-index 1100，高于 hero-shell 1000）
 * v7 改进：让 main 跟随 visual 提前进入屏幕，避免 hero 飞出后到 main 到位之间的空白
 *   visual=0     → ty=+100vh (main 在 200dvh，屏幕外底)
 *   visual=0.30  → ty=+40vh  (main 进入屏幕 40vh = 约 40%)
 *   visual=0.50  → ty=0      (main 抵达屏幕底)
 *   visual=1.00  → ty=-100vh (main 在屏幕顶 = 正常位置)
 */
body.hero-page-active #content-inner,
body.hero-page-active .layout,
body.hero-page-active main {
  --p: var(--hero-visual, 0);
  position: relative;
  z-index: 1100;
  margin-top: 100dvh;
  background: #faf8f5;
  box-shadow: 0 -16px 40px rgba(0, 0, 0, 0.08);
  /* main 跟随 visual 提前进入屏幕（关键：让 main 在 hero 完全飞出的同一时间进入） */
  transform: translate3d(0, calc((0.5 - var(--p)) * 200vh), 0);
  /* 同步淡入：visual ≥ 0.05 后开始显示 */
  opacity: clamp((var(--p) - 0.05) * 1.3, 0, 1);
}

/* ── 「首页净化 v7」：hero 阶段完全隐藏 nav + 播放器 + 按钮 ──
 * 释放段 visual ≥ 0.85 时这些元素淡入回正常状态（保留转场连续性）。
 * 用 --hero-visual 控制淡入时机：
 *   - visual ∈ [0, 0.85]  → opacity 0（hero 期间纯净）
 *   - visual ∈ [0.85, 1.00] → 0 → 1 渐显（释放完成时主页元素平滑回归）
 * 注：hero-shell z-index 已经 1000 覆盖 nav 本身，
 *     opacity 仅作为保险（防止 nav 的 fixed 定位浮在 hero-shell 上面）。 */
body.hero-page-active #page-header.full_page,
body.hero-page-active #page-header.full_page #nav,
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down,
body.hero-page-active #nav,
body.hero-page-active #menus,
body.hero-page-active #blog-info {
  --purge-progress: calc((var(--hero-visual, 0) - 0.85) / 0.15);
  opacity: clamp(var(--purge-progress), 0, 1);
  pointer-events: none;
  transition: none; /* 完全跟手，不延迟 */
}

/* ─────────────────────────────────────────────────
 * 「首页净化 v7」：去掉浮动播放器 + 右下角按钮
 * 注意：#sidebar 是左侧抽屉菜单（导航用），保留
 * 注意：#aside 是文章页右侧 widget（主页本来就没有）
 * ───────────────────────────────────────────────── */
body.hero-page-active #music-bar,
body.hero-page-active #music-panel,
body.hero-page-active #rightside,
body.hero-page-active #go-up,
body.hero-page-active #rightside-config,
body.hero-page-active #aside {
  display: none !important;
}

body.hero-page-active {
  overflow-x: hidden;
  overflow-y: auto;
}

/* ── 右侧滚动进度导轨（PC only）：蓄力段缓慢填充，释放段快速清空 ──
 * z-index 1500 确保在 hero-shell (1000) 和 main (1100) 之上 */
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
  /* 颜色渐变：蓄力段颜色淡（蓄能），释放段颜色深（释放）
   * 用两段固定颜色的 gradient + opacity 控制整体浓度
   */
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
  /* 蓄力段可见（pin 0→1 → 透明度 0.5→1），释放后消失 */
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
 * 蓄力段（visual 0→0.22）：translateY 0 → -2vh（轻微上浮，像被弹簧拉起），opacity 略降
 * 释放段（visual 0.22→1）：translateY -2vh → -60vh（急速飞出），横向 ±25vh 散开
 *   用 easeout 驱动：ty = -2vh - ease × 58vh，横向偏移 = ease × 25vh × direction
 *   实际：ty = pin × (-2vh) - ease × 58vh
 *         tx = ease × 25vh（文字会水平散开）
 *
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
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=7"') : '';

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

  // 滚动驱动 JS：rAF 节流 + 蓄力释放数学
  const scrollDriverJs = `
<script>
(function() {
  var rafId = null;
  var html = document.documentElement;

  // easeOutExpo：t=0→1 时，曲线开始很快、后端渐近 1（爆裂感）
  function easeOutExpo(t) {
    return t >= 1 ? 1 : (1 - Math.pow(1 - t, 3));
  }
  // easeInQuad：t=0→1 时，曲线开始慢、后端快（蓄力感）
  function easeInQuad(t) {
    return t * t;
  }

  // 分段函数：raw ∈ [0, 0.45] 蓄力；raw ∈ [0.45, 1] 释放
  function computeVisual(raw) {
    if (raw <= 0.45) {
      // 蓄力段：easeInQuad 0 → 0.22（起步慢，中段开始加速，最后 22% 蓄满）
      return easeInQuad(raw / 0.45) * 0.22;
    }
    // 释放段：easeOutExpo 0.22 → 1.0（前 15% 缓慢，后 85% 急速）
    return 0.22 + easeOutExpo((raw - 0.45) / 0.55) * 0.78;
  }

  function update() {
    if (rafId) return;
    rafId = requestAnimationFrame(function() {
      var heroH = window.innerHeight;
      // 调试支持：?raw=0.5 URL 参数直接定位滚动位置（用于截图）
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
      var pin = Math.min(raw / 0.45, 1);
      var release = Math.max((raw - 0.45) / 0.55, 0);
      var easeOut = easeOutExpo(release);
      var spring = easeInQuad(pin);

      html.style.setProperty('--hero-raw', raw.toFixed(4));
      html.style.setProperty('--hero-visual', visual.toFixed(4));
      html.style.setProperty('--hero-pin', pin.toFixed(4));
      html.style.setProperty('--hero-release', release.toFixed(4));
      html.style.setProperty('--hero-easeout', easeOut.toFixed(4));
      html.style.setProperty('--hero-spring', spring.toFixed(4));

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

  hexo.log.info('[hero-inject] ✅ v7 「弹簧蓄力→爆裂释放」重构完成: ' + canonical);
  return content;
});