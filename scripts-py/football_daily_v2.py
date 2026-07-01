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
FLAG_CDN = 'https://flagcdn.com/w40'

# ==================== FotMob 风格 CSS ====================
# 配色 + 组件样式。Task 2 会插入到最终 HTML <style> 块
WC_CSS = """:root {
  --bg-page: #F5F5F5;
  --bg-card: #FFFFFF;
  --color-score: #00C853;
  --color-time: #FF6D00;
  --color-title: #1A1A1A;
  --color-body: #333333;
  --color-muted: #999999;
  --color-qualify: #4CAF50;
  --color-playoff: #FFC107;
  --color-eliminated: #E0E0E0;
  --header-bg: #0E2F7E;
  --radius-card: 12px;
  --radius-score: 6px;
  --radius-pill: 20px;
}
body { margin:0; background:var(--bg-page); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:var(--color-body); font-size:14px; }
.wc-container { max-width:680px; margin:0 auto; padding:0; }
.wc-header { background:var(--header-bg); color:#fff; padding:24px 20px; text-align:center; }
.wc-header h1 { margin:0; font-size:22px; font-weight:700; }
.wc-header .sub { margin-top:4px; font-size:12px; opacity:0.8; }
.wc-header .flag-circle { width:36px; height:36px; border-radius:50%; vertical-align:middle; margin-right:8px; }
.wc-section { background:var(--bg-card); border-radius:var(--radius-card); margin:12px 0; overflow:hidden; }
.wc-section-title { padding:12px 16px 8px; font-size:16px; font-weight:600; color:var(--color-title); border-bottom:1px solid #EEE; }
.wc-match-row { display:flex; align-items:center; padding:10px 16px; border-bottom:1px solid #F5F5F5; min-height:48px; }
.wc-match-row:last-child { border-bottom:none; }
.wc-match-team { flex:1; display:flex; align-items:center; gap:6px; font-size:14px; color:var(--color-body); }
.wc-match-team.right { justify-content:flex-end; text-align:right; }
.wc-flag { width:20px; height:20px; border-radius:50%; object-fit:cover; flex-shrink:0; }
.wc-score { background:var(--color-score); color:#fff; padding:4px 12px; border-radius:var(--radius-score); font-weight:700; font-size:15px; min-width:50px; text-align:center; }
.wc-score.live { animation:pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.85} }
.wc-time { color:var(--color-time); font-weight:600; font-size:14px; min-width:50px; text-align:center; }
.wc-status { font-size:11px; color:var(--color-muted); margin-left:6px; }
.wc-standings { width:100%; border-collapse:collapse; font-size:13px; }
.wc-standings th { color:var(--color-muted); font-weight:400; padding:8px 6px; text-align:right; font-size:11px; }
.wc-standings th:first-child, .wc-standings td:first-child { text-align:left; padding-left:16px; }
.wc-standings td { padding:6px; text-align:right; }
.wc-standings td.team-cell { text-align:left; }
.wc-rank-bar { display:inline-block; width:4px; height:20px; border-radius:2px; margin-right:8px; vertical-align:middle; }
.wc-rank-bar.qualify { background:var(--color-qualify); }
.wc-rank-bar.playoff { background:var(--color-playoff); }
.wc-rank-bar.eliminated { background:var(--color-eliminated); }
.wc-scorer-row { display:flex; align-items:center; padding:8px 16px; border-bottom:1px solid #F5F5F5; gap:8px; }
.wc-scorer-rank { width:24px; font-weight:700; color:var(--color-muted); font-size:13px; }
.wc-scorer-name { flex:1; font-size:14px; }
.wc-scorer-team { font-size:12px; color:var(--color-muted); }
.wc-scorer-bar { height:8px; border-radius:4px; background:var(--color-score); min-width:20px; }
.wc-scorer-goals { font-weight:700; font-size:15px; min-width:24px; text-align:right; }
.wc-news-card { display:flex; gap:12px; padding:12px 16px; border-bottom:1px solid #F5F5F5; }
.wc-news-thumb { width:60px; height:60px; border-radius:8px; object-fit:cover; flex-shrink:0; background:#EEE; }
.wc-news-body { flex:1; }
.wc-news-title { font-size:15px; font-weight:500; color:var(--color-title); margin:0 0 4px; line-height:1.3; }
.wc-news-meta { font-size:12px; color:var(--color-muted); }
.wc-news-source { color:var(--color-score); font-weight:500; }
.wc-badge { display:inline-block; padding:2px 8px; border-radius:var(--radius-pill); font-size:11px; font-weight:500; background:rgba(255,255,255,0.2); color:#fff; }
.wc-followed-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 16px; }
.wc-followed-card { border-radius:16px; padding:16px; color:#fff; text-align:center; }
.wc-followed-card .flag-lg { width:48px; height:48px; border-radius:50%; margin:0 auto 8px; display:block; }
.wc-followed-card .team-name { font-size:15px; font-weight:700; }
.wc-followed-card .next-match { font-size:12px; opacity:0.85; margin-top:4px; }"""

def team_flag(team_abbr_or_name, fallback_name='', size=20):
    """从 ESPN abbreviation 生成圆形国旗 HTML img"""
    abbr = ''
    if team_abbr_or_name and team_abbr_or_name in FLAG_MAP:
        abbr = team_abbr_or_name
    iso = FLAG_MAP.get(abbr, '')
    if iso:
        alt = fallback_name or abbr
        return f'<img class="wc-flag" src="{FLAG_CDN}/{iso}.png" alt="{alt}" width="{size}" height="{size}">'
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

# ==================== 世界杯富文本卡片（HTML FotMob 风格）====================
def wc_header_hero(title='足球早报', subtitle='') -> str:
    """FotMob 风格品牌色 Header Hero"""
    today_cn = bj_date_cn()
    sub = subtitle or f'{today_cn} · 世界杯淘汰赛'
    return f"""<div class="wc-header"><span class="wc-badge">世界杯</span><h1>⚽ {title}</h1><div class="sub">{sub}</div></div>"""


def wc_match_row(m: dict) -> str:
    """FotMob 风格单行比赛组件（HTML）"""
    home_name, away_name = get_team_names(m)
    home_flag = team_flag_from_match(m, 'home')
    away_flag = team_flag_from_match(m, 'away')
    st = get_status_cn(m)
    mt = get_match_time(m)
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

    # 中间区域：比分框 or 时间
    if st == '已结束':
        center = f'<a href="{match_link}" class="wc-score">{home_score}-{away_score}</a>'
        status_str = ''
    elif st == '进行中':
        center = f'<a href="{match_link}" class="wc-score live">{home_score}-{away_score}</a>'
        status_str = '<span class="wc-status">进行中</span>'
    else:
        center = f'<span class="wc-time">{mt}</span>'
        status_str = ''

    return f"""<div class="wc-match-row"><div class="wc-match-team">{home_flag}<span>{home_name}</span></div>{center}{status_str}<div class="wc-match-team right"><span>{away_name}</span>{away_flag}</div></div>"""


def wc_match_card_compact(m: dict) -> str:
    """紧凑版比赛行（HTML，用于预告/关注队列表，无比分框只有时间）"""
    home_name, away_name = get_team_names(m)
    home_flag = team_flag_from_match(m, 'home')
    away_flag = team_flag_from_match(m, 'away')
    mt = get_match_time(m)
    return f"""<div class="wc-match-row"><div class="wc-match-team">{home_flag}<span>{home_name}</span></div><span class="wc-time">{mt}</span><div class="wc-match-team right"><span>{away_name}</span>{away_flag}</div></div>"""


def wc_group_standings_card(group_data: dict) -> str:
    """FotMob 风格积分榜（HTML 紧凑表 + 彩色排名条带）"""
    group_name = group_data.get('name', '')
    entries = group_data.get('entries', [])
    if not entries:
        return ''

    rows_html = []
    for e in sorted(entries, key=lambda x: x.get('position', 999)):
        pos = e.get('position', '?')
        team = safe(e, 'team', 'name', default='?')
        abbr = safe(e, 'team', 'abbreviation', default='')
        flag = team_flag(abbr, team, size=16)
        played = e.get('played', 0)
        gd = e.get('goal_difference', 0)
        pts = e.get('points', 0)
        # 排名条带颜色
        if pos <= 2:
            bar_class = 'qualify'
        elif pos == 3:
            bar_class = 'playoff'
        else:
            bar_class = 'eliminated'
        gd_str = f'+{gd}' if gd > 0 else str(gd)
        rows_html.append(f"""<tr><td class="team-cell"><span class="wc-rank-bar {bar_class}"></span>{pos} {flag} {team}</td><td>{played}</td><td>{gd_str}</td><td><b>{pts}</b></td></tr>""")

    return f"""<div class="wc-section"><div class="wc-section-title">🏆 {group_name}</div><table class="wc-standings"><tr><th>球队</th><th>场</th><th>净</th><th>分</th></tr>{''.join(rows_html)}</table></div>"""


def wc_scorer_card(rank, name, goals, team, max_goals=None) -> str:
    """FotMob 风格射手榜行（HTML 条形图）"""
    medal = '🥇' if rank == 1 else '🥈' if rank == 2 else '🥉' if rank == 3 else str(rank)
    max_g = max_goals or goals or 1
    bar_width = int((goals / max_g) * 120) if max_g > 0 else 0
    search_link = f'https://www.google.com/search?q={name}+{team}+World+Cup+2026'
    return f"""<div class="wc-scorer-row"><span class="wc-scorer-rank">{medal}</span><div class="wc-scorer-name">{name}<div class="wc-scorer-team">{team}</div></div><div class="wc-scorer-bar" style="width:{bar_width}px"></div><span class="wc-scorer-goals">{goals}</span><a href="{search_link}" style="color:var(--color-muted);text-decoration:none;font-size:12px;">🔍</a></div>"""


def wc_news_card(item: dict) -> str:
    """FotMob 风格新闻卡片（HTML）"""
    title = item.get('title', '')
    link = item.get('link', '#')
    source = item.get('source', '')
    pub_date = item.get('pub_date', '')
    thumb = item.get('image', '')
    source_color = '#00C853'  # 默认绿色
    thumb_html = f'<img class="wc-news-thumb" src="{thumb}" alt="">' if thumb else '<div class="wc-news-thumb"></div>'
    return f"""<div class="wc-news-card">{thumb_html}<div class="wc-news-body"><a href="{link}" style="text-decoration:none;"><p class="wc-news-title">{title}</p></a><div class="wc-news-meta"><span class="wc-news-source">{source}</span> • {pub_date}</div></div></div>"""

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


# ==================== 世界杯辅助 ====================
def is_knockout_phase(wc_standings=None) -> bool:
    """判断世界杯是否进入淘汰赛阶段。
    判断逻辑：如果积分榜存在且所有小组每队已打 >= 3 场，则小组赛结束。
    兜底：7 月 1 日之后强制返回 True（硬编码安全网）。
    """
    # 硬编码安全网：7 月及以后直接 True
    if now_bj().month >= 7:
        return True
    if wc_standings:
        for group in wc_standings:
            for entry in group.get('entries', []):
                if entry.get('played', 0) < 3:
                    return False
        return True
    return False


def wc_section_wrap(title: str, inner_html: str, emoji: str = '') -> str:
    """包裹一个 FotMob 风格板块（白底圆角卡片 + 标题行）"""
    title_text = f'{emoji} {title}' if emoji else title
    return f"""<div class="wc-section">
<div class="wc-section-title">{title_text}</div>
{inner_html}
</div>"""


# ==================== 世界杯早报 ====================
def generate_morning_wc_md() -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()
    now_str = now_bj().strftime('%Y-%m-%d %H:%M')

    print("📅 拉取今日赛程...")
    events = get_today_matches()
    wc_events = [e for e in events if 'World Cup' in get_comp_name(e)]
    other_events = [e for e in events if 'World Cup' not in get_comp_name(e)]

    print("🏆 拉取世界杯积分榜...")
    wc_standings = get_wc_standings()
    knockout = is_knockout_phase(wc_standings)

    print("⚽ 拉取射手榜...")
    top_scorers = get_wc_top_scorers(limit=10)

    print("🗞️ 拉取新闻...")
    news = []
    for q in WC_NEWS_QUERIES[:5]:
        items = get_news_google(q, limit=3)
        news.extend(items)
    rss_items = []
    for name, url in RSS_FEEDS[:2]:
        entries = get_news_rss(url, limit=4)
        for e in entries:
            e['source'] = e.get('source', name)
        rss_items.extend(entries)

    # ========== 组装 HTML ==========
    html = []

    # 1. Front-matter（YAML，无空行接 HTML）
    phase_label = '世界杯淘汰赛' if knockout else '世界杯小组赛'
    html.append(f"""---
title: 足球早报 · {today_cn}
date: {today_str} 08:00:00
excerpt: {phase_label}晨间赛程 + 射手榜
description: {phase_label}晨间赛程 · 射手榜 · 数据驱动
cover_color: '#0E2F7E'
tags:
  - 足球
  - 早报
  - 世界杯
  - 数据驱动
categories:
  - 足球日报
---
<style>{WC_CSS}</style>
<div class="wc-container">""")

    # 2. Header Hero
    html.append(wc_header_hero(title='足球早报', subtitle=f'{today_cn} · {phase_label}'))

    # 3. 今日焦点（关注队的比赛）
    followed_ids = set(WC_FOLLOWED_TEAMS.keys())
    followed_today = []
    other_wc_today = []
    for e in wc_events:
        team_ids = set()
        for c in e.get('competitors', []):
            tid = safe(c, 'team', 'id', default='')
            if tid:
                team_ids.add(str(tid))
        if team_ids & followed_ids:
            followed_today.append(e)
        else:
            other_wc_today.append(e)

    if followed_today:
        focus_inner = ''.join(wc_match_row(e) for e in followed_today)
        html.append(wc_section_wrap('今日焦点', focus_inner, '⭐'))

    # 4. 今日世界杯赛程
    if other_wc_today:
        today_inner = ''.join(wc_match_row(e) for e in other_wc_today[:12])
        html.append(wc_section_wrap('今日赛程', today_inner, '📅'))

    # 5. 其他赛事（非世界杯）
    if other_events:
        other_inner = ''.join(wc_match_row(e) for e in other_events[:6])
        html.append(wc_section_wrap('其他赛事', other_inner, '🏟️'))

    # 6. 小组积分榜（仅小组赛阶段显示）
    if not knockout and wc_standings:
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if has_followed:
                html.append(wc_group_standings_card(s))
        other_groups_html = ''
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if not has_followed:
                other_groups_html += wc_group_standings_card(s)
        if other_groups_html:
            html.append(f'<details><summary>📁 其他小组</summary>{other_groups_html}</details>')

    # 7. 射手榜
    if top_scorers:
        max_goals = top_scorers[0][1] if top_scorers else 1
        scorer_inner = ''.join(
            wc_scorer_card(i, name, goals, team, max_goals)
            for i, (name, goals, team) in enumerate(top_scorers, 1)
        )
        html.append(wc_section_wrap('世界杯射手榜', scorer_inner, '⚽'))

    # 8. 关注国家队近况
    followed_inner = ''
    for tid, tname in WC_FOLLOWED_TEAMS.items():
        recent = get_wc_team_matches(tid, limit=3)
        if recent:
            followed_inner += f'<div style="padding:4px 16px;font-size:12px;color:#999;font-weight:600;">{tname}</div>'
            for r in recent:
                followed_inner += wc_match_card_compact(r)
    if followed_inner:
        html.append(wc_section_wrap('关注国家队', followed_inner, '⭐'))

    # 9. 新闻
    seen_titles = set()
    news_inner = ''
    for n in news:
        title = n.get('title', '')
        if title and title not in seen_titles:
            seen_titles.add(title)
            news_inner += wc_news_card(n)
        if len(seen_titles) >= 8:
            break
    if news_inner:
        html.append(wc_section_wrap('新闻速递', news_inner, '🗞️'))

    # 10. RSS 新闻
    seen_rss = set()
    rss_inner = ''
    for n in rss_items:
        title = n.get('title', '')
        if title and title not in seen_rss:
            seen_rss.add(title)
            rss_inner += wc_news_card(n)
        if len(seen_rss) >= 6:
            break
    if rss_inner:
        html.append(f'<details><summary style="padding:12px 16px;font-weight:600;">📡 RSS 精选</summary>{rss_inner}</details>')

    # 11. 页脚
    html.append(f"""<div style="padding:16px;text-align:center;font-size:12px;color:#999;">
本文为「足球日报」自动生成（世界杯模式 · {phase_label}）<br>
数据来源：ESPN · BBC Sport · Sky Sports · Google News<br>
生成时间：{now_str} GMT+8
</div>""")

    html.append('</div>')

    return '\n'.join(html)


# ==================== 世界杯晚报 ====================
def generate_evening_wc_md() -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()
    now_str = now_bj().strftime('%Y-%m-%d %H:%M')

    print("📅 拉取今日赛程...")
    events = get_today_matches()
    wc_events = [e for e in events if 'World Cup' in get_comp_name(e)]
    other_events = [e for e in events if 'World Cup' not in get_comp_name(e)]
    finished_events = [e for e in events if get_status_cn(e) == '已结束']
    finished_wc = [e for e in finished_events if 'World Cup' in get_comp_name(e)]
    upcoming = [e for e in events if get_status_cn(e) == '未开始']

    print("🏆 拉取世界杯积分榜...")
    wc_standings = get_wc_standings()
    knockout = is_knockout_phase(wc_standings)

    print("⚽ 拉取射手榜...")
    top_scorers = get_wc_top_scorers(limit=15)

    print("📈 拉取今日进球详情...")
    match_goals = {}
    for e in finished_wc[:8]:
        eid = e.get('id')
        if eid:
            match_goals[eid] = get_wc_event_goals(str(eid))

    print("🗞️ 拉取新闻...")
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

    # ========== 组装 HTML ==========
    html = []
    phase_label = '世界杯淘汰赛' if knockout else '世界杯小组赛'

    # 1. Front-matter
    html.append(f"""---
title: 足球晚报 · {today_cn}
date: {today_str} 20:00:00
excerpt: {phase_label}战报 + 射手榜 + 进球详情
description: {phase_label}晚间战报 · 射手榜 · 进球详情 · 数据驱动
cover_color: '#0E2F7E'
tags:
  - 足球
  - 晚报
  - 世界杯
  - 数据驱动
categories:
  - 足球日报
---
<style>{WC_CSS}</style>
<div class="wc-container">""")

    # 2. Header Hero
    html.append(wc_header_hero(title='足球晚报', subtitle=f'{today_cn} · {phase_label}战报'))

    # 3. 今日战报（已结束比赛）
    followed_ids = set(WC_FOLLOWED_TEAMS.keys())
    if finished_events:
        # 关注队已完场比赛优先
        followed_finished = []
        other_finished = []
        for e in finished_events:
            team_ids = set()
            for c in e.get('competitors', []):
                tid = safe(c, 'team', 'id', default='')
                if tid:
                    team_ids.add(str(tid))
            if team_ids & followed_ids:
                followed_finished.append(e)
            else:
                other_finished.append(e)

        if followed_finished:
            focus_inner = ''.join(wc_match_row(e) for e in followed_finished)
            html.append(wc_section_wrap('今日焦点战报', focus_inner, '⭐'))

        if other_finished:
            other_inner = ''.join(wc_match_row(e) for e in other_finished[:12])
            html.append(wc_section_wrap('今日战报', other_inner, '⚽'))

    # 4. 进球详情
    if match_goals:
        goals_inner = ''
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
                goals_inner += f'<div style="padding:4px 16px;font-size:12px;color:#999;font-weight:600;">{match_name}</div>'
                for g in goals:
                    g_team_flag = ''
                    if g['team']:
                        for e in finished_wc:
                            for c in e.get('competitors', []):
                                if safe(c, 'team', 'name', default='') == g['team']:
                                    abbr = safe(c, 'team', 'abbreviation', default='')
                                    g_team_flag = team_flag(abbr, g['team'], size=16) + ' '
                                    break
                    goals_inner += f'<div style="padding:6px 16px;font-size:13px;">⚽ {g_team_flag}{g["minute"]}\' {g["player"]} ({g["team"]})</div>'
        if goals_inner:
            html.append(wc_section_wrap('进球详情', goals_inner, '🥅'))

    # 5. 进行中 / 未开始比赛
    live_or_upcoming = [e for e in events if get_status_cn(e) in ('进行中', '未开始')]
    if live_or_upcoming:
        upcoming_inner = ''.join(wc_match_row(e) for e in live_or_upcoming[:8])
        html.append(wc_section_wrap('待赛 / 进行中', upcoming_inner, '⏰'))

    # 6. 小组积分榜（仅小组赛阶段）
    if not knockout and wc_standings:
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if has_followed:
                html.append(wc_group_standings_card(s))
        other_groups_html = ''
        for s in wc_standings:
            entries = s.get('entries', [])
            has_followed = any(safe(e, 'team', 'id', default='') in followed_ids for e in entries)
            if not has_followed:
                other_groups_html += wc_group_standings_card(s)
        if other_groups_html:
            html.append(f'<details><summary>📁 其他小组</summary>{other_groups_html}</details>')

    # 7. 射手榜
    if top_scorers:
        max_goals = top_scorers[0][1] if top_scorers else 1
        scorer_inner = ''.join(
            wc_scorer_card(i, name, goals, team, max_goals)
            for i, (name, goals, team) in enumerate(top_scorers, 1)
        )
        html.append(wc_section_wrap('世界杯射手榜', scorer_inner, '⚽'))

    # 8. 关注国家队近况
    followed_inner = ''
    for tid, tname in WC_FOLLOWED_TEAMS.items():
        recent = get_wc_team_matches(tid, limit=3)
        if recent:
            followed_inner += f'<div style="padding:4px 16px;font-size:12px;color:#999;font-weight:600;">{tname}</div>'
            for r in recent:
                followed_inner += wc_match_card_compact(r)
    if followed_inner:
        html.append(wc_section_wrap('关注国家队', followed_inner, '⭐'))

    # 9. 新闻
    seen_titles = set()
    news_inner = ''
    for n in news:
        title = n.get('title', '')
        if title and title not in seen_titles:
            seen_titles.add(title)
            news_inner += wc_news_card(n)
        if len(seen_titles) >= 12:
            break
    if news_inner:
        html.append(wc_section_wrap('新闻聚合', news_inner, '🗞️'))

    # 10. RSS 新闻
    seen_rss = set()
    rss_inner = ''
    for n in rss_items:
        title = n.get('title', '')
        if title and title not in seen_rss:
            seen_rss.add(title)
            rss_inner += wc_news_card(n)
        if len(seen_rss) >= 10:
            break
    if rss_inner:
        html.append(f'<details><summary style="padding:12px 16px;font-weight:600;">📡 RSS 精选</summary>{rss_inner}</details>')

    # 11. 页脚
    html.append(f"""<div style="padding:16px;text-align:center;font-size:12px;color:#999;">
本文为「足球日报」自动生成（世界杯模式 · {phase_label}）<br>
数据来源：ESPN · BBC Sport · Sky Sports · ESPN FC · Google News<br>
生成时间：{now_str} GMT+8
</div>""")

    html.append('</div>')

    return '\n'.join(html)

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
