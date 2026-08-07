#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub 日报生成器
=================
把指定日期(北京时间)自己在 GitHub 上所有仓库的提交,汇总成一篇中文日报文章,
写入 source/_posts/github-daily-YYYY-MM-DD.md。

用法:
    python scripts-py/github_daily.py [YYYY-MM-DD]
    不传日期时默认"昨天"(北京时间)——工作流在北京 0 点跑,正好总结刚过去的一天。

数据源: GitHub Search Commits API(author:{user} + committer-date 区间,代码内再按
北京日期精确过滤)。环境变量 GH_TOKEN 可选——带 token 时搜索能覆盖私有仓库
(CI 里默认 GITHUB_TOKEN 只覆盖公开仓库,私有仓库需配 GH_ACTIVITY_TOKEN secret)。
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone, date

POSTS_DIR = os.environ.get("POSTS_DIR", os.path.join(os.path.dirname(__file__), "..", "source", "_posts"))
GITHUB_USER = os.environ.get("GITHUB_USER", "Axtrivc")
BEIJING = timezone(timedelta(hours=8))

TYPE_LABELS = {
    "feat": "✨ 新功能",
    "fix": "🐛 修复",
    "docs": "📝 文档",
    "style": "🎨 样式",
    "refactor": "♻️ 重构",
    "perf": "⚡ 性能",
    "test": "✅ 测试",
    "build": "📦 构建",
    "ci": "👷 CI",
    "chore": "🔧 杂项",
    "other": "📌 其他",
}
TYPE_ORDER = ["feat", "fix", "perf", "refactor", "style", "docs", "test", "build", "ci", "chore", "other"]

WEEKDAYS = "一二三四五六日"


def search_commits(user: str, target: date) -> list:
    """搜索 target 北京日期的提交。北京一天 = UTC 前一天 16:00 ~ 当天 16:00,
    所以搜索区间放宽到 target-1 ~ target,再按北京日期精确过滤。"""
    d1 = (target - timedelta(days=1)).isoformat()
    d2 = target.isoformat()
    q = f"author:{user}+committer-date:{d1}..{d2}"
    url = f"https://api.github.com/search/commits?q={q}&sort=committer-date&order=asc&per_page=100"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "github-daily-bot",
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        print(f"GitHub API 请求失败: HTTP {e.code} {body}", file=sys.stderr)
        sys.exit(1)

    commits = []
    seen = set()
    for it in data.get("items", []):
        c = it["commit"]
        # 解析带时区的 ISO 时间,转北京时间
        dt = datetime.fromisoformat(c["committer"]["date"].replace("Z", "+00:00")).astimezone(BEIJING)
        if dt.date() != target:
            continue
        key = (it["repository"]["full_name"], it["sha"])
        if key in seen:
            continue
        seen.add(key)
        msg = c["message"].splitlines()[0].strip()
        commits.append({
            "repo": it["repository"]["full_name"],
            "repo_short": it["repository"]["name"],
            "repo_url": it["repository"]["html_url"],
            "sha": it["sha"][:7],
            "url": it["html_url"],
            "time": dt,
            "message": msg,
            "type": parse_type(msg),
        })
    commits.sort(key=lambda x: x["time"])
    return commits


def parse_type(msg: str) -> str:
    m = re.match(r"^(\w+)(\(.+?\))?!?:", msg)
    if m and m.group(1).lower() in TYPE_LABELS:
        return m.group(1).lower()
    return "other"


def type_summary(commits: list) -> str:
    """一个仓库的提交类型概览,如 '3 修复、2 新功能'"""
    counts = {}
    for c in commits:
        counts[c["type"]] = counts.get(c["type"], 0) + 1
    parts = []
    for t in TYPE_ORDER:
        if t in counts:
            label = TYPE_LABELS[t].split(" ", 1)[1]  # 去掉 emoji
            parts.append(f"{counts[t]} {label}")
    return "、".join(parts)


def render(target: date, commits: list) -> str:
    weekday = WEEKDAYS[target.weekday()]
    date_cn = f"{target.year}年{target.month}月{target.day}日"
    title = f"GitHub 日报 · {date_cn} 星期{weekday}"

    # 按仓库分组,提交数降序
    repos = {}
    for c in commits:
        repos.setdefault(c["repo"], []).append(c)
    ordered = sorted(repos.values(), key=lambda lst: (-len(lst), lst[0]["repo"]))

    total = len(commits)
    n_repos = len(ordered)
    repo_names = "、".join(lst[0]["repo_short"] for lst in ordered)
    excerpt = f"{date_cn} 共 {total} 次提交,涉及 {n_repos} 个仓库:{repo_names}(自动汇总)"

    lines = []
    lines.append("---")
    lines.append(f"title: {title}")
    lines.append(f"date: {target.isoformat()} 23:59:00")
    lines.append(f"excerpt: {excerpt}")
    lines.append(f"description: {excerpt}")
    lines.append("cover_color: '#0D1117'")
    lines.append("tags:")
    lines.append("  - GitHub")
    lines.append("  - 开发日志")
    lines.append("  - 自动化")
    lines.append("categories:")
    lines.append("  - GitHub 日报")
    lines.append("---")
    lines.append("")

    # 概览
    lines.append("## 📊 今日概览")
    lines.append("")
    lines.append(f"**{date_cn}**(北京时间),全天共向 **{n_repos} 个仓库**推送了 **{total} 次提交**。")
    lines.append("")
    lines.append("| 仓库 | 提交数 | 主要内容 |")
    lines.append("| --- | --- | --- |")
    for lst in ordered:
        c0 = lst[0]
        lines.append(f"| [{c0['repo']}]({c0['repo_url']}) | {len(lst)} | {type_summary(lst)} |")
    lines.append("")

    # 每个仓库一节
    for lst in ordered:
        c0 = lst[0]
        lines.append(f"## 🗂️ {c0['repo']}")
        lines.append("")
        by_type = {}
        for c in lst:
            by_type.setdefault(c["type"], []).append(c)
        for t in TYPE_ORDER:
            if t not in by_type:
                continue
            lines.append(f"### {TYPE_LABELS[t]}")
            lines.append("")
            for c in by_type[t]:
                lines.append(f"- `{c['time'].strftime('%H:%M')}` [{c['message']}]({c['url']}) `{c['sha']}`")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("> 本文由 GitHub Actions 于每日 0 点(北京时间)自动汇总生成,数据来自 GitHub Search API。")
    lines.append("")
    return "\n".join(lines)


def main():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        target = date.fromisoformat(sys.argv[1].strip())
    else:
        target = (datetime.now(BEIJING) - timedelta(days=1)).date()

    print(f"汇总 {GITHUB_USER} 在 {target}(北京时间)的提交…")
    commits = search_commits(GITHUB_USER, target)
    print(f"命中 {len(commits)} 条提交")

    if not commits:
        print("当天没有提交,跳过生成。")
        return

    md = render(target, commits)
    out = os.path.join(POSTS_DIR, f"github-daily-{target.isoformat()}.md")
    os.makedirs(POSTS_DIR, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"已写入 {out}")


if __name__ == "__main__":
    main()
