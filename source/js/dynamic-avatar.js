/* ============================================================
   Axtrivc's Blog — Dynamic Avatar Loader v3
   适配 Butterfly 主题的懒加载机制（data-lazy-src + onerror）
   v3 修复：
   - observer 无限循环（用 dataset 标记 + 规范化 URL 比较）
   - 多 selector 命中同一元素（用 WeakSet 去重）
   - 定时器泄漏（成功后立即清理）
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.AXTRIVC_SITE_CONFIG || {};
  var avatarUrl = cfg.avatar || '';
  if (!avatarUrl) return;

  // 把相对 URL 规范化为绝对 URL，便于比较
  function normalizeUrl(u) {
    try { return new URL(u, location.origin).href; } catch (e) { return u; }
  }
  var avatarAbs = normalizeUrl(avatarUrl);

  // 标记是否已成功设置过
  var applied = new WeakSet();

  function setImg(img) {
    if (!img || applied.has(img)) return;
    // 移除懒加载兜底
    img.removeAttribute('onerror');
    img.removeAttribute('data-lazy-src');
    img.removeAttribute('data-src');
    // 直接设置 src
    img.src = avatarUrl;
    applied.add(img);
    img.dataset.axAvatar = 'applied';
  }

  function applyAvatar() {
    var selectors = [
      '#card-info img.avatar-img',
      '#card-info img[alt="avatar"]',
      '.card-info__avatar img',
      '.aside-content .author-info__avatar img',
      '.author-info__avatar img',
      'img.avatar-img',
      'img[alt="avatar"]'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (img) {
        setImg(img);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAvatar);
  } else {
    applyAvatar();
  }

  // Butterfly 懒加载会延迟设置 src，做有限的几次重试
  var tries = 0;
  var iv = setInterval(function () {
    applyAvatar();
    if (++tries > 6) clearInterval(iv);
  }, 500);

  // 用单个 MutationObserver 监听整个 body 的图片变化（避免每个 img 挂一个 observer）
  function setupObserver() {
    if (window.__axAvatarObserver) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        // 属性变化：检查是不是头像被改回占位
        if (m.type === 'attributes' && m.target && m.target.tagName === 'IMG') {
          var img = m.target;
          if (!img.matches('img.avatar-img, img[alt="avatar"], .author-info__avatar img, #card-info img')) return;
          // 用规范化后的 URL 比较，避免相对/绝对不一致
          var currentAbs = normalizeUrl(img.src);
          if (currentAbs !== avatarAbs) {
            img.removeAttribute('data-lazy-src');
            img.src = avatarUrl;
          }
        }
        // 新增节点：可能是懒加载刚插入的头像
        if (m.type === 'childList' && m.addedNodes) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType === 1 && node.querySelector) {
              applyAvatar();
            }
          });
        }
      });
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['src', 'data-lazy-src'],
      subtree: true,
      childList: true
    });
    window.__axAvatarObserver = observer;
  }

  // 等待 DOM 稳定后挂 observer
  setTimeout(setupObserver, 1000);
})();
