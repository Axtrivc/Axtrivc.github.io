/* ============================================================
   Axtrivc's Blog — Birthday Countdown
   从 _config.butterfly.yml 的 inject.bottom 段抽离
   只在首页展示
   ============================================================ */
(function () {
  'use strict';

  // 生日日期配置（如需修改，改这里）
  var BDAY_MONTH = 5;  // 1-12
  var BDAY_DAY = 12;   // 1-31

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // 只在首页展示
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;

    var now = new Date();
    var isToday = (now.getMonth() === BDAY_MONTH - 1 && now.getDate() === BDAY_DAY);

    var card = document.createElement('div');
    card.className = 'bday-countdown' + (isToday ? ' today' : '');

    if (isToday) {
      card.innerHTML =
        '<div class="bday-emoji">🎂🎉</div>' +
        '<div class="bday-name">今天是 Axtrivc 的生日！</div>' +
        '<div class="bday-date">5月12日 · Happy Birthday!</div>';
    } else {
      card.innerHTML =
        '<div class="bday-emoji">🎂</div>' +
        '<div class="bday-label">BIRTHDAY COUNTDOWN</div>' +
        '<div class="bday-name">Axtrivc 的生日</div>' +
        '<div class="bday-grid">' +
          '<div class="bday-num"><span class="num" id="bday-d">00</span><span class="unit">天</span></div>' +
          '<div class="bday-num"><span class="num" id="bday-h">00</span><span class="unit">时</span></div>' +
          '<div class="bday-num"><span class="num" id="bday-m">00</span><span class="unit">分</span></div>' +
          '<div class="bday-num"><span class="num" id="bday-s">00</span><span class="unit">秒</span></div>' +
        '</div>' +
        '<div class="bday-date">' + BDAY_MONTH + '月' + BDAY_DAY + '日</div>';
    }

    var posts = document.getElementById('recent-posts');
    var postItems = document.querySelector('.recent-post-items');
    if (posts && postItems) {
      posts.insertBefore(card, postItems);
    } else if (posts) {
      posts.insertBefore(card, posts.firstChild);
    }

    if (!isToday) {
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      function tick() {
        var n = new Date();
        var nx = new Date(n.getFullYear(), BDAY_MONTH - 1, BDAY_DAY);
        if (nx <= n) nx = new Date(n.getFullYear() + 1, BDAY_MONTH - 1, BDAY_DAY);
        var d = nx - n;
        var dd = Math.floor(d / 86400000);
        var hh = Math.floor((d % 86400000) / 3600000);
        var mm = Math.floor((d % 3600000) / 60000);
        var ss = Math.floor((d % 60000) / 1000);
        var ed = document.getElementById('bday-d');
        var eh = document.getElementById('bday-h');
        var em = document.getElementById('bday-m');
        var es = document.getElementById('bday-s');
        if (ed) ed.textContent = pad(dd);
        if (eh) eh.textContent = pad(hh);
        if (em) em.textContent = pad(mm);
        if (es) es.textContent = pad(ss);
      }
      tick();
      // 用 pjax:complete 时不重启 interval，保持简单
      setInterval(tick, 1000);
    }
  });
})();
