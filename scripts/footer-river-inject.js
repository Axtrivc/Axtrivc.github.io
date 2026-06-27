/**
 * Footer River 注入器
 *
 * 在博客 footer 底部 (.footer-other 之后) 注入 river.ai 风格的水流 canvas,
 * 放在 "© 2026 By ɐ ℒℯℯ" copyright 文字所在区域。
 *
 * - canvas: 多层正弦波 + 点击涟漪 + 鼠标扰动
 * - 颜色: 深蓝 #0E2F7E(与 hero 呼应)
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
/* ── Footer River Stage ──
 * 放在 .footer-other 之后, footer 底部
 * 深蓝水面带, 高度 120px, 圆角顶部
 */
.axtrivc-river-stage {
  position: relative;
  width: 100%;
  height: 120px;
  margin-top: 24px;
  background: linear-gradient(180deg, #0E2F7E 0%, #081C50 100%);
  overflow: hidden;
  cursor: crosshair;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
.axtrivc-river-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.axtrivc-river-hint {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 2;
  color: rgba(242, 233, 214, 0.7);
  font-size: 12px;
  font-weight: 300;
  letter-spacing: 0.05em;
  pointer-events: none;
  transition: opacity 0.6s ease;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
/* 移动端缩小 */
@media (max-width: 768px) {
  .axtrivc-river-stage {
    height: 90px;
    margin-top: 16px;
  }
  .axtrivc-river-hint {
    font-size: 11px;
    top: 8px;
    right: 12px;
  }
}
</style>
`;

  var html = `
<div class="axtrivc-river-stage" id="axtrivcRiverStage" role="img" aria-label="一片可以点击泛起涟漪的水面">
  <span class="axtrivc-river-hint">点击水面 →</span>
  <canvas id="axtrivcRiverCanvas"></canvas>
</div>
`;

  var js = `
<script src="/js/axtrivc-river.js?v=1"></script>
`;

  // CSS 注入到 </head> 前
  data = data.replace('</head>', css + '\n</head>');

  // HTML 注入到 </footer> 前(放在 footer 内部, copyright 下方)
  data = data.replace('</footer>', html + '\n</footer>');

  // JS 注入到 </body> 前
  data = data.replace('</body>', js + '\n</body>');

  return data;
});
