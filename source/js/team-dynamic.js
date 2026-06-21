/* ============================================================
   Axtrivc's Blog — Team Page Dynamic Module
   通用：新闻流 + 自动刷新 + 相对时间 + XSS 防护
   三支球队页共用（barcelona / miami / spain）
   数据源：ESPN site API（支持 CORS，免费）
   ============================================================ */
(function (global) {
  'use strict';

  // 缓存：避免短时间内重复请求（localStorage，跨页面共享）
  var CACHE_PREFIX = 'axtrivc_team_cache_';
  var CACHE_TTL = 4 * 60 * 1000; // 4 分钟（比自动刷新 5 分钟略短，确保拿到新数据）

  /* ---------- 工具 ---------- */

  // XSS 防护：把任意值转成纯文本
  function escapeHtml(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ISO 时间 → "3 小时前"
  function timeAgo(iso) {
    if (!iso) return '';
    var ts = new Date(iso).getTime();
    if (isNaN(ts)) return '';
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + ' 分钟前';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' 小时前';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + ' 天前';
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  // 读取缓存
  function readCache(key) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) return null;
      return obj.data;
    } catch (e) { return null; }
  }

  // 写入缓存
  function writeCache(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* 配额超限或隐私模式，静默 */ }
  }

  /* ---------- 新闻流 ---------- */

  /**
   * 加载联赛新闻并按关键词过滤出主队相关条目
   * @param {Object} opts
   *   - league: 'esp.1' / 'usa.1' / 'fifa.world'
   *   - keywords: ['barcelona', 'barca', 'flick', 'yamal', ...]
   *   - limit: 最多返回几条（默认 5）
   *   - containerId: 渲染目标的 element id
   *   - loadingId: 加载占位的 element id
   */
  function loadTeamNews(opts) {
    opts = opts || {};
    var league = opts.league;
    var keywords = (opts.keywords || []).map(function (k) { return k.toLowerCase(); });
    var limit = opts.limit || 5;
    var containerId = opts.containerId || 'newsContent';
    var loadingId = opts.loadingId || 'newsLoading';

    if (!league) return;

    var cacheKey = 'news_' + league + '_' + keywords.join('-');
    var cached = readCache(cacheKey);
    if (cached) {
      renderNews(cached, containerId, loadingId);
      return;
    }

    var url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + league + '/news';

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var articles = data.articles || [];

        // 关键词匹配：标题/描述任一包含关键词就保留
        var filtered = articles.filter(function (a) {
          if (!keywords.length) return true; // 无关键词 → 不过滤
          var text = ((a.headline || '') + ' ' + (a.description || '')).toLowerCase();
          return keywords.some(function (k) { return text.indexOf(k) !== -1; });
        });

        // 关键词过滤后不够 → 补回前 N 条不限来源
        if (filtered.length < limit) {
          var used = new Set(filtered.map(function (a) { return a.headline; }));
          articles.forEach(function (a) {
            if (filtered.length >= limit) return;
            if (!used.has(a.headline)) filtered.push(a);
          });
        }

        filtered = filtered.slice(0, limit);
        writeCache(cacheKey, filtered);
        renderNews(filtered, containerId, loadingId);
      })
      .catch(function (e) {
        console.warn('新闻加载失败:', e.message);
        var el = document.getElementById(loadingId);
        if (el) {
          el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--theme-secondary, #888);font-size:12px;">📰 暂时无法加载新闻</div>';
        }
      });
  }

  function renderNews(articles, containerId, loadingId) {
    var container = document.getElementById(containerId);
    var loading = document.getElementById(loadingId);
    if (!container) return;

    if (!articles.length) {
      if (loading) loading.innerHTML = '<div style="padding:16px;text-align:center;color:var(--theme-secondary, #888);font-size:12px;">📭 暂无相关新闻</div>';
      return;
    }

    var html = articles.map(function (a) {
      var title = escapeHtml(a.headline || '无标题');
      var desc = escapeHtml(a.description || '');
      if (desc.length > 90) desc = desc.slice(0, 90) + '…';
      var time = escapeHtml(timeAgo(a.published));
      var img = a.images && a.images[0] && a.images[0].url ? a.images[0].url : '';
      var link = a.links && a.links.web && a.links.web.href ? a.links.web.href : '#';

      var imgHtml = img
        ? '<div class="news-thumb" style="background-image:url(\'' + escapeHtml(img) + '\');"></div>'
        : '<div class="news-thumb news-thumb-placeholder">📰</div>';

      return '<a class="news-item" href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer">' +
        imgHtml +
        '<div class="news-body">' +
          '<div class="news-title">' + title + '</div>' +
          (desc ? '<div class="news-desc">' + desc + '</div>' : '') +
          '<div class="news-time">' + time + '</div>' +
        '</div>' +
      '</a>';
    }).join('');

    container.innerHTML = html;
    if (loading) loading.style.display = 'none';
    container.style.display = '';

    // 更新 "最后刷新" 时间戳
    var tsEl = document.getElementById('newsLastUpdate');
    if (tsEl) tsEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- 自动刷新 ---------- */

  /**
   * 给页面挂自动刷新
   * @param {Number} intervalSec - 刷新间隔（秒），默认 300 = 5 分钟
   * @param {Function[]} callbacks - 每次刷新调用的函数数组
   * @param {String} indicatorId - 倒计时指示器 element id（可选）
   */
  function setupAutoRefresh(intervalSec, callbacks, indicatorId) {
    intervalSec = intervalSec || 300;
    callbacks = callbacks || [];

    var remaining = intervalSec;
    var indicator = indicatorId ? document.getElementById(indicatorId) : null;

    // 倒计时显示
    setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        remaining = intervalSec;
      }
      if (indicator) {
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        indicator.textContent = m + ':' + (s < 10 ? '0' + s : s);
      }
    }, 1000);

    // 实际刷新（间隔分钟触发一次 callbacks）
    setInterval(function () {
      callbacks.forEach(function (fn) {
        try { if (typeof fn === 'function') fn(); }
        catch (e) { console.warn('自动刷新 callback 出错:', e); }
      });
      remaining = intervalSec;
    }, intervalSec * 1000);
  }

  /* ---------- 页面可见性优化 ---------- */
  // 当用户从别的 tab 切回来时，立即刷新一次（避免显示过期数据）
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && global.__autoRefreshCallbacks) {
      global.__autoRefreshCallbacks.forEach(function (fn) {
        try { if (typeof fn === 'function') fn(); } catch (e) {}
      });
    }
  });

  /* ---------- 球员数据动态加载 ---------- */

  /**
   * 加载球队本赛季球员统计（出场/进球/助攻/黄牌/红牌）
   * 数据源：ESPN site API roster，支持 CORS
   *
   * @param {Object} opts
   *   - league: 'esp.1' / 'usa.1' / 'fifa.world'
   *   - teamId: '83' / '18996' / ...
   *   - season: 年份，如 '2025'
   *   - highlightJersey: 'BAR' 等需要高亮的球衣号（可选，留空则不高亮）
   *   - containerId: 渲染目标
   *   - loadingId: 加载占位
   */
  function loadTeamRoster(opts) {
    opts = opts || {};
    var league = opts.league;
    var teamId = opts.teamId;
    var season = opts.season || new Date().getFullYear();
    var containerId = opts.containerId || 'rosterContent';
    var loadingId = opts.loadingId || 'rosterLoading';
    if (!league || !teamId) return;

    var cacheKey = 'roster_' + league + '_' + teamId + '_' + season;
    var cached = readCache(cacheKey);
    if (cached) { renderRoster(cached, containerId, loadingId); return; }

    var url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + league + '/teams/' + teamId + '/roster?season=' + season;

    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var athletes = data.athletes || [];
        if (!athletes.length) throw new Error('空名单');

        // 解析每个球员的关键统计
        var parsed = athletes.map(function (a) {
          var cats = (a.statistics && a.statistics.splits && a.statistics.splits.categories) || [];
          var general = [], offensive = [], goalkeeping = [];
          cats.forEach(function (c) {
            if (c.name === 'general') general = c.stats || [];
            else if (c.name === 'offensive') offensive = c.stats || [];
            else if (c.name === 'goalKeeping') goalkeeping = c.stats || [];
          });
          function pick(arr, key) {
            var s = arr.find(function (x) { return x.name === key; });
            return s ? (s.displayValue !== undefined ? s.displayValue : s.value) : '0';
          }
          return {
            id: a.id,
            name: a.fullName || a.shortName || a.displayName || 'Unknown',
            jersey: a.jersey || '',
            position: a.position ? a.position.abbreviation : '',
            positionName: a.position ? a.position.name : '',
            age: a.age || '',
            citizenship: a.citizenship || '',
            flag: a.flag && a.flag.href ? a.flag.href : '',
            appearances: pick(general, 'appearances'),
            subIns: pick(general, 'subIns'),
            goals: pick(offensive, 'totalGoals'),
            assists: pick(offensive, 'goalAssists'),
            shotsOnTarget: pick(offensive, 'shotsOnTarget'),
            yellowCards: pick(general, 'yellowCards'),
            redCards: pick(general, 'redCards'),
            foulsCommitted: pick(general, 'foulsCommitted'),
            foulsSuffered: pick(general, 'foulsSuffered'),
            saves: pick(goalkeeping, 'saves'),
            goalsConceded: pick(goalkeeping, 'goalsConceded'),
            injuries: a.injuries || []
          };
        });

        writeCache(cacheKey, parsed);
        renderRoster(parsed, containerId, loadingId);
      })
      .catch(function (e) {
        console.warn('球员数据加载失败:', e.message);
        var el = document.getElementById(loadingId);
        if (el) {
          el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--theme-secondary, #888);font-size:12px;">👥 暂时无法加载球员数据</div>';
        }
      });
  }

  function renderRoster(players, containerId, loadingId) {
    var container = document.getElementById(containerId);
    var loading = document.getElementById(loadingId);
    if (!container) return;

    // 按 GK → D → M → F 排序
    var order = { G: 0, D: 1, M: 2, F: 3 };
    players.sort(function (a, b) {
      var oa = order[a.position] || 9;
      var ob = order[b.position] || 9;
      if (oa !== ob) return oa - ob;
      // 同位置按出场数降序
      return (parseInt(b.appearances) || 0) - (parseInt(a.appearances) || 0);
    });

    // 位置组中文名
    var posLabels = { G: '🧤 守门员', D: '🛡️ 后卫', M: '⚽ 中场', F: '🎯 前锋' };
    var lastPos = '';

    var html = '';
    players.forEach(function (p) {
      if (p.position !== lastPos) {
        if (lastPos) html += '</tbody></table>';
        html += '<div class="roster-pos-title">' + (posLabels[p.position] || '其他') + '</div>';
        html += '<table class="roster-table"><thead><tr>' +
          '<th class="rt-jer">#</th>' +
          '<th class="rt-name">球员</th>' +
          '<th class="rt-stat" title="出场">场</th>' +
          '<th class="rt-stat" title="进球">球</th>' +
          '<th class="rt-stat" title="助攻">助</th>' +
          '<th class="rt-card" title="黄牌/红牌">🟨/🟥</th>' +
        '</tr></thead><tbody>';
        lastPos = p.position;
      }
      var injured = p.injuries && p.injuries.length > 0;
      var injClass = injured ? ' rt-injured' : '';
      html += '<tr class="rt-row' + injClass + '">' +
        '<td class="rt-jer">' + escapeHtml(p.jersey) + '</td>' +
        '<td class="rt-name">' +
          (p.flag ? '<img class="rt-flag" src="' + escapeHtml(p.flag) + '" alt="" loading="lazy" />' : '') +
          '<span class="rt-name-text">' + escapeHtml(p.name) + '</span>' +
          (injured ? '<span class="rt-inj-badge">🩹</span>' : '') +
        '</td>' +
        '<td class="rt-stat">' + escapeHtml(p.appearances) + '</td>' +
        '<td class="rt-stat rt-goal">' + escapeHtml(p.goals) + '</td>' +
        '<td class="rt-stat rt-assist">' + escapeHtml(p.assists) + '</td>' +
        '<td class="rt-card"><span class="rt-yellow">' + escapeHtml(p.yellowCards) + '</span>/<span class="rt-red">' + escapeHtml(p.redCards) + '</span></td>' +
      '</tr>';
    });
    if (lastPos) html += '</tbody></table>';

    container.innerHTML = html;
    if (loading) loading.style.display = 'none';
    container.style.display = '';

    var tsEl = document.getElementById('rosterLastUpdate');
    if (tsEl) tsEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  // 导出
  global.TeamDynamic = {
    loadTeamNews: loadTeamNews,
    loadTeamRoster: loadTeamRoster,
    setupAutoRefresh: setupAutoRefresh,
    escapeHtml: escapeHtml,
    timeAgo: timeAgo
  };

})(window);
