/* ============================================================
   Axtrivc's Blog — Dynamic Avatar Loader
   从 source/_data/site_config.yml 读取管理员上传的头像
   ============================================================ */
(function () {
  'use strict';

  // 站点配置数据（由 Hexo 注入）
  var cfg = window.AXTRIVC_SITE_CONFIG || {};
  var avatarUrl = cfg.avatar || '';

  if (!avatarUrl) return;

  function applyAvatar() {
    // 桌面端侧边栏头像
    var sidebarAvatar = document.querySelector('.aside-content .author-info__avatar img, #card-info img.avatar, .card-info__avatar img');
    if (sidebarAvatar) {
      sidebarAvatar.src = avatarUrl;
      sidebarAvatar.removeAttribute('onerror');
    }

    // 其他可能存在的头像位置
    var all = document.querySelectorAll('img.avatar, .avatar img');
    all.forEach(function (img) {
      if (img.src !== avatarUrl) img.src = avatarUrl;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAvatar);
  } else {
    applyAvatar();
  }

  // Butterfly 主题有时会延迟加载头像，多次尝试
  var tries = 0;
  var iv = setInterval(function () {
    applyAvatar();
    if (++tries > 8) clearInterval(iv);
  }, 500);
})();
