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

# ==================== 视觉样式（暗色球场风）====================
# 所有样式作用域限定在 .wc-container 内，不污染博客全局（不再写 body 规则）
WC_CSS = """.wc-container{--wc-card:rgba(255,255,255,.045);--wc-border:rgba(255,255,255,.09);--wc-text:#E9EEF7;--wc-muted:#8B96AB;--wc-green:#16A34A;--wc-green-l:#4ADE80;--wc-amber:#FBBF24;--wc-red:#F87171;--wc-blue:#38BDF8;max-width:720px;margin:0 auto;background:linear-gradient(180deg,#101C36 0%,#0B1220 300px);border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:var(--wc-text);font-size:14px;line-height:1.5;box-shadow:0 12px 40px rgba(2,6,18,.45)}
.wc-container a{text-decoration:none}
.wc-hero{position:relative;padding:30px 22px 24px;background:radial-gradient(120% 170% at 88% -20%,rgba(56,189,248,.30),transparent 55%),radial-gradient(110% 150% at 0% 0%,rgba(34,197,94,.22),transparent 52%),linear-gradient(135deg,#14295A 0%,#0C1832 62%,#0B1220 100%);border-bottom:1px solid var(--wc-border);overflow:hidden}
.wc-hero::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 2px,transparent 2px 14px);pointer-events:none}
.wc-hero-inner{position:relative}
.wc-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.wc-badge{display:inline-block;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#BAE6FD;background:rgba(56,189,248,.14);box-shadow:inset 0 0 0 1px rgba(56,189,248,.35)}
.wc-badge.green{color:#BBF7D0;background:rgba(34,197,94,.14);box-shadow:inset 0 0 0 1px rgba(34,197,94,.35)}
.wc-hero h1{margin:0;font-size:26px;font-weight:800;color:#fff;letter-spacing:.01em}
.wc-hero .sub{margin-top:6px;font-size:12px;color:rgba(233,238,247,.72)}
.wc-stats{display:flex;gap:10px;margin-top:18px}
.wc-stat{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:9px 6px;text-align:center;min-width:0}
.wc-stat b{display:block;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-stat span{font-size:10px;color:var(--wc-muted)}
.wc-sec{margin:14px 14px 0;background:var(--wc-card);border:1px solid var(--wc-border);border-radius:16px;overflow:hidden}
.wc-sec-title{display:flex;align-items:center;gap:8px;padding:13px 16px;font-size:15px;font-weight:700;border-bottom:1px solid var(--wc-border)}
.wc-sec-title::before{content:'';width:4px;height:16px;border-radius:2px;background:linear-gradient(180deg,var(--wc-green-l),var(--wc-green));flex-shrink:0}
.wc-chip{margin-left:auto;font-size:11px;font-weight:600;color:var(--wc-muted);background:rgba(255,255,255,.06);padding:2px 10px;border-radius:999px}
.wc-date{padding:10px 16px 2px;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--wc-muted);text-transform:uppercase}
.wc-m{display:grid;grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);align-items:center;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.05)}
.wc-m:last-child{border-bottom:none}
.wc-t{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px}
.wc-t.r{flex-direction:row-reverse;text-align:right}
.wc-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-flag{width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
.wc-fp{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;letter-spacing:.02em;color:#C7D0E0;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
.wc-c{display:flex;flex-direction:column;align-items:center;gap:3px}
.wc-pill{display:inline-block;min-width:56px;text-align:center;padding:4px 10px;border-radius:8px;font-weight:700;font-size:14px;box-sizing:border-box}
.wc-pill.time{color:var(--wc-amber);background:rgba(251,191,36,.10);box-shadow:inset 0 0 0 1px rgba(251,191,36,.28)}
.wc-pill.score{color:#fff;background:linear-gradient(135deg,var(--wc-green),var(--wc-green-l));box-shadow:0 2px 8px rgba(34,197,94,.30)}
.wc-pill.score.live{animation:wcpulse 2s infinite}
@keyframes wcpulse{0%,100%{opacity:1}50%{opacity:.8}}
.wc-st{font-size:10px;color:var(--wc-muted);white-space:nowrap}
.wc-s{display:grid;grid-template-columns:26px minmax(0,1fr) 84px 30px;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid rgba(255,255,255,.05)}
.wc-s:last-child{border-bottom:none}
.wc-rank{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--wc-muted);background:rgba(255,255,255,.06)}
.wc-rank.r1{background:linear-gradient(135deg,#F59E0B,#FDE047);color:#3B2F00}
.wc-rank.r2{background:linear-gradient(135deg,#94A3B8,#E2E8F0);color:#1E293B}
.wc-rank.r3{background:linear-gradient(135deg,#B45309,#F59E0B);color:#3B1F00}
.wc-sname{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-sname a{color:var(--wc-text)}
.wc-sname a:hover{color:#7DD3FC}
.wc-steam{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--wc-muted);margin-top:2px}
.wc-steam .wc-flag,.wc-steam .wc-fp{width:14px;height:14px;font-size:6px}
.wc-track{height:7px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden}
.wc-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--wc-green),var(--wc-green-l))}
.wc-goals{font-weight:800;font-size:15px;text-align:right;color:var(--wc-green-l)}
.wc-ft-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px}
.wc-ft{background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid var(--wc-border);border-radius:14px;padding:13px 14px}
.wc-ft-head{display:flex;align-items:center;gap:10px}
.wc-ft-head .wc-flag,.wc-ft-head .wc-fp{width:32px;height:32px;font-size:10px;box-shadow:0 0 0 2px rgba(255,255,255,.15)}
.wc-ft-name{font-weight:700;font-size:15px}
.wc-ft-form{display:flex;gap:4px;margin-left:auto}
.wc-fb{width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.wc-fb.w{color:#4ADE80;background:rgba(34,197,94,.16);box-shadow:inset 0 0 0 1px rgba(34,197,94,.4)}
.wc-fb.d{color:#C7D0E0;background:rgba(148,163,184,.14);box-shadow:inset 0 0 0 1px rgba(148,163,184,.35)}
.wc-fb.l{color:#F87171;background:rgba(248,113,113,.14);box-shadow:inset 0 0 0 1px rgba(248,113,113,.35)}
.wc-ft-line{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--wc-muted);margin-top:9px}
.wc-ft-line b{color:var(--wc-text);font-weight:600;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-focus{margin:14px 14px 0;border-radius:16px;padding:20px;border:1px solid rgba(56,189,248,.25);background:radial-gradient(120% 160% at 50% -30%,rgba(56,189,248,.22),transparent 55%),linear-gradient(160deg,#14315E 0%,#0B1730 70%);text-align:center}
.wc-fc-badge{display:inline-block;padding:3px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.1em;color:#7DD3FC;background:rgba(56,189,248,.12);box-shadow:inset 0 0 0 1px rgba(56,189,248,.35)}
.wc-fc-teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-top:18px}
.wc-fc-team{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.wc-fc-team img{width:54px;height:54px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px rgba(255,255,255,.12),0 8px 20px rgba(0,0,0,.35)}
.wc-fc-team .n{font-weight:700;font-size:15px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-fc-vs{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#06240F;background:linear-gradient(135deg,var(--wc-green-l),var(--wc-green));box-shadow:0 4px 14px rgba(34,197,94,.4)}
.wc-fc-meta{margin-top:16px;font-size:12px;color:var(--wc-muted)}
.wc-fc-meta b{color:var(--wc-amber);font-weight:700}
.wc-n{display:block;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.05)}
.wc-n:last-child{border-bottom:none}
.wc-ntitle{display:block;font-size:14px;font-weight:600;color:var(--wc-text);line-height:1.45;margin:0 0 6px}
.wc-n:hover .wc-ntitle{color:#7DD3FC}
.wc-nmeta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--wc-muted)}
.wc-src{padding:1px 9px;border-radius:999px;font-weight:800;font-size:10px;color:#0B1220;background:#94A3B8}
.wc-g{display:flex;align-items:center;gap:8px;padding:8px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05)}
.wc-g:last-child{border-bottom:none}
.wc-gmin{min-width:38px;text-align:center;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:800;color:var(--wc-amber);background:rgba(251,191,36,.10);box-shadow:inset 0 0 0 1px rgba(251,191,36,.25)}
.wc-standings{width:100%;border-collapse:collapse;font-size:13px}
.wc-standings th{color:var(--wc-muted);font-weight:600;padding:8px 6px;text-align:right;font-size:11px}
.wc-standings th:first-child,.wc-standings td:first-child{text-align:left;padding-left:16px}
.wc-standings td{padding:7px 6px;text-align:right;border-top:1px solid rgba(255,255,255,.05)}
.wc-standings td.team-cell{text-align:left}
.wc-standings .wc-flag,.wc-standings .wc-fp{width:16px;height:16px;font-size:6px;vertical-align:middle}
.wc-rank-bar{display:inline-block;width:4px;height:18px;border-radius:2px;margin-right:8px;vertical-align:middle}
.wc-rank-bar.qualify{background:var(--wc-green-l)}
.wc-rank-bar.playoff{background:var(--wc-amber)}
.wc-rank-bar.eliminated{background:rgba(255,255,255,.15)}
details.wc-sec summary{display:flex;align-items:center;gap:8px;padding:13px 16px;font-size:15px;font-weight:700;cursor:pointer;list-style:none}
details.wc-sec summary::-webkit-details-marker{display:none}
details.wc-sec summary::before{content:'';width:4px;height:16px;border-radius:2px;background:linear-gradient(180deg,var(--wc-green-l),var(--wc-green));flex-shrink:0}
details.wc-sec[open] summary{border-bottom:1px solid var(--wc-border)}
.wc-foot{padding:18px 16px 22px;text-align:center;font-size:11px;color:var(--wc-muted);line-height:1.8}
.wc-foot-line{width:48px;height:3px;border-radius:2px;margin:0 auto 12px;background:linear-gradient(90deg,var(--wc-green),var(--wc-blue))}
@media(max-width:560px){.wc-ft-grid{grid-template-columns:1fr}.wc-stats{gap:6px}.wc-hero h1{font-size:22px}.wc-s{grid-template-columns:26px minmax(0,1fr) 56px 26px}}"""

def team_flag(team_abbr_or_name, fallback_name='', size=20):
    """从 ESPN abbreviation 生成圆形国旗 HTML img。
    无国旗映射时返回同尺寸占位徽章（缩写首字母），保证所有行严格对齐。"""
    abbr = ''
    if team_abbr_or_name and team_abbr_or_name in FLAG_MAP:
        abbr = team_abbr_or_name
    iso = FLAG_MAP.get(abbr, '')
    if iso:
        alt = fallback_name or abbr
        return f'<img class="wc-flag" src="{FLAG_CDN}/{iso}.png" alt="{alt}" width="{size}" height="{size}">'
    # 占位徽章：优先用缩写，否则取队名单词首字母
    code = (team_abbr_or_name or '').strip().upper()
    if not code or len(code) > 4:
        words = [w for w in (fallback_name or '').replace('(', ' ').replace(')', ' ').split() if w]
        code = ''.join(w[0] for w in words[:2]).upper() or '?'
    return f'<span class="wc-fp">{code[:3]}</span>'

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

def bj_dt(utc_str):
    """UTC ISO -> 北京 datetime（失败返回 None）"""
    if not utc_str:
        return None
    try:
        return datetime.fromisoformat(utc_str.replace('Z', '+00:00')).astimezone(BJ)
    except Exception:
        return None

def bj_md_str(utc_str):
    """UTC ISO -> 'MM-DD'（北京时间）"""
    dt = bj_dt(utc_str)
    return dt.strftime('%m-%d') if dt else ''

def bj_full_cn(utc_str):
    """UTC ISO -> '7月25日 周五 03:00'（北京时间）"""
    dt = bj_dt(utc_str)
    if not dt:
        return '?'
    wd = ['一', '二', '三', '四', '五', '六', '日'][dt.weekday()]
    return f'{dt.month}月{dt.day}日 周{wd} {dt.strftime("%H:%M")}'

# ==================== 新闻清洗 ====================
import re as _re

def norm_title(t: str) -> str:
    """标题归一化（用于去重：大小写/标点/空格不敏感）"""
    return _re.sub(r'[^a-z0-9一-鿿]+', '', (t or '').lower())

# 明显非足球的内容（Sky 等综合源会混入板球/F1 等）
NON_FOOTBALL_HINTS = [
    'cricket', 'nfl', 'tennis', 'rugby', 'golf', 'boxing', 'darts',
    'formula', 'motogp', 'basketball', 'nba', 'baseball', 'mlb',
    'nhl', 'hockey', 'athletics', 'cycling', 'snooker', 'ufc', 'wwe',
]

def is_football_news(item: dict) -> bool:
    """按标题+链接剔除明显非足球的新闻"""
    text = f"{item.get('title', '')} {item.get('link', '') or item.get('url', '')}".lower()
    return not any(h in text for h in NON_FOOTBALL_HINTS)

# 新闻来源 chip 配色（深色背景上的浅色 chip）
SOURCE_COLORS = {
    'BBC Sport': '#FCA5A5', 'BBC': '#FCA5A5',
    'Sky Sports': '#7DD3FC', 'Sky': '#7DD3FC',
    'ESPN FC': '#C4B5FD', 'ESPN': '#C4B5FD',
    'Goal.com': '#86EFAC', 'Goal': '#86EFAC',
    'NBC Sports': '#F9A8D4',
    'The Athletic': '#FCD34D',
}

def split_news_title(item: dict):
    """Google News 标题常带 ' - 来源' 后缀，拆出来源并清洗标题"""
    title = (item.get('title', '') or '').strip()
    source = (item.get('source', '') or '').strip()
    if ' - ' in title:
        head, _, tail = title.rpartition(' - ')
        if head and 0 < len(tail) <= 30:
            title = head.strip()
            if not source:
                source = tail.strip()
    return title, source

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
            # sports_skills 输出为 UTF-8；Windows 默认 gbk 解码会乱码甚至崩溃，强制 UTF-8
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45,
                                    encoding='utf-8', errors='replace')
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

_WC_SCHEDULE_CACHE = None

def get_wc_season_schedule():
    """世界杯赛季全部赛程（单次运行内缓存；失败不缓存空结果并重试）"""
    global _WC_SCHEDULE_CACHE
    if _WC_SCHEDULE_CACHE is not None:
        return _WC_SCHEDULE_CACHE
    import time
    for attempt in range(3):
        data = call_skill('football', 'get_season_schedule', f'--season_id={WC_SEASON_ID}')
        result = safe(data, 'data', 'schedules', default=[]) or []
        if result:
            _WC_SCHEDULE_CACHE = result
            return _WC_SCHEDULE_CACHE
        print(f"  ⚠️ 赛季赛程为空，重试 {attempt + 1}/3...")
        time.sleep(3)
    return []

def wc_team_abbr_map():
    """从赛季赛程构建 队名 -> ESPN 缩写 映射（用于射手榜国旗）"""
    m = {}
    for s in get_wc_season_schedule():
        for c in s.get('competitors', []):
            name = safe(c, 'team', 'name', default='')
            abbr = safe(c, 'team', 'abbreviation', default='')
            if name and abbr:
                m[name] = abbr
    return m

def wc_upcoming_matches():
    """真正未进行的比赛（按开球时间升序）。
    数据方会遗留过期 not_started（排期早于已赛场次），
    以最近一场已赛的开球时间为基准剔除。"""
    sched = get_wc_season_schedule()
    closed_times = [s.get('start_time', '') for s in sched if s.get('status') == 'closed']
    cutoff = max(closed_times) if closed_times else ''
    ups = [s for s in sched if s.get('status') != 'closed' and s.get('start_time', '') > cutoff]
    return sorted(ups, key=lambda x: x.get('start_time', ''))

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

# ==================== 世界杯富文本卡片（暗色球场风 HTML）====================
def wc_header_hero(title='足球早报', subtitle='', phase='世界杯', edition='早报', stats=None) -> str:
    """暗色渐变 Hero：徽标行 + 大标题 + 副标题 + 数据条"""
    today_cn = bj_date_cn()
    sub = subtitle or f'{today_cn} · {phase}'
    stats = stats or []
    stats_html = ''
    if stats:
        cells = ''.join(f'<div class="wc-stat"><b>{v}</b><span>{k}</span></div>' for v, k in stats)
        stats_html = f'<div class="wc-stats">{cells}</div>'
    return f"""<div class="wc-hero"><div class="wc-hero-inner">
<div class="wc-badges"><span class="wc-badge">{phase}</span><span class="wc-badge green">{edition}</span></div>
<h1>⚽ {title}</h1><div class="sub">{sub}</div>{stats_html}
</div></div>"""


def _match_scores(m: dict):
    """提取主客队比分（字符串，可能为空）"""
    competitors = m.get('competitors', [])
    home_score = away_score = ''
    if len(competitors) >= 2:
        hs = competitors[0].get('score')
        as_ = competitors[1].get('score')
        if hs is not None:
            home_score = str(hs)
        if as_ is not None:
            away_score = str(as_)
    return home_score, away_score


def wc_match_row(m: dict) -> str:
    """单行比赛组件：三列严格对齐（旗/占位徽章 + 中央比分/时间 pill + 状态行）"""
    home_name, away_name = get_team_names(m)
    home_flag = team_flag_from_match(m, 'home')
    away_flag = team_flag_from_match(m, 'away')
    st = get_status_cn(m)
    mt = get_match_time(m)
    eid = m.get('id', '')
    match_link = f'https://www.espn.com/soccer/match/_/gameId/{eid}' if eid else '#'
    home_score, away_score = _match_scores(m)

    # 中央单元格：比分框 or 时间 pill，下方一行状态/日期
    today = bj_date_str()
    match_date = (m.get('start_time') or '')[:10]
    sub = ''
    if st == '已结束':
        center = f'<a href="{match_link}" class="wc-pill score">{home_score}-{away_score}</a>'
        sub = '已结束' if match_date == today else f'已结束 · {bj_md_str(m.get("start_time"))}'
    elif st == '进行中':
        center = f'<a href="{match_link}" class="wc-pill score live">{home_score}-{away_score}</a>'
        sub = '进行中'
    else:
        center = f'<span class="wc-pill time">{mt}</span>'
        if match_date and match_date != today:
            sub = bj_md_str(m.get('start_time'))
    sub_html = f'<span class="wc-st">{sub}</span>' if sub else ''

    return f"""<div class="wc-m"><div class="wc-t">{home_flag}<span>{home_name}</span></div><div class="wc-c">{center}{sub_html}</div><div class="wc-t r"><span>{away_name}</span>{away_flag}</div></div>"""


def wc_match_card_compact(m: dict) -> str:
    """紧凑版比赛行（复用主组件，时间/比分 + 日期子行）"""
    return wc_match_row(m)


def wc_group_standings_card(group_data: dict) -> str:
    """积分榜（紧凑表 + 彩色排名条带）"""
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

    return f"""<div class="wc-sec"><div class="wc-sec-title">🏆 {group_name}</div><table class="wc-standings"><tr><th>球队</th><th>场</th><th>净</th><th>分</th></tr>{''.join(rows_html)}</table></div>"""


def wc_scorer_card(rank, name, goals, team, max_goals=None, abbr_map=None) -> str:
    """射手榜行：名次徽章 + 球员（队旗）+ 固定轨道渐变条 + 进球数"""
    max_g = max_goals or goals or 1
    pct = max(8, int((goals / max_g) * 100)) if max_g > 0 else 0
    search_link = f'https://www.google.com/search?q={name}+{team}+World+Cup+2026'
    team_flag_html = ''
    if team:
        abbr = (abbr_map or {}).get(team, '')
        team_flag_html = team_flag(abbr, team, size=14) if abbr else ''
    team_html = f'<div class="wc-steam">{team_flag_html}<span>{team}</span></div>' if team else ''
    rank_cls = f' r{rank}' if rank <= 3 else ''
    return f"""<div class="wc-s"><span class="wc-rank{rank_cls}">{rank}</span><div class="wc-sname"><a href="{search_link}">{name}</a>{team_html}</div><div class="wc-track"><div class="wc-fill" style="width:{pct}%"></div></div><span class="wc-goals">{goals}</span></div>"""


def wc_news_card(item: dict) -> str:
    """新闻行：标题 + 来源 chip + 日期（Google News 标题后缀自动拆来源）"""
    title, source = split_news_title(item)
    link = item.get('link', '#')
    pub_date = item.get('pub_date', '') or item.get('published', '')
    if not title:
        return ''
    chip_color = SOURCE_COLORS.get(source, '#94A3B8')
    chip = f'<span class="wc-src" style="background:{chip_color}">{source}</span>' if source else ''
    date_html = f'<span>{pub_date}</span>' if pub_date else ''
    return f"""<a class="wc-n" href="{link}"><span class="wc-ntitle">{title}</span><span class="wc-nmeta">{chip}{date_html}</span></a>"""


def wc_focus_card(m: dict, label='下一场焦点战') -> str:
    """焦点战大卡：大国旗 VS 布局 + 日期时间 + 球场"""
    home_name, away_name = get_team_names(m)
    competitors = m.get('competitors', [])
    def big_flag(idx):
        if len(competitors) > idx:
            abbr = safe(competitors[idx], 'team', 'abbreviation', default='')
            iso = FLAG_MAP.get(abbr, '')
            if iso:
                name = safe(competitors[idx], 'team', 'name', default='')
                return f'<img src="https://flagcdn.com/w80/{iso}.png" alt="{name}" width="54" height="54">'
        return '<span class="wc-fp" style="width:54px;height:54px;font-size:14px">?</span>'
    venue_name = safe(m, 'venue', 'name', default='') or ''
    venue_city = safe(m, 'venue', 'city', default='') or ''
    venue_str = ' · '.join(x for x in [venue_name, venue_city] if x)
    venue_html = f' · {venue_str}' if venue_str else ''
    return f"""<div class="wc-focus">
<span class="wc-fc-badge">{label}</span>
<div class="wc-fc-teams">
<div class="wc-fc-team">{big_flag(0)}<span class="n">{home_name}</span></div>
<span class="wc-fc-vs">VS</span>
<div class="wc-fc-team">{big_flag(1)}<span class="n">{away_name}</span></div>
</div>
<div class="wc-fc-meta"><b>{bj_full_cn(m.get('start_time'))}</b>{venue_html}</div>
</div>"""


def _followed_team_info(tid):
    """从赛季赛程提取关注队的：缩写、最近已赛、下一场、近 5 场战绩"""
    matches = get_wc_team_matches(tid, limit=30)
    abbr = ''
    for m in matches:
        for c in m.get('competitors', []):
            if str(safe(c, 'team', 'id', default='')) == str(tid):
                abbr = safe(c, 'team', 'abbreviation', default='')
                break
        if abbr:
            break
    finished = [m for m in matches if m.get('status') == 'closed']
    upcoming = [
        m for m in wc_upcoming_matches()
        if any(str(safe(c, 'team', 'id', default='')) == str(tid) for c in m.get('competitors', []))
    ]
    return abbr, finished, upcoming


def _form_badges(tid, finished, limit=5):
    """近 N 场胜/平/负徽章（最新在右）"""
    badges = []
    for m in finished[:limit]:
        comps = m.get('competitors', [])
        mine = other = None
        for c in comps:
            if str(safe(c, 'team', 'id', default='')) == str(tid):
                mine = c
            else:
                other = c
        if mine is None or other is None:
            continue
        try:
            ms, os_ = int(mine.get('score', 0)), int(other.get('score', 0))
        except (TypeError, ValueError):
            continue
        if ms > os_:
            badges.append('<span class="wc-fb w">胜</span>')
        elif ms == os_:
            badges.append('<span class="wc-fb d">平</span>')
        else:
            badges.append('<span class="wc-fb l">负</span>')
    badges.reverse()
    return ''.join(badges)


def wc_followed_team_card(tid, cn_name) -> str:
    """关注球队卡：队旗 + 中文名 + 近 5 场战绩 + 上一场比分 + 下一场时间"""
    abbr, finished, upcoming = _followed_team_info(tid)
    flag_html = team_flag(abbr, cn_name, size=32)
    form_html = _form_badges(tid, finished)

    if finished:
        last = finished[0]
        lh, la = get_team_names(last)
        lhs, las = _match_scores(last)
        last_str = f'{bj_md_str(last.get("start_time"))} · {lh} {lhs}-{las} {la}'
    else:
        last_str = '—'
    if upcoming:
        nxt = upcoming[0]
        nh, na = get_team_names(nxt)
        opp = na
        for c in nxt.get('competitors', []):
            if str(safe(c, 'team', 'id', default='')) != str(tid):
                opp = safe(c, 'team', 'name', default=na)
                break
        next_str = f'{bj_md_str(nxt.get("start_time"))} {bj_time_str(nxt.get("start_time"))} vs {opp}'
    else:
        next_str = '—'
    return f"""<div class="wc-ft">
<div class="wc-ft-head">{flag_html}<span class="wc-ft-name">{cn_name}</span><span class="wc-ft-form">{form_html}</span></div>
<div class="wc-ft-line"><span>上一场</span><b>{last_str}</b></div>
<div class="wc-ft-line"><span>下一场</span><b>{next_str}</b></div>
</div>"""

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


def wc_section_wrap(title: str, inner_html: str, emoji: str = '', count: int = 0) -> str:
    """包裹一个板块（深色玻璃卡片 + 绿色竖条标题 + 可选数量 chip）"""
    title_text = f'{emoji} {title}' if emoji else title
    chip = f'<span class="wc-chip">{count}</span>' if count else ''
    return f"""<div class="wc-sec">
<div class="wc-sec-title">{title_text}{chip}</div>
{inner_html}
</div>"""


def wc_footer(phase_label: str, now_str: str) -> str:
    """页脚（渐变分隔条 + 来源说明）"""
    return f"""<div class="wc-foot"><div class="wc-foot-line"></div>
「足球日报」自动生成 · 世界杯模式（{phase_label}）<br>
数据来源 ESPN · BBC Sport · Sky Sports · Google News · 生成时间 {now_str} GMT+8
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
cover_color: '#101C36'
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

    # 2. Header Hero（含数据条：今日场次 / 射手王 / 关注球队）
    top = top_scorers[0] if top_scorers else None
    top_str = f'{top[0].split()[-1]} {top[1]}' if top else '—'
    stats = [
        (str(len(wc_events)), '今日世界杯'),
        (top_str, '射手王'),
        (str(len(WC_FOLLOWED_TEAMS)), '关注球队'),
    ]
    html.append(wc_header_hero(title='足球早报', subtitle=f'{today_cn} · {phase_label}',
                               phase=phase_label, edition='晨报', stats=stats))

    # 3. 今日焦点（关注队今日比赛）；今日无赛则展示下一场焦点战大卡
    followed_ids = set(WC_FOLLOWED_TEAMS.keys())

    def _involves_followed(e):
        team_ids = set()
        for c in e.get('competitors', []):
            tid = safe(c, 'team', 'id', default='')
            if tid:
                team_ids.add(str(tid))
        return bool(team_ids & followed_ids)

    followed_today = [e for e in wc_events if _involves_followed(e)]
    other_wc_today = [e for e in wc_events if not _involves_followed(e)]

    if followed_today:
        focus_inner = ''.join(wc_match_row(e) for e in followed_today)
        html.append(wc_section_wrap('今日焦点', focus_inner, '⭐', len(followed_today)))
    else:
        # 下一场关注队比赛（wc_upcoming_matches 已剔除过期 not_started）
        candidates = [m for m in wc_upcoming_matches() if _involves_followed(m)]
        if candidates:
            html.append(wc_focus_card(candidates[0], '下一场焦点战'))

    # 4. 今日世界杯赛程
    if other_wc_today:
        today_inner = ''.join(wc_match_row(e) for e in other_wc_today[:12])
        html.append(wc_section_wrap('今日赛程', today_inner, '📅', len(other_wc_today)))

    # 5. 其他赛事（非世界杯，按赛事分组）
    if other_events:
        grouped = {}
        for e in other_events[:8]:
            grouped.setdefault(get_comp_name(e) or '其他', []).append(e)
        other_inner = ''
        for comp, evs in grouped.items():
            other_inner += f'<div class="wc-date">{comp}</div>'
            other_inner += ''.join(wc_match_row(e) for e in evs)
        html.append(wc_section_wrap('其他赛事', other_inner, '🏟️', len(other_events[:8])))

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
            html.append(f'<details class="wc-sec"><summary>📁 其他小组</summary>{other_groups_html}</details>')

    # 7. 射手榜（带队旗 + 渐变条）
    if top_scorers:
        abbr_map = wc_team_abbr_map()
        max_goals = top_scorers[0][1] if top_scorers else 1
        scorer_inner = ''.join(
            wc_scorer_card(i, name, goals, team, max_goals, abbr_map)
            for i, (name, goals, team) in enumerate(top_scorers, 1)
        )
        html.append(wc_section_wrap('世界杯射手榜', scorer_inner, '⚽', len(top_scorers)))

    # 8. 关注国家队（卡片：近 5 场战绩 + 上一场 + 下一场）
    followed_grid = ''.join(wc_followed_team_card(tid, tname) for tid, tname in WC_FOLLOWED_TEAMS.items())
    if followed_grid:
        html.append(wc_section_wrap('关注国家队', f'<div class="wc-ft-grid">{followed_grid}</div>', '⭐'))

    # 9. 新闻（归一化去重 + 剔除非足球内容）
    seen_titles = set()
    news_inner = ''
    for n in news:
        if not is_football_news(n):
            continue
        key = norm_title(n.get('title', ''))
        if key and key not in seen_titles:
            seen_titles.add(key)
            news_inner += wc_news_card(n)
        if len(seen_titles) >= 8:
            break
    if news_inner:
        html.append(wc_section_wrap('新闻速递', news_inner, '🗞️', len(seen_titles)))

    # 10. RSS 新闻（折叠，过滤非足球内容）
    seen_rss = set()
    rss_inner = ''
    for n in rss_items:
        if not is_football_news(n):
            continue
        key = norm_title(n.get('title', ''))
        if key and key not in seen_rss and key not in seen_titles:
            seen_rss.add(key)
            rss_inner += wc_news_card(n)
        if len(seen_rss) >= 6:
            break
    if rss_inner:
        html.append(f'<details class="wc-sec"><summary>📡 RSS 精选<span class="wc-chip">{len(seen_rss)}</span></summary>{rss_inner}</details>')

    # 11. 页脚
    html.append(wc_footer(phase_label, now_str))

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
    followed_ids = set(WC_FOLLOWED_TEAMS.keys())

    def _involves_followed(e):
        team_ids = set()
        for c in e.get('competitors', []):
            tid = safe(c, 'team', 'id', default='')
            if tid:
                team_ids.add(str(tid))
        return bool(team_ids & followed_ids)

    # 1. Front-matter
    html.append(f"""---
title: 足球晚报 · {today_cn}
date: {today_str} 20:00:00
excerpt: {phase_label}战报 + 射手榜 + 进球详情
description: {phase_label}晚间战报 · 射手榜 · 进球详情 · 数据驱动
cover_color: '#101C36'
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

    # 2. Header Hero（数据条：今日已赛 / 今日进球 / 射手王）
    def _match_total_goals(e):
        total = 0
        for c in e.get('competitors', []):
            try:
                total += int(c.get('score', 0) or 0)
            except (TypeError, ValueError):
                pass
        return total
    today_goals = sum(_match_total_goals(e) for e in finished_wc)
    top = top_scorers[0] if top_scorers else None
    top_str = f'{top[0].split()[-1]} {top[1]}' if top else '—'
    stats = [
        (str(len(finished_wc)), '今日已赛'),
        (str(today_goals), '今日进球'),
        (top_str, '射手王'),
    ]
    html.append(wc_header_hero(title='足球晚报', subtitle=f'{today_cn} · {phase_label}战报',
                               phase=phase_label, edition='晚报', stats=stats))

    # 3. 今日战报（已结束比赛，关注队优先）；无战报则展示下一场焦点战大卡
    followed_finished = [e for e in finished_events if _involves_followed(e)]
    other_finished = [e for e in finished_events if not _involves_followed(e)]

    if followed_finished:
        focus_inner = ''.join(wc_match_row(e) for e in followed_finished)
        html.append(wc_section_wrap('今日焦点战报', focus_inner, '⭐', len(followed_finished)))

    if other_finished:
        other_inner = ''.join(wc_match_row(e) for e in other_finished[:12])
        html.append(wc_section_wrap('今日战报', other_inner, '⚽', len(other_finished)))

    if not followed_finished and not other_finished:
        candidates = [m for m in wc_upcoming_matches() if _involves_followed(m)]
        if candidates:
            html.append(wc_focus_card(candidates[0], '下一场焦点战'))

    # 4. 进球详情（时间胶囊样式）
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
                goals_inner += f'<div class="wc-date">{match_name}</div>'
                for g in goals:
                    g_team_flag = ''
                    if g['team']:
                        for e in finished_wc:
                            for c in e.get('competitors', []):
                                if safe(c, 'team', 'name', default='') == g['team']:
                                    abbr = safe(c, 'team', 'abbreviation', default='')
                                    g_team_flag = team_flag(abbr, g['team'], size=16)
                                    break
                            if g_team_flag:
                                break
                    goals_inner += f'<div class="wc-g"><span class="wc-gmin">{g["minute"]}\'</span>{g_team_flag}<span>{g["player"]}</span><span style="color:var(--wc-muted);font-size:11px">{g["team"]}</span></div>'
        if goals_inner:
            html.append(wc_section_wrap('进球详情', goals_inner, '🥅'))

    # 5. 进行中 / 未开始比赛
    live_or_upcoming = [e for e in events if get_status_cn(e) in ('进行中', '未开始')]
    if live_or_upcoming:
        upcoming_inner = ''.join(wc_match_row(e) for e in live_or_upcoming[:8])
        html.append(wc_section_wrap('待赛 / 进行中', upcoming_inner, '⏰', len(live_or_upcoming[:8])))

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
            html.append(f'<details class="wc-sec"><summary>📁 其他小组</summary>{other_groups_html}</details>')

    # 7. 射手榜（带队旗 + 渐变条）
    if top_scorers:
        abbr_map = wc_team_abbr_map()
        max_goals = top_scorers[0][1] if top_scorers else 1
        scorer_inner = ''.join(
            wc_scorer_card(i, name, goals, team, max_goals, abbr_map)
            for i, (name, goals, team) in enumerate(top_scorers, 1)
        )
        html.append(wc_section_wrap('世界杯射手榜', scorer_inner, '⚽', len(top_scorers)))

    # 8. 关注国家队（卡片：近 5 场战绩 + 上一场 + 下一场）
    followed_grid = ''.join(wc_followed_team_card(tid, tname) for tid, tname in WC_FOLLOWED_TEAMS.items())
    if followed_grid:
        html.append(wc_section_wrap('关注国家队', f'<div class="wc-ft-grid">{followed_grid}</div>', '⭐'))

    # 9. 新闻（归一化去重 + 剔除非足球内容）
    seen_titles = set()
    news_inner = ''
    for n in news:
        if not is_football_news(n):
            continue
        key = norm_title(n.get('title', ''))
        if key and key not in seen_titles:
            seen_titles.add(key)
            news_inner += wc_news_card(n)
        if len(seen_titles) >= 12:
            break
    if news_inner:
        html.append(wc_section_wrap('新闻聚合', news_inner, '🗞️', len(seen_titles)))

    # 10. RSS 新闻（折叠，过滤非足球内容）
    seen_rss = set()
    rss_inner = ''
    for n in rss_items:
        if not is_football_news(n):
            continue
        key = norm_title(n.get('title', ''))
        if key and key not in seen_rss and key not in seen_titles:
            seen_rss.add(key)
            rss_inner += wc_news_card(n)
        if len(seen_rss) >= 10:
            break
    if rss_inner:
        html.append(f'<details class="wc-sec"><summary>📡 RSS 精选<span class="wc-chip">{len(seen_rss)}</span></summary>{rss_inner}</details>')

    # 11. 页脚
    html.append(wc_footer(phase_label, now_str))

    html.append('</div>')

    return '\n'.join(html)

# ==================== 归档页更新 ====================
def update_archive_index():
    """扫描 POSTS_DIR 下所有 football-*.md，重新生成 /football/ 归档页。
    移植自 scripts/football-daily.js 的 updateArchiveIndex()，模板保持一致
    （含 dcd057f1 修复引入的 standalone-theme.js 引用）。"""
    import re
    archive_path = POSTS_DIR.parent / 'football' / 'index.html'
    archive_path.parent.mkdir(parents=True, exist_ok=True)

    pattern = re.compile(r'^football-(morning|evening)-(\d{4})-(\d{2})-(\d{2})\.md$')
    weekday_cn = ['一', '二', '三', '四', '五', '六', '日']  # datetime.weekday(): 周一=0
    posts = []
    for f in POSTS_DIR.iterdir():
        m = pattern.match(f.name)
        if not m:
            continue
        typ, y, mo, d = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))
        date_str = f'{y:04d}-{mo:02d}-{d:02d}'
        posts.append({
            'type': typ,
            'date': date_str,
            'label': f'{mo}月{d}日',
            'weekday': f'星期{weekday_cn[datetime(y, mo, d).weekday()]}',
            'href': f'/{y}/{mo:02d}/{d:02d}/football-{typ}-{date_str}/',
        })

    # 日期倒序，同日期晚报在前（两次稳定排序）
    posts.sort(key=lambda p: 0 if p['type'] == 'evening' else 1)
    posts.sort(key=lambda p: p['date'], reverse=True)

    # 生成 HTML 卡片（按月分组，月份倒序）
    cards = []
    if not posts:
        cards.append('<div class="archive-empty"><div class="archive-empty-icon">📭</div><p>暂无日报，敬请期待</p></div>')
    else:
        months = {}
        for p in posts:
            months.setdefault(p['date'][:7], []).append(p)
        for mkey in sorted(months.keys(), reverse=True):
            y, mo = mkey.split('-')
            cards.append(f'<div class="archive-month-label">{y} 年 {int(mo)} 月</div>')
            cards.append('<div class="archive-grid">')
            for p in months[mkey]:
                badge = '☀️ 早报' if p['type'] == 'morning' else '🌙 晚报'
                desc = '晨间战报 + 赛程速览' if p['type'] == 'morning' else '晚间新闻 + 深度资讯'
                cards.append(f'''      <a class="archive-card" href="{p['href']}">
        <div class="ac-top">
          <span class="ac-type ac-{p['type']}">{badge}</span>
          <span class="ac-date">{p['label']}</span>
        </div>
        <div class="ac-weekday">{p['weekday']}</div>
        <div class="ac-desc">{desc}</div>
      </a>''')
            cards.append('    </div>')
    archive_cards = '\n'.join(cards)

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>足球日报 · 归档</title>
  <link rel="stylesheet" href="/football/assets/common.css" />
  <script src="/js/standalone-theme.js"></script>
</head>
<body>

  <div class="top-nav">
    <a href="/">首页</a>
    <span class="nav-sep">|</span>
    <span class="nav-current">⚽ 足球日报</span>
  </div>

  <div class="archive-header">
    <div class="archive-icon">⚽</div>
    <h1>足球日报</h1>
    <p class="archive-sub">每日早报 · 晨间战报与赛程速览 &nbsp;|&nbsp; 每日晚报 · 晚间新闻与深度资讯</p>
  </div>

  <!-- 我的关注 -->
  <div class="card" style="margin-top: 4px;">
    <div class="card-title">我的关注</div>
    <div class="follow-bar">
      <a class="follow-chip chip-barca" href="/football/teams/barcelona.html">🔴 巴萨</a>
      <a class="follow-chip chip-spain" href="/football/teams/spain.html">🇪🇸 西班牙</a>
      <a class="follow-chip chip-miami" href="/football/teams/miami.html">🩷 迈阿密国际</a>
      <span class="follow-chip chip-laliga">🟡 西甲</span>
      <span class="follow-chip chip-ucl">🔵 欧冠</span>
      <span class="follow-chip chip-pl">🟣 英超</span>
    </div>
  </div>

  <!-- 归档列表 -->
  <div class="archive-section">
{archive_cards}
  </div>

  <div class="footer">
    数据来源：ESPN · BBC Sport · Sky Sports · Google News · 自动更新
  </div>

</body>
</html>
'''

    archive_path.write_text(html, encoding='utf-8')
    print(f'✅ 归档页已更新（{len(posts)} 篇日报）: {archive_path}')

# ==================== Main ====================
def main():
    # Windows 本地 GBK 控制台无法输出 emoji/中文，强制 UTF-8
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    parser = argparse.ArgumentParser(description='足球日报 v4 增强版')
    parser.add_argument('edition', nargs='?', choices=['morning', 'evening'], help='早报或晚报')
    parser.add_argument('--preview', action='store_true', help='只写到 D:/WorkBuddy-Outputs 备份')
    parser.add_argument('--archive-only', action='store_true', help='只重新生成 /football/ 归档页，不拉取数据')
    args = parser.parse_args()

    if args.archive_only:
        update_archive_index()
        return

    if not args.edition:
        parser.error('需要指定 edition (morning/evening)，或使用 --archive-only')

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

        # 3. 更新 /football/ 归档页
        update_archive_index()

    print(f"\n🎉 完成。")

if __name__ == '__main__':
    main()
