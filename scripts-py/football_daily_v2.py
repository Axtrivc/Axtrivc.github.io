"""
football_daily_v2.py — 足球日报 v6 · FotMob 版 (2026-07-23)

v6 调整:
- 联赛白名单: 只展示 英超/西甲/意甲/德甲/法甲/沙特联/中超/美职联 + 欧冠/欧联
  + 世界杯/欧洲杯/欧国联/国际友谊赛; 小众联赛 (巴甲/阿甲等) 一律剔除,
  但关注球队参加的任何赛事 (如国王杯) 始终保留
- 沙特联/中超不在 sports_skills 覆盖内, 直采 ESPN scoreboard (ksa.1/chn.1) 补齐
- 关注球队赛程弃用 sports_skills get_team_schedule (数据陈旧: 巴萨返回 0 场,
  西班牙只有 2024 欧洲杯), 改直采 ESPN site API schedule (按联赛+赛季合并)
- 关注球队 9 支: 巴萨/西班牙/曼城/曼联/阿森纳/拜仁/巴黎/科莫/迈阿密,
  卡片可点击跳转 /football/teams/<slug>.html (客户端实时拉取 ESPN 数据)
- 联赛分隔条加大 (24px 联赛徽 + 14px 粗体 + 分隔线), 比赛行队徽加大到 30px

v5 重构:
- 弃用世界杯模式与暗色球场风, 全版改用 FotMob 浅色卡片风 (参照用户截图)
- 休赛期以足坛新闻为主: Sky Sports 足球 RSS (逐条配图, feedparser 直解析)
  + BBC Sport / ESPN FC (文字) + Google News (转会/球队动态)
- 修复: 数据源把已踢完的比赛 (如世界杯决赛 西班牙vs阿根廷) 遗留为 not_started,
  旧逻辑把它当"下一场比赛"展示 — 现在一律要求 开球时间 > 当前时间 才算未赛
- 修复: 关注球队 ESPN ID 失效 (81/78/1593/788 → 83/1068/20232/164)
- 图片: 队徽 ESPN CDN teamlogos/500/{id}.png (浏览器 UA 可直链),
        联赛徽 leaguelogos/500/{lid}.png, 新闻图 Sky enclosure (365dm CDN)
- lazyload 共存: Butterfly 的 post_lazyload 会把所有 img 改写为 1x1 占位 + data-lazy-src,
        由 vanilla-lazyload 滚动触发回载; fm 图片必须 loading="eager" — 原生 lazy 会让
        浏览器延迟发请求, 快滚时被 vanilla-lazyload 的 cancel_on_exit 取消, 大图永远空白
- 比赛覆盖: get_daily_schedule 合并关注球队当/昨日比赛 (MLS 等不在 daily 接口的赛事)

输出:
- 早报: source/_posts/football-morning-YYYY-MM-DD.md
- 晚报: source/_posts/football-evening-YYYY-MM-DD.md
- 同时备份到 D:/WorkBuddy-Outputs/Football-Daily/

用法:
  python football_daily_v2.py morning
  python football_daily_v2.py evening
  python football_daily_v2.py morning --preview
  python football_daily_v2.py --archive-only
"""

import sys
import os
import json
import html as _html
import argparse
import subprocess
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

ESPN_TEAM_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500'
ESPN_LEAGUE_LOGO = 'https://a.espncdn.com/i/leaguelogos/soccer/500'

# ==================== 关注球队 (ESPN team IDs, 2026-07 逐一实测) ====================
# slug = /football/teams/<slug>.html 球队详情页
# espn = 直采赛程的 (联赛 slug, 赛季年份) 组合; 欧洲球队带欧冠, 赛季跨年用当年
FOLLOWED_TEAMS = {
    '83':    {'name': '巴塞罗那',    'slug': 'barcelona', 'color': '#A50044', 'color2': '#004D98',
              'espn': [('esp.1', '2025'), ('esp.1', '2026'), ('uefa.champions', '2025'), ('uefa.champions', '2026')]},
    '164':   {'name': '西班牙',      'slug': 'spain',     'color': '#B31B1B', 'color2': '#6E0B0B',
              'espn': [('fifa.world', '2026'), ('uefa.nations', '2026')]},
    '382':   {'name': '曼城',        'slug': 'mancity',   'color': '#6CABDD', 'color2': '#1C2C5B',
              'espn': [('eng.1', '2025'), ('eng.1', '2026'), ('uefa.champions', '2025'), ('uefa.champions', '2026')]},
    '360':   {'name': '曼联',        'slug': 'manutd',    'color': '#DA291C', 'color2': '#7A0D06',
              'espn': [('eng.1', '2025'), ('eng.1', '2026')]},
    '359':   {'name': '阿森纳',      'slug': 'arsenal',   'color': '#EF0107', 'color2': '#8F0000',
              'espn': [('eng.1', '2025'), ('eng.1', '2026'), ('uefa.champions', '2025'), ('uefa.champions', '2026')]},
    '132':   {'name': '拜仁慕尼黑',  'slug': 'bayern',    'color': '#DC052D', 'color2': '#7A0219',
              'espn': [('ger.1', '2025'), ('ger.1', '2026'), ('uefa.champions', '2025'), ('uefa.champions', '2026')]},
    '160':   {'name': '巴黎圣日耳曼', 'slug': 'psg',       'color': '#004170', 'color2': '#001829',
              'espn': [('fra.1', '2025'), ('fra.1', '2026'), ('uefa.champions', '2025'), ('uefa.champions', '2026')]},
    '2572':  {'name': '科莫',        'slug': 'como',      'color': '#005DAA', 'color2': '#002C52',
              'espn': [('ita.1', '2025'), ('ita.1', '2026')]},
    '20232': {'name': '迈阿密国际',  'slug': 'miami',     'color': '#E77FAE', 'color2': '#8A2B56',
              'espn': [('usa.1', '2026'), ('usa.1', '2025')]},
}

# 赛事 id -> (中文名, ESPN 联赛徽标 id 或 None); 徽标 id 均已实测
COMP_MAP = {
    'premier-league':           ('英超', 23),
    'la-liga':                  ('西甲', 15),
    'serie-a':                  ('意甲', 12),
    'bundesliga':               ('德甲', 10),
    'ligue-1':                  ('法甲', 9),
    'mls':                      ('美职联', 19),
    'usa.1':                    ('美职联', 19),
    'champions-league':         ('欧冠', 2),
    'uefa.champions':           ('欧冠', 2),
    'uefa.champions-league':    ('欧冠', 2),
    'europa-league':            ('欧联', 2310),
    'uefa.europa':              ('欧联', 2310),
    'world-cup':                ('世界杯', 4),
    'fifa.world':               ('世界杯', 4),
    'european-championship':    ('欧洲杯', 74),
    'uefa.euro':                ('欧洲杯', 74),
    'uefa.nations':             ('欧国联', 2395),
    'international-friendly':   ('国际友谊赛', None),
    'saudi-pro-league':         ('沙特联', 2488),
    'chinese-super-league':     ('中超', 2350),
    # 仅显示名映射 (关注队参加时才出现, 不在白名单)
    'copa-del-rey':             ('国王杯', None),
    'fa-cup':                   ('足总杯', None),
    'club-world-cup':           ('世俱杯', None),
    'conference-league':        ('欧协联', None),
}

# 主流赛事白名单 — 小众联赛 (巴甲/阿甲/英冠等) 一律不进日报
MAIN_COMPS = frozenset((
    'premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1',
    'mls', 'usa.1', 'saudi-pro-league', 'chinese-super-league',
    'champions-league', 'uefa.champions', 'uefa.champions-league',
    'europa-league', 'uefa.europa',
    'world-cup', 'fifa.world', 'european-championship', 'uefa.euro',
    'uefa.nations', 'international-friendly',
))

# 比赛分组展示顺序 (按白名单优先级)
COMP_ORDER = [
    'premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1',
    'saudi-pro-league', 'chinese-super-league', 'mls',
    'champions-league', 'europa-league',
    'world-cup', 'european-championship', 'uefa.nations', 'international-friendly',
]

# 沙特联/中超不在 sports_skills daily 覆盖内, 直采 ESPN scoreboard 补齐
EXTRA_LEAGUES = [
    ('ksa.1', 'saudi-pro-league', '沙特联'),
    ('chn.1', 'chinese-super-league', '中超'),
]
ESPN_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

# RSS 源 (BBC / ESPN 走 sports_skills; Sky 走 feedparser 直解析拿配图)
RSS_FEEDS = [
    ('BBC Sport', 'https://feeds.bbci.co.uk/sport/football/rss.xml'),
    ('ESPN FC',   'https://www.espn.com/espn/rss/soccer/news'),
]
SKY_FOOTBALL_RSS = 'https://www.skysports.com/rss/11095'  # 足球频道, 逐条带 enclosure 图

# Google News 查询
TRANSFER_QUERIES = [
    'Premier League transfer news',
    'Real Madrid Barcelona transfer',
    'football transfer rumours signings',
    'La Liga Serie A transfer news',
]
TEAM_QUERIES = [
    'Barcelona team news',
    'Manchester City Arsenal team news',
    'Manchester United team news',
    'Bayern Munich PSG team news',
    'Inter Miami Messi news',
    'Como Fabregas news',
]

# 转会关键词 (标题匹配)
TRANSFER_RE = None  # 在 main 前编译, 见 is_transfer_news()

# 明显非足球的内容
NON_FOOTBALL_HINTS = [
    'cricket', 'the hundred', 'nfl', 'tennis', 'rugby', 'golf', 'boxing',
    'darts', 'formula', 'grand prix', 'motogp', 'basketball', 'nba',
    'baseball', 'mlb', 'nhl', 'hockey', 'athletics', 'cycling', 'snooker',
    'ufc', 'wwe', 'fury', 'usyk', 'commonwealth',
]

# 新闻来源头像配色 (浅色底)
SOURCE_COLORS = {
    'BBC Sport': '#B80000', 'BBC': '#B80000',
    'Sky Sports': '#0B62D6', 'Sky': '#0B62D6',
    'ESPN FC': '#DA0202', 'ESPN': '#DA0202',
    'Goal.com': '#00A651', 'Goal': '#00A651',
    'NBC Sports': '#7C3AED',
    'The Athletic': '#B45309',
    'SI': '#1D4ED8',
}

# ==================== 视觉样式 (FotMob 浅色卡片风) ====================
# 作用域限定在 .fm-container 内, 不污染博客全局
# 注意: Butterfly 的 .container img 会给文章内所有 img 注入 display:block + margin:0 auto 20px,
# 特异性与 .fm-* 类打平, 靠文档顺序 (本文 style 块在 body 更靠后) 压制 — .fm-container img{margin:0}
# 是必须存在的防线, 删掉会导致联赛徽标居中/队徽错位/缩略图偏上
FM_CSS = """.fm-container{--fm-bg:#F3F5F7;--fm-card:#FFFFFF;--fm-text:#101828;--fm-sub:#667085;--fm-line:#EEF2F5;--fm-green:#00A651;--fm-green-d:#00843D;--fm-red:#E5484D;max-width:720px;margin:0 auto;background:var(--fm-bg);border-radius:20px;padding:14px 14px 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;color:var(--fm-text);font-size:14px;line-height:1.5;box-shadow:0 10px 34px rgba(16,24,40,.10)}
.fm-container a{text-decoration:none;color:inherit}
.fm-container a:hover{text-decoration:none}
.fm-container img{margin:0}
.fm-card{background:var(--fm-card);border-radius:16px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.05)}
.fm-hero{padding:20px 18px 16px}
.fm-kicker{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--fm-green)}
.fm-pulse{width:9px;height:9px;border-radius:50%;background:var(--fm-green);box-shadow:0 0 0 4px rgba(0,166,81,.14)}
.fm-hero h1{margin:8px 0 4px;font-size:25px;font-weight:800;letter-spacing:.01em;color:var(--fm-text)}
.fm-date{font-size:12.5px;color:var(--fm-sub)}
.fm-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.fm-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:#F2F4F7;font-size:12px;font-weight:600;color:#344054}
.fm-sec-title{display:flex;align-items:center;gap:9px;padding:15px 16px 10px;font-size:16px;font-weight:800}
.fm-sec-title::before{content:'';width:8px;height:8px;border-radius:3px;background:var(--fm-green)}
.fm-count{margin-left:auto;font-size:11px;font-weight:700;color:var(--fm-sub);background:#F2F4F7;border-radius:999px;padding:2px 10px}
.fm-league{display:flex;align-items:center;gap:10px;padding:16px 16px 6px;font-size:14.5px;font-weight:800;color:var(--fm-text);letter-spacing:.02em}
.fm-league img{width:24px;height:24px;object-fit:contain}
.fm-league .fm-lgline{flex:1;height:2px;border-radius:2px;background:linear-gradient(90deg,#E4E7EC,transparent)}
.fm-m{display:grid;grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);align-items:center;padding:11px 16px;border-top:1px solid var(--fm-line)}
.fm-t{display:flex;align-items:center;gap:10px;min-width:0;font-size:14px;font-weight:600}
.fm-t.r{flex-direction:row-reverse;text-align:right}
.fm-t .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fm-logo{position:relative;width:30px;height:30px;flex-shrink:0;display:inline-block}
.fm-logo .fm-fp{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#475467;background:#F2F4F7;border:1px solid #E4E7EC}
.fm-logo img{position:relative;width:30px;height:30px;object-fit:contain;display:block}
.fm-c{display:flex;flex-direction:column;align-items:center;gap:2px}
.fm-score{font-weight:800;font-size:16px;color:var(--fm-text);white-space:nowrap}
.fm-time{font-size:13px;font-weight:600;color:var(--fm-sub);white-space:nowrap}
.fm-livepill{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--fm-green);color:#fff;font-size:12px;font-weight:800;animation:fmpulse 2s infinite}
@keyframes fmpulse{0%,100%{opacity:1}50%{opacity:.75}}
.fm-mdate{font-size:10px;color:var(--fm-sub);white-space:nowrap}
.fm-empty{padding:14px 16px;color:var(--fm-sub);font-size:13px}
.fm-heroimg{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#EAECF0}
.fm-nbody{padding:13px 16px 15px}
.fm-t1{font-size:16.5px;font-weight:800;line-height:1.42}
.fm-t1 a:hover{color:var(--fm-green)}
.fm-meta{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:11.5px;color:var(--fm-sub)}
.fm-ava{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0}
.fm-nrow{display:flex;gap:12px;align-items:center;padding:11px 16px;border-top:1px solid var(--fm-line)}
.fm-thumb{width:84px;height:84px;border-radius:12px;object-fit:cover;flex-shrink:0;background:#EAECF0;display:block}
.fm-thumb-fb{width:84px;height:84px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff}
.fm-nbody2{min-width:0;flex:1}
.fm-t2{font-size:14px;font-weight:700;line-height:1.4;color:var(--fm-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fm-nrow:hover .fm-t2{color:var(--fm-green)}
.fm-teams{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:2px 16px 16px}
.fm-team{border-radius:16px;padding:13px 12px 11px;color:#fff;position:relative;overflow:hidden;min-height:142px;display:flex;flex-direction:column;text-decoration:none;cursor:pointer;box-shadow:0 2px 8px rgba(16,24,40,.10);transition:transform .18s ease,box-shadow .18s ease}
.fm-container a.fm-team,.fm-container a.fm-team:hover{color:#fff}
.fm-team:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(16,24,40,.24);text-decoration:none;color:#fff}
.fm-team::before{content:'';position:absolute;top:-20%;left:-70%;width:45%;height:140%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.30),transparent);transform:skewX(-20deg);transition:left .55s ease;pointer-events:none;z-index:1}
.fm-team:hover::before{left:135%}
.fm-team::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 120% at 100% 0%,rgba(255,255,255,.18),transparent 55%);pointer-events:none}
.fm-team .top{display:flex;align-items:center;gap:10px;position:relative;z-index:2}
.fm-team img{width:44px;height:44px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 4px 10px rgba(0,0,0,.28))}
.fm-team .nm{font-size:15.5px;font-weight:800;letter-spacing:.01em;line-height:1.25;min-width:0}
.fm-team .nx{position:relative;z-index:2;margin-top:auto;padding-top:8px;font-size:11.5px;opacity:.95;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.fm-team .ha{font-size:10px;font-weight:800;background:rgba(255,255,255,.22);border-radius:6px;padding:1px 6px;flex-shrink:0}
.fm-team .cta{position:relative;z-index:2;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.24);font-size:11px;font-weight:700;opacity:.95;display:flex;align-items:center;justify-content:space-between;letter-spacing:.02em}
.fm-team .cta .arr{transition:transform .18s;font-size:13px}
.fm-team:hover .cta .arr{transform:translateX(3px)}
.fm-form{display:flex;gap:4px;position:relative;z-index:2;margin-top:8px}
.fm-fb2{width:17px;height:17px;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;color:#fff}
.fm-fb2.w{background:#12B76A}
.fm-fb2.d{background:rgba(255,255,255,.35)}
.fm-fb2.l{background:rgba(0,0,0,.30)}
@media(max-width:640px){.fm-teams{grid-template-columns:1fr 1fr}.fm-team .nm{font-size:14px}}
.fm-foot{text-align:center;color:var(--fm-sub);font-size:11px;line-height:1.9;padding:12px 16px 20px}
@media(max-width:560px){.fm-m{grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr)}.fm-hero h1{font-size:21px}.fm-thumb,.fm-thumb-fb{width:70px;height:70px}}"""

# ==================== 工具函数 ====================
def esc(s):
    return _html.escape(str(s or ''), quote=True)

def now_bj():
    return datetime.now(BJ)

def bj_date_str(offset=0):
    d = now_bj() + timedelta(days=offset)
    return d.strftime('%Y-%m-%d')

def bj_date_cn():
    d = now_bj()
    weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return f"{d.year}年{d.month}月{d.day}日 星期{weekdays[d.weekday()]}"

def parse_dt(utc_str):
    """ISO 时间 -> 北京 datetime (失败返回 None)"""
    if not utc_str:
        return None
    try:
        return datetime.fromisoformat(str(utc_str).replace('Z', '+00:00')).astimezone(BJ)
    except Exception:
        return None

def parse_pub_date(item):
    """新闻时间: 兼容 published_iso (ISO) 与 published (RFC822), 返回北京 datetime 或 None"""
    iso = item.get('published_iso') or ''
    dt = parse_dt(iso)
    if dt:
        return dt
    raw = item.get('published') or item.get('pub_date') or ''
    if raw:
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(raw).astimezone(BJ)
        except Exception:
            return None
    return None

def time_ago(dt):
    """北京 datetime -> 'x分钟前 / x小时前 / x天前 / M月d日'"""
    if not dt:
        return ''
    secs = (now_bj() - dt).total_seconds()
    if secs < 0:
        return dt.strftime('%m月%d日').lstrip('0').replace('月0', '月')
    if secs < 3600:
        return f'{max(1, int(secs // 60))}分钟前'
    if secs < 86400:
        return f'{int(secs // 3600)}小时前'
    if secs < 5 * 86400:
        return f'{int(secs // 86400)}天前'
    return f'{dt.month}月{dt.day}日'

def bj_time_str(utc_str):
    dt = parse_dt(utc_str)
    return dt.strftime('%H:%M') if dt else '?'

def bj_full_cn(utc_str):
    """UTC ISO -> '7月25日 周六 03:00' (北京时间)"""
    dt = parse_dt(utc_str)
    if not dt:
        return '?'
    wd = ['一', '二', '三', '四', '五', '六', '日'][dt.weekday()]
    return f'{dt.month}月{dt.day}日 周{wd} {dt.strftime("%H:%M")}'

# ==================== 比赛状态判定 ====================
CLOSED_STATUSES = {'closed', 'finished', 'final', 'status_final', 'full-time', 'ft'}

def is_closed(m):
    return str(m.get('status', '')).lower() in CLOSED_STATUSES

def is_future(m):
    """真正未开球: 非已结束 且 开球时间晚于现在 (5 分钟宽限)。
    数据源会把已踢完的比赛遗留为 not_started (如世界杯决赛), 必须按时间过滤。"""
    if is_closed(m):
        return False
    dt = parse_dt(m.get('start_time'))
    if not dt:
        return False
    return dt > now_bj() - timedelta(minutes=5)

def is_live(m):
    """已开球但未标记结束: 开球时间在 3 小时内"""
    if is_closed(m):
        return False
    dt = parse_dt(m.get('start_time'))
    if not dt:
        return False
    now = now_bj()
    return dt - timedelta(minutes=5) <= now <= dt + timedelta(hours=3)

def match_bj_date(m):
    dt = parse_dt(m.get('start_time'))
    return dt.strftime('%Y-%m-%d') if dt else ''

# ==================== CLI 调用 (sports-skills) ====================
def call_skill(*args):
    """调用 sports-skills CLI 并解析 JSON"""
    python_candidates = ['python3', 'python', sys.executable]
    for py in python_candidates:
        cmd = [py, '-m', 'sports_skills', *args]
        try:
            # sports_skills 输出为 UTF-8; Windows 默认 gbk 解码会乱码甚至崩溃, 强制 UTF-8
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

# ==================== 数据采集: 比赛 ====================
def get_daily_matches(date_str=None):
    """指定日期的赛程 (所有覆盖赛事); 默认今天"""
    args = ['football', 'get_daily_schedule']
    if date_str:
        args.append(f'--date={date_str}')
    data = call_skill(*args)
    if (not data or not data.get('status')) and date_str:
        data = call_skill('football', 'get_daily_schedule')
    return safe(data, 'data', 'events', default=[]) or []

# ==================== 数据采集: ESPN 直采 (球队赛程 + 沙特联/中超) ====================
def _espn_get(url):
    """ESPN site API GET -> dict (失败返回 None); 必须带浏览器 UA"""
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={'User-Agent': ESPN_UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode('utf-8', 'replace'))
    except Exception:
        return None

def _espn_score(v):
    """score 字段兼容: {$ref,value,displayValue} / 数字字符串 / 数字 / None"""
    if v is None:
        return None
    if isinstance(v, dict):
        v = v.get('value')
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None

def normalize_espn_event(e, comp_id, comp_name):
    """ESPN site API 事件 -> 与 sports_skills 一致的内部结构。
    status: scoreboard 在顶层 e.status, schedule 在 competitions[0].status"""
    comp0 = (e.get('competitions') or [{}])[0]
    st = (e.get('status') or comp0.get('status') or {}).get('type') or {}
    if st.get('completed'):
        status = 'closed'
    elif st.get('state') == 'in':
        status = 'in_progress'
    else:
        status = 'not_started'
    competitors = []
    scores = {}
    for c in comp0.get('competitors') or []:
        t = c.get('team') or {}
        sc = _espn_score(c.get('score'))
        if not st.get('completed') and st.get('state') != 'in':
            sc = None
        qualifier = c.get('homeAway') or ''
        competitors.append({
            'team': {
                'id': str(t.get('id') or ''),
                'name': t.get('displayName') or t.get('name') or '?',
                'short_name': t.get('shortDisplayName') or t.get('displayName') or '?',
                'abbreviation': t.get('abbreviation') or '',
            },
            'qualifier': qualifier,
            'score': sc,
        })
        if qualifier in ('home', 'away'):
            scores[qualifier] = sc
    # 主队排前 (sports_skills 约定 competitors[0]=home)
    competitors.sort(key=lambda c: 0 if c['qualifier'] == 'home' else 1)
    return {
        'id': str(e.get('id') or comp0.get('id') or ''),
        'status': status,
        'start_time': e.get('date') or '',
        'competition': {'id': comp_id, 'name': comp_name},
        'competitors': competitors,
        'scores': scores,
    }

def get_team_events(team_id):
    """球队赛程直采 ESPN site API (sports_skills get_team_schedule 数据陈旧已弃用)。
    按 FOLLOWED_TEAMS[tid]['espn'] 的 (联赛, 赛季) 组合合并去重。"""
    info = FOLLOWED_TEAMS.get(str(team_id)) or {}
    out, seen = [], set()
    for league, season in info.get('espn', []):
        url = (f'https://site.api.espn.com/apis/site/v2/sports/soccer/{league}'
               f'/teams/{team_id}/schedule?season={season}')
        data = _espn_get(url)
        for e in (data or {}).get('events') or []:
            lg = e.get('league') or {}
            cid = lg.get('slug') or league
            cname = lg.get('name') or league
            m = normalize_espn_event(e, cid, cname)
            if m['id'] and m['id'] not in seen:
                seen.add(m['id'])
                out.append(m)
    return out

def get_extra_league_events(bj_dates):
    """沙特联/中超: ESPN scoreboard 直采。bj_dates 为北京日期列表 (YYYY-MM-DD);
    每个北京日横跨 UTC 两天 (16:00→16:00), 前后各多拉一天兜底, 靠北京时间重新分桶。"""
    utc_dates = set()
    for ds in bj_dates:
        d = datetime.strptime(ds, '%Y-%m-%d')
        for off in (-1, 0, 1):
            utc_dates.add((d + timedelta(days=off)).strftime('%Y%m%d'))
    out = []
    for slug, cid, cname in EXTRA_LEAGUES:
        for ymd in sorted(utc_dates):
            data = _espn_get(f'https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}'
                             f'/scoreboard?dates={ymd}&limit=200')
            for e in (data or {}).get('events') or []:
                out.append(normalize_espn_event(e, cid, cname))
    return out

def involves_followed(m):
    """比赛是否有关注球队参与"""
    return any(str(safe(c, 'team', 'id', default='')) in FOLLOWED_TEAMS
               for c in m.get('competitors', []))

def is_main_match(m):
    """主流赛事白名单过滤; 关注球队参加的任何赛事 (国王杯等) 始终保留"""
    cid = (m.get('competition') or {}).get('id') or ''
    return cid in MAIN_COMPS or involves_followed(m)

# ==================== 数据采集: 新闻 ====================
def get_sky_football_news(limit=14):
    """Sky Sports 足球 RSS — feedparser 直解析, 逐条带 enclosure 配图"""
    try:
        import feedparser
    except ImportError:
        return []
    try:
        f = feedparser.parse(SKY_FOOTBALL_RSS)
    except Exception:
        return []
    items = []
    for e in f.entries:
        img = ''
        for enc in getattr(e, 'enclosures', []) or []:
            href = enc.get('href', '') or enc.get('url', '')
            if href:
                img = href
                break
        items.append({
            'title': e.get('title', ''),
            'link': e.get('link', '#'),
            'source': 'Sky Sports',
            'published': e.get('published', ''),
            'published_iso': '',
            'image': img,
        })
    return items[:limit]

def get_news_rss(feed_url, source_name, limit=6):
    """RSS 文字新闻 (经 sports_skills)"""
    data = call_skill('news', 'fetch_feed', f'--url={feed_url}')
    entries = safe(data, 'data', 'entries', default=[]) or safe(data, 'entries', default=[]) or []
    for e in entries:
        e['source'] = e.get('source') or source_name
        e['image'] = e.get('image') or ''
    return entries[:limit]

def get_news_google(query, limit=3):
    """Google News 搜索 (经 sports_skills)"""
    data = call_skill('news', 'fetch_items', '--google_news',
                      f'--query={query}', f'--limit={limit}', '--sort_by_date')
    items = safe(data, 'data', 'items', default=[]) or safe(data, 'items', default=[]) or []
    for e in items:
        e['image'] = ''
    return items

# ==================== 新闻清洗 ====================
import re as _re

def norm_title(t):
    """标题归一化 (去重: 大小写/标点/空格不敏感)"""
    return _re.sub(r'[^a-z0-9一-鿿]+', '', (t or '').lower())

def is_football_news(item):
    """按标题+链接剔除明显非足球的新闻"""
    text = f"{item.get('title', '')} {item.get('link', '') or item.get('url', '')}".lower()
    return not any(h in text for h in NON_FOOTBALL_HINTS)

_TRANSFER_PATTERN = _re.compile(
    r'transfer|sign(s|ed|ing)?\b|deal\b|rumou?r|bid\b|clause|loan\b|swoop|'
    r'medical|free agent|contract|exit\b|move\b|snap up|join(s|ed)?\b|转会|签约|加盟|官宣',
    _re.IGNORECASE)

def is_transfer_news(item):
    return bool(_TRANSFER_PATTERN.search(item.get('title', '') or ''))

def split_news_title(item):
    """Google News 标题常带 ' - 来源' 后缀, 拆出来源并清洗标题"""
    title = (item.get('title', '') or '').strip()
    source = (item.get('source', '') or '').strip()
    if ' - ' in title:
        head, _, tail = title.rpartition(' - ')
        if head and 0 < len(tail) <= 30:
            title = head.strip()
            if not source:
                source = tail.strip()
    return title, source

def news_fresh(item, max_days=5):
    """剔除过旧新闻 (无法解析时间则保留)"""
    dt = parse_pub_date(item)
    if not dt:
        return True
    return (now_bj() - dt) <= timedelta(days=max_days)

def dedup_news(items):
    seen, out = set(), []
    for it in items:
        t, s = split_news_title(it)
        if not t:
            continue
        key = norm_title(t)
        if not key or key in seen:
            continue
        seen.add(key)
        it = dict(it)
        it['title'], it['source'] = t, s
        out.append(it)
    return out

# ==================== 渲染: 通用 ====================
def logo_html(team_id, abbr='', size=26):
    """队徽: ESPN CDN 图, 加载失败时露出底下的缩写圆形占位徽章"""
    code = (abbr or '?').strip().upper()[:3] or '?'
    fb = f'<span class="fm-fp">{esc(code)}</span>'
    if team_id:
        return (f'<span class="fm-logo">{fb}'
                f'<img src="{ESPN_TEAM_LOGO}/{team_id}.png" alt="{esc(abbr)}" '
                f'loading="eager" onerror="this.remove()"></span>')
    return f'<span class="fm-logo">{fb}</span>'

def comp_display(m):
    """赛事显示名 + 联赛徽标 id (可能为 None)"""
    comp = m.get('competition') or {}
    cid = comp.get('id', '') or ''
    name = comp.get('name', '') or '其他'
    if cid in COMP_MAP:
        cn, lid = COMP_MAP[cid]
        return cn, lid
    return name, None

def source_avatar(source):
    """新闻来源圆形字母头像"""
    s = (source or '?').strip()
    letter = esc(s[0].upper()) if s else '?'
    color = SOURCE_COLORS.get(s, '#667085')
    return f'<span class="fm-ava" style="background:{color}">{letter}</span>'

def news_meta_html(item):
    """来源头像 + 来源名 + 相对时间"""
    _, source = split_news_title(item)
    dt = parse_pub_date(item)
    ago = time_ago(dt)
    bits = [source_avatar(source)]
    if source:
        bits.append(f'<span>{esc(source)}</span>')
    if ago:
        bits.append(f'<span>· {ago}</span>')
    return f'<div class="fm-meta">{"".join(bits)}</div>'

# ==================== 渲染: 比赛 ====================
def fm_match_row(m):
    """FotMob 比赛行: 主队名+队徽 | 中央比分/时间 | 队徽+客队名"""
    comps = m.get('competitors', [])
    if len(comps) < 2:
        return ''
    ht, at = comps[0].get('team') or {}, comps[1].get('team') or {}
    hn = esc(ht.get('short_name') or ht.get('name') or '?')
    an = esc(at.get('short_name') or at.get('name') or '?')
    h_logo = logo_html(ht.get('id'), ht.get('abbreviation', ''))
    a_logo = logo_html(at.get('id'), at.get('abbreviation', ''))

    scores = m.get('scores') or {}
    hs, as_ = scores.get('home'), scores.get('away')
    if hs is None:
        hs = comps[0].get('score')
    if as_ is None:
        as_ = comps[1].get('score')

    eid = m.get('id', '')
    link = f'https://www.espn.com/soccer/match/_/gameId/{eid}' if eid else '#'

    sub = ''
    if is_closed(m):
        center = f'<a href="{link}" class="fm-score">{hs} - {as_}</a>'
        if match_bj_date(m) != bj_date_str():
            sub = f'<span class="fm-mdate">{esc(match_bj_date(m)[5:].replace("-", "/"))}</span>'
    elif is_live(m):
        center = f'<a href="{link}" class="fm-livepill">{hs} - {as_} LIVE</a>'
    else:
        center = f'<span class="fm-time">{bj_time_str(m.get("start_time"))}</span>'
        d = match_bj_date(m)
        if d and d != bj_date_str():
            dt = parse_dt(m.get('start_time'))
            sub = f'<span class="fm-mdate">{dt.month}/{dt.day}</span>' if dt else ''
    return (f'<div class="fm-m">'
            f'<div class="fm-t">{h_logo}<span class="nm">{hn}</span></div>'
            f'<div class="fm-c">{center}{sub}</div>'
            f'<div class="fm-t r"><span class="nm">{an}</span>{a_logo}</div></div>')

def fm_match_block(events, limit=14):
    """按赛事分组的比赛列表 HTML — 按中文名合并别名组 (如 uefa.champions/champions-league),
    组序固定为 COMP_ORDER 白名单优先级"""
    groups = {}
    for e in events[:limit]:
        comp = e.get('competition') or {}
        cid = comp.get('id') or ''
        cn, lid = comp_display(e)
        key = cn  # 中文显示名为组键, 自动合并别名
        if key not in groups:
            groups[key] = {'lid': lid, 'cid': cid, 'evs': []}
        groups[key]['evs'].append(e)
        if groups[key]['lid'] is None and lid:
            groups[key]['lid'] = lid

    def _sort_key(k):
        cid = groups[k]['cid']
        return COMP_ORDER.index(cid) if cid in COMP_ORDER else len(COMP_ORDER)

    out = []
    for key in sorted(groups.keys(), key=_sort_key):
        g = groups[key]
        logo = (f'<img src="{ESPN_LEAGUE_LOGO}/{g["lid"]}.png" alt="" loading="eager" '
                f'onerror="this.remove()">') if g['lid'] else ''
        out.append(f'<div class="fm-league">{logo}<span>{esc(key)}</span>'
                   f'<span class="fm-lgline"></span></div>')
        out.extend(fm_match_row(e) for e in g['evs'])
    return ''.join(out)

def fm_section(title, inner, count=0):
    chip = f'<span class="fm-count">{count}</span>' if count else ''
    return f'<div class="fm-card"><div class="fm-sec-title">{esc(title)}{chip}</div>{inner}</div>'

# ==================== 渲染: 新闻 ====================
def fm_news_hero(item):
    """头条大卡: 16:9 大图 + 标题 + 来源/时间 (仿 FotMob 时下人气)"""
    title, _ = split_news_title(item)
    link = item.get('link', '#')
    img = item.get('image') or ''
    img_html = (f'<img class="fm-heroimg" src="{esc(img)}" alt="" loading="eager" '
                f'onerror="this.remove()">') if img else ''
    return (f'<div class="fm-card">{img_html}'
            f'<div class="fm-nbody"><div class="fm-t1"><a href="{esc(link)}">{esc(title)}</a></div>'
            f'{news_meta_html(item)}</div></div>')

def fm_news_row(item):
    """新闻行: 左缩略图 (无图时用来源色块) + 右标题 + 来源/时间"""
    title, source = split_news_title(item)
    link = item.get('link', '#')
    img = item.get('image') or ''
    if img:
        thumb = (f'<img class="fm-thumb" src="{esc(img)}" alt="" loading="eager" '
                 f'onerror="this.outerHTML=\'<div class=fm-thumb-fb style=background:{SOURCE_COLORS.get(source, "#667085")}>{esc((source or "?")[:1].upper())}</div>\'">')
    else:
        color = SOURCE_COLORS.get(source, '#667085')
        letter = esc((source or '?').strip()[:1].upper())
        thumb = f'<div class="fm-thumb-fb" style="background:{color}">{letter}</div>'
    return (f'<a class="fm-nrow" href="{esc(link)}">{thumb}'
            f'<div class="fm-nbody2"><div class="fm-t2">{esc(title)}</div>'
            f'{news_meta_html(item)}</div></a>')

# ==================== 渲染: 关注球队 ====================
def _form_badges(tid, closed_events, limit=5):
    """近 N 场胜/平/负圆点 (最新在右; 只统计 150 天内的比赛)"""
    cutoff = now_bj() - timedelta(days=150)
    recent = []
    for m in closed_events:
        dt = parse_dt(m.get('start_time'))
        if dt and dt >= cutoff:
            recent.append(m)
    recent.sort(key=lambda x: x.get('start_time', ''), reverse=True)
    badges = []
    for m in recent[:limit]:
        mine, other = None, None
        for c in m.get('competitors', []):
            if str(safe(c, 'team', 'id', default='')) == str(tid):
                mine = c
            else:
                other = c
        if mine is None or other is None:
            continue
        try:
            ms, os_ = int(mine.get('score', 0) or 0), int(other.get('score', 0) or 0)
        except (TypeError, ValueError):
            continue
        if ms > os_:
            badges.append('<span class="fm-fb2 w">胜</span>')
        elif ms == os_:
            badges.append('<span class="fm-fb2 d">平</span>')
        else:
            badges.append('<span class="fm-fb2 l">负</span>')
    badges.reverse()
    return ''.join(badges)

def fm_team_card(tid, info, events):
    """FotMob 关注队卡: 队色底 + 大队徽 + 队名 + 近 5 场战绩 + 下一场"""
    future = sorted([m for m in events if is_future(m)], key=lambda x: x.get('start_time', ''))
    closed = [m for m in events if is_closed(m)]
    form_html = _form_badges(tid, closed)

    if future:
        nxt = future[0]
        opp, ha = '?', ''
        for c in nxt.get('competitors', []):
            if str(safe(c, 'team', 'id', default='')) == str(tid):
                ha = '主' if c.get('qualifier') == 'home' else '客'
            else:
                t = c.get('team') or {}
                opp = t.get('short_name') or t.get('name') or '?'
        ha_html = f'<span class="ha">{ha}</span>' if ha else ''
        next_html = f'{ha_html}<span>{esc(opp)}</span><span>{esc(bj_full_cn(nxt.get("start_time")))}</span>'
    else:
        next_html = '<span>休赛期 · 赛程待定</span>'

    form_row = f'<div class="fm-form">{form_html}</div>' if form_html else ''
    return (f'<a class="fm-team" href="/football/teams/{info["slug"]}.html" '
            f'style="background:linear-gradient(135deg,{info["color"]} 0%,{info["color2"]} 100%)">'
            f'<div class="top"><img src="{ESPN_TEAM_LOGO}/{tid}.png" alt="{esc(info["name"])}" '
            f'loading="eager" onerror="this.remove()">'
            f'<div class="nm">{esc(info["name"])}</div></div>{form_row}'
            f'<div class="nx">{next_html}</div>'
            f'<div class="cta"><span>球队详情 · 实时数据</span><span class="arr">›</span></div></a>')

# ==================== 渲染: Hero / 页脚 ====================
def fm_hero(edition_cn, chips):
    chips_html = ''.join(f'<span class="fm-chip">{c}</span>' for c in chips if c)
    return (f'<div class="fm-card fm-hero">'
            f'<div class="fm-kicker"><span class="fm-pulse"></span><span>足球日报 · {edition_cn}</span></div>'
            f'<h1>⚽ 足球{edition_cn}</h1>'
            f'<div class="fm-date">{bj_date_cn()} · 抓取于 {now_bj().strftime("%H:%M")} (GMT+8)</div>'
            f'<div class="fm-chips">{chips_html}</div></div>')

def fm_footer():
    return (f'<div class="fm-foot">「足球日报」自动生成 · FotMob 风格版<br>'
            f'数据来源 ESPN · Sky Sports · BBC Sport · Google News · '
            f'{now_bj().strftime("%Y-%m-%d %H:%M")} GMT+8</div>')

# ==================== 新闻聚合 ====================
def collect_news():
    """拉取全部新闻源, 返回 (头条列表带图, 转会列表, 动态列表), 均已去重过滤"""
    print('🗞️ 拉取 Sky Sports 足球 RSS (带图)...')
    sky = [n for n in get_sky_football_news(14) if is_football_news(n) and news_fresh(n)]
    print(f'   Sky: {len(sky)} 条')

    print('📡 拉取 BBC / ESPN RSS...')
    text_news = []
    for name, url in RSS_FEEDS:
        entries = [n for n in get_news_rss(url, name, 6) if is_football_news(n) and news_fresh(n)]
        print(f'   {name}: {len(entries)} 条')
        text_news.extend(entries)

    print('🔀 拉取转会新闻 (Google News)...')
    transfer_g = []
    for q in TRANSFER_QUERIES:
        transfer_g.extend(n for n in get_news_google(q, 3) if is_football_news(n) and news_fresh(n))

    print('⚽ 拉取球队动态 (Google News)...')
    team_g = []
    for q in TEAM_QUERIES:
        team_g.extend(n for n in get_news_google(q, 3) if is_football_news(n) and news_fresh(n))

    # 头条: Sky 带图优先, 不足时用 BBC/ESPN 文字补齐
    headlines = dedup_news(sky)
    hero_item = headlines[0] if headlines else None
    headline_rows = headlines[1:7] if len(headlines) > 1 else []
    text_pool = dedup_news(text_news)
    used = {norm_title(h['title']) for h in headlines}
    for n in text_pool:
        if len(headline_rows) >= 6:
            break
        if norm_title(n['title']) not in used:
            used.add(norm_title(n['title']))
            headline_rows.append(n)
    if not hero_item and text_pool:
        hero_item = text_pool[0]
        used.add(norm_title(text_pool[0]['title']))

    # 转会: Sky 中带转会关键词的 (有图) + Google 转会查询; 不与头条/hero 重复
    sky_tr = [n for n in headlines if is_transfer_news(n)]
    transfers = []
    for n in dedup_news(sky_tr + transfer_g):
        if len(transfers) >= 7:
            break
        if norm_title(n['title']) not in used:
            used.add(norm_title(n['title']))
            transfers.append(n)

    # 足坛动态: 剩余文字新闻 + Google 球队动态
    rest = [n for n in dedup_news(text_pool + team_g) if norm_title(n['title']) not in used]
    feed = rest[:6]

    return hero_item, headline_rows, transfers, feed

# ==================== 日报生成 ====================
def generate_report(edition):
    """edition: 'morning' | 'evening' — 同一 FotMob 模版, 比赛板块侧重不同"""
    today_cn = bj_date_cn()
    today_str = bj_date_str()
    edition_cn = '早报' if edition == 'morning' else '晚报'

    # ---- 1. 比赛数据 ----
    print('📅 拉取赛程 (昨日/今日/明日)...')
    yday_str, tmrw_str = bj_date_str(-1), bj_date_str(1)
    raw, seen_ids = [], set()
    for ds in (yday_str, today_str, tmrw_str):
        for e in get_daily_matches(ds):
            if str(e.get('id')) not in seen_ids:
                seen_ids.add(str(e.get('id')))
                raw.append(e)

    print('🌍 直采沙特联/中超 (ESPN scoreboard)...')
    n_extra = 0
    for m in get_extra_league_events((yday_str, today_str, tmrw_str)):
        if m['id'] and m['id'] not in seen_ids:
            seen_ids.add(m['id'])
            raw.append(m)
            n_extra += 1
    print(f'   沙特联/中超补充 {n_extra} 场')

    print('⭐ 拉取关注球队赛程 (ESPN 直采)...')
    team_events = {}
    for tid in FOLLOWED_TEAMS:
        team_events[tid] = get_team_events(tid)

    # daily 接口缺 MLS 等赛事, 用关注球队赛程补齐三天窗口
    for tev in team_events.values():
        for m in tev:
            if str(m.get('id')) in seen_ids:
                continue
            if match_bj_date(m) in (yday_str, today_str, tmrw_str):
                seen_ids.add(str(m.get('id')))
                raw.append(m)

    # 小众联赛剔除: 白名单内赛事 + 关注队参加的比赛才保留
    n_before = len(raw)
    raw = [e for e in raw if is_main_match(e)]
    print(f'🔎 联赛白名单过滤: {n_before} -> {len(raw)} 场')

    # 按北京时间重新分桶 (daily 接口按自身时区给日期, 会串天)
    ev_today = sorted([e for e in raw if match_bj_date(e) == today_str], key=lambda x: x.get('start_time', ''))
    ev_yday = sorted([e for e in raw if match_bj_date(e) == yday_str], key=lambda x: x.get('start_time', ''))
    ev_tmrw = sorted([e for e in raw if match_bj_date(e) == tmrw_str], key=lambda x: x.get('start_time', ''))

    today_closed = [e for e in ev_today if is_closed(e)]
    today_live = [e for e in ev_today if is_live(e)]
    today_up = [e for e in ev_today if is_future(e)]
    tmrw_up = [e for e in ev_tmrw if is_future(e)]

    # 昨夜今晨: 近 20 小时内已结束的比赛, 关注队优先, 最多 12 场
    cutoff = now_bj() - timedelta(hours=20)
    recent_closed = sorted(
        [e for e in raw if is_closed(e) and (parse_dt(e.get('start_time')) or now_bj()) >= cutoff],
        key=lambda x: (not involves_followed(x), x.get('start_time', '')))[:12]

    # ---- 2. 新闻数据 ----
    hero_item, headline_rows, transfers, feed = collect_news()

    # ---- 3. Hero chips ----
    n_matches = len(ev_today)
    n_news = (1 if hero_item else 0) + len(headline_rows) + len(transfers) + len(feed)
    chips = []
    if edition == 'morning' and n_matches:
        chips.append(f'⚽ 今日比赛 {n_matches} 场')
    elif edition == 'evening' and today_closed:
        chips.append(f'⚽ 今日已赛 {len(today_closed)} 场')
    chips.append(f'🗞️ 足坛新闻 {n_news} 条')
    # 关注队最近的一场未赛 -> 距开赛天数
    nxt_all = []
    for tid, tev in team_events.items():
        fut = sorted([m for m in tev if is_future(m)], key=lambda x: x.get('start_time', ''))
        if fut:
            nxt_all.append((parse_dt(fut[0].get('start_time')), tid))
    if nxt_all:
        dt0, tid0 = min(nxt_all, key=lambda x: x[0])
        days = (dt0.date() - now_bj().date()).days
        if days > 0:
            chips.append(f'🗓️ 距{FOLLOWED_TEAMS[tid0]["name"]}下一场 {days} 天')
    chips.append('🪟 夏季转会窗进行中')

    # ---- 4. 组装 ----
    html_parts = []
    html_parts.append(f"""---
title: 足球{edition_cn} · {today_cn}
date: {today_str} {'08:00:00' if edition == 'morning' else '20:00:00'}
excerpt: 足坛新闻 + 转会动态 + 赛程速览 (FotMob 风)
description: 足坛头条 · 转会窗 · 关注球队 · 赛程速览 · FotMob 风格
cover_color: '#F3F5F7'
tags:
  - 足球
  - {edition_cn}
  - 转会窗
  - 数据驱动
categories:
  - 足球日报
---
<style>{FM_CSS}</style>
<div class="fm-container">""")

    html_parts.append(fm_hero(edition_cn, chips))

    # 比赛板块
    if edition == 'morning':
        if recent_closed:
            html_parts.append(fm_section('昨夜今晨', fm_match_block(recent_closed), len(recent_closed)))
        if today_live or today_up:
            evs = today_live + today_up
            html_parts.append(fm_section('今日比赛', fm_match_block(evs), len(evs)))
        # 今日无未赛时预告明晨赛事 (美洲赛事集中在北京时间清晨)
        if not (today_live or today_up) and tmrw_up:
            html_parts.append(fm_section('明晨预告', fm_match_block(tmrw_up[:10]), len(tmrw_up[:10])))
    else:
        if today_closed or today_live:
            evs = today_live + today_closed
            html_parts.append(fm_section('今日战报', fm_match_block(evs), len(evs)))
        upcoming = today_up + tmrw_up
        if upcoming:
            html_parts.append(fm_section('待赛', fm_match_block(upcoming), len(upcoming)))
    if not (recent_closed or today_closed or today_live or today_up or tmrw_up):
        html_parts.append('<div class="fm-card"><div class="fm-empty">🏖️ 休赛期 — 今日无主流赛事, 足坛动态详见下方新闻。</div></div>')

    # 头条
    if hero_item:
        html_parts.append(fm_news_hero(hero_item))
    if headline_rows:
        html_parts.append(fm_section('时下人气', ''.join(fm_news_row(n) for n in headline_rows), len(headline_rows)))

    # 转会窗
    if transfers:
        html_parts.append(fm_section('转会窗', ''.join(fm_news_row(n) for n in transfers), len(transfers)))

    # 关注球队
    team_cards = ''.join(fm_team_card(tid, info, team_events.get(tid, []))
                         for tid, info in FOLLOWED_TEAMS.items())
    html_parts.append(fm_section('我的关注', f'<div class="fm-teams">{team_cards}</div>'))

    # 足坛动态
    if feed:
        html_parts.append(fm_section('足坛动态', ''.join(fm_news_row(n) for n in feed), len(feed)))

    html_parts.append(fm_footer())
    html_parts.append('</div>')
    return '\n'.join(html_parts)

# ==================== 归档页更新 ====================
def update_archive_index():
    """扫描 POSTS_DIR 下所有 football-*.md, 重新生成 /football/ 归档页。
    移植自 scripts/football-daily.js 的 updateArchiveIndex(), 模板保持一致
    (含 dcd057f1 修复引入的 standalone-theme.js 引用)。"""
    import re
    archive_path = POSTS_DIR.parent / 'football' / 'index.html'
    archive_path.parent.mkdir(parents=True, exist_ok=True)

    pattern = re.compile(r'^football-(morning|evening)-(\d{4})-(\d{2})-(\d{2})\.md$')
    weekday_cn = ['一', '二', '三', '四', '五', '六', '日']
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

    posts.sort(key=lambda p: 0 if p['type'] == 'evening' else 1)
    posts.sort(key=lambda p: p['date'], reverse=True)

    cards = []
    if not posts:
        cards.append('<div class="archive-empty"><div class="archive-empty-icon">📭</div><p>暂无日报,敬请期待</p></div>')
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
                desc = '足坛新闻 + 赛程速览' if p['type'] == 'morning' else '今日战报 + 新闻聚合'
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

    # 关注球队 chips — 与日报一致, 点击进球队详情页 (客户端实时拉取 ESPN 数据)
    chips = []
    for tid, info in FOLLOWED_TEAMS.items():
        chips.append(
            f'      <a class="follow-chip" href="/football/teams/{info["slug"]}.html" '
            f'style="background:linear-gradient(135deg,{info["color"]},{info["color2"]});color:#fff;">'
            f'<img class="chip-logo" src="{ESPN_TEAM_LOGO}/{tid}.png" alt="{esc(info["name"])}" '
            f'loading="lazy" onerror="this.remove()">{esc(info["name"])}</a>')
    follow_chips = '\n'.join(chips)

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
    <p class="archive-sub">每日早报 · 足坛新闻与赛程速览 &nbsp;|&nbsp; 每日晚报 · 今日战报与新闻聚合</p>
  </div>

  <!-- 我的关注 -->
  <div class="card" style="margin-top: 4px;">
    <div class="card-title">我的关注</div>
    <div class="follow-bar">
{follow_chips}
    </div>
  </div>

  <!-- 归档列表 -->
  <div class="archive-section">
{archive_cards}
  </div>

  <div class="footer">
    数据来源：ESPN · Sky Sports · BBC Sport · Google News · 自动更新
  </div>

</body>
</html>
'''

    archive_path.write_text(html, encoding='utf-8')
    print(f'✅ 归档页已更新({len(posts)} 篇日报): {archive_path}')

# ==================== Main ====================
def main():
    # Windows 本地 GBK 控制台无法输出 emoji/中文, 强制 UTF-8
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    parser = argparse.ArgumentParser(description='足球日报 v6 · FotMob 版')
    parser.add_argument('edition', nargs='?', choices=['morning', 'evening'], help='早报或晚报')
    parser.add_argument('--preview', action='store_true', help='只写到 D:/WorkBuddy-Outputs 备份')
    parser.add_argument('--archive-only', action='store_true', help='只重新生成 /football/ 归档页, 不拉取数据')
    args = parser.parse_args()

    if args.archive_only:
        update_archive_index()
        return

    if not args.edition:
        parser.error('需要指定 edition (morning/evening), 或使用 --archive-only')

    edition = args.edition
    today_str = bj_date_str()

    print(f'=== ⚽ 足球日报 v6 · FotMob 版 · {edition} ===')
    print(f'北京时间: {bj_date_cn()}')
    print(f'输出目录: {POSTS_DIR}')
    print()

    md = generate_report(edition)

    if args.preview:
        filename = f'football-{edition}-preview-{today_str}.md'
        out = D / filename
        out.write_text(md, encoding='utf-8')
        print(f'\n✅ Preview 写到: {out}')
    else:
        POSTS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f'football-{edition}-{today_str}.md'
        filepath = POSTS_DIR / filename
        filepath.write_text(md, encoding='utf-8')
        print(f'\n✅ {filename} 生成完成')

        backup = D / filename
        backup.write_text(md, encoding='utf-8')
        print(f'✅ 备份: {backup}')

        update_archive_index()

    print(f'\n🎉 完成。')

if __name__ == '__main__':
    main()
