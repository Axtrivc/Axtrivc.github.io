/* ============================================================
   Axtrivc's Blog — Team Page Generic Module (team-page.js)
   通用球队详情页: 下一场 / 最近5场 / 积分榜 / 数据总览
   数据全部来自 ESPN 公开接口 (支持 CORS), 页面打开即实时拉取,
   不写死任何比分/排名 — 配合 team-dynamic.js (新闻/阵容/自动刷新)

   用法:
     TeamPage.init({
       teamId: '83',            // ESPN team id
       league: 'esp.1',         // 联赛 slug (赛程/积分榜/新闻共用)
       leagueName: '西甲',      // 展示用联赛中文名
       teamZh: '巴塞罗那',      // 本队中文名 (下一场标题用)
       seasons: ['2026','2025'],// 赛程拉取的赛季 (按序合并去重)
       standingsSeason: '2025', // 积分榜赛季; null/缺省 → 不加载积分榜
       rosterSeason: '2025',    // 阵容数据赛季; null/缺省 → 不加载
       newsLeague: 'esp.1',     // 可选, 新闻接口联赛 (默认 = league)
       keywords: ['barcelona']  // 新闻关键词过滤
     })
   ============================================================ */
(function (global) {
  'use strict';

  var ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  var ESPN_WEB = 'https://site.web.api.espn.com/apis/v2/sports/soccer/';
  var TEAM_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/';

  function $(id) { return document.getElementById(id); }
  function esc(t) {
    if (t == null) return '';
    var div = document.createElement('div');
    div.textContent = String(t);
    return div.innerHTML;
  }
  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* 赛事名中文化 (按 ESPN league.name 匹配) */
  var COMP_CN = [
    [/champions league/i, '欧冠'],
    [/europa league/i, '欧联'],
    [/world cup/i, '世界杯'],
    [/european championship/i, '欧洲杯'],
    [/nations league/i, '欧国联'],
    [/laliga/i, '西甲'],
    [/premier league/i, '英超'],
    [/serie a/i, '意甲'],
    [/bundesliga/i, '德甲'],
    [/ligue 1/i, '法甲'],
    [/major league soccer/i, '美职联'],
    [/friendly/i, '友谊赛']
  ];
  function compCn(name, fallback) {
    for (var i = 0; i < COMP_CN.length; i++) {
      if (COMP_CN[i][0].test(name || '')) return COMP_CN[i][1];
    }
    return fallback || name || '';
  }

  /* ISO -> '7月25日 周六 19:30' (北京时间) */
  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '?';
    var parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return p.month + '月' + p.day + '日 ' + (p.weekday || '') + ' ' + p.hour + ':' + p.minute;
  }
  function fmtMD(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return p.month + '/' + p.day;
  }

  /* ESPN 事件统一化: 兼容 scoreboard (顶层 status) 与 schedule (competitions[0].status),
     score 兼容 {$ref,value} 对象 / 数字字符串 / null */
  function normEvent(e) {
    var comp0 = (e.competitions || [])[0] || {};
    var st = ((e.status || comp0.status || {}).type) || {};
    var home = null, away = null;
    (comp0.competitors || []).forEach(function (c) {
      var sc = c.score;
      if (sc && typeof sc === 'object') sc = sc.value;
      sc = parseInt(sc, 10);
      if (isNaN(sc)) sc = null;
      var t = {
        id: String((c.team || {}).id || ''),
        name: (c.team || {}).shortDisplayName || (c.team || {}).displayName || '?',
        score: sc
      };
      if (c.homeAway === 'home') home = t; else away = t;
    });
    var completed = !!st.completed;
    if (!completed && st.state !== 'in') {
      if (home) home.score = null;
      if (away) away.score = null;
    }
    return {
      id: String(e.id || ''),
      date: e.date || '',
      completed: completed,
      leagueName: (e.league || {}).name || '',
      home: home, away: away
    };
  }

  function oppOf(cfg, e) { return e.home.id === String(cfg.teamId) ? e.away : e.home; }
  function venueOf(cfg, e) { return e.home.id === String(cfg.teamId) ? '主' : '客'; }

  /* ---------- 赛程: 下一场 + 最近5场 ---------- */
  function loadMatches(cfg) {
    var urls = (cfg.seasons || []).map(function (s) {
      return ESPN_SITE + cfg.league + '/teams/' + cfg.teamId + '/schedule?season=' + s;
    });
    return Promise.all(urls.map(function (u) { return fetchJSON(u).catch(function () { return null; }); }))
      .then(function (datas) {
        var seen = {}, evs = [];
        datas.forEach(function (d) {
          ((d && d.events) || []).forEach(function (e) {
            var n = normEvent(e);
            if (n.id && !seen[n.id] && n.home && n.away) { seen[n.id] = 1; evs.push(n); }
          });
        });
        renderNext(cfg, evs);
        renderRecent(cfg, evs);
      })
      .catch(function (err) {
        console.warn('赛程加载失败:', err);
        var el = $('nextLoading');
        if (el) el.innerHTML = '<div class="next-empty">加载失败, 稍后自动重试</div>';
        var rl = $('recentLoading');
        if (rl) rl.innerHTML = '<div class="next-empty">加载失败, 稍后自动重试</div>';
      });
  }

  function renderNext(cfg, evs) {
    var loading = $('nextLoading'), box = $('nextContent');
    var now = Date.now();
    var next = evs.filter(function (e) {
      return !e.completed && new Date(e.date).getTime() > now - 5 * 60000;
    }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); })[0];

    if (!next) {
      if (loading) loading.innerHTML = '<div class="next-empty">🏖️ 休赛期 · 赛程待定</div>';
      return;
    }
    var opp = oppOf(cfg, next);
    var venue = venueOf(cfg, next);
    var title = venue === '主'
      ? cfg.teamZh + ' vs ' + opp.name
      : opp.name + ' vs ' + cfg.teamZh;
    box.innerHTML =
      '<div class="next-match">' +
        '<img class="nx-logo" src="' + TEAM_LOGO + esc(opp.id) + '.png" alt="" loading="eager" onerror="this.remove()">' +
        '<div class="nx-info">' +
          '<div class="nx-title">' + esc(title) + '</div>' +
          '<div class="nx-meta">' + esc(compCn(next.leagueName, cfg.leagueName)) + ' · ' + venue + '场</div>' +
        '</div>' +
        '<div class="nx-when">' + esc(fmtWhen(next.date)) + '</div>' +
      '</div>';
    if (loading) loading.style.display = 'none';
    box.style.display = '';
  }

  function renderRecent(cfg, evs) {
    var loading = $('recentLoading'), box = $('recentContent');
    var finished = evs.filter(function (e) { return e.completed; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, 5);

    if (!finished.length) {
      if (loading) loading.innerHTML = '<div class="next-empty">暂无已完赛场次</div>';
      return;
    }
    var html = finished.map(function (e) {
      var mine = e.home.id === String(cfg.teamId) ? e.home : e.away;
      var opp = oppOf(cfg, e);
      var venue = venueOf(cfg, e);
      var ms = mine.score == null ? 0 : mine.score;
      var os = opp.score == null ? 0 : opp.score;
      var txt, cls;
      if (ms > os) { txt = '胜'; cls = 'rm-win'; }
      else if (ms === os) { txt = '平'; cls = 'rm-draw'; }
      else { txt = '负'; cls = 'rm-loss'; }
      var left = venue === '主' ? '<span>' + esc(cfg.teamZh) + '</span>' : '<span class="rm-opp">' + esc(opp.name) + '</span>';
      var right = venue === '主' ? '<span class="rm-opp">' + esc(opp.name) + '</span>' : '<span>' + esc(cfg.teamZh) + '</span>';
      return '<div class="recent-match">' +
        '<span class="rm-date">' + esc(fmtMD(e.date)) + '</span>' +
        '<span class="rm-venue">' + venue + '</span>' +
        '<span class="rm-vs">' + left + '</span>' +
        '<span class="rm-score">' + (venue === '主' ? ms + ' - ' + os : os + ' - ' + ms) + '</span>' +
        '<span class="rm-vs" style="justify-content:flex-end;">' + right + '</span>' +
        '<span class="rm-comp">' + esc(compCn(e.leagueName, cfg.leagueName)) + '</span>' +
        '<span class="rm-result ' + cls + '">' + txt + '</span>' +
      '</div>';
    }).join('');
    box.innerHTML = html;
    if (loading) loading.style.display = 'none';
    box.style.display = '';
    var rd = $('recentDate');
    if (rd) rd.textContent = '(截至 ' + new Date().toLocaleDateString('zh-CN') + ')';
  }

  /* ---------- 积分榜 + 数据总览 ---------- */
  function loadStandings(cfg) {
    if (!cfg.standingsSeason) return Promise.resolve();
    return fetchJSON(ESPN_WEB + cfg.league + '/standings?season=' + cfg.standingsSeason)
      .then(function (d) {
        var children = d.children || [];
        if (!children.length) throw new Error('空积分榜');
        /* 多组时选含本队的一组 (如美职联东西部), 否则第一组 */
        var pick = children[0];
        for (var i = 0; i < children.length; i++) {
          var ens = ((children[i].standings || {}).entries) || [];
          for (var j = 0; j < ens.length; j++) {
            if (String((ens[j].team || {}).id) === String(cfg.teamId)) { pick = children[i]; break; }
          }
        }
        var entries = ((pick.standings || {}).entries) || [];
        if (!entries.length) throw new Error('空积分榜');
        var rows = entries.map(function (en) {
          var stats = {};
          (en.stats || []).forEach(function (s) {
            stats[s.name] = s.displayValue != null ? s.displayValue : s.value;
          });
          return {
            id: String((en.team || {}).id || ''),
            name: (en.team || {}).shortDisplayName || (en.team || {}).displayName || '?',
            logo: TEAM_LOGO + ((en.team || {}).id || '') + '.png',
            stats: stats
          };
        });
        renderStandings(cfg, rows);
      })
      .catch(function (err) {
        console.warn('积分榜加载失败:', err);
        var sl = $('standingsLoading');
        if (sl) sl.innerHTML = '<div class="next-empty">积分榜暂时不可用</div>';
        var tl = $('statsLoading');
        if (tl) tl.innerHTML = '<div class="next-empty">数据暂时不可用</div>';
      });
  }

  function num(s) { var n = parseInt(s, 10); return isNaN(n) ? 0 : n; }
  function suffix(n) { return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'; }

  function renderStandings(cfg, rows) {
    var mine = null;
    rows.forEach(function (r) { if (r.id === String(cfg.teamId)) mine = r; });

    /* 数据总览 */
    var statsBox = $('statsContent');
    if (mine && statsBox) {
      var rk = num(mine.stats.rank);
      $('statsContent').innerHTML =
        '<div class="team-stats">' +
          '<div><div class="team-stat-num">' + rk + suffix(rk) + '</div><div class="team-stat-label">联赛排名</div></div>' +
          '<div><div class="team-stat-num">' + esc(mine.stats.points || '0') + '</div><div class="team-stat-label">积分</div></div>' +
          '<div><div class="team-stat-num">' + esc(mine.stats.gamesPlayed || '0') + '</div><div class="team-stat-label">场次</div></div>' +
        '</div>' +
        '<div class="team-stats" style="border-bottom:none;padding-top:0;">' +
          '<div><div class="team-stat-num">' + esc(mine.stats.wins || '0') + '</div><div class="team-stat-label">胜</div></div>' +
          '<div><div class="team-stat-num">' + esc(mine.stats.ties || '0') + '</div><div class="team-stat-label">平</div></div>' +
          '<div><div class="team-stat-num">' + esc(mine.stats.pointDifferential || '0') + '</div><div class="team-stat-label">净胜球</div></div>' +
        '</div>';
      var sl = $('statsLoading');
      if (sl) sl.style.display = 'none';
      statsBox.style.display = '';
    }

    /* 完整积分榜 */
    var body = $('standingsBody');
    if (body) {
      body.innerHTML = rows.map(function (r) {
        var hl = r.id === String(cfg.teamId);
        return '<tr class="' + (hl ? 'highlight' : '') + '">' +
          '<td class="rank">' + esc(r.stats.rank || '-') + '</td>' +
          '<td><img src="' + r.logo + '" alt="" loading="lazy" onerror="this.remove()" ' +
               'style="width:16px;height:16px;object-fit:contain;vertical-align:-3px;margin-right:6px;">' +
               esc(r.name) + '</td>' +
          '<td>' + esc(r.stats.gamesPlayed || '0') + '</td>' +
          '<td>' + esc(r.stats.wins || '0') + '</td>' +
          '<td>' + esc(r.stats.ties || '0') + '</td>' +
          '<td>' + esc(r.stats.losses || '0') + '</td>' +
          '<td>' + esc(r.stats.pointsFor || '0') + ':' + esc(r.stats.pointsAgainst || '0') + '</td>' +
          '<td>' + esc(r.stats.pointDifferential || '0') + '</td>' +
          '<td class="pts">' + esc(r.stats.points || '0') + '</td>' +
        '</tr>';
      }).join('');
      var sld = $('standingsLoading');
      if (sld) sld.style.display = 'none';
      var sc = $('standingsContent');
      if (sc) sc.style.display = '';
      var sd = $('standingsDate');
      if (sd) sd.textContent = '(截至 ' + new Date().toLocaleDateString('zh-CN') + ')';
    }
  }

  /* ---------- 入口 ---------- */
  function init(cfg) {
    cfg = cfg || {};
    function refreshAll() {
      loadMatches(cfg);
      loadStandings(cfg);
    }
    refreshAll();

    if (global.TeamDynamic) {
      TeamDynamic.loadTeamNews({
        league: cfg.newsLeague || cfg.league,
        keywords: cfg.keywords || [],
        limit: cfg.newsLimit || 5,
        containerId: 'newsContent',
        loadingId: 'newsLoading'
      });
      if (cfg.rosterSeason) {
        TeamDynamic.loadTeamRoster({
          league: cfg.rosterLeague || cfg.league,
          teamId: cfg.teamId,
          season: cfg.rosterSeason,
          containerId: 'rosterContent',
          loadingId: 'rosterLoading'
        });
      }
      global.__autoRefreshCallbacks = [refreshAll, function () {
        TeamDynamic.loadTeamNews({
          league: cfg.newsLeague || cfg.league,
          keywords: cfg.keywords || [],
          limit: cfg.newsLimit || 5,
          containerId: 'newsContent',
          loadingId: 'newsLoading'
        });
      }];
      TeamDynamic.setupAutoRefresh(300, global.__autoRefreshCallbacks, 'refreshCountdown');
    }
  }

  global.TeamPage = { init: init };

})(window);
