/**
 * UI Polish — 动效与版面收尾脚本
 * 1) 顶部阅读进度线(根滚动条隐藏后的阅读位置指示)
 * 2) 标题日期段防断行("2026年8月27日 星期四"不再被拦腰截断)
 * 3) 滚动入场编排(ui-polish.css 板块 I):首页卡片/侧栏卡片/分页
 *    用 IntersectionObserver 交错显现,--reveal-delay 控制同批错峰,
 *    动画结束后摘除过渡类,把 hover 过渡还给第一轮的卡片规则。
 *    入场位移走 translate 属性——theme-system.css 的
 *    transform:none !important 网格锁与 hover 抬升都不受影响。
 * 4) 侧栏头像淡入兜底:vanilla-lazyload 换图后补 loaded 类,
 *    防止 CSS 默认 opacity:0 因类名不齐而永久隐身。
 * 5) 跨页 View Transitions(ui-polish.css 板块 L):Chromium 系整页
 *    交叉淡化 + 卡片标题↔文章标题共享元素飞入,名按文章路径生成。
 * 6) 文章页头视差:#post-info 随滚动缓出下移渐隐(220px 页头内)。
 * 7) 目录百分比徽标脉冲:数值变化时轻跳一下(节流 0.9s/次)。
 * 8) 主题切换颜色过渡(板块 P):themechange 挂 html.theme-gliding 550ms。
 * 9) 文章内图片 lazyload 淡入(板块 Q):占位→真图不再跳变。
 * 全部尊重 prefers-reduced-motion;无 IntersectionObserver 直接跳过。
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

  /* ── 滚动入场编排 ── */
  var REVEAL_SEL = [
    '#recent-posts.masonry .recent-post-item',
    '#aside-content .card-widget',
    '#pagination .pagination',
    '.article-sort-title',
    '.article-sort-item',
    '.tag-cloud-list',
    '.category-lists',
    '#footer .footer-other'
  ].join(',');
  var STEP_MS = 70;   /* 同批相邻元素错峰 */
  var DUR_MS = 700;   /* 与 CSS 过渡时长(0.65s)对齐再留余量 */

  function initReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;
    var items = document.querySelectorAll(REVEAL_SEL);
    if (!items.length) return;

    /* 错峰在"进入视口的那一刻"分配:同一批出现的元素按 70ms 递增,
       与上一批间隔超过 300ms 则重新从 0 起,深处卡片滚到时不吃旧延迟 */
    var batchIndex = 0;
    var lastMark = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var now = Date.now();
        if (now - lastMark > 300) batchIndex = 0;
        lastMark = now;
        var delay = batchIndex++ * STEP_MS;
        el.style.setProperty('--reveal-delay', delay + 'ms');
        el.classList.add('ui-revealed');
        window.setTimeout(function () {
          el.classList.remove('ui-reveal', 'ui-revealed');
          el.style.removeProperty('--reveal-delay');
        }, DUR_MS + delay);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el) {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = '1';
      el.classList.add('ui-reveal');
      io.observe(el);
    });
  }

  /* ── 侧栏头像淡入兜底 ── */
  function initAvatarFade() {
    document.querySelectorAll('#aside-content .avatar-img img').forEach(function (img) {
      if (img.dataset.fadeBound) return;
      img.dataset.fadeBound = '1';
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('loaded');
        return;
      }
      img.addEventListener('load', function () { img.classList.add('loaded'); });
      img.addEventListener('error', function () { img.classList.add('error'); });
    });
  }

  /* ── 跨页 View Transitions:卡片标题 ↔ 文章标题共享元素 ──
     名按文章路径生成,列表页与文章页两侧算法一致才能配对;
     中文 slug 的 % 编码字符不是合法 CSS ident,剥掉 % 后
     (E8%A5%BF → E8A5BF)既合法又不撞名。只命名主列表卡片,
     侧栏"最新文章"不命名——同页两个同名会让整个过渡被跳过。 */
  function vtSlug(pathname) {
    return pathname.replace(/^\/+|\/+$/g, '').replace(/\//g, '-').replace(/%/g, '');
  }
  function initViewTransitions() {
    if (!('viewTransitionName' in document.documentElement.style)) return;
    document.querySelectorAll('#recent-posts .article-title[href]').forEach(function (a) {
      try { a.style.viewTransitionName = 'post-' + vtSlug(new URL(a.href).pathname); } catch (e) {}
    });
    var pt = document.querySelector('#post-info .post-title');
    if (pt) pt.style.viewTransitionName = 'post-' + vtSlug(location.pathname);
  }

  /* ── 文章页头视差:标题随滚动缓出(220px 页头内渐隐下移) ── */
  function initPostHeaderParallax() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var header = document.getElementById('page-header');
    var info = document.getElementById('post-info');
    if (!header || !info || !/\bpost-bg\b/.test(header.className)) return;
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || 0;
      var h = header.offsetHeight || 220;
      if (y > h) return;
      info.style.transform = 'translate3d(0,' + (y * 0.35).toFixed(1) + 'px,0)';
      info.style.opacity = Math.max(0, 1 - y / (h * 0.85)).toFixed(3);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ── 目录百分比徽标脉冲(数值变化时,节流到 0.9s/次) ── */
  function initTocPulse() {
    if (!('MutationObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var badge = document.querySelector('#aside-content #card-toc .toc-percentage');
    if (!badge) return;
    var last = badge.textContent, lastPulse = 0, t = null;
    new MutationObserver(function () {
      if (badge.textContent === last) return;
      last = badge.textContent;
      var now = Date.now();
      if (now - lastPulse < 900) return;
      lastPulse = now;
      badge.classList.remove('toc-pulse');
      void badge.offsetWidth;           /* 重启动画 */
      badge.classList.add('toc-pulse');
      clearTimeout(t);
      t = setTimeout(function () { badge.classList.remove('toc-pulse'); }, 650);
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  /* ── 主题切换颜色过渡:themechange 时挂 html.theme-gliding ~550ms,
     CSS(板块 P)接管大表面的 background/border/color 过渡,消除硬切 ── */
  function initThemeGlide() {
    var t = null;
    window.addEventListener('themechange', function () {
      var root = document.documentElement;
      root.classList.add('theme-gliding');
      clearTimeout(t);
      t = setTimeout(function () { root.classList.remove('theme-gliding'); }, 550);
    });
  }

  /* ── 文章内图片 lazyload 淡入:占位阶段挂 ui-img-wait(opacity:0),
     真图 load 后换 ui-img-done 播一次淡入。已缓存(complete)的不动,
     避免二次闪烁;只碰 opacity,不干预 vanilla-lazyload 的换图逻辑 ── */
  function initArticleImgFade() {
    document.querySelectorAll('#article-container img[data-lazy-src]').forEach(function (img) {
      if (img.dataset.imgFadeBound) return;
      img.dataset.imgFadeBound = '1';
      if (img.complete && img.naturalWidth > 1) return;   /* 已是真图 */
      img.classList.add('ui-img-wait');
      img.addEventListener('load', function () {
        if (img.naturalWidth <= 1) return;                /* 仍是 1x1 占位 */
        img.classList.remove('ui-img-wait');
        img.classList.add('ui-img-done');
      });
    });
  }

  function init() {
    initProgress();
    protectDates();
    initReveal();
    initAvatarFade();
    initViewTransitions();
    initPostHeaderParallax();
    initTocPulse();
    initThemeGlide();
    initArticleImgFade();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
