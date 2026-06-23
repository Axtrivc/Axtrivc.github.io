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
    var iconUp = document.getElementById('icon-up');
    var vinyl = document.getElementById('vinyl-icon');
    var barSub = document.querySelector('.bar-sub');
    var btnLink = document.getElementById('btn-link');

    if (!panel || !embedContainer) return;

    // 注入 iframe（按需构建，避免硬编码在 HTML 里）
    embedContainer.innerHTML =
      '<iframe src="' + SPOTIFY_EMBED_URL + '" height="352" frameBorder="0" ' +
      'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
      'loading="lazy" style="display:block;width:100%;border:none;border-radius:0 0 16px 16px;"></iframe>';

    var panelOpen = false;

    function togglePlayer() {
      panelOpen = !panelOpen;
      if (panelOpen) {
        panel.classList.add('show');
        if (iconUp) iconUp.innerHTML = '<path d="M6 9l6 6 6-6"/>';
        if (barSub) barSub.textContent = '点击播放 ♪';
      } else {
        panel.classList.remove('show');
        if (iconUp) iconUp.innerHTML = '<path d="M18 15l-6-6-6 6"/>';
      }
    }

    // 暴露到 window（供内联 onclick 调用）
    window.togglePlayer = togglePlayer;

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

    // 点击面板外部关闭
    document.addEventListener('click', function (e) {
      if (panelOpen && !panel.contains(e.target) && btnToggle && !btnToggle.contains(e.target)) {
        panelOpen = false;
        panel.classList.remove('show');
        if (iconUp) iconUp.innerHTML = '<path d="M18 15l-6-6-6 6"/>';
      }
    });
  });
})();
