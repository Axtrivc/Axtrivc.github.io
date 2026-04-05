/**
 * football-daily.js
 * 每日足球日报生成器 - GitHub Actions 用
 * 
 * 功能：从 football-data.org API 抓取赛程/赛果，生成 Hexo 博客文章（Markdown）
 * 输出：source/_posts/football-daily-YYYY-MM-DD.md
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const POSTS_DIR = process.env.POSTS_DIR || path.join(__dirname, '..', 'source', '_posts');

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

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : https;
    const req = mod.get(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }, (res) => {
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

// ==================== 名称映射 ====================
function getCompName(comp) {
  if (!comp) return '';
  const map = {
    'PL': '英超', 'PD': '西甲', 'CL': '欧冠', 'BL1': '德甲', 'SA': '意甲',
    'FL1': '法甲', 'WC': '世界杯', 'EC': '欧洲杯', 'MLS': '美职联',
    'ELC': '英冠', 'DED': '荷甲', 'BSA': '巴甲',
  };
  return map[comp.code] || comp.name || comp.code || '';
}

function getTeamCn(team) {
  if (!team) return '';
  const cn = {
    'FC Barcelona': '巴萨', 'FC Bayern Munchen': '拜仁', 'Real Madrid': '皇马',
    'Liverpool FC': '利物浦', 'Paris Saint-Germain': '巴黎', 'Arsenal FC': '阿森纳',
    'Manchester City': '曼城', 'Manchester United': '曼联', 'Chelsea FC': '切尔西',
    'Atletico Madrid': '马竞', 'Tottenham Hotspur': '热刺',
    'Inter Miami CF': '迈阿密国际', 'Inter Miami': '迈阿密国际',
    'Real Sociedad': '皇家社会', 'Real Betis': '贝蒂斯', 'Villarreal CF': '比利亚雷亚尔',
    'Newcastle United': '纽卡斯尔', 'Atalanta': '亚特兰大', 'Sporting CP': '葡萄牙体育',
    'Borussia Dortmund': '多特蒙德', 'Juventus': '尤文图斯',
    'AC Milan': 'AC米兰', 'Inter Milan': '国际米兰',
    'Spain': '西班牙', 'Germany': '德国', 'France': '法国', 'Brazil': '巴西',
    'England': '英格兰', 'Argentina': '阿根廷', 'Italy': '意大利', 'Portugal': '葡萄牙',
  };
  return cn[team.name] || team.shortName || team.name || '';
}

function formatMatchTime(utcDate) {
  const d = new Date(utcDate);
  const bj = new Date(d.getTime() + 8 * 3600000);
  return `${String(bj.getHours()).padStart(2, '0')}:${String(bj.getMinutes()).padStart(2, '0')}`;
}

// ==================== 关注球队判断 ====================
const PRIORITY_TEAMS = ['巴萨', '皇马', '拜仁', '利物浦', '巴黎', '阿森纳', '马竞', '迈阿密国际', '曼城', '热刺', '西班牙'];
const PRIORITY_COMPS = ['PL', 'PD', 'CL'];

function isPriority(m) {
  const home = getTeamCn(m.homeTeam);
  const away = getTeamCn(m.awayTeam);
  return PRIORITY_TEAMS.some(t => home.includes(t) || away.includes(t)) ||
    (m.competition && PRIORITY_COMPS.includes(m.competition.code));
}

// ==================== 生成 Markdown ====================
function generateMarkdown(matches, nextMatches) {
  const dateCN = getTodayCN();
  const today = getDateStr();

  const finished = matches.filter(m => m.status === 'FINISHED');
  const live = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = matches.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));

  const priorityFinished = finished.filter(isPriority);
  const priorityUpcoming = upcoming.filter(isPriority);
  const allFinished = [...priorityFinished, ...finished.filter(m => !priorityFinished.includes(m))];
  const allUpcoming = [...priorityUpcoming, ...upcoming.filter(m => !priorityUpcoming.includes(m))];

  // --- 战报 ---
  let resultsSection = '';
  if (allFinished.length === 0 && live.length === 0) {
    resultsSection = '\n> 今日暂无已结束比赛\n';
  } else {
    resultsSection = '\n| 赛事 | 主队 | 比分 | 客队 | 备注 |\n|:---:|:---:|:---:|:---:|:---:|\n';
    [...live, ...allFinished].forEach(m => {
      const comp = getCompName(m.competition);
      const home = getTeamCn(m.homeTeam);
      const away = getTeamCn(m.awayTeam);
      if (m.status === 'FINISHED') {
        const f = m.score.fullTime;
        const ht = m.score.halfTime;
        let note = '';
        if (f.home > f.away) note = home + '胜';
        else if (f.home < f.away) note = away + '胜';
        else note = '平局';
        if (ht.home != null) note += ` (半场${ht.home}-${ht.away})`;
        resultsSection += `| ${comp} | ${home} | **${f.home} - ${f.away}** | ${away} | ${note} |\n`;
      } else {
        const live = m.score.fullTime;
        const min = m.minute ? `${m.minute}'` : '进行中';
        resultsSection += `| ${comp} | ${home} | 🔴 ${live.home} - ${live.away} | ${away} | ${min} |\n`;
      }
    });
  }

  // --- 即将开赛 ---
  let upcomingSection = '';
  if (allUpcoming.length === 0 && nextMatches.length > 0) {
    upcomingSection = '\n### 关注球队下一场\n\n| 时间 | 赛事 | 对阵 |\n|:---:|:---:|:---:|\n';
    nextMatches.forEach(m => {
      const time = formatMatchTime(m.utcDate);
      const comp = getCompName(m.competition);
      const home = getTeamCn(m.homeTeam);
      const away = getTeamCn(m.awayTeam);
      upcomingSection += `| ${time} | ${comp} | ${home} vs ${away} |\n`;
    });
  } else if (allUpcoming.length > 0) {
    upcomingSection = '\n### 即将开赛\n\n| 开球时间 | 赛事 | 对阵 |\n|:---:|:---:|:---:|\n';
    allUpcoming.slice(0, 10).forEach(m => {
      const time = formatMatchTime(m.utcDate);
      const comp = getCompName(m.competition);
      const home = getTeamCn(m.homeTeam);
      const away = getTeamCn(m.awayTeam);
      upcomingSection += `| ${time} | ${comp} | ${home} vs ${away} |\n`;
    });
  } else {
    upcomingSection = '\n> 暂无即将开始的比赛\n';
  }

  // --- 关注球队近况 ---
  let focusSection = '';
  if (nextMatches.length > 0 && allUpcoming.length > 0) {
    focusSection = '\n### 关注球队下一场\n\n| 球队 | 下一场 | 赛事 |\n|:---:|:---:|:---:|\n';
    nextMatches.forEach(m => {
      const comp = getCompName(m.competition);
      const home = getTeamCn(m.homeTeam);
      const away = getTeamCn(m.awayTeam);
      const time = formatMatchTime(m.utcDate);
      // 判断是哪个关注球队
      const focused = PRIORITY_TEAMS.find(t => home.includes(t) || away.includes(t));
      if (focused) {
        focusSection += `| ${focused} | ${home} vs ${away} (${time}) | ${comp} |\n`;
      }
    });
  }

  const markdown = `---
title: 足球日报 · ${dateCN}
date: ${today} 08:00:00
tags:
  - 足球
  - 日报
categories:
  - 足球日报
---

> ⚽ 每日足球资讯自动汇总 · 数据来源 football-data.org

## 今日战报

${resultsSection}

${upcomingSection}

${focusSection}

---

*本文由 GitHub Actions 自动生成，仅供阅读参考。*
`;

  return markdown;
}

// ==================== 主流程 ====================
async function main() {
  console.log('=== 足球日报生成器 ===');
  console.log(`日期: ${getTodayCN()}`);

  // 确保目录存在
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // 抓取今日比赛
  console.log('正在抓取今日比赛...');
  const matches = await fetchMatches();
  console.log(`获取到 ${matches.length} 场比赛`);

  // 抓取关注球队的下一场比赛
  console.log('正在抓取关注球队赛程...');
  const teamIds = [83, 64, 541, 1593]; // 巴萨、利物浦、皇马、迈阿密国际
  const nextMatches = [];
  for (const tid of teamIds) {
    const m = await fetchTeamNextMatch(tid);
    if (m) nextMatches.push(m);
  }
  console.log(`获取到 ${nextMatches.length} 场关注球队赛程`);

  // 生成 Markdown
  const today = getDateStr();
  const filename = `football-daily-${today}.md`;
  const markdown = generateMarkdown(matches, nextMatches);

  // 写入文件
  const filepath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(filepath, markdown, 'utf-8');
  console.log(`✅ ${filename} 生成完成`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
