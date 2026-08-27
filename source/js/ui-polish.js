/**
 * UI Polish — 顶部阅读进度线 + 标题日期段防断行
 * 根滚动条隐藏后(ui-polish.css 板块 A),用 3px 主题色细线承担
 * 阅读位置指示。rAF 节流,passive 监听。
 * 中文标题里"2026年8月27日 星期四"常被平衡换行拦腰截成
 * "…2026 / 年8月…"——纯 CSS 无法把日期黏成一组,这里包一层
 * white-space:nowrap 的 span。
 */
(function () {
  'use strict';

  /* ── 阅读进度线 ── */
  function initProgress() {
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

  /* ── 标题日期段防断行 ── */
  var DATE_RE = /(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:\s*星期[一二三四五六日天])?)/;
  var TITLE_SEL = [
    '.recent-post-item > .recent-post-info > .article-title',
    '#aside-content .aside-list > .aside-list-item .content > .title',
    '.article-sort-item-title'
  ].join(',');

  function protectDates() {
    document.querySelectorAll(TITLE_SEL).forEach(function (el) {
      if (el.dataset.dateGuarded) return;
      el.dataset.dateGuarded = '1';
      var node = el.firstChild;
      while (node) {
        var next = node.nextSibling;
        if (node.nodeType === 3 && DATE_RE.test(node.nodeValue)) {
          var frag = document.createDocumentFragment();
          node.nodeValue.split(DATE_RE).forEach(function (part) {
            if (!part) return;
            if (DATE_RE.test(part)) {
              var span = document.createElement('span');
              span.style.whiteSpace = 'nowrap';
              span.textContent = part.replace(/\s+/g, ' ');
              frag.appendChild(span);
            } else {
              frag.appendChild(document.createTextNode(part));
            }
          });
          el.replaceChild(frag, node);
        }
        node = next;
      }
    });
  }

  function init() {
    initProgress();
    protectDates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

