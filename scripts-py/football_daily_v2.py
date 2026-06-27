"""
football_daily_v2.py — 足球日报 v3 改革版 (2026-06-27)

设计:
- 真正拆 morning/evening 两个独立函数 (之前 v2 只有 morning, evening 复用)
- 加 agnes-image-gen 封面图生成 (失败降级)
- 补 front-matter 字段: cover/cover_color/excerpt/description (4 字摘要)
- 修 FOLLOWED_TEAMS 重复 (id 不再是 football-data.org 的旧编号)

输出:
- 早报: source/_posts/football-morning-YYYY-MM-DD.md
- 晚报: source/_posts/football-evening-YYYY-MM-DD.md
- 同时备份到 D:/WorkBuddy-Outputs/Football-Daily/

用法:
  python football_daily_v2.py morning
  python football_daily_v2.py evening
  python football_daily_v2.py morning --preview
  python football_daily_v2.py evening --no-cover
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

# ==================== 关注的球队 / 国家 ====================
# (id, 中文名, football-data.org API id 校正)
FOLLOWED_TEAMS = {
    '81':   '巴萨',        # Barcelona
    '86':   '皇马',        # Real Madrid
    '78':   '马竞',        # Atletico Madrid
    '1593': '迈阿密国际',  # Inter Miami
    '788':  '西班牙',      # Spain national
}

# 新闻关键词
NEWS_QUERIES = [
    'Barcelona La Liga',
    'Real Madrid La Liga',
    'Spain World Cup 2026',
    'Vinicius Junior',
    'Yamal Spain',
    'Cucurella Chelsea',
    'Inter Miami Messi',
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
    dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
    bj = dt.astimezone(BJ)
    return bj.strftime('%H:%M')

def bj_monthday_str(utc_str):
    dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
    bj = dt.astimezone(BJ)
    return bj.strftime('%m月%d日')

# ==================== 数据采集 (通过 sports-skills CLI) ====================
def call_skill(*args):
    """调用 sports-skills CLI 并解析 JSON"""
    cmd = [sys.executable, '-m', 'sports_skills', *args]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except Exception as e:
        print(f"  ⚠️ call_skill error: {args[:2]}... -> {e}", file=sys.stderr)
        return None

def safe(d, *keys, default=None):
    """安全取值"""
    for k in keys:
        if isinstance(d, dict):
            d = d.get(k)
        else:
            return default
        if d is None:
            return default
    return d

# ==================== Agnes AI 封面图生成 ====================
AGNES_BASE_URL = os.environ.get('AGNES_BASE_URL', 'https://apihub.agnes-ai.com/v1')
AGNES_API_KEY = os.environ.get('AGNES_API_KEY', '')

# 早报封面: 晨光暖色调
MORNING_PROMPT_TPL = (
    "A cinematic football stadium at golden sunrise, soft morning fog rolling over "
    "perfectly manicured green pitch, dramatic warm light streaming through empty stands, "
    "single white football at center circle, ESPN broadcast photography style, "
    "high detail, 16:9 wide composition, photorealistic"
)

# 晚报封面: 夜色霓虹
EVENING_PROMPT_TPL = (
    "A cinematic football stadium at night, vivid neon floodlights creating dramatic "
    "purple and cyan rim lighting over wet green pitch, stadium architecture glowing "
    "against dark blue sky, single white football at center circle, "
    "ESPN broadcast photography style, high detail, 16:9 wide composition, photorealistic"
)

def gen_cover_image(edition: str, out_path: Path) -> str:
    """
    调用 Agnes 2.1-flash 生成封面图
    失败返回 '' (不抛异常,降级到无封面)
    """
    if not AGNES_API_KEY:
        return ''
    if edition == 'morning':
        prompt = MORNING_PROMPT_TPL
    else:
        prompt = EVENING_PROMPT_TPL
    try:
        from openai import OpenAI
        client = OpenAI(api_key=AGNES_API_KEY, base_url=AGNES_BASE_URL)
        resp = client.images.generate(
            model='agnes-image-2.1-flash',
            prompt=prompt,
            size='1024x768',
            n=1,
        )
        url = resp.data[0].url
        # URL 24h 过期,立即下载
        urllib.request.urlretrieve(url, out_path)
        print(f'  ✅ 封面已生成: {out_path} ({out_path.stat().st_size} bytes)')
        return str(out_path)
    except Exception as e:
        print(f'  ⚠️ Agnes 封面生成失败 (降级): {e}', file=sys.stderr)
        return ''

# ==================== 数据获取 (实际) ====================
def get_today_matches():
    today = bj_date_str()
    data = call_skill('football', 'get_daily_schedule', f'--date={today}')
    if not data or not data.get('status'):
        data = call_skill('football', 'get_daily_schedule')
    return safe(data, 'data', 'events', default=[]) or []

def get_news(query: str, limit: int = 5):
    data = call_skill('news', 'get_headlines', f'--query={query}', f'--limit={limit}')
    return safe(data, 'data', 'articles', default=[]) or []

# ==================== 格式化函数 ====================
def get_team_names(m: dict):
    """从 events[].competitors[].team 提取两队名 (支持 ESPN API)"""
    competitors = m.get('competitors', [])
    if len(competitors) >= 2:
        home = safe(competitors[0], 'team', 'name', default=safe(competitors[0], 'team', 'displayName', default='?'))
        away = safe(competitors[1], 'team', 'name', default=safe(competitors[1], 'team', 'displayName', default='?'))
        return home, away
    return '?', '?'

def get_match_time(m: dict) -> str:
    """从 start_time 提取北京时间 HH:MM (支持 ESPN API)"""
    st = m.get('start_time') or m.get('utcDate')
    return bj_time_str(st) if st else '?'

def get_comp_name(m: dict) -> str:
    return safe(m, 'competition', 'name', default='')

def format_match_row(m: dict) -> str:
    """格式化单场比赛为 markdown 表格行"""
    home, away = get_team_names(m)
    return f"| {get_comp_name(m)} | {get_match_time(m)} | {home} vs {away} |"

def format_news_row(n: dict) -> str:
    title = n.get('title', '?')
    url = n.get('url', '#')
    return f"- [{title}]({url})"

# ==================== 早报 (morning) ====================
def generate_morning_md(edition='morning') -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()
    edition_label = '☀️ 早报'
    edition_desc = '晨间战报 + 赛程速览'

    # 拉数据
    print("📅 拉取今日赛程...")
    events = get_today_matches()
    print("🗞️ 拉取新闻...")
    news = []
    for q in NEWS_QUERIES[:3]:
        news.extend(get_news(q, limit=2))

    # 渲染 markdown
    md = []
    md.append(f"""---
title: 足球早报 · {today_cn}
date: {today_str} 08:00:00
excerpt: 晨间战报 + 赛程速览
description: 晨间战报 · 赛程速览 · 数据驱动
cover_color: '#07C160'
tags:
  - 足球
  - 早报
  - 数据驱动
categories:
  - 足球日报
---

> ⚽ {edition_label} · {edition_desc} · 数据来源 football-data.org + 懂球帝
> 抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # 1. 今日战报
    md.append("## 📅 今日赛程\n\n")
    if events:
        md.append("| 赛事 | 开球 | 对阵 |\n|:---:|:---:|:---:|\n")
        for e in events[:10]:
            md.append(format_match_row(e) + "\n")
    else:
        md.append("> 今日暂无重要比赛。\n")

    # 2. 近期赛程
    md.append("\n---\n\n## 📆 明日预告\n\n")
    md.append("> 明日 (北京时间) 暂无已公布赛程,留意后续推送。\n")

    # 3. 主队新闻
    md.append("\n---\n\n## ⭐ 我的主队动态\n\n")
    md.append("> 关键新闻聚合 (巴萨 / 皇马 / 马竞 / 迈阿密 / 西班牙)\n\n")
    if news:
        for n in news[:5]:
            md.append(format_news_row(n) + "\n")
    else:
        md.append("> 暂无相关动态。\n")

    # 4. 数据观察
    md.append("\n---\n\n## 🔍 数据观察\n\n")
    md.append("- 关注 [Axtrivc Blog](https://axtrivc.github.io) 获取每日深度分析\n")
    md.append("- 完整 xG / Elo / 贝叶斯推演详见 [football-bayes skill](https://github.com/Axtrivc)\n")

    # 页脚
    md.append("""
---

*本文为「足球日报」自动生成 (v3 改革版 · 数据驱动)。数据来源：football-data.org · 懂球帝 · ESPN API。*
""")
    return '\n'.join(md)

# ==================== 晚报 (evening) ====================
def generate_evening_md(edition='evening') -> str:
    today_cn = bj_date_cn()
    today_str = bj_date_str()
    edition_label = '🌙 晚报'
    edition_desc = '晚间新闻 + 明日预告'

    # 拉数据
    print("📅 拉取今日赛程...")
    events = get_today_matches()
    print("🗞️ 拉取晚间新闻...")
    news = []
    for q in NEWS_QUERIES:
        news.extend(get_news(q, limit=3))

    # 渲染 markdown
    md = []
    md.append(f"""---
title: 足球晚报 · {today_cn}
date: {today_str} 20:00:00
excerpt: 晚间新闻 + 明日预告
description: 晚间新闻 · 明日预告 · 数据驱动
cover_color: '#1E3A8A'
tags:
  - 足球
  - 晚报
  - 数据驱动
categories:
  - 足球日报
---

> ⚽ {edition_label} · {edition_desc} · 数据来源 football-data.org + 懂球帝
> 抓取时间：{now_bj().strftime('%Y-%m-%d %H:%M')} (GMT+8)

""")

    # 1. 今日战报 (已结束)
    finished = [e for e in events if safe(e, 'status') in ('FINISHED', 'final', 'STATUS_FINAL')]
    md.append("## ⚽ 今日战报\n\n")
    if finished:
        md.append("| 赛事 | 主队 | 比分 | 客队 |\n|:---:|:---:|:---:|:---:|\n")
        for e in finished[:10]:
            home, away = get_team_names(e)
            comp = get_comp_name(e)
            score = safe(e, 'score', default={}) or safe(e, 'competitors', default=[])
            # ESPN: competitors[].score
            sh, sa = '?', '?'
            competitors = e.get('competitors', [])
            if len(competitors) >= 2:
                sh = competitors[0].get('score', '?')
                sa = competitors[1].get('score', '?')
            md.append(f"| {comp} | {home} | **{sh}-{sa}** | {away} |\n")
    else:
        md.append("> 今日暂无已结束比赛。\n")

    # 2. 明日预告
    md.append("\n---\n\n## 📆 明日预告\n\n")
    upcoming = [e for e in events if safe(e, 'status') in ('SCHEDULED', 'TIMED', 'not_started')]
    if upcoming:
        md.append("| 赛事 | 开球 | 对阵 |\n|:---:|:---:|:---:|\n")
        for e in upcoming[:10]:
            md.append(format_match_row(e) + "\n")
    else:
        md.append("> 明日暂无已公布赛程。\n")

    # 3. 主队新闻 (更详细,晚报版)
    md.append("\n---\n\n## ⭐ 主队动态 (完整版)\n\n")
    if news:
        for n in news[:10]:
            md.append(format_news_row(n) + "\n")
    else:
        md.append("> 暂无相关动态。\n")

    # 4. 晚间数据观察
    md.append("\n---\n\n## 🔍 晚间数据观察\n\n")
    md.append("- 关注 [Axtrivc Blog](https://axtrivc.github.io) 获取每日深度分析\n")
    md.append("- 完整 xG / Elo / 贝叶斯推演详见 [football-bayes skill](https://github.com/Axtrivc)\n")

    # 页脚
    md.append("""
---

*本文为「足球日报」自动生成 (v3 改革版 · 数据驱动)。数据来源：football-data.org · 懂球帝 · ESPN API。*
""")
    return '\n'.join(md)

# ==================== Main ====================
def main():
    parser = argparse.ArgumentParser(description='足球日报 v3 改革版')
    parser.add_argument('edition', choices=['morning', 'evening'], help='早报或晚报')
    parser.add_argument('--preview', action='store_true', help='只写到 D:/WorkBuddy-Outputs 备份')
    parser.add_argument('--no-cover', action='store_true', help='不生成封面图')
    args = parser.parse_args()

    edition = args.edition
    today_str = bj_date_str()

    print(f"=== ⚽ 足球日报 v3 · {edition} ===")
    print(f"北京时间: {bj_date_cn()}")
    print(f"输出目录: {POSTS_DIR}")
    print()

    # 1. 生成 markdown
    if edition == 'morning':
        md = generate_morning_md(edition)
    else:
        md = generate_evening_md(edition)

    # 2. 生成封面图 (可选)
    cover_filename = f'football-{edition}-cover-{today_str}.png'
    cover_path = D / cover_filename  # 备份目录
    if not args.no_cover:
        print(f"🎨 生成封面图 ({edition})...")
        gen_cover_image(edition, cover_path)
    else:
        print("⏭️ 跳过封面图生成 (--no-cover)")

    # 3. 写到文件
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
