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
    data = call_skill('news', 'fetch_items', '--google_news=True', f'--query={query}', f'--limit={limit}', '--sort_by_date=True')
    return safe(data, 'data', 'items', default=[]) or safe(data, 'items', default=[]) or []

def get_news_rss(feed_url, limit=5):
    """RSS feed"""
    data = call_skill('news', 'fetch_feed', f'--url={feed_url}')
    entries = safe(data, 'data', 'entries', default=[]) or safe(data, 'entries', default=[]) or []
    return entries[:limit]

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
