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

// 关注的联赛代码
const COMPETITIONS = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'CL'];

// 关注的球队（name + id）
const FOLLOWED_TEAMS = [
  { name: '巴萨', id: 83 },
  { name: '皇马', id: 541 },
  { name: '马竞', id: 530 },
  { name: '迈阿密国际', id: 1593 },
  { name: '西班牙', id: 788 },
];

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
    const req = https.get(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }, (res) => {
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

// ==================== 抓取数据 ====================
async function fetchMatchesByCompetition(comp) {
  if (!FOOTBALL_API_KEY) return [];
  try {
    const today = getDateStr();
    const tomorrow = getDateStr(1);
    const url = `https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${today}&dateTo=${tomorrow}`;
    const data = await fetchJSON(url);
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
    const data = await fetchJSON(url);
    return data.matches || [];
  } catch (e) {
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

// ==================== 生成 Markdown ====================
function generateMarkdown(allMatches, teamData) {
  const dateCN = getTodayCN();
  const today = getDateStr();

  // 分类比赛
  const finished = allMatches.filter(m => m.status === 'FINISHED');
  const live = allMatches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = allMatches.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));

  // 按联赛分组
  const byComp = {};
  allMatches.forEach(m => {
    const comp = getCompName(m.competition);
    if (!byComp[comp]) byComp[comp] = [];
    byComp[comp].push(m);
  });

  // --- 战报部分 ---
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

  // --- 即将开赛 ---
  let upcomingSection = '';
  if (upcoming.length === 0) {
    upcomingSection = '\n> 今日暂无即将开始的比赛\n';
  } else {
    // 按联赛分组显示
    upcomingSection = '';
    Object.keys(byComp).forEach(comp => {
      const compMatches = byComp[comp].filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));
      if (compMatches.length > 0) {
        upcomingSection += `\n#### ${comp}\n\n| 开球时间 | 主队 | 客队 |\n|:---:|:---:|:---:|\n`;
        compMatches.forEach(m => {
          const time = formatMatchTime(m.utcDate);
          const home = getTeamCn(m.homeTeam);
          const away = getTeamCn(m.awayTeam);
          const isFocus = isPriority(m);
          upcomingSection += `| ${time} | ${isFocus ? '**' + home + '**' : home} | ${isFocus ? '**' + away + '**' : away} |\n`;
        });
      }
    });
  }

  // --- 主队专区 ---
  let teamSection = '';
  if (teamData && teamData.length > 0) {
    teamSection = '\n## 我的主队\n';
    teamData.forEach(td => {
      const teamName = td.team.name;
      teamSection += `\n### ${teamName}\n\n`;
      
      // 近期战绩
      if (td.recent && td.recent.length > 0) {
        teamSection += '**近期战绩**\n\n| 日期 | 赛事 | 对阵 | 比分 | 结果 |\n|:---:|:---:|:---:|:---:|:---:|\n';
        td.recent.slice(0, 3).forEach(m => {
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
      }
      
      // 下一场比赛
      if (td.next) {
        const comp = getCompName(td.next.competition);
        const home = getTeamCn(td.next.homeTeam);
        const away = getTeamCn(td.next.awayTeam);
        const time = formatMatchTime(td.next.utcDate);
        const date = formatDate(td.next.utcDate);
        teamSection += `\n**下一场**：${date} ${time} ${comp} - ${home} vs ${away}\n`;
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

## 即将开赛
${upcomingSection}
${teamSection}

---

*本文由 GitHub Actions 自动生成，仅供阅读参考。*
`;

  return markdown;
}

// ==================== 主流程 ====================
async function main() {
  // 只在有 API Key 时才执行（避免 hexo generate/deploy 时被触发覆盖数据）
  if (!FOOTBALL_API_KEY) {
    console.log('无 FOOTBALL_API_KEY，跳过日报生成');
    return;
  }
  
  console.log('=== 足球日报生成器 ===');
  console.log(`日期: ${getTodayCN()}`);

  if (!FOOTBALL_API_KEY) {
    console.log('警告: 未设置 FOOTBALL_API_KEY');
  }

  // 确保目录存在
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  // 抓取各联赛比赛（每个请求间隔2秒避免限速）
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
  console.log(`总计: ${allMatches.length} 场比赛`);

  // 抓取关注球队数据（每个请求间隔2秒）
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
  }

  // 生成 Markdown
  const today = getDateStr();
  const filename = `football-daily-${today}.md`;
  const markdown = generateMarkdown(allMatches, teamData);

  // 写入文件
  const filepath = path.join(POSTS_DIR, filename);
  fs.writeFileSync(filepath, markdown, 'utf-8');
  console.log(`✅ ${filename} 生成完成 (${allMatches.length} 场比赛)`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
