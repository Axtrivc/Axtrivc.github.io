/**
 * Hero 注入：将 source/hero/ 下的 hero 区块插入到博客主页内容之前。
 *
 * 行为：
 *   - 只对主页（根 index.html）注入，不影响其他页面和分页
 *   - 注入位置：</header> 之后、<main> 之前
 *   - hero 占满首屏，下方接博客列表
 *
 * 关键设计（2026-06-23）：
 *   1. hero/index.html 的 CSS 里写了 `html, body { overflow:hidden; height:100% }`，
 *      注入到博客主页后会污染全局 html/body 导致整个页面无法滚动。
 *      解决：注入前清洗 CSS，把通用选择器改为 `.hero-page-active` 限定容器
 *   2. 给 body 添加 class `hero-page-active` 让清洗后的 CSS 生效
 *   3. Butterfly 主题的 #page-header.full_page 是首屏 banner（占 100vh），
 *      会把 hero 推到屏外。注入 JS 把 full_page 的 height/min-height 折叠到 nav 高
 *      （约 60-72px），让 hero 占满首屏
 *   4. hero 容器放在 .hero-shell 里，position:sticky 不行，用 relative 即可
 *   5. 加一行「向下滚动」的滚动提示
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

  // ── 关键清洗 ──────────────────────────────────────────
  // 1. 把 `html, body { overflow:hidden; ... }` 移除（避免污染博客全局）
  // 2. 把 `*, *::before, *::after { margin:0; padding:0 }` 移除（不重置博客页面元素）
  heroCss = heroCss
    .replace(/^\s*html,\s*body\s*\{[^}]*\}\s*$/gm, '')
    .replace(/^\s*\*,\s*\*::before,\s*\*::after\s*\{[^}]*\}\s*$/gm, '');

  // ── 注入专用 scoped 样式 ──────────────────────────────────────────
  heroCss += `
/* ── hero-inject 注入专用 scoped 样式 ── */

/* hero-shell 是 hero 的占满首屏容器，紧贴 header 下方 */
.hero-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #0E2F7E;
  margin: 0;
  padding: 0;
  z-index: 1;
}
.hero-shell > section.hero {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: #0E2F7E;
}
@media (max-width: 768px) {
  .hero-shell { height: 80vh; height: 80dvh; }
}

/* 字体 fallback（不影响其他页面） */
.hero-shell, .hero-shell * {
  font-family: -apple-system, BlinkMacSystemFont, "Inter Tight", "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 在博客主页，折叠 Butterfly 的 full_page banner 到只剩 nav 高 */
/* 让 hero-shell 紧贴 nav 下方占满首屏 */
body.hero-page-active #page-header.full_page {
  height: auto !important;
  min-height: 0 !important;
  visibility: visible;
}
body.hero-page-active #page-header.full_page #site-info,
body.hero-page-active #page-header.full_page #scroll-down {
  display: none !important;
}
body.hero-page-active #page-header.full_page #nav {
  /* nav 维持原样（顶部菜单） */
}

/* 在博客主页，让页面可以正常滚动 */
body.hero-page-active {
  overflow-x: hidden;
  overflow-y: auto;
}
`;

  const scriptMatch = heroSrc.match(/<script src="river-hero\.js"[^>]*><\/script>/);
  const heroScriptTag = scriptMatch ? scriptMatch[0].replace('src="river-hero.js"', 'src="/hero/river-hero.js?v=3"') : '';

  const afterScriptIdx = heroSrc.indexOf(heroScriptTag) + heroScriptTag.length;
  const inlineScriptMatch = heroSrc.slice(afterScriptIdx).match(/<script>[\s\S]*?<\/script>/);
  const heroInitScript = inlineScriptMatch ? inlineScriptMatch[0] : '';

  const heroStyleTag = `<style id="hero-inline-css">\n${heroCss}\n</style>`;
  let content = data.replace('</head>', heroStyleTag + '\n</head>');

  // 用 .hero-shell 包裹 hero section
  const heroWrapped = `<div class="hero-shell">\n${heroSection}\n</div>`;

  content = content.replace(
    '</header>',
    '</header>\n\n' + heroWrapped + '\n'
  );

  // 在 hero 之前插入一个滚动提示
  const scrollHint = `
<div class="hero-scroll-hint" aria-hidden="true">
  <span>↓ 向下滚动查看博客</span>
</div>
<style>
.hero-scroll-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  color: rgba(255,255,255,0.6);
  font-size: 12px;
  letter-spacing: 0.05em;
  pointer-events: none;
  animation: heroScrollHintBob 2s ease-in-out infinite;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}
@keyframes heroScrollHintBob {
  0%, 100% { transform: translate(-50%, 0); opacity: 0.55; }
  50%      { transform: translate(-50%, 6px); opacity: 1; }
}
</style>
`;

  content = content.replace(
    '<div class="hero-shell">',
    scrollHint + '<div class="hero-shell">'
  );

  const heroScripts = heroScriptTag + '\n' + heroInitScript;
  content = content.replace('</body>', heroScripts + '\n</body>');

  // 给 body 加 class hero-page-active
  content = content.replace(
    /<body([^>]*)>/,
    '<body$1 class="hero-page-active">'
  );

  hexo.log.info('[hero-inject] ✅ hero injected: ' + canonical);
  return content;
});