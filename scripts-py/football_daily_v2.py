"""
football_daily_v2.py — 足球日报 v4 增强版 (2026-06-27)

v4 新增:
- 联赛积分榜 (La Liga + Premier League top 5) via get_season_standings
- 关注球队近 5 场战绩 via get_team_schedule
- RSS 新闻聚合 (BBC Sport / Sky Sports / ESPN) via news fetch_feed
- xG 数据 (top 5 联赛已结束比赛) via get_event_xg
- 转会动态 via news fetch_items (Google News)

设计:
- morning / evening 两个独立函数
- 多数据源: ESPN (赛程/积分/阵容) + Understat (xG) + RSS (BBC/Sky/ESPN) + Google News
- 所有 call_skill 调用有降级处理,单源失败不影响整体

输出:
- 早报: source/_posts/football-morning-YYYY-MM-DD.md
- 晚报: source/_posts/football-evening-YYYY-MM-DD.md
- 同时备份到 D:/WorkBuddy-Outputs/Football-Daily/

用法:
  python football_daily_v2.py morning
  python football_daily_v2.py evening
  python football_daily_v2.py morning --preview
"""

import sys
import os
import json
import argparse
import subprocess
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ==================== 路径配置 ====================
SCRIPT_DIR = Path(__file__).parent.resolve()
BLOG_ROOT = SCRIPT_DIR.parent
POSTS_DIR = Path(os.environ.get('POSTS_DIR', BLOG_ROOT / 'source' / '_posts'))
D = Path('D:/WorkBuddy-Outputs/Football-Daily')
D.mkdir(parents=True, exist_ok=True)

# 北京时间
BJ = timezone(timedelta(hours=8))

# ==================== 国旗 CDN ====================
# ESPN abbr -> flagcdn ISO alpha-2
# GLM 已实测全部 48 队 200 OK（2026-06-30）
FLAG_MAP = {
    'ALG': 'dz', 'ARG': 'ar', 'AUS': 'au', 'AUT': 'at',
    'BEL': 'be', 'BIH': 'ba', 'BRA': 'br', 'CAN': 'ca',
    'CIV': 'ci', 'COD': 'cd', 'COL': 'co', 'CPV': 'cv',
    'CRO': 'hr', 'CUW': 'cw', 'CZE': 'cz', 'ECU': 'ec',
    'EGY': 'eg', 'ENG': 'gb-eng', 'ESP': 'es', 'FRA': 'fr',
    'GER': 'de', 'GHA': 'gh', 'HAI': 'ht', 'IRN': 'ir',
    'IRQ': 'iq', 'JOR': 'jo', 'JPN': 'jp', 'KOR': 'kr',
    'KSA': 'sa', 'MAR': 'ma', 'MEX': 'mx', 'NED': 'nl',
    'NOR': 'no', 'NZL': 'nz', 'PAN': 'pa', 'PAR': 'py',
    'POR': 'pt', 'QAT': 'qa', 'RSA': 'za', 'SCO': 'gb-sct',
    'SEN': 'sn', 'SUI': 'ch', 'SWE': 'se', 'TUN': 'tn',
    'TUR': 'tr', 'URU': 'uy', 'USA': 'us', 'UZB': 'uz',
}
FLAG_CDN = 'https://flagcdn.com/w80'

def team_flag(team_abbr_or_name, fallback_name=''):
    """从 ESPN abbreviation 或 team name 生成国旗 markdown img"""
    abbr = ''
    if team_abbr_or_name and team_abbr_or_name in FLAG_MAP:
        abbr = team_abbr_or_name
    iso = FLAG_MAP.get(abbr, '')
    if iso:
        alt = fallback_name or abbr
        return f'![{alt}]({FLAG_CDN}/{iso}.png)'
    return ''

def team_flag_from_match(m: dict, side: str = 'home'):
    """从比赛 dict 里提取对应 side 的国旗"""
    competitors = m.get('competitors', [])
    idx = 0 if side == 'home' else 1
    if len(competitors) > idx:
        abbr = safe(competitors[idx], 'team', 'abbreviation', default='')
        name = safe(competitors[idx], 'team', 'name', default='')
        return team_flag(abbr, name)
    return ''

# ==================== 模式开关 ====================
# True  = 世界杯模式（联赛休赛期）
# False = 联赛模式（默认，原始逻辑）
WORLD_CUP_MODE = True

# 世界杯赛季（ESPN）
WC_COMPETITION = 'fifa.world'
WC_SEASON_ID = 'world-cup-2026'

# 世界杯关注国家队（ESPN team IDs）
WC_FOLLOWED_TEAMS = {
    '164': '西班牙',
    '202': '阿根廷',
    '478': '法国',
    '464': '挪威',
    '448': '英格兰',
}

# 世界杯新闻关键词（Google News）
WC_NEWS_QUERIES = [
    'FIFA World Cup 2026 results',
    'World Cup highlights goals',
    'Spain World Cup squad',
    'Argentina World Cup Messi',
    'France World Cup team news',
    'Norway World Cup Haaland',
    'England World Cup',
    'World Cup shock upset',
]

# ==================== 关注的球队 / 联赛 ====================
# ESPN team IDs
FOLLOWED_TEAMS = {
    '81':   '巴萨',
    '86':   '皇马',
    '78':   '马竞',
    '1593': '迈阿密国际',
    '788':  '西班牙',
}

# 联赛 slug -> 中文名 (用于积分榜)
LEAGUES = {
    'la-liga':         '西甲',
    'premier-league':  '英超',
    'serie-a':         '意甲',
    'bundesliga':      '德甲',
    'ligue-1':         '法甲',
}

# 新闻搜索关键词 (Google News)
NEWS_QUERIES = [
    'Barcelona La Liga transfer',
    'Real Madrid La Liga team news',
    'Atletico Madrid La Liga',
    'Spain national team World Cup 2026',
    'Inter Miami Messi MLS',
    'Premier League results',
    'Champions League draw',
]

# RSS 源
RSS_FEEDS = [
    ('BBC Sport',    'https://feeds.bbci.co.uk/sport/football/rss.xml'),
    ('Sky Sports',   'https://www.skysports.com/rss/12040'),
    ('ESPN FC',      'https://www.espn.com/espn/rss/soccer/news'),
]

# ==================== 工具函数 ====================
def now_bj():
    return datetime.now(BJ)

def bj_date_str(offset=0):
    d = now_bj() + timedelta(days=offset)
    return d.strftime('%Y-%m-%d')

def bj_date_cn():
    d = now_bj()
    weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return f"{d.year}年{d.month}月{d.day}日 星期{weekdays[d.weekday()]}"

def bj_time_str(utc_str):
    """UTC ISO -> 北京时间 HH:MM"""
    if not utc_str:
        return '?'
    try:
        dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
        bj = dt.astimezone(BJ)
        return bj.strftime('%H:%M')
    except Exception:
        return '?'

# ==================== CLI 调用 (sports-skills) ====================
def call_skill(*args):
    """调用 sports-skills CLI 并解析 JSON"""
    python_candidates = [
        'python3',
        'python',
        sys.executable,
    ]
    for py in python_candidates:
        cmd = [py, '-m', 'sports_skills', *args]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
        except (FileNotFoundError, json.JSONDecodeError, subprocess.TimeoutExpired):
            continue
        except Exception:
            continue
    return None

def safe(d, *keys, default=None):
    for k in keys:
        if isinstance(d, dict):
            d = d.get(k)
        else:
            return default
        if d is None:
            return default
    return d

# ==================== 数据采集层 ====================
def get_today_matches():
    """今日赛程 (所有联赛)"""
    today = bj_date_str()
    data = call_skill('football', 'get_daily_schedule', f'--date={today}')
    if not data or not data.get('status'):
        data = call_skill('football', 'get_daily_schedule')
    return safe(data, 'data', 'events', default=[]) or []

def get_team_schedule(team_id, limit=5):
    """球队近 N 场比赛"""
    data = call_skill('football', 'get_team_schedule', f'--team_id={team_id}')
    results = safe(data, 'data', 'results', default=[]) or []
    return results[:limit] if results else []

def get_league_standings(league_slug):
    """联赛积分榜"""
    # 先拿当前赛季
    season_data = call_skill('football', 'get_current_season', f'--competition_id={league_slug}')
    season_id = safe(season_data, 'data', 'season', 'id')
    if not season_id:
        # fallback: 自己拼
        year = now_bj().year
        season_id = f'{league_slug}-{year}'
    data = call_skill('football', 'get_season_standings', f'--season_id={season_id}')
    return safe(data, 'data', 'standings', default=[]) or []

def get_event_xg(event_id):
    """单场 xG (top 5 联赛)"""
    data = call_skill('football', 'get_event_xg', f'--event_id={event_id}')
    return safe(data, 'data', 'teams', default=[]) or []

def get_news_google(query, limit=5):
    """Google News 搜索"""
    data = call_skill('news', 'fetch_items', '--google_news', f'--query={query}', f'--limit={limit}', '--sort_by_date')
    return safe(data, 'data', 'items', default=[]) or safe(data, 'items', default=[]) or []

def get_news_rss(feed_url, limit=5):
    """RSS feed"""
    data = call_skill('news', 'fetch_feed', f'--url={feed_url}')
    entries = safe(data, 'data', 'entries', default=[]) or safe(data, 'entries', default=[]) or []
    return entries[:limit]

# ==================== 世界杯数据采集 ====================
def get_wc_standings():
    """世界杯小组赛积分榜（所有组）"""
    data = call_skill('football', 'get_season_standings', f'--season_id={WC_SEASON_ID}')
    return safe(data, 'data', 'standings', default=[]) or []

def get_wc_season_schedule():
    """世界杯赛季全部赛程（76 场）"""
    data = call_skill('football', 'get_season_schedule', f'--season_id={WC_SEASON_ID}')
    return safe(data, 'data', 'schedules', default=[]) or []

def get_wc_team_matches(team_id, limit=5):
    """国家队在世界杯的全部比赛（从赛季赛程过滤）"""
    schedules = get_wc_season_schedule()
    team_matches = []
    for s in schedules:
        comps = s.get('competitors', [])
        for c in comps:
            tid = safe(c, 'team', 'id', default='')
            if str(tid) == str(team_id):
                team_matches.append(s)
                break
    team_matches.sort(key=lambda x: x.get('start_time', ''), reverse=True)
    return team_matches[:limit]

def get_wc_event_goals(event_id):
    """单场比赛的进球列表（从 timeline 提取）"""
    data = call_skill('football', 'get_event_timeline', f'--event_id={event_id}')
    timeline = safe(data, 'data', 'timeline', default=[]) or []
    goals = []
    for t in timeline:
        if t.get('type') == 'goal':
            minute = t.get('minute', '?')
            team_name = safe(t, 'team', 'name', default='')
            player_name = safe(t, 'player', 'name', default='')
            if player_name:
                goals.append({
                    'minute': minute,
                    'team': team_name,
                    'player': player_name,
                })
    return goals

def get_wc_top_scorers(limit=10):
    """世界杯全程射手榜（遍历已结束比赛的 timeline 聚合）
    遍历 74 场已结束比赛，每场调 get_event_timeline，提取 goal 事件聚合。
    耗时约 3-5 分钟（每场约 2-3 秒），GitHub Actions 不会超时。
    """
    schedules = get_wc_season_schedule()
    finished = [s for s in schedules if s.get('status') == 'closed']
    scorer_map = {}
    total = len(finished)
    for i, match in enumerate(finished):
        eid = match.get('id')
        if not eid:
            continue
        if (i + 1) % 10 == 0:
            print(f"  射手榜进度: {i+1}/{total}")
        goals = get_wc_event_goals(str(eid))
        for g in goals:
            pname = g['player']
            if pname not in scorer_map:
                scorer_map[pname] = {'goals': 0, 'team': g['team']}
            scorer_map[pname]['goals'] += 1
    sorted_scorers = sorted(scorer_map.items(), key=lambda x: -x[1]['goals'])
    return [(name, info['goals'], info['team']) for name, info in sorted_scorers[:limit]]

# ==================== 格式化函数 ====================
def get_team_names(m: dict):
    """从 events[].competitors[].team 提取两队名"""
    competitors = m.get('competitors', [])
    if len(competitors) >= 2:
        home = safe(competitors[0], 'team', 'name', default=safe(competitors[0], 'team', 'displayName', default='?'))
        away = safe(competitors[1], 'team', 'name', default=safe(competitors[1], 'team', 'displayName', default='?'))
        return home, away
    return '?', '?'

def get_match_time(m: dict) -> str:
    st = m.get('start_time') or m.get('utcDate')
    return bj_time_str(st) if st else '?'

def get_comp_name(m: dict) -> str:
    return safe(m, 'competition', 'name', default='') or ''

def get_status_cn(m: dict) -> str:
    """比赛状态中文"""
    s = safe(m, 'status', default='')
    mapping = {
        'not_started': '未开始', 'scheduled': '未开始', 'TIMED': '未开始',
        'live': '进行中', 'in_play': '进行中',
        'halftime': '中场',
        'closed': '已结束', 'finished': '已结束', 'final': '已结束', 'STATUS_FINAL': '已结束',
        'postponed': '延期',
    }
    return mapping.get(s, s or '')

# ==================== 世界杯富文本卡片 ====================
def wc_match_card(m: dict) -> str:
    """世界杯比赛卡片（带国旗 + 交互折叠）"""
    home_flag = team_flag_from_match(m, 'home')
    away_flag = team_flag_from_match(m, 'away')
    home_name, away_name = get_team_names(m)
    comp = get_comp_name(m)
    st = get_status_cn(m)
    mt = get_match_time(m)

    # 比赛链接（ESPN 官网）
    eid = m.get('id', '')
    match_link = f'https://www.espn.com/soccer/match/_/gameId/{eid}' if eid else '#'

    competitors = m.get('competitors', [])
    home_score = away_score = ''
    if len(competitors) >= 2:
        hs = competitors[0].get('score')
        as_ = competitors[1].get('score')
        if hs is not None:
            home_score = str(hs)
        if as_ is not None:
            away_score = str(as_)

    # 状态颜色 emoji
    if st == '已结束':
        status_emoji = '✅'
        score_str = f'**{home_score} - {away_score}**' if home_score else 'VS'
    elif st == '进行中':
        status_emoji = '🔴'
        score_str = f'**{home_score} - {away_score}**' if home_score else 'VS'
    else:
        status_emoji = '⏰'
        score_str = 'VS'

    card = f"""{home_flag} {home_name} {score_str} {away_name} {away_flag} {status_emoji} {comp} · {mt} · {st}

🏟️ [📺 查看比赛详情]({match_link})
"""
    return card

def wc_match_card_compact(m: dict) -> str:
    """紧凑版比赛卡片（一行，用于预告列表）"""
    home_flag = team_flag_from_match(m, 'home')
    away_flag = team_flag_from_match(m, 'away')
    home_name, away_name = get_team_names(m)
    comp = get_comp_name(m)
    mt = get_match_time(m)
    return f'{home_flag} **{home_name}** vs **{away_name}** {away_flag} · {mt} · {comp}'

def wc_group_standings_card(group_data: dict) -> str:
    """世界杯小组积分榜卡片（带国旗 + 折叠交互）"""
    group_name = group_data.get('name', '')
    entries = group_data.get('entries', [])
    if not entries:
        return ''

    header = f"""<details open>

🏆 {group_name}

| # | 标记 | 球队 | 赛 | 胜 | 平 | 负 | 进 | 失 | 净 | 分 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
"""
    rows = []
    for e in sorted(entries, key=lambda x: x.get('position', 999)):
        pos = e.get('position', '?')
        team = safe(e, 'team', 'name', default='?')
        abbr = safe(e, 'team', 'abbreviation', default='')
        flag = team_flag(abbr, team)
        played = e.get('played', 0)
        won = e.get('won', 0)
        drawn = e.get('drawn', 0)
        lost = e.get('lost', 0)
        gf = e.get('goals_for', 0)
        ga = e.get('goals_against', 0)
        gd = e.get('goal_difference', 0)
        pts = e.get('points', 0)
        # 出线标记（小组前 2 名 = 出线，3-4 名 = 淘汰）
        marker = '🟢' if pos <= 2 else '⚪'
        rows.append(f'| {pos} | {marker} | {flag} {team} | {played} | {won} | {drawn} | {lost} | {gf} | {ga} | {gd} | {pts} |')

    footer = """

🟢 = 出线区 · ⚪ = 淘汰区
</details>
"""
    return header + '\n'.join(rows) + footer

def wc_scorer_card(rank, name, goals, team) -> str:
    """射手榜单行卡片（带交互按钮）"""
    medal = '🥇' if rank == 1 else '🥈' if rank == 2 else '🥉' if rank == 3 else f'{rank}.'
    search_link = f'https://www.google.com/search?q={name}+{team}+World+Cup+2026+goal'
    return f'| {medal} | {name} | {team} | **{goals}** | [🔍]({search_link}) |'

def format_match_row(m: dict) -> str:
    home, away = get_team_names(m)
    return f"| {get_comp_name(m)} | {get_match_time(m)} | {home} vs {away} | {get_status_cn(m)} |"

def format_finished_row(m: dict) -> str:
    home, away = get_team_names(m)
    comp = get_comp_name(m)
    competitors = m.get('competitors', [])
    sh = sa = '?'
    if len(competitors) >= 2:
        sh = competitors[0].get('score', '?')
        sa = competitors[1].get('score', '?')
    return f"| {comp} | {home} | **{sh}-{sa}** | {away} |"

def format_news_item(item: dict) -> str:
    title = item.get('title', '?')
    link = item.get('link') or item.get('url', '#')
    source = item.get('source', '')
    pub = item.get('published', '')
    suffix = ''
    if source:
        suffix += f' *({source})*'
    if pub:
        suffix += f' `{pub}`'
    return f"- [{title}]({link}){suffix}"

def is_standings_empty(standings_list):
    """检测积分榜是否全 0（休赛期新赛季空数据）"""
    if not standings_list:
        return True
    for s in standings_list:
        entries = s.get('entries', []) if isinstance(s, dict) else []
        if isinstance(s, dict) and 'team' in s:
            entries = [s]
        for e in entries:
            played = e.get('played', 0)
            if played and played > 0:
                return False
    return True

def format_standings_table(standings_list, league_name, top_n=5):
    """从 standings 数据提取积分榜 top N"""
    if not standings_list:
        return f"> {league_name} 积分暂不可用。\n"
    # standings 可能是 list of dicts，每个有 entries
    entries = []
    for s in standings_list:
        if isinstance(s, dict) and 'entries' in s:
            entries.extend(s['entries'])
        elif isinstance(s, dict) and 'team' in s:
            entries.append(s)
    # 排序 by position
    entries.sort(key=lambda x: x.get('position', 999))
    if not entries:
        return f"> {league_name} 积分暂不可用。\n"
    lines = [f"| 排名 | 球队 | 赛 | 胜 | 平 | 负 | 进 | 失 | 净 | 分 |\n|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n"]
    for e in entries[:top_n]:
        pos = e.get('position', '?')
        team = safe(e, 'team', 'name', default='?')
        played = e.get('played', '?')
        won = e.get('won', '?')
        drawn = e.get('drawn', '?')
        lost = e.get('lost', '?')
        gf = e.get('goals_for', '?')
        ga = e.get('goals_against', '?')
        gd = e.get('goal_difference', '?')
        pts = e.get('points', '?')
        lines.append(f"| {pos} | {team} | {played} | {won} | {drawn} | {lost} | {gf} | {ga} | {gd} | **{pts}** |\n")
    return ''.join(lines)

def format_team_recent(team_name, results, limit=5):
    """格式化球队近 N 场"""
    if not results:
        return f"> {team_name} 近期暂无比赛数据。\n"
    lines = []
    for r in results[:limit]:
        home, away = get_team_names(r)
        competitors = r.get('competitors', [])
        sh = sa = '?'
        if len(competitors) >= 2:
            sh = competitors[0].get('score', '?')
            sa = competitors[1].get('score', '?')
        comp = get_comp_name(r)
        date = bj_time_str(r.get('start_time', ''))
        lines.append(f"  - {comp} | {home} {sh}-{sa} {away} ({date})")
    return '\n'.join(lines) + '\n'

# ==================== 早报 (morning) ====================
def generate_morning_md() -> str:
    if WORLD_CUP_MODE:
        return generate_morning_wc_md()
    today_cn = bj_date_cn()
    today_str = bj_date_str()

    # 拉数据
    print("📅 拉取今日赛程...")
    events = get_today_matches()
    print("📊 拉取联赛积分榜...")
    laliga_standings = get_league_standings('la-liga')
    pl_standings = get_league_standings('premier-league')
    print("⚽ 拉取关注球队近况...")
    barca_recent = get_team_schedule('81', limit=5)
    real_recent = get_team_schedule('86', limit=5)
    print("🗞️ 拉取新闻 (Google News)...")
    news = []
    for q in NEWS_QUERIES[:4]:
        items = get_news_google(q, limit=3)
        news.extend(items)
    print("📡 拉取 RSS 新闻...")
    rss_items = []
    for name, url in RSS_FEEDS[:2]:
        entries = get_news_rss(url, limit=4)
        for e in entries:
            e['source'] = e.get('source', name)
        rss_items.extend(entries)

    # 渲染 markdown
    md = []
    md.append(f"""---
title: 足球早报 · {today_cn}
date: {today_str} 08:00:00
excerpt: 晨间战报 + 赛程速览 + 积分榜
description: 晨间战报 · 赛程速览 · 积分榜 · 数据驱动
cover_color: '#07C160'
tags:
  - 足球
  - 早报
  - 数据驱动
categories:
  - 足球日报
---

> ☀️ 早报 · 晨间战报 + 赛程速览 · 数据来源 ESPN + Understat + RSS
> 抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # 1. 今日赛程
    md.append("## 📅 今日赛程\n\n")
    if events:
        md.append("| 赛事 | 开球 | 对阵 | 状态 |\n|:---:|:---:|:---:|:---:|\n")
        for e in events[:12]:
            md.append(format_match_row(e) + "\n")
    else:
        md.append("> 今日暂无重要比赛。\n")

    # 2. 联赛积分榜
    md.append("\n---\n\n## 🏆 联赛积分榜\n\n")
    md.append("### 西甲 La Liga\n\n")
    md.append(format_standings_table(laliga_standings, '西甲', top_n=5))
    md.append("\n### 英超 Premier League\n\n")
    md.append(format_standings_table(pl_standings, '英超', top_n=5))

    # 3. 关注球队近况
    md.append("\n---\n\n## ⭐ 关注球队近况\n\n")
    md.append("**巴萨 (Barcelona) 近 5 场：**\n\n")
    md.append(format_team_recent('巴萨', barca_recent))
    md.append("\n**皇马 (Real Madrid) 近 5 场：**\n\n")
    md.append(format_team_recent('皇马', real_recent))

    # 4. 新闻聚合
    md.append("\n---\n\n## 🗞️ 新闻速递\n\n")
    md.append("### Google News 聚合\n\n")
    if news:
        seen = set()
        for n in news:
            title = n.get('title', '')
            if title and title not in seen:
                seen.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen) >= 8:
                break
    else:
        md.append("> 暂无相关新闻。\n")

    md.append("\n### RSS 精选\n\n")
    if rss_items:
        seen_rss = set()
        for n in rss_items:
            title = n.get('title', '')
            if title and title not in seen_rss:
                seen_rss.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen_rss) >= 6:
                break
    else:
        md.append("> RSS 源暂无返回。\n")

    # 5. 数据来源
    md.append(f"""
---

*本文为「足球日报」自动生成 (v4 增强版)。数据来源：ESPN · Understat · BBC Sport · Sky Sports · Google News。*
*生成时间：{now_bj().strftime('%Y-%m-%d %H:%M')} GMT+8*
""")
    return '\n'.join(md)

# ==================== 晚报 (evening) ====================
def generate_evening_md() -> str:
    if WORLD_CUP_MODE:
        return generate_evening_wc_md()
    today_cn = bj_date_cn()
    today_str = bj_date_str()

    # 拉数据
    print("📅 拉取今日赛程...")
    events = get_today_matches()
    print("📊 拉取联赛积分榜...")
    laliga_standings = get_league_standings('la-liga')
    pl_standings = get_league_standings('premier-league')
    seriea_standings = get_league_standings('serie-a')
    print("⚽ 拉取关注球队近况...")
    barca_recent = get_team_schedule('81', limit=5)
    real_recent = get_team_schedule('86', limit=5)
    atleti_recent = get_team_schedule('78', limit=5)
    print("📈 拉取已结束比赛 xG...")
    finished_events = [e for e in events if get_status_cn(e) == '已结束']
    xg_data = {}
    for e in finished_events[:3]:
        eid = e.get('id')
        if eid:
            xg_teams = get_event_xg(str(eid))
            if xg_teams:
                xg_data[eid] = xg_teams
    print("🗞️ 拉取新闻 (Google News + RSS)...")
    news = []
    for q in NEWS_QUERIES:
        items = get_news_google(q, limit=3)
        news.extend(items)
    rss_items = []
    for name, url in RSS_FEEDS:
        entries = get_news_rss(url, limit=5)
        for e in entries:
            e['source'] = e.get('source', name)
        rss_items.extend(entries)

    # 渲染 markdown
    md = []
    md.append(f"""---
title: 足球晚报 · {today_cn}
date: {today_str} 20:00:00
excerpt: 晚间战报 + 积分榜 + xG + 新闻
description: 晚间战报 · 积分榜 · xG 数据 · 新闻聚合 · 数据驱动
cover_color: '#1E3A8A'
tags:
  - 足球
  - 晚报
  - 数据驱动
categories:
  - 足球日报
---

> 🌙 晚报 · 晚间战报 + 积分榜 + xG + 新闻聚合 · 数据来源 ESPN + Understat + RSS
> 抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # 1. 今日战报 (已结束)
    md.append("## ⚽ 今日战报\n\n")
    if finished_events:
        md.append("| 赛事 | 主队 | 比分 | 客队 |\n|:---:|:---:|:---:|:---:|\n")
        for e in finished_events[:12]:
            md.append(format_finished_row(e) + "\n")
    else:
        md.append("> 今日暂无已结束比赛。\n")

    # 2. xG 数据 (如果有)
    if xg_data:
        md.append("\n### 📈 今日 xG 数据\n\n")
        md.append("| 比赛 | 主队 xG | 客队 xG |\n|:---:|:---:|:---:|\n")
        for eid, teams in xg_data.items():
            if isinstance(teams, list) and len(teams) >= 2:
                t1 = teams[0]
                t2 = teams[1]
                name1 = safe(t1, 'team', 'name', default='?')
                name2 = safe(t2, 'team', 'name', default='?')
                xg1 = safe(t1, 'xg', default='?')
                xg2 = safe(t2, 'xg', default='?')
                md.append(f"| {name1} vs {name2} | {xg1} | {xg2} |\n")

    # 3. 联赛积分榜 (晚报版加意甲)
    md.append("\n---\n\n## 🏆 联赛积分榜\n\n")
    md.append("### 西甲 La Liga\n\n")
    md.append(format_standings_table(laliga_standings, '西甲', top_n=8))
    md.append("\n### 英超 Premier League\n\n")
    md.append(format_standings_table(pl_standings, '英超', top_n=5))
    md.append("\n### 意甲 Serie A\n\n")
    md.append(format_standings_table(seriea_standings, '意甲', top_n=5))

    # 4. 关注球队近况
    md.append("\n---\n\n## ⭐ 关注球队近况\n\n")
    md.append("**巴萨 (Barcelona) 近 5 场：**\n\n")
    md.append(format_team_recent('巴萨', barca_recent))
    md.append("\n**皇马 (Real Madrid) 近 5 场：**\n\n")
    md.append(format_team_recent('皇马', real_recent))
    md.append("\n**马竞 (Atletico Madrid) 近 5 场：**\n\n")
    md.append(format_team_recent('马竞', atleti_recent))

    # 5. 明日预告
    md.append("\n---\n\n## 📆 明日预告\n\n")
    tomorrow = bj_date_str(1)
    upcoming = [e for e in events if get_status_cn(e) == '未开始']
    if upcoming:
        md.append("| 赛事 | 开球 | 对阵 |\n|:---:|:---:|:---:|\n")
        for e in upcoming[:8]:
            home, away = get_team_names(e)
            md.append(f"| {get_comp_name(e)} | {get_match_time(e)} | {home} vs {away} |\n")
    else:
        md.append("> 明日暂无已公布赛程。\n")

    # 6. 新闻聚合 (完整版)
    md.append("\n---\n\n## 🗞️ 新闻聚合 (完整版)\n\n")
    md.append("### Google News\n\n")
    if news:
        seen = set()
        for n in news:
            title = n.get('title', '')
            if title and title not in seen:
                seen.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen) >= 12:
                break
    else:
        md.append("> 暂无相关新闻。\n")

    md.append("\n### RSS 精选 (BBC + Sky + ESPN)\n\n")
    if rss_items:
        seen_rss = set()
        for n in rss_items:
            title = n.get('title', '')
            if title and title not in seen_rss:
                seen_rss.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen_rss) >= 10:
                break
    else:
        md.append("> RSS 源暂无返回。\n")

    # 页脚
    md.append(f"""

---

*本文为「足球日报」自动生成 (v4 增强版)。数据来源：ESPN · Understat · BBC Sport · Sky Sports · ESPN FC · Google News。*
*生成时间：{now_bj().strftime('%Y-%m-%d %H:%M')} GMT+8*
""")
    return '\n'.join(md)


# ==================== 世界杯早报 ====================
def generate_morning_wc_md() -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()

    print("📅 拉取今日赛程...")
    events = get_today_matches()
    wc_events = [e for e in events if 'World Cup' in get_comp_name(e)]
    other_events = [e for e in events if 'World Cup' not in get_comp_name(e)]
    events_sorted = wc_events + other_events

    print("🏆 拉取世界杯小组积分榜...")
    wc_standings = get_wc_standings()

    print("⚽ 拉取世界杯全程射手榜（可能需要 3-5 分钟）...")
    top_scorers = get_wc_top_scorers(limit=10)

    print("🗞️ 拉取新闻 (Google News)...")
    news = []
    for q in WC_NEWS_QUERIES[:5]:
        items = get_news_google(q, limit=3)
        news.extend(items)
    print("📡 拉取 RSS 新闻...")
    rss_items = []
    for name, url in RSS_FEEDS[:2]:
        entries = get_news_rss(url, limit=4)
        for e in entries:
            e['source'] = e.get('source', name)
        rss_items.extend(entries)

    md = []
    md.append(f"""---
title: 足球早报 · {today_cn}
date: {today_str} 08:00:00
excerpt: 世界杯晨间赛程 + 小组积分榜 + 射手榜
description: 世界杯晨间赛程 · 小组积分榜 · 射手榜 · 数据驱动
cover_color: '#07C160'
tags:
  - 足球
  - 早报
  - 世界杯
  - 数据驱动
categories:
  - 足球日报
---

🏟️ 世界杯早报 · 赛程速览 + 小组形势 + 射手榜 · 数据来源 ESPN + RSS
抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # ========== 快速导航 ==========
    md.append("## 🧭 今日导航\n")
    md.append("- [📅 今日赛程](#-今日赛程) · [🏆 小组积分榜](#-小组积分榜) · [⚽ 射手榜](#-世界杯射手榜) · [⭐ 关注国家队](#-关注国家队) · [🗞️ 新闻](#-新闻速递)\n\n")

    # ========== 1. 今日赛程（卡片版） ==========
    md.append("## 📅 今日赛程\n\n")
    if events_sorted:
        md.append(f"> 今日共 {len(events_sorted)} 场比赛（世界杯 {len(wc_events)} 场）\n\n")
        for e in events_sorted[:12]:
            md.append(wc_match_card(e))
    else:
        md.append("> 今日暂无比赛安排。\n")

    # ========== 2. 小组积分榜（折叠卡片） ==========
    md.append("\n---\n\n## 🏆 小组积分榜\n\n")
    if wc_standings:
        followed_ids = set(WC_FOLLOWED_TEAMS.keys())
        priority_groups = []
        other_groups = []
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if has_followed:
                priority_groups.append(s)
            else:
                other_groups.append(s)

        if priority_groups:
            md.append("### ⭐ 关注队所在组\n\n")
            for s in priority_groups:
                md.append(wc_group_standings_card(s))

        if other_groups:
            md.append("\n<details>\n<summary>📁 其他小组（点击展开）</summary>\n\n")
            for s in other_groups:
                md.append(wc_group_standings_card(s))
            md.append("\n</details>\n")
    else:
        md.append("> 世界杯积分榜暂不可用。\n")

    # ========== 3. 射手榜 ==========
    md.append("\n---\n\n## ⚽ 世界杯射手榜\n\n")
    if top_scorers:
        md.append("| 奖牌 | 球员 | 球队 | 进球 | 详情 |\n|:---:|:---:|:---:|:---:|:---:|\n")
        for i, (name, goals, team) in enumerate(top_scorers, 1):
            md.append(wc_scorer_card(i, name, goals, team) + "\n")
    else:
        md.append("> 射手榜暂无数据。\n")

    # ========== 4. 关注国家队（折叠交互） ==========
    md.append("\n---\n\n## ⭐ 关注国家队\n\n")
    md.append("<details open>\n<summary><b>关注国家队近况（点击折叠）</b></summary>\n\n")
    for tid, tname in WC_FOLLOWED_TEAMS.items():
        recent = get_wc_team_matches(tid, limit=3)
        md.append(f"### {tname}\n\n")
        if recent:
            for r in recent:
                md.append(wc_match_card_compact(r) + "\n")
        else:
            md.append(f"> {tname} 暂无比赛数据。\n")
        md.append("\n")
    md.append("</details>\n")

    # ========== 5. 新闻 ==========
    md.append("\n---\n\n## 🗞️ 新闻速递\n\n")
    md.append("<details open>\n<summary><b>Google News</b></summary>\n\n")
    if news:
        seen = set()
        for n in news:
            title = n.get('title', '')
            if title and title not in seen:
                seen.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen) >= 8:
                break
    else:
        md.append("> 暂无相关新闻。\n")
    md.append("</details>\n\n")

    md.append("<details>\n<summary><b>RSS 精选</b></summary>\n\n")
    if rss_items:
        seen_rss = set()
        for n in rss_items:
            title = n.get('title', '')
            if title and title not in seen_rss:
                seen_rss.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen_rss) >= 6:
                break
    else:
        md.append("> RSS 源暂无返回。\n")
    md.append("</details>\n")

    md.append(f"""

本文为「足球日报」自动生成 (世界杯模式)。数据来源：ESPN · BBC Sport · Sky Sports · Google News。
生成时间：{now_bj().strftime('%Y-%m-%d %H:%M')} GMT+8
""")
    return '\n'.join(md)


# ==================== 世界杯晚报 ====================
def generate_evening_wc_md() -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()

    print("📅 拉取今日赛程...")
    events = get_today_matches()
    wc_events = [e for e in events if 'World Cup' in get_comp_name(e)]
    other_events = [e for e in events if 'World Cup' not in get_comp_name(e)]
    events_sorted = wc_events + other_events
    finished_events = [e for e in events if get_status_cn(e) == '已结束']
    finished_wc = [e for e in finished_events if 'World Cup' in get_comp_name(e)]
    upcoming = [e for e in events if get_status_cn(e) == '未开始']

    print("🏆 拉取世界杯小组积分榜...")
    wc_standings = get_wc_standings()

    print("⚽ 拉取世界杯全程射手榜（可能需要 3-5 分钟）...")
    top_scorers = get_wc_top_scorers(limit=15)

    print("📈 拉取今日进球详情...")
    match_goals = {}
    for e in finished_wc[:8]:
        eid = e.get('id')
        if eid:
            match_goals[eid] = get_wc_event_goals(str(eid))

    print("🗞️ 拉取新闻 (Google News + RSS)...")
    news = []
    for q in WC_NEWS_QUERIES:
        items = get_news_google(q, limit=3)
        news.extend(items)
    rss_items = []
    for name, url in RSS_FEEDS:
        entries = get_news_rss(url, limit=5)
        for e in entries:
            e['source'] = e.get('source', name)
        rss_items.extend(entries)

    md = []
    md.append(f"""---
title: 足球晚报 · {today_cn}
date: {today_str} 20:00:00
excerpt: 世界杯战报 + 小组积分榜 + 射手榜 + 进球详情
description: 世界杯晚间战报 · 小组积分榜 · 射手榜 · 进球详情 · 数据驱动
cover_color: '#1E3A8A'
tags:
  - 足球
  - 晚报
  - 世界杯
  - 数据驱动
categories:
  - 足球日报
---

🌙 世界杯晚报 · 战报 + 积分榜 + 射手榜 + 进球详情 · 数据来源 ESPN + RSS
抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # ========== 快速导航 ==========
    md.append("## 🧭 今日导航\n")
    md.append("- [⚽ 今日战报](#-今日战报) · [🏆 小组积分榜](#-小组积分榜) · [⚽ 射手榜](#-世界杯射手榜) · [⭐ 关注国家队](#-关注国家队) · [📆 明日预告](#-明日预告) · [🗞️ 新闻](#-新闻聚合)\n\n")

    # ========== 1. 今日战报（卡片版） ==========
    md.append("## ⚽ 今日战报\n\n")
    if finished_events:
        md.append(f"> 今日已结束 {len(finished_events)} 场（世界杯 {len(finished_wc)} 场）\n\n")
        for e in finished_events[:12]:
            md.append(wc_match_card(e))
    else:
        md.append("> 今日暂无已结束比赛。\n")

    # ========== 2. 进球详情（折叠交互） ==========
    if match_goals:
        md.append("\n<details open>\n<summary><b>⚽ 进球详情（点击折叠）</b></summary>\n\n")
        for eid, goals in match_goals.items():
            if not goals:
                continue
            match_name = ""
            for e in finished_wc:
                if str(e.get('id', '')) == str(eid):
                    home, away = get_team_names(e)
                    match_name = f"{home} vs {away}"
                    break
            if match_name:
                md.append(f"### {match_name}\n\n")
                for g in goals:
                    g_team_flag = ''
                    if g['team']:
                        for e in finished_wc:
                            for c in e.get('competitors', []):
                                if safe(c, 'team', 'name', default='') == g['team']:
                                    abbr = safe(c, 'team', 'abbreviation', default='')
                                    g_team_flag = team_flag(abbr, g['team']) + ' '
                                    break
                    md.append(f"- ⚽ {g_team_flag}{g['minute']}' {g['player']} ({g['team']})\n")
                md.append("\n")
        md.append("</details>\n")

    # ========== 3. 小组积分榜 ==========
    md.append("\n---\n\n## 🏆 小组积分榜\n\n")
    if wc_standings:
        followed_ids = set(WC_FOLLOWED_TEAMS.keys())
        priority_groups = []
        other_groups = []
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if has_followed:
                priority_groups.append(s)
            else:
                other_groups.append(s)

        if priority_groups:
            md.append("### ⭐ 关注队所在组\n\n")
            for s in priority_groups:
                md.append(wc_group_standings_card(s))

        if other_groups:
            md.append("\n<details>\n<summary>📁 其他小组（点击展开）</summary>\n\n")
            for s in other_groups:
                md.append(wc_group_standings_card(s))
            md.append("\n</details>\n")
    else:
        md.append("> 世界杯积分榜暂不可用。\n")

    # ========== 4. 射手榜 ==========
    md.append("\n---\n\n## ⚽ 世界杯射手榜\n\n")
    if top_scorers:
        md.append("| 奖牌 | 球员 | 球队 | 进球 | 详情 |\n|:---:|:---:|:---:|:---:|:---:|\n")
        for i, (name, goals, team) in enumerate(top_scorers, 1):
            md.append(wc_scorer_card(i, name, goals, team) + "\n")
    else:
        md.append("> 射手榜暂无数据。\n")

    # ========== 5. 关注国家队（折叠交互） ==========
    md.append("\n---\n\n## ⭐ 关注国家队\n\n")
    md.append("<details open>\n<summary><b>关注国家队近况（点击折叠）</b></summary>\n\n")
    for tid, tname in WC_FOLLOWED_TEAMS.items():
        recent = get_wc_team_matches(tid, limit=3)
        md.append(f"### {tname}\n\n")
        if recent:
            for r in recent:
                md.append(wc_match_card_compact(r) + "\n")
        else:
            md.append(f"> {tname} 暂无比赛数据。\n")
        md.append("\n")
    md.append("</details>\n")

    # ========== 6. 明日预告 ==========
    md.append("\n---\n\n## 📆 明日预告\n\n")
    if upcoming:
        md.append(f"> 明日共 {len(upcoming)} 场比赛\n\n")
        for e in upcoming[:8]:
            md.append(wc_match_card_compact(e) + "\n")
    else:
        md.append("> 明日暂无已公布赛程。\n")

    # ========== 7. 新闻 ==========
    md.append("\n---\n\n## 🗞️ 新闻聚合\n\n")
    md.append("<details open>\n<summary><b>Google News</b></summary>\n\n")
    if news:
        seen = set()
        for n in news:
            title = n.get('title', '')
            if title and title not in seen:
                seen.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen) >= 12:
                break
    else:
        md.append("> 暂无相关新闻。\n")
    md.append("</details>\n\n")

    md.append("<details>\n<summary><b>RSS 精选</b></summary>\n\n")
    if rss_items:
        seen_rss = set()
        for n in rss_items:
            title = n.get('title', '')
            if title and title not in seen_rss:
                seen_rss.add(title)
                md.append(format_news_item(n) + "\n")
            if len(seen_rss) >= 10:
                break
    else:
        md.append("> RSS 源暂无返回。\n")
    md.append("</details>\n")

    md.append(f"""

本文为「足球日报」自动生成 (世界杯模式)。数据来源：ESPN · BBC Sport · Sky Sports · ESPN FC · Google News。
生成时间：{now_bj().strftime('%Y-%m-%d %H:%M')} GMT+8
""")
    return '\n'.join(md)

# ==================== Main ====================
def main():
    parser = argparse.ArgumentParser(description='足球日报 v4 增强版')
    parser.add_argument('edition', choices=['morning', 'evening'], help='早报或晚报')
    parser.add_argument('--preview', action='store_true', help='只写到 D:/WorkBuddy-Outputs 备份')
    args = parser.parse_args()

    edition = args.edition
    today_str = bj_date_str()

    print(f"=== ⚽ 足球日报 v4 增强版 · {edition} ===")
    print(f"北京时间: {bj_date_cn()}")
    print(f"输出目录: {POSTS_DIR}")
    print()

    # 1. 生成 markdown
    if edition == 'morning':
        md = generate_morning_md()
    else:
        md = generate_evening_md()

    # 2. 写到文件
    if args.preview:
        filename = f'football-{edition}-preview-{today_str}.md'
        out = D / filename
        out.write_text(md, encoding='utf-8')
        print(f"\n✅ Preview 写到: {out}")
    else:
        POSTS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f'football-{edition}-{today_str}.md'
        filepath = POSTS_DIR / filename
        filepath.write_text(md, encoding='utf-8')
        print(f"\n✅ {filename} 生成完成")

        # 备份
        backup = D / filename
        backup.write_text(md, encoding='utf-8')
        print(f"✅ 备份: {backup}")

    print(f"\n🎉 完成。")

if __name__ == '__main__':
    main()
