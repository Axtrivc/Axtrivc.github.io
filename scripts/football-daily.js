/**
 * football-daily.js
 * 每日足球日报生成器 - GitHub Actions 用
 * 
 * 功能：
 * 1. 抓取当日足球赛程/赛果（football-data.org API）
 * 2. 搜索当日足球新闻摘要
 * 3. 生成 index.html、barcelona.html、spain.html、miami.html
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const SOURCE_DIR = process.env.SOURCE_DIR || path.join(__dirname, '..', 'source', 'football');
const TEAMS_DIR = path.join(SOURCE_DIR, 'teams');

// 关注的球队 ID（football-data.org）
const TEAM_IDS = {
  barcelona: 83,
  realMadrid: 541,
  atletico: 530,
  bayern: 157,
  liverpool: 64,
  paris: 85,
  arsenal: 42,
  interMiami: 1593, // football-data.org 迈阿密国际 ID
  spainNational: 788, // 西班牙国家队
};

// 关注的赛事
const COMPETITIONS = ['PL', 'PD', 'CL']; // 英超、西甲、欧冠

// ==================== 工具函数 ====================
function getDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayCN() {
  const d = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

function getTimeStr() {
  const d = new Date();
  // 转北京时间 UTC+8
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  return `${String(bj.getHours()).padStart(2, '0')}:${String(bj.getMinutes()).padStart(2, '0')}`;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ==================== 抓取赛程/赛果 ====================
async function fetchMatches() {
  if (!FOOTBALL_API_KEY) {
    console.log('No FOOTBALL_API_KEY, using empty matches');
    return [];
  }
  try {
    const today = getDateStr();
    const url = `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`;
    const data = await fetchJSON(url);
    return data.matches || [];
  } catch (e) {
    console.error('Failed to fetch matches:', e.message);
    return [];
  }
}

// ==================== 抓取关注球队赛程 ====================
async function fetchTeamNextMatch(teamId) {
  if (!FOOTBALL_API_KEY) return null;
  try {
    const url = `https://api.football-data.org/v4/teams/${teamId}/matches?status=SCHEDULED&limit=1`;
    const data = await fetchJSON(url);
    return data.matches && data.matches[0] ? data.matches[0] : null;
  } catch (e) {
    return null;
  }
}

// ==================== 生成 HTML ====================

const TOGGLE_SCRIPT = `<script>
function toggleArticle(el) {
  const expand = el.nextElementSibling;
  if (!expand || !expand.classList.contains('news-expand')) return;
  const hint = el.querySelector('.hot-expand-hint');
  if (expand.classList.contains('open')) {
    expand.classList.remove('open');
    if (hint) hint.textContent = '\u25BE';
  } else {
    document.querySelectorAll('.news-expand.open').forEach(e => {
      e.classList.remove('open');
      const h = e.previousElementSibling.querySelector('.hot-expand-hint');
      if (h) h.textContent = '\u25BE';
    });
    expand.classList.add('open');
    if (hint) hint.textContent = '\u25B4';
  }
}
</script>`;

const CSS_LINK = '<link rel="stylesheet" href="/-Axtrivc-.github.io/football/assets/common.css" />';

function getCompName(comp) {
  if (!comp) return '';
  const map = {
    'PL': '英超', 'PD': '西甲', 'CL': '欧冠', 'BL1': '德甲', 'SA': '意甲',
    'FL1': '法甲', 'WC': '世界杯', 'EC': '欧洲杯', 'PPL': '中超',
    'ELC': '英冠', 'DED': '荷甲', 'PPL': '葡萄牙超', 'BSA': '巴甲',
    'MLS': '美职联'
  };
  return map[comp.code] || comp.name || comp.code || '';
}

function getTeamName(team) {
  if (!team) return '';
  return team.shortName || team.name || '';
}

function getTeamCnName(team) {
  // 常用球队中文名映射
  const cnMap = {
    'FC Barcelona': '巴萨', 'FC Bayern Munchen': '拜仁', 'Real Madrid': '皇马',
    'Liverpool FC': '利物浦', 'Paris Saint-Germain': '巴黎', 'Arsenal FC': '阿森纳',
    'Manchester City': '曼城', 'Manchester United': '曼联', 'Chelsea FC': '切尔西',
    'Atletico Madrid': '马竞', 'Tottenham Hotspur': '热刺',
    'Inter Miami CF': '迈阿密国际', 'Inter Miami': '迈阿密国际',
    'Real Sociedad': '皇家社会', 'Real Betis': '贝蒂斯', 'Villarreal CF': '比利亚雷亚尔',
    'Newcastle United': '纽卡斯尔', 'Newcastle': '纽卡斯尔',
    'Atalanta': '亚特兰大', 'Sporting CP': '葡萄牙体育',
    'Borussia Dortmund': '多特蒙德', 'Juventus': '尤文图斯',
    'AC Milan': 'AC米兰', 'Inter Milan': '国际米兰',
  };
  if (!team) return '';
  return cnMap[team.name] || team.shortName || team.name || '';
}

function matchToScoreCard(match) {
  const homeTeam = getTeamCnName(match.homeTeam);
  const awayTeam = getTeamCnName(match.awayTeam);
  const compName = getCompName(match.competition);
  
  const status = match.status;
  let scoreMain = '';
  let scoreNote = '';
  let icon = '';
  
  if (status === 'FINISHED') {
    const ht = match.score.halfTime;
    const full = match.score.fullTime;
    scoreMain = `${full.home} - ${full.away}`;
    if (full.home > full.away) scoreNote = homeTeam + '胜';
    else if (full.home < full.away) scoreNote = awayTeam + '胜';
    else scoreNote = '平局';
    if (ht.home != null) scoreMain += ` (${ht.home}-${ht.away})`;
    icon = '\u2705';
  } else if (status === 'IN_PLAY' || status === 'PAUSED') {
    const live = match.score.fullTime;
    scoreMain = `${live.home} - ${live.away}`;
    const min = match.minute ? `${match.minute}'` : '进行中';
    scoreNote = min;
    icon = '\uD83D\uDD34';
  } else {
    // SCHEDULED or TIMED
    const utcDate = new Date(match.utcDate);
    const bjTime = new Date(utcDate.getTime() + 8 * 3600000);
    const hours = String(bjTime.getHours()).padStart(2, '0');
    const mins = String(bjTime.getMinutes()).padStart(2, '0');
    scoreMain = `${hours}:${mins}`;
    scoreNote = '未开始';
    icon = '\uD83D\uDCC5';
  }
  
  return { homeTeam, awayTeam, compName, scoreMain, scoreNote, icon, status };
}

function generateIndexHTML(matches, nextMatches) {
  const dateCN = getTodayCN();
  const timeStr = getTimeStr();
  
  // 分类比赛：已结束 / 进行中 / 即将开始
  const finished = matches.filter(m => m.status === 'FINISHED');
  const live = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = matches.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));
  
  // 过滤出我们关注的比赛（优先展示）
  const priorityTeams = ['巴塞罗那', '巴萨', '皇马', '拜仁', '利物浦', '巴黎', '阿森纳', '马竞', '迈阿密国际', '曼城', '热刺'];
  const isPriority = (m) => {
    const home = getTeamCnName(m.homeTeam);
    const away = getTeamCnName(m.awayTeam);
    return priorityTeams.some(t => home.includes(t) || away.includes(t)) || 
           (m.competition && ['PL', 'PD', 'CL'].includes(m.competition.code));
  };
  
  const priorityFinished = finished.filter(isPriority);
  const priorityUpcoming = upcoming.filter(isPriority);
  
  // 生成战报卡片
  let scoreCards = '';
  const allFinished = [...priorityFinished, ...finished.filter(m => !priorityFinished.includes(m))];
  if (allFinished.length === 0 && live.length === 0) {
    scoreCards = '<div style="padding:16px 20px;font-size:13px;color:#999;">今日暂无已结束比赛</div>';
  } else {
    let lastComp = '';
    [...live, ...allFinished].forEach(m => {
      const sc = matchToScoreCard(m);
      if (sc.compName && sc.compName !== lastComp) {
        scoreCards += `<div class="score-comp">${sc.compName}</div>`;
        lastComp = sc.compName;
      }
      const isLive = sc.status === 'IN_PLAY' || sc.status === 'PAUSED';
      scoreCards += `
    <div class="score-card">
      <div class="score-team home">${sc.homeTeam}</div>
      <div class="score-box">
        <div class="score-main">${sc.scoreMain}</div>
        <div class="score-note">${sc.scoreNote}</div>
      </div>
      <div class="score-team away">${sc.awayTeam}</div>
    </div>`;
    });
  }
  
  // 生成赛程
  let schedItems = '';
  const allUpcoming = [...priorityUpcoming, ...upcoming.filter(m => !priorityUpcoming.includes(m))];
  if (allUpcoming.length === 0 && nextMatches.length > 0) {
    // 如果今天没有即将开始的比赛，展示关注球队的下一场比赛
    nextMatches.forEach(m => {
      const sc = matchToScoreCard(m);
      schedItems += `
    <div class="sched-item">
      <span class="sched-time">${sc.scoreMain}</span>
      <span class="sched-comp">${sc.compName}</span>
      <span class="sched-teams">${sc.homeTeam} vs ${sc.awayTeam}</span>
      <span class="sched-icon">${sc.icon}</span>
    </div>`;
    });
  } else {
    allUpcoming.slice(0, 10).forEach(m => {
      const sc = matchToScoreCard(m);
      schedItems += `
    <div class="sched-item">
      <span class="sched-time${m.status === 'IN_PLAY' || m.status === 'PAUSED' ? ' live' : ''}">${sc.scoreMain}</span>
      <span class="sched-comp">${sc.compName}</span>
      <span class="sched-teams">${sc.homeTeam} vs ${sc.awayTeam}</span>
      <span class="sched-icon">${sc.icon}</span>
    </div>`;
    });
  }
  if (!schedItems) {
    schedItems = '<div style="padding:16px 20px;font-size:13px;color:#999;">暂无即将开始的比赛</div>';
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>足球日报 · ${dateCN}</title>
  ${CSS_LINK}
</head>
<body>

  <div class="top-nav">
    <a href="/-Axtrivc-.github.io/">首页</a>
    <span class="nav-sep">|</span>
    <span class="nav-current">足球日报</span>
  </div>

  <div class="page-header">
    <h1>⚽ 今日热点</h1>
    <div class="date-line">${dateCN} · ${timeStr} 更新</div>
  </div>

  <!-- 我的关注 -->
  <div class="card">
    <div class="card-title">我的关注</div>
    <div class="follow-bar">
      <a class="follow-chip chip-barca" href="/-Axtrivc-.github.io/football/teams/barcelona.html">🔴 巴萨</a>
      <a class="follow-chip chip-spain" href="/-Axtrivc-.github.io/football/teams/spain.html">🇪🇸 西班牙</a>
      <a class="follow-chip chip-miami" href="/-Axtrivc-.github.io/football/teams/miami.html">🩷 迈阿密国际</a>
      <span class="follow-chip chip-laliga">🟡 西甲</span>
      <span class="follow-chip chip-ucl">🔵 欧冠</span>
      <span class="follow-chip chip-pl">🟣 英超</span>
    </div>
  </div>

  <!-- 今日战报 -->
  <div class="card">
    <div class="card-title"><span class="badge badge-red">HOT</span> 今日战报</div>
    ${scoreCards}
  </div>

  <!-- 即将开赛 -->
  <div class="card">
    <div class="card-title"><span class="badge badge-amber">LIVE</span> 即将开赛</div>
    ${schedItems}
  </div>

  <div class="footer">
    数据来源：football-data.org · 自动更新 · 仅供阅读
  </div>

  ${TOGGLE_SCRIPT}

</body>
</html>`;
  
  return html;
}

// ==================== 球队页面生成 ====================
// 球队页面是相对静态的（大名单、荣誉等），只更新赛程部分
// 这里不做球队页面自动更新，保持手动管理

// ==================== 主流程 ====================
async function main() {
  console.log('=== 足球日报生成器 ===');
  console.log(`日期: ${getTodayCN()}`);
  
  // 确保目录存在
  if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true });
  if (!fs.existsSync(TEAMS_DIR)) fs.mkdirSync(TEAMS_DIR, { recursive: true });
  
  // 抓取今日比赛
  console.log('正在抓取今日比赛...');
  const matches = await fetchMatches();
  console.log(`获取到 ${matches.length} 场比赛`);
  
  // 抓取关注球队的下一场比赛
  console.log('正在抓取关注球队赛程...');
  const teamIds = [TEAM_IDS.barcelona, TEAM_IDS.liverpool, TEAM_IDS.realMadrid, TEAM_IDS.interMiami];
  const nextMatches = [];
  for (const tid of teamIds) {
    const m = await fetchTeamNextMatch(tid);
    if (m) nextMatches.push(m);
  }
  console.log(`获取到 ${nextMatches.length} 场关注球队赛程`);
  
  // 生成首页
  console.log('正在生成 index.html...');
  const indexHTML = generateIndexHTML(matches, nextMatches);
  fs.writeFileSync(path.join(SOURCE_DIR, 'index.html'), indexHTML, 'utf-8');
  console.log('index.html 生成完成');
  
  console.log('=== 完成 ===');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
