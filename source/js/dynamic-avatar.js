/* ============================================================
   Axtrivc's Blog — Dynamic Avatar Loader v2
   适配 Butterfly 主题的懒加载机制（data-lazy-src + onerror）
   ============================================================ */
(function () {
  'use strict';

  var cfg = window.AXTRIVC_SITE_CONFIG || {};
  var avatarUrl = cfg.avatar || '';
  if (!avatarUrl) return;

  function setImg(img) {
    if (!img) return;
    // 移除懒加载兜底
    img.removeAttribute('onerror');
    img.removeAttribute('data-lazy-src');
    img.removeAttribute('data-src');
    // 直接设置 src
    img.src = avatarUrl;
    // 兜底：如果设置了之后又被改回去
    var attempt = 0;
    var iv = setInterval(function () {
      if (img.src.indexOf(avatarUrl) === -1 && attempt < 5) {
        img.removeAttribute('data-lazy-src');
        img.src = avatarUrl;
        attempt++;
      } else {
        clearInterval(iv);
      }
    }, 300);
  }

  function applyAvatar() {
    // 1. Butterfly 侧边栏头像（主要位置）
    var selectors = [
      '#card-info img.avatar-img',
      '#card-info img[alt="avatar"]',
      '.card-info__avatar img',
      '.aside-content .author-info__avatar img',
      '.author-info__avatar img',
      'img.avatar-img',
      'img[alt="avatar"]'
    ];
    var seen = {};
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (img) {
        if (!seen[img]) {
          seen[img] = true;
          setImg(img);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAvatar);
  } else {
    applyAvatar();
  }

  // Butterfly 的懒加载会延迟设置 src，多次尝试覆盖
  var tries = 0;
  var iv = setInterval(function () {
    applyAvatar();
    if (++tries > 10) clearInterval(iv);
  }, 500);

  // 用 MutationObserver 监听头像元素属性变化（防止主题 JS 把 src 改回去）
  function observeAvatars() {
    var imgs = document.querySelectorAll('img.avatar-img, img[alt="avatar"], .author-info__avatar img, #card-info img');
    imgs.forEach(function (img) {
      if (img.dataset.axAvatarObserved) return;
      img.dataset.axAvatarObserved = '1';
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'data-lazy-src')) {
            // 检查是否被改回占位
            if (img.src.indexOf(avatarUrl) === -1) {
              img.removeAttribute('data-lazy-src');
              img.src = avatarUrl;
            }
          }
        });
      });
      observer.observe(img, { attributes: true, attributeFilter: ['src', 'data-lazy-src'] });
    });
  }

  // 等待 DOM 稳定后挂 observer
  setTimeout(observeAvatars, 1000);
  setTimeout(observeAvatars, 3000);
})();
