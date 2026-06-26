/* ============================================================
   Axtrivc's Blog — Music Bar (Spotify 嵌入播放器)
   从 _config.butterfly.yml 的 inject.bottom 段抽离
   ============================================================ */
(function () {
  'use strict';

  // 播放器配置（如需更换歌单，改这里）
  var SPOTIFY_PLAYLIST_ID = '6T6g0jNwBR1YLNfCO5miEo';
  var SPOTIFY_EMBED_URL = 'https://open.spotify.com/embed/playlist/' + SPOTIFY_PLAYLIST_ID + '?utm_source=generator&theme=0';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var panel = document.getElementById('music-panel');
    var embedContainer = document.getElementById('player-embed-container');
    var btnToggle = document.getElementById('btn-toggle');
    var btnClose = document.getElementById('btn-close');
    var btnBarClose = document.getElementById('btn-bar-close');
    var launcher = document.getElementById('music-launcher');
    var btnLauncher = document.getElementById('btn-launcher');
    var iconUp = document.getElementById('icon-up');
    var vinyl = document.getElementById('vinyl-icon');
    var barSub = document.querySelector('.bar-sub');
    var btnLink = document.getElementById('btn-link');

    var bar = document.getElementById('music-bar');
    if (!panel || !embedContainer || !bar) return;

    // 注入 iframe（按需构建，避免硬编码在 HTML 里）
    embedContainer.innerHTML =
      '<iframe src="' + SPOTIFY_EMBED_URL + '" height="352" frameBorder="0" ' +
      'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
      'loading="lazy" style="display:block;width:100%;border:none;border-radius:0 0 16px 16px;"></iframe>';

    // 以 DOM 实际状态为准，避免 panelOpen 变量与 UI 不同步
    function isOpen() { return panel.classList.contains('show'); }

    function openPlayer() {
      panel.classList.add('show');
      if (iconUp) iconUp.innerHTML = '<path d="M6 9l6 6 6-6"/>';
      if (barSub) barSub.textContent = '点击播放 ♪';
    }

    function closePlayer() {
      panel.classList.remove('show');
      if (iconUp) iconUp.innerHTML = '<path d="M18 15l-6-6-6 6"/>';
    }

    function togglePlayer() {
      if (isOpen()) closePlayer(); else openPlayer();
    }

    if (btnToggle) btnToggle.addEventListener('click', function (e) { e.stopPropagation(); togglePlayer(); });
    // 关闭按钮：始终执行关闭，绝不反向打开
    if (btnClose) btnClose.addEventListener('click', function (e) { e.stopPropagation(); closePlayer(); });

    // 隐藏整个音乐栏（用户主动收起） + 显示右下角迷你 launcher
    if (btnBarClose) btnBarClose.addEventListener('click', function (e) {
      e.stopPropagation();
      closePlayer();
      bar.style.display = 'none';
      document.body.style.paddingBottom = '0';
      if (launcher) launcher.hidden = false;
      try { sessionStorage.setItem('axtrivc_musicbar_hidden', '1'); } catch (_) {}
    });

    // launcher 按钮：恢复音乐栏
    if (btnLauncher) btnLauncher.addEventListener('click', function (e) {
      e.stopPropagation();
      bar.style.display = '';
      document.body.style.paddingBottom = '';
      launcher.hidden = true;
      try { sessionStorage.removeItem('axtrivc_musicbar_hidden'); } catch (_) {}
    });

    // 启动时恢复用户上次的选择（本次会话内有效）
    try {
      if (sessionStorage.getItem('axtrivc_musicbar_hidden') === '1') {
        bar.style.display = 'none';
        document.body.style.paddingBottom = '0';
        if (launcher) launcher.hidden = false;
      }
    } catch (_) {}

    // 外链按钮
    if (btnLink) {
      btnLink.addEventListener('click', function () {
        window.open('https://open.spotify.com/playlist/' + SPOTIFY_PLAYLIST_ID, '_blank');
      });
    }

    // 监听 Spotify embed 的播放状态消息
    window.addEventListener('message', function (e) {
      // 只接受 open.spotify.com 的消息
      if (typeof e.origin === 'string' && e.origin.indexOf('spotify.com') === -1) return;
      if (e.data && e.data.type === 'SPOTIFY_FRAME_MESSAGE') {
        try {
          var payload = typeof e.data.payload === 'string' ? JSON.parse(e.data.payload) : e.data.payload;
          if (payload && payload.data && payload.data.is_playing !== undefined) {
            if (payload.data.is_playing) {
              if (vinyl) { vinyl.classList.add('playing'); vinyl.textContent = '🎶'; }
              if (barSub) barSub.textContent = '正在播放...';
            } else {
              if (vinyl) { vinyl.classList.remove('playing'); vinyl.textContent = '🎵'; }
              if (barSub) barSub.textContent = '已暂停';
            }
          }
        } catch (err) {}
      }
    });

    // 点击面板与音乐栏以外的区域关闭
    document.addEventListener('click', function (e) {
      if (isOpen() && !panel.contains(e.target) && !bar.contains(e.target)) {
        closePlayer();
      }
    });
  });
})();
