/**
 * UI Polish — 顶部阅读进度线
 * 根滚动条隐藏后(ui-polish.css 板块 A),用 3px 主题色细线承担
 * 阅读位置指示。rAF 节流,passive 监听。
 */
(function () {
  'use strict';

  function init() {
    if (document.getElementById('scroll-progress')) return;
    var bar = document.createElement('div');
    bar.id = 'scroll-progress';
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (max <= 0) { bar.style.width = '0'; return; }
      var y = h.scrollTop || document.body.scrollTop || 0;
      bar.style.width = Math.min(100, (y / max) * 100) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
