/* ============================================================
   Axtrivc's Blog — Floating Publish Button
   右下角浮动 + 号，点击展开三个发布入口
   ============================================================ */
(function () {
  'use strict';

  if (window.__axtrivcPublishFab) return;
  window.__axtrivcPublishFab = true;

  // 不在 admin 页面显示
  if (location.pathname.indexOf('/admin') === 0) return;

  var ADMIN_BASE = '/admin/#/collections/';
  var OPTIONS = [
    { icon: 'fa-pen-fancy', label: '文章', url: ADMIN_BASE + 'posts/new', color: '#07C160' },
    { icon: 'fa-image', label: '图片', url: ADMIN_BASE + 'posts/new', color: '#2A8FE0' },
    { icon: 'fa-video', label: '视频', url: ADMIN_BASE + 'posts/new', color: '#E0562A' },
    // 返回顶部（弥补 hide-rightside.css 删掉原生按钮的缺失）
    { icon: 'fa-arrow-up', label: '顶部', action: 'scrollTop', color: '#8B6F47' }
  ];

  // 等待 body 可用
  function init() {
    if (!document.body) { setTimeout(init, 50); return; }

    var container = document.createElement('div');
    container.id = 'axtrivc-fab';
    container.innerHTML = ''
      + '<button class="fab-main" type="button" aria-label="发布文章">'
      + '<i class="fas fa-plus"></i>'
      + '</button>'
      + '<div class="fab-menu" aria-hidden="true">'
      + OPTIONS.map(function (o, i) {
          // 顶部按钮用 <button>，其他用 <a>
          if (o.action === 'scrollTop') {
            return ''
              + '<button class="fab-item fab-item-btn" type="button" data-action="' + o.action + '" data-idx="' + i + '">'
              + '<span class="fab-item-label">' + o.label + '</span>'
              + '<span class="fab-item-icon" style="background:' + o.color + '">'
              + '<i class="fas ' + o.icon + '"></i>'
              + '</span>'
              + '</button>';
          }
          return ''
            + '<a class="fab-item" href="' + o.url + '" data-idx="' + i + '">'
            + '<span class="fab-item-label">' + o.label + '</span>'
            + '<span class="fab-item-icon" style="background:' + o.color + '">'
            + '<i class="fas ' + o.icon + '"></i>'
            + '</span>'
            + '</a>';
        }).join('')
      + '</div>';

    document.body.appendChild(container);

    // 交互：点击主按钮展开/收起
    var main = container.querySelector('.fab-main');
    var menu = container.querySelector('.fab-menu');
    var isOpen = false;

    function open() {
      isOpen = true;
      container.classList.add('open');
      main.innerHTML = '<i class="fas fa-times"></i>';
      main.setAttribute('aria-expanded', 'true');
    }
    function close() {
      isOpen = false;
      container.classList.remove('open');
      main.innerHTML = '<i class="fas fa-plus"></i>';
      main.setAttribute('aria-expanded', 'false');
    }
    function toggle() { isOpen ? close() : open(); }

    main.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // 点击外部收起
    document.addEventListener('click', function (e) {
      if (isOpen && !container.contains(e.target)) close();
    });

    // 键盘 ESC 收起
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close();
    });

    // 处理特殊 action（返回顶部等）
    container.querySelectorAll('.fab-item-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var action = btn.getAttribute('data-action');
        if (action === 'scrollTop') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        close();
      });
    });

    // 跳转类子项直接走默认行为
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
