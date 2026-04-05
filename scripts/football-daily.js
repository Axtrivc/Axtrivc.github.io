/**
 * football-daily.js
 * 每日足球日报生成器 - GitHub Actions 用
 * 
 * 功能：
 * 1. 从 football-data.org API 抓取赛程/赛果
 * 2. 从懂球帝 API 抓取足坛新闻
 * 3. 生成 Hexo 博客文章（Markdown）
 * 
 * 输出：source/_posts/football-daily-YYYY-MM-DD.md
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const POSTS_DIR = process.env.POSTS_DIR || path.join(__dirname, '..', 'source', '_posts');

// 关注的联赛代码
const COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL'];

// 关注的球队（name + football-data id + 队名关键词，用于从比赛列表中识别）
const FOLLOWED_TEAMS = [
  { name: '巴萨', id: 81, keywords: ['巴塞罗那', 'Barcelona', 'FC Barcelona'] },
  { name: '皇马', id: 86, keywords: ['皇家马德里', 'Real Madrid', 'Real Madrid CF'] },
  { name: '马竞', id: 78, keywords: ['马德里竞技', 'Atlético', 'Club Atlético'] },
  { name: '迈阿密国际', id: 1593, keywords: ['迈阿密国际', 'Inter Miami'] },
  { name: '西班牙', id: 788, keywords: ['西班牙', 'Spain'] },
];

// 懂球帝新闻分类 tabId
const NEWS_TABS = {
  '头条': 1,
  '西甲': 5,
  '英超': 3,
  '意甲': 4,
  '德甲': 6,
  '法甲': 12,
};

// 懂球帝球队页面关键词（用于筛选关注球队新闻）
const TEAM_KEYWORDS = ['巴萨', '巴塞罗那', '皇马', '皇家马德里', '马竞', '马德里竞技', '迈阿密国际', '西班牙', '斗牛士'];

// ==================== 工具函数 ====================
function getDateStr(offset = 0) {
  // 返回 UTC 日期字符串
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayCN() {
  // 返回北京时间日期
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600000);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${bj.getFullYear()}年${bj.getMonth() + 1}月${bj.getDate()}日 星期${weekdays[bj.getDay()]}`;
}

function getBjDate(offset = 0) {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600000);
  bj.setDate(bj.getDate() + offset);
  const y = bj.getFullYear();
  const m = bj.getMonth() + 1;
  const day = bj.getDate();
  return { y, m, day, str: `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}` };
}

function todayBjTimestamp() {
  // 返回今天北京时间 0 点的 Unix 时间戳
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600000);
  const bjStart = new Date(bj.getFullYear(), bj.getMonth(), bj.getDate());
  // 转为 UTC 时间戳（北京时间 0 点 = UTC 前一天 16 点）
  return Math.floor(bjStart.getTime() / 1000) - 8 * 3600;
}

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...options.headers } }, (res) => {
      // 懂球帝可能 301 重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ==================== 抓取比赛数据 ====================
async function fetchMatchesByCompetition(comp) {
  if (!FOOTBALL_API_KEY) return [];
  try {
    // 关键修复：日期范围用 UTC 前一天到 UTC 后一天
    // 这样能覆盖北京时间凌晨（UTC 前一天晚上）到明天的比赛
    const yesterday = getDateStr(-1);
    const tomorrow = getDateStr(1);
    const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${yesterday}&dateTo=${tomorrow}`;
    const data = await fetchJSON(url, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });
    return data.matches || [];
  } catch (e) {
    console.error(`Failed to fetch ${comp}:`, e.message);
    return [];
  }
}

async function fetchTeamRecentMatches(teamId) {
  if (!FOOTBALL_API_KEY) return [];
  try {
    const url = `https://api.football-data.org/v4/teams/${teamId}/matches?limit=5`;
    const data = await fetchJSON(url, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });
    return data.matches || [];
  } catch (e) {
    return [];
  }
}

async function fetchTeamNextMatch(teamId) {
  if (!FOOTBALL_API_KEY) return null;
  try {
    const url = `https://api.football-data.org/v4/teams/${teamId}/matches?status=SCHEDULED&limit=1`;
    const data = await fetchJSON(url, {
      headers: { 'X-Auth-Token': FOOTBALL_API_KEY }
    });
    return data.matches && data.matches[0] ? data.matches[0] : null;
  } catch (e) {
    return null;
  }
}

// ==================== 抓取懂球帝新闻 ====================
async function fetchDongqiudiNews(tabId, limit = 15) {
  try {
    const url = `https://www.dongqiudi.com/api/app/tabs/web/${tabId}.json?size=${limit}`;
    const data = await fetchJSON(url);
    const articles = data.articles || [];
    
    // 过滤：只要今天的新闻（基于北京时间）
    const todayTs = todayBjTimestamp();
    const todayArticles = articles.filter(a => {
      return a.show_time && a.show_time >= todayTs;
    });
    
    return todayArticles.map(a => ({
      id: a.id,
      title: a.title || '',
      url: `https://www.dongqiudi.com/article/${a.id}`,
      comments: a.comments_total || 0,
      time: a.created_at || '',
      category: a.secondary_category || [a.category || ''],
    }));
  } catch (e) {
    console.error(`Failed to fetch news tab ${tabId}:`, e.message);
    return [];
  }
}

// ==================== 名称映射 ====================
const COMP_NAMES = {
  'PL': '英超', 'PD': '西甲', 'BL1': '德甲', 'SA': '意甲', 'FL1': '法甲',
  'CL': '欧冠', 'EL': '欧联', 'WC': '世界杯', 'EC': '欧洲杯'
};

const TEAM_NAMES = {
  'FC Barcelona': '巴萨', 'FC Bayern München': '拜仁', 'Real Madrid CF': '皇马',
  'Liverpool FC': '利物浦', 'Paris Saint-Germain FC': '巴黎', 'Arsenal FC': '阿森纳',
  'Manchester City FC': '曼城', 'Manchester United FC': '曼联', 'Chelsea FC': '切尔西',
  'Atlético de Madrid': '马竞', 'Tottenham Hotspur FC': '热刺',
  'Inter Miami CF': '迈阿密国际', 'Inter Miami': '迈阿密国际',
  'Real Sociedad': '皇家社会', 'Real Betis': '贝蒂斯', 'Villarreal CF': '比利亚雷亚尔',
  'Newcastle United FC': '纽卡斯尔', 'Atalanta BC': '亚特兰大', 'Sporting CP': '葡萄牙体育',
  'Borussia Dortmund': '多特蒙德', 'Juventus FC': '尤文图斯',
  'Inter': '国际米兰', 'Inter Milan': '国际米兰',
  'AC Milan': 'AC米兰', 'Udinese': '乌迪内斯',
  'AS Roma': '罗马', 'SSC Napoli': '那不勒斯', 'SS Lazio': '拉齐奥',
  'Spain': '西班牙', 'Germany': '德国', 'France': '法国', 'Brazil': '巴西',
  'England': '英格兰', 'Argentina': '阿根廷', 'Italy': '意大利', 'Portugal': '葡萄牙',
  'Athletic Club': '毕尔巴鄂', 'Sevilla FC': '塞维利亚', 'Valencia CF': '瓦伦西亚',
  'Celta': '塞尔塔', 'Celta de Vigo': '塞尔塔', 'CEL': '塞尔塔', 'RCD Espanyol': '西班牙人', 'Getafe CF': '赫塔菲',
  'Deportivo Alavés': '阿拉维斯', 'CA Osasuna': '奥萨苏纳', 'Girona FC': '赫罗纳',
  'RCD Mallorca': '马略卡', 'UD Las Palmas': '拉斯帕尔马斯', 'Rayo Vallecano': '巴列卡诺',
  'Real Valladolid CF': '巴拉多利德', 'CD Leganés': '莱加内斯',
  'Real Oviedo': '奥维耶多', 'Levante UD': '莱万特',
  'Union Berlin': '柏林联合', 'FC St. Pauli': '圣保利', 'St. Pauli': '圣保利',
  'Eintracht Frankfurt': '法兰克福', 'Frankfurt': '法兰克福',
  '1. FC Köln': '科隆', 'FC Bayern München': '拜仁',
  'AC Pisa': '比萨', 'Torino FC': '都灵', 'Udinese Calcio': '乌迪内斯',
  'Como 1907': '科莫', 'US Lecce': '莱切', 'Genoa CFC': '热那亚',
  'ACF Fiorentina': '佛罗伦萨', 'Bologna FC 1909': '博洛尼亚',
  'US Cremonese': '克雷莫纳',
  'Angers SCO': '昂热', 'Olympique Lyonnais': '里昂', 'Le Havre AC': '勒阿弗尔',
  'AJ Auxerre': '欧塞尔', 'FC Lorient': '洛里昂', 'Paris FC': '巴黎FC',
  'FC Metz': '梅斯', 'FC Nantes': '南特', 'AS Monaco FC': '摩纳哥',
  'Olympique de Marseille': '马赛', 'Stade Rennais FC': '雷恩',
  'LOSC Lille': '里尔', 'OGC Nice': '尼斯', 'RC Lens': '朗斯',
  'Botafogo': '博塔弗戈', 'Vasco da Gama': '瓦斯科达伽马',
  'PSG': '巴黎', 'Paris Saint-Germain': '巴黎',
  // 德甲补充
  'SC Freiburg': '弗赖堡', 'Freiburg': '弗赖堡',
  'TSG Hoffenheim': '霍芬海姆', 'Hoffenheim': '霍芬海姆',
  'SV Werder Bremen': '不来梅', 'Bremen': '不来梅',
  'RB Leipzig': '莱比锡', 'Leipzig': '莱比锡',
  'Bayer Leverkusen': '勒沃库森', 'Leverkusen': '勒沃库森',
  'VfB Stuttgart': '斯图加特', 'Stuttgart': '斯图加特',
  'Borussia Mönchengladbach': '门兴', "M'gladbach": '门兴',
  'FC Heidenheim': '海登海姆', 'Heidenheim': '海登海姆',
  'Hamburger SV': '汉堡', 'HSV': '汉堡',
  'FC Augsburg': '奥格斯堡', 'Augsburg': '奥格斯堡',
  '1. FSV Mainz 05': '美因茨', 'Mainz': '美因茨',
  'VfL Wolfsburg': '沃尔夫斯堡', 'Wolfsburg': '沃尔夫斯堡',
  'Hertha BSC': '柏林赫塔', 'Hertha': '柏林赫塔',
  'VfL Bochum': '波鸿', 'Bochum': '波鸿',
  '1. FC Union Berlin': '柏林联合',
  'SV Darmstadt 98': '达姆施塔特',
  '1. FC Heidenheim 1846': '海登海姆',
  'SV Wehen Wiesbaden': '韦恩',
  // 意甲补充
  'US Sassuolo': '萨索洛', 'Sassuolo': '萨索洛',
  'Hellas Verona': '维罗纳', 'Verona': '维罗纳',
  'Cagliari Calcio': '卡利亚里', 'Cagliari': '卡利亚里',
  'Parma Calcio 1913': '帕尔马', 'Parma': '帕尔马',
  'US Salernitana 1919': '萨勒尼塔纳',
  'US Lecce': '莱切', 'Lecce': '莱切',
  'Genoa CFC': '热那亚', 'Genoa': '热那亚',
  'Torino FC': '都灵', 'Torino': '都灵',
  'US Cremonese': '克雷莫纳', 'Cremonese': '克雷莫纳',
  'AC Monza': '蒙扎', 'Monza': '蒙扎',
  'Empoli FC': '恩波利', 'Empoli': '恩波利',
  'Cosenza Calcio': '科森扎',
  // 法甲补充
  'RC Strasbourg': '斯特拉斯堡', 'Strasbourg': '斯特拉斯堡',
  'Stade Brestois 29': '布雷斯特', 'Brest': '布雷斯特',
  'Stade Rennais FC': '雷恩', 'Stade Rennais': '雷恩', 'Rennes': '雷恩',
  'LOSC Lille': '里尔', 'Lille': '里尔',
  // 西甲补充
  'Atleti': '马竞', 'RCD Espanyol': '西班牙人', 'Espanyol': '西班牙人',
  'Levante UD': '莱万特', 'Levante': '莱万特',
  'CD Leganés': '莱加内斯', 'Leganes': '莱加内斯',
  // 其他
  'LA Galaxy': '洛杉矶银河', 'LAFC': '洛杉矶FC',
  'Inter Miami CF': '迈阿密国际', 'Inter Miami': '迈阿密国际',
};

function getCompName(comp) {
  if (!comp) return '';
  return COMP_NAMES[comp.code] || comp.name || comp.code || '';
}

function getTeamCn(team) {
  if (!team) return '';
  return TEAM_NAMES[team.name] || TEAM_NAMES[team.shortName] || TEAM_NAMES[team.tla] || team.shortName || team.name || '';
}

function formatMatchTime(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  return `${String(bj.getHours()).padStart(2, '0')}:${String(bj.getMinutes()).padStart(2, '0')}`;
}

function formatDate(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  return `${bj.getMonth() + 1}月${bj.getDate()}日`;
}

// 判断是否是今天的比赛（北京时间）
function isTodayMatch(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  const today = getBjDate();
  return bj.getFullYear() === today.y && bj.getMonth() === today.m - 1 && bj.getDate() === today.day;
}

// ==================== 关注球队判断 ====================
const PRIORITY_TEAMS = ['巴萨', '皇马', '拜仁', '利物浦', '巴黎', '阿森纳', '马竞', '迈阿密国际', '曼城', '热刺', '西班牙', '国际米兰', '罗马', '尤文图斯', 'AC米兰', '那不勒斯'];
const PRIORITY_COMPS = ['PL', 'PD', 'CL'];

function isPriority(m) {
  const home = getTeamCn(m.homeTeam);
  const away = getTeamCn(m.awayTeam);
  return PRIORITY_TEAMS.some(t => home.includes(t) || away.includes(t)) ||
    (m.competition && PRIORITY_COMPS.includes(m.competition.code));
}

function isFollowedTeam(teamId) {
  return FOLLOWED_TEAMS.some(t => t.id === teamId);
}

// 判断新闻是否与关注球队相关
function isTeamNews(article) {
  return TEAM_KEYWORDS.some(kw => article.title.includes(kw));
}

// 判断是否是今天或明天的比赛（北京时间）
function isTodayOrTomorrowMatch(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  const today = getBjDate();
  const tomorrow = getBjDate(1);
  const bjStr = `${bj.getFullYear()}-${String(bj.getMonth() + 1).padStart(2, '0')}-${String(bj.getDate()).padStart(2, '0')}`;
  return bjStr === today.str || bjStr === tomorrow.str;
}

function matchDateLabel(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  const today = getBjDate();
  const tomorrow = getBjDate(1);
  const bjStr = `${bj.getFullYear()}-${String(bj.getMonth() + 1).padStart(2, '0')}-${String(bj.getDate()).padStart(2, '0')}`;
  if (bjStr === today.str) return '今天';
  if (bjStr === tomorrow.str) return '明天';
  return `${bj.getMonth() + 1}月${bj.getDate()}日`;
}

// ==================== 生成 Markdown ====================
function generateMarkdown(allMatches, teamData, allNews) {
  const dateCN = getTodayCN();
  const today = getBjDate().str;

  // 过滤出今天的比赛（北京时间）
  const todayMatches = allMatches.filter(m => isTodayMatch(m.utcDate));

  // 分类比赛
  const finished = todayMatches.filter(m => m.status === 'FINISHED');
  const live = todayMatches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = todayMatches.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));

  // 近期赛程：今天+明天未开始的比赛
  const nearFutureMatches = allMatches.filter(m => 
    isTodayOrTomorrowMatch(m.utcDate) && ['SCHEDULED', 'TIMED'].includes(m.status)
  );

  // 按联赛分组（用于今日比赛）
  const byComp = {};
  todayMatches.forEach(m => {
    const comp = getCompName(m.competition);
    if (!byComp[comp]) byComp[comp] = [];
    byComp[comp].push(m);
  });

  // === 新闻部分 ===
  let newsSection = '';

  // 1. 足坛头条
  const headlineNews = allNews['头条'] || [];
  if (headlineNews.length > 0) {
    newsSection += '\n### 📰 足坛头条\n\n';
    headlineNews.slice(0, 8).forEach(a => {
      const teamTag = isTeamNews(a) ? ' ⭐' : '';
      newsSection += `- [${a.title}](${a.url})${teamTag}\n`;
    });
  }

  // 2. 各联赛新闻
  const leagueNewsOrder = ['西甲', '英超', '意甲', '德甲', '法甲'];
  leagueNewsOrder.forEach(league => {
    const news = allNews[league] || [];
    if (news.length > 0) {
      newsSection += `\n#### ${league}新闻\n\n`;
      news.slice(0, 5).forEach(a => {
        newsSection += `- [${a.title}](${a.url})\n`;
      });
    }
  });

  // 3. 我的主队新闻（从所有新闻中筛选）
  const allTeamNews = [];
  Object.values(allNews).forEach(news => {
    news.forEach(a => {
      if (isTeamNews(a) && !allTeamNews.some(n => n.id === a.id)) {
        allTeamNews.push(a);
      }
    });
  });
  if (allTeamNews.length > 0) {
    newsSection += '\n#### 我的主队动态\n\n';
    allTeamNews.slice(0, 8).forEach(a => {
      newsSection += `- ⭐ [${a.title}](${a.url})\n`;
    });
  }

  if (!newsSection) {
    newsSection = '\n> 今日暂无足坛新闻\n';
  }

  // === 战报部分 ===
  let resultsSection = '';
  if (finished.length === 0 && live.length === 0) {
    resultsSection = '\n> 今日暂无已结束比赛\n';
  } else {
    // 优先显示关注球队的比赛
    const priorityFinished = finished.filter(isPriority);
    const otherFinished = finished.filter(m => !isPriority(m));
    
    if (priorityFinished.length > 0) {
      resultsSection += '\n### 🔥 焦点战报\n\n| 赛事 | 主队 | 比分 | 客队 | 备注 |\n|:---:|:---:|:---:|:---:|:---:|\n';
      priorityFinished.forEach(m => {
        const comp = getCompName(m.competition);
        const home = getTeamCn(m.homeTeam);
        const away = getTeamCn(m.awayTeam);
        const f = m.score.fullTime;
        const ht = m.score.halfTime;
        let note = f.home > f.away ? home + '胜' : f.home < f.away ? away + '胜' : '平局';
        if (ht.home != null) note += ` (半场${ht.home}-${ht.away})`;
        resultsSection += `| ${comp} | **${home}** | **${f.home} - ${f.away}** | **${away}** | ${note} |\n`;
      });
    }
    
    if (otherFinished.length > 0) {
      resultsSection += '\n### 其他赛果\n\n| 赛事 | 主队 | 比分 | 客队 |\n|:---:|:---:|:---:|:---:|\n';
      otherFinished.forEach(m => {
        const comp = getCompName(m.competition);
        const home = getTeamCn(m.homeTeam);
        const away = getTeamCn(m.awayTeam);
        const f = m.score.fullTime;
        resultsSection += `| ${comp} | ${home} | ${f.home} - ${f.away} | ${away} |\n`;
      });
    }
  }

  // 进行中比赛
  if (live.length > 0) {
    resultsSection += '\n### 🔴 进行中\n\n| 赛事 | 主队 | 实时比分 | 客队 | 时间 |\n|:---:|:---:|:---:|:---:|:---:|\n';
    live.forEach(m => {
      const comp = getCompName(m.competition);
      const home = getTeamCn(m.homeTeam);
      const away = getTeamCn(m.awayTeam);
      const score = m.score.fullTime;
      const minute = m.minute ? `${m.minute}'` : '进行中';
      resultsSection += `| ${comp} | ${home} | **${score.home} - ${score.away}** | ${away} | ${minute} |\n`;
    });
  }

  // --- 近期赛程（今天+明天未开始的比赛） ---
  let upcomingSection = '';
  if (nearFutureMatches.length === 0) {
    upcomingSection = '\n> 近两日暂无赛程\n';
  } else {
    // 按日期+联赛分组
    const byDateComp = {};
    nearFutureMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)).forEach(m => {
      const label = matchDateLabel(m.utcDate);
      if (!byDateComp[label]) byDateComp[label] = {};
      const comp = getCompName(m.competition);
      if (!byDateComp[label][comp]) byDateComp[label][comp] = [];
      byDateComp[label][comp].push(m);
    });
    
    Object.entries(byDateComp).forEach(([dateLabel, comps]) => {
      upcomingSection += `\n### 📅 ${dateLabel}\n\n`;
      Object.entries(comps).forEach(([comp, matches]) => {
        upcomingSection += `#### ${comp}\n\n| 开球时间 | 主队 | 客队 |\n|:---:|:---:|:---:|\n`;
        matches.forEach(m => {
          const time = formatMatchTime(m.utcDate);
          const home = getTeamCn(m.homeTeam);
          const away = getTeamCn(m.awayTeam);
          const isFocus = isPriority(m);
          upcomingSection += `| ${time} | ${isFocus ? '**' + home + '**' : home} | ${isFocus ? '**' + away + '**' : away} |\n`;
        });
      });
    });
  }

  // --- 主队专区 ---
  let teamSection = '';
  if (teamData && teamData.length > 0) {
    teamSection = '\n## 我的主队\n';
    teamData.forEach(td => {
      const teamName = td.team.name;
      const teamConfig = FOLLOWED_TEAMS.find(t => t.name === teamName);
      const teamKeywords = teamConfig ? teamConfig.keywords : [teamName];
      
      // 判断比赛是否属于该主队
      // 优先用 team id 匹配，同时用关键词匹配（兼容不同赛季的 team id 变化）
      // 关键词匹配时排除误匹配（如 Barcelona 不应匹配 Espanyol de Barcelona）
      const EXCLUDE_PATTERNS = {
        '巴萨': ['Espanyol'],
        '巴塞罗那': ['Espanyol'],
      };
      const excludeKws = EXCLUDE_PATTERNS[teamName] || [];
      
      function isTeamMatch(m) {
        // 方式1：直接用 id 匹配
        if (m.homeTeam.id === td.team.id || m.awayTeam.id === td.team.id) return true;
        // 方式2：关键词匹配
        const homeStr = (m.homeTeam.name || '') + ' ' + (m.homeTeam.shortName || '') + ' ' + (m.homeTeam.tla || '');
        const awayStr = (m.awayTeam.name || '') + ' ' + (m.awayTeam.shortName || '') + ' ' + (m.awayTeam.tla || '');
        for (const kw of teamKeywords) {
          const homeMatch = homeStr.includes(kw);
          const awayMatch = awayStr.includes(kw);
          const homeExclude = excludeKws.some(ex => homeStr.includes(ex));
          const awayExclude = excludeKws.some(ex => awayStr.includes(ex));
          if ((homeMatch && !homeExclude) || (awayMatch && !awayExclude)) return true;
        }
        return false;
      }
      
      teamSection += `\n### ${teamName}\n\n`;
      
      // 今日比赛结果
      const todayTeamMatches = todayMatches.filter(m => m.status === 'FINISHED' && isTeamMatch(m));
      if (todayTeamMatches.length > 0) {
        teamSection += '**今日战报**\n\n';
        todayTeamMatches.forEach(m => {
          const comp = getCompName(m.competition);
          const home = getTeamCn(m.homeTeam);
          const away = getTeamCn(m.awayTeam);
          const f = m.score.fullTime;
          const isHome = m.homeTeam.id === td.team.id || teamKeywords.some(kw => m.homeTeam.name === kw || (m.homeTeam.shortName && m.homeTeam.shortName === kw));
          const myScore = isHome ? f.home : f.away;
          const oppScore = isHome ? f.away : f.home;
          const result = myScore > oppScore ? '✅ 胜' : myScore < oppScore ? '❌ 负' : '➖ 平';
          teamSection += `- ${comp}：${home} ${f.home}-${f.away} ${away}（${result}）\n`;
        });
        teamSection += '\n';
      }
      
      // 近期战绩（最近5场，排除今日已显示的）
      if (td.recent && td.recent.length > 0) {
        const recentOther = td.recent.filter(m => !(m.status === 'FINISHED' && isTodayMatch(m.utcDate) && isTeamMatch(m)));
        if (recentOther.length > 0) {
          teamSection += '**近期战绩**\n\n| 日期 | 赛事 | 对阵 | 比分 | 结果 |\n|:---:|:---:|:---:|:---:|:---:|\n';
          recentOther.slice(0, 5).forEach(m => {
            const date = formatDate(m.utcDate);
            const comp = getCompName(m.competition);
            const home = getTeamCn(m.homeTeam);
            const away = getTeamCn(m.awayTeam);
            const isHome = m.homeTeam.id === td.team.id;
            const opponent = isHome ? away : home;
            let result = '';
            if (m.status === 'FINISHED') {
              const f = m.score.fullTime;
              const myScore = isHome ? f.home : f.away;
              const oppScore = isHome ? f.away : f.home;
              if (myScore > oppScore) result = '✅ 胜';
              else if (myScore < oppScore) result = '❌ 负';
              else result = '➖ 平';
              teamSection += `| ${date} | ${comp} | ${isHome ? '主' : '客'} vs ${opponent} | ${myScore}-${oppScore} | ${result} |\n`;
            } else {
              teamSection += `| ${date} | ${comp} | ${isHome ? '主' : '客'} vs ${opponent} | - | ${m.status} |\n`;
            }
          });
          teamSection += '\n';
        }
      }
      
      // 下一场比赛
      if (td.next) {
        const comp = getCompName(td.next.competition);
        const home = getTeamCn(td.next.homeTeam);
        const away = getTeamCn(td.next.awayTeam);
        const time = formatMatchTime(td.next.utcDate);
        const date = formatDate(td.next.utcDate);
        teamSection += `**下一场**：${date} ${time} ${comp} - ${home} vs ${away}\n\n`;
      }
      
      // 相关新闻（从主队新闻中筛选）
      const teamNews = allTeamNews.filter(a => {
        const teamKws = {
          '巴萨': ['巴萨', '巴塞罗那'],
          '皇马': ['皇马', '皇家马德里'],
          '马竞': ['马竞', '马德里竞技'],
          '迈阿密国际': ['迈阿密国际'],
          '西班牙': ['西班牙', '斗牛士'],
        };
        const kws = teamKws[teamName] || [];
        return kws.some(kw => a.title.includes(kw));
      });
      if (teamNews.length > 0) {
        teamSection += '**相关新闻**\n\n';
        teamNews.slice(0, 3).forEach(a => {
          teamSection += `- [${a.title}](${a.url})\n`;
        });
        teamSection += '\n';
      }
      
      // 如果以上内容都为空，显示提示
      const hasContent = todayTeamMatches.length > 0 || 
        (td.recent && td.recent.length > 0) || 
        td.next || 
        teamNews.length > 0;
      if (!hasContent) {
        teamSection += '> 暂无近期动态\n\n';
      }
    });
  }

  const totalNewsCount = Object.values(allNews).reduce((sum, arr) => sum + arr.length, 0);

  const markdown = `---
title: 足球日报 · ${dateCN}
date: ${today} 08:00:00
tags:
  - 足球
  - 日报
categories:
  - 足球日报
---

> ⚽ 每日足球资讯自动汇总 · 数据来源 football-data.org + 懂球帝

## 足坛新闻
${newsSection}

## 今日战报
${resultsSection}

## 近期赛程
${upcomingSection}
${teamSection}

---

*本文由 GitHub Actions 自动生成，仅供阅读参考。新闻来源：[懂球帝](https://www.dongqiudi.com)*
`;

  return { markdown, stats: { matches: todayMatches.length, finished: finished.length, news: totalNewsCount } };
}

// ==================== 主流程 ====================
async function main() {
  // 只在有 API Key 时才执行（避免 hexo generate/deploy 时被触发覆盖数据）
  if (!FOOTBALL_API_KEY) {
    console.log('无 FOOTBALL_API_KEY，跳过日报生成');
    return;
  }
  
  console.log('=== 足球日报生成器 ===');
  console.log(`北京时间: ${getTodayCN()}`);

  // 确保目录存在
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // ======== 1. 抓取比赛数据 ========
  console.log('正在抓取各联赛比赛...');
  const allMatches = [];
  for (const comp of COMPETITIONS) {
    const matches = await fetchMatchesByCompetition(comp);
    console.log(`  ${comp}: ${matches.length} 场`);
    allMatches.push(...matches);
    if (COMPETITIONS.indexOf(comp) < COMPETITIONS.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`总计: ${allMatches.length} 场比赛（含近3天范围）`);

  // ======== 2. 抓取关注球队数据 ========
  console.log('正在抓取关注球队数据...');
  const teamData = [];
  for (const team of FOLLOWED_TEAMS) {
    console.log(`  查询 ${team.name}...`);
    const recent = await fetchTeamRecentMatches(team.id);
    if (FOLLOWED_TEAMS.indexOf(team) < FOLLOWED_TEAMS.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
    const next = await fetchTeamNextMatch(team.id);
    teamData.push({
      team: { id: team.id, name: team.name },
      recent,
      next
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  // ======== 3. 抓取懂球帝新闻 ========
  console.log('正在抓取懂球帝新闻...');
  const allNews = {};
  const tabEntries = Object.entries(NEWS_TABS);
  for (const [tabName, tabId] of tabEntries) {
    try {
      const articles = await fetchDongqiudiNews(tabId, 15);
      allNews[tabName] = articles;
      console.log(`  ${tabName}: ${articles.length} 条今日新闻`);
    } catch (e) {
      console.error(`  ${tabName} 获取失败:`, e.message);
      allNews[tabName] = [];
    }
    if (tabEntries.indexOf([tabName, tabId]) < tabEntries.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  const totalNews = Object.values(allNews).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`总计: ${totalNews} 条新闻`);

  // ======== 4. 生成 Markdown ========
  const today = getBjDate().str;
  const filename = `football-daily-${today}.md`;
  const { markdown, stats } = generateMarkdown(allMatches, teamData, allNews);

  // 写入文件
  const filepath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(filepath, markdown, 'utf-8');
  console.log(`\n✅ ${filename} 生成完成`);
  console.log(`   今日比赛: ${stats.matches} 场（已结束 ${stats.finished} 场）`);
  console.log(`   新闻: ${stats.news} 条`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
