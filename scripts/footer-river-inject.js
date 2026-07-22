/**
 * Footer River 注入器
 *
 * 在博客 footer 底部 (.footer-other 之后) 注入 river.ai 风格的水流 canvas,
 * "© 2026 By ɐ ℒℯℯ" copyright 文字浮在水面上。
 *
 * - canvas: 多层正弦波 + 点击涟漪 + 鼠标扰动
 * - 颜色: 全主题适配(footer/提示文字/copyright 均跟随 --footer-* CSS 变量,
 *   波浪与画布渐变色在 axtrivc-river.js 内按主题切换)
 * - IntersectionObserver: 只在视口内才动画
 * - 不修改 butterfly 模板,纯 after_render:html 注入
 */
hexo.extend.filter.register('after_render:html', function (data) {
  if (!data || typeof data !== 'string') return data;

  // 只在有 footer 的页面注入(排除 admin/rss 等)
  var footerIdx = data.indexOf('<footer');
  if (footerIdx === -1) return data;
  var closingFooterIdx = data.indexOf('</footer>', footerIdx);
  if (closingFooterIdx === -1) return data;

  // 跳过 /admin/ CMS 页面
  if (data.indexOf('id="nc-root"') !== -1) return data;
  if (data.indexOf('DecapCMS') !== -1) return data;

  var css = `
<style id="axtrivc-river-css">
/* ── Footer 整体改造: 背景跟随主题, river 无缝融合 ──
 * #footer 默认白色背景($light-blue), 改为主题 footer 色(--footer-bg)
 * river-stage 无圆角, 直接衔接 footer 底部, 形成一体感
 */

/* ① footer 背景 = 页面色 → footer 色的连续渐变(--page-bg/--footer-bg 由
 *    theme-system.js 按主题设置), 与上方内容区和下方 river 都无色阶断点;
 *    padding-bottom=0 让 river 紧贴底边 */
#footer {
  background: linear-gradient(180deg,
    var(--page-bg, #ffffff) 0%,
    var(--footer-bg, #faf8f5) 100%) !important;
  padding-bottom: 0 !important;
}
/* ── Footer River Stage ──
 * 无圆角, 与 footer 融为一体: 渐变起点直接用 --footer-bg(= footer 底部颜色),
 * 保证 footer → river 衔接处零色差, 再向下过渡到 mid/bottom 水色。
 * river 在 footer 内部紧贴底边, 由 body padding-bottom 把 footer 抬到 music-bar 顶部 */
.footer-other {
  background-color: transparent !important;
  padding-top: 16px !important;
  padding-bottom: 0 !important;
}
.axtrivc-river-stage {
  position: relative;
  width: 100%;
  height: 140px;
  margin-top: 0;
  margin-bottom: 0;
  padding-top: 0;
  /* 四段渐进: footer 底色先稳一段, 再缓慢过渡到 mid/bottom 水色,
   * 消除 footer → river 衔接处的色带感 */
  background: linear-gradient(180deg,
    var(--footer-bg, #faf8f5) 0%,
    var(--footer-river-top, #efe8dc) 28%,
    var(--footer-river-mid, #e8d9c0) 62%,
    var(--footer-river-bottom, #d4bc96) 100%);
  overflow: hidden;
  cursor: crosshair;
}
.axtrivc-river-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
  /* 水色与波纹从上方"浮现": canvas 顶部 38% 渐隐,
   * 与 stage 背景渐变叠加, footer → river 无可见分界线(2026-07-22 v2) */
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 38%);
  mask-image: linear-gradient(180deg, transparent 0%, #000 38%);
}
.axtrivc-river-hint {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 2;
  color: var(--footer-river-hint, rgba(120, 90, 55, 0.65));
  font-size: 12px;
  font-weight: 300;
  letter-spacing: 0.05em;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
/* ── Copyright 跟波纹线条融合 ──
 * 位置从中央 50% 下移到 72%, 跟中前层波纹(yOff 0.70/0.78)重叠
 * 文字穿插在波纹中, 像漂浮在水里, 不再孤立在上方
 * 颜色淡化: 0.75 → 0.5, 让波纹成为视觉主角
 */
.axtrivc-copyright {
  position: absolute;
  top: 72%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  z-index: 10;
  text-align: center;
  font-family: "Noto Serif SC", "PingFang SC", "Microsoft YaHei", serif;
  font-size: 13px;
  font-weight: 300;
  letter-spacing: 0.08em;
  color: var(--footer-river-text, rgba(70, 50, 25, 0.5));
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.4);
  pointer-events: none;
  user-select: none;
}
/* 隐藏原 butterfly copyright (已在 river 里显示) */
body .footer-other > .footer-copyright { display: none !important; }
/* 移动端缩小 */
@media (max-width: 768px) {
  .axtrivc-river-stage {
    height: 105px;
    padding-top: 0;
    margin-bottom: 0;
  }
  .axtrivc-river-hint {
    font-size: 11px;
    top: 8px;
    right: 12px;
  }
  .axtrivc-copyright {
    font-size: 12px;
  }
}

/* ② 防止上滑白屏: html 底部用主题 footer 色兜底(overscroll 时与 river 衔接);
 *    body 用页面色 --page-bg — 内容列两侧边距与页面同色,
 *    避免 footer 顶部交界处出现 边距/footer/内容列/river 四色拼接 */
html {
  background-color: var(--footer-bg, #faf8f5) !important;
}
body {
  background-color: var(--page-bg, #ffffff) !important;
}
</style>
`;

  var html = `
<div class="axtrivc-river-stage" id="axtrivcRiverStage" role="img" aria-label="一片可以点击泛起涟漪的水面">
  <span class="axtrivc-river-hint">点击水面 →</span>
  <canvas id="axtrivcRiverCanvas"></canvas>
  <span class="axtrivc-copyright">&copy; 2026 By &nbsp;ɐ&thinsp;ℒℯℯ</span>
</div>
`;

  var js = `
<script src="/js/axtrivc-river.js?v=3"></script>
`;

  // CSS 注入到 </head> 前
  data = data.replace('</head>', css + '\n</head>');

  // HTML 注入到 </footer> 前(放在 footer 内部, copyright 下方)
  data = data.replace('</footer>', html + '\n</footer>');

  // JS 注入到 </body> 前
  data = data.replace('</body>', js + '\n</body>');

  return data;
});
