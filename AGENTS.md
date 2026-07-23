# Axtrivc's Blog — Hexo 项目说明

Hexo 7 + Butterfly 主题的个人博客,部署到 GitHub Pages(Axtrivc.github.io)。

## 用户偏好(持久指令)

- **改完代码后自动 commit 并 push,无需逐次确认。**(用户 2026-07-22 明确授权)
  - commit message 用中文、遵循仓库现有 conventional commits 风格(如 `fix(football): ...` / `chore: ...`)
  - 仅限常规 commit/push;force-push、rebase、删分支等破坏性操作仍需先问

## 构建与部署

- `npx hexo generate` 构建到 `public/`;`npx hexo server` 本地预览
- push 到 `master` 触发 GitHub Actions(`.github/workflows/deploy.yml`)构建并部署到 `main` 分支
- `public/`、`db.json`、`node_modules/` 不进仓库(编译产物,CI 重建)

## 自定义结构

- `scripts/`:Hexo 7 手动注册的注入脚本(`_config.yml` 的 `scripts:` 列表)
  - `hero-inject.js`:首页 hero(ASCII 河流 shader + 左下角 typed 副标题 + hero 下方 `.hero-fade` 渐变带 v6)——渐变带 = 动画自身的延伸,不是手调色带:river-hero.js 在主循环 `gpuTimedDraw()` 后与 `freezeStaticHero()` 快照后各回调一次 `window.__heroFrameHook(canvas)`(同一同步任务,WebGL 缓冲未被合成清除,外部 rAF/定时器取样会得到纯黑帧,勿绕行);heroJs 以 15fps 取 canvas 底边 mh 行(按显示比例换算 ≈ 底边以上 27% 场景)**垂直翻转**铺满渐变带(带顶 = 动画底边那一行,星野/山体纹理无缝续入——薄条拉伸会产生"点变线"分界,必须用整块镜像),再由「渐晕 + 粗颗粒径向团块 + 细噪声」destination-out 遮罩溶解成碎尾(遮罩仅 resize 时重建);色彩衬底 = 底边**暗部 45 分位**采样色(勿用均值——均值偏亮,半擦除区会透出"贴膜"雾感)→ 平坦 22% → 动画夜色系(#101E38/#1B3566/#46608E/#8BA7C6)→ `--page-bg`(监听 window 的 `themechange`);镜像以 0.95 不透明度合成到 placeholder 底色 #15397A 上(hero canvas 本身只有 0.95 不透明,底下垫 placeholder,不补偿会在交界处露色阶),挂钩沉默 >800ms 且静态兜底图在播时改从 `#heroStill` img 取样;另叠加稀疏同款 RAMP_ASCII 字符 12fps 闪烁(密度限于顶部 55%,颜色取底边亮粒子);IntersectionObserver 不可见即停。**羽化兜底**:hero canvas/still/placeholder 底部 22% 带 `mask-image` 渐隐,露出 `section.hero` 底色 #0B1220(= 渐变带顶部兜底色);首次取样成功才给 body 加 `hero-fade-live` 摘除遮罩——取样链在用户会话里断掉时(扩展注入/驱动丢缓冲/死缓存)带顶退回默认深色,亮场景底边会顶出直线分界,羽化保证任何失败路径只剩软过渡(2026-07-23 用户现场出现但脚本复现不了的硬边,据此加固);**section.hero 底色必须从 #0E2F7E 保持为 #0B1220**,否则羽化终点与带顶不同色会重新露出阶跃
  - `footer-river-inject.js`:footer 水流动画注入(canvas 在 `source/js/axtrivc-river.js`)
  - `cache-bust.js` / `inject-site-config.js`:资源版本号 / 站点配置注入
  - `post-desc-fix.js`:首页摘要修复(剔除正文内联 `<style>/<script>` 块,防止足球日报卡片预览漏 CSS)
- `scripts-py/football_daily_v2.py`:足球日报生成器 v6(GitHub Actions `football-daily.yml` 每天早/晚各跑一次,**FotMob 浅色卡片风休赛期模式**,世界杯模式已随赛事结束移除),写 `source/_posts/football-{morning|evening}-YYYY-MM-DD.md` 并**重建 `source/football/index.html` 归档页**(`update_archive_index()`,v1→v2 迁移时曾漏移植导致归档停更);`--archive-only` 只重建归档不拉数据,`--preview` 只写本地备份
  - **联赛白名单(v6)**: 只展示 `MAIN_COMPS` 内的赛事——英超/西甲/意甲/德甲/法甲/沙特联/中超/美职联 + 欧冠/欧联 + 世界杯/欧洲杯/欧国联/国际友谊赛;巴甲/阿甲/英冠等小众联赛一律剔除,**但关注球队参加的任何赛事(如国王杯)始终保留**(`is_main_match()`);`COMP_MAP` 兼有"仅显示名"条目(国王杯/足总杯等,不在白名单);分组按中文名合并别名(uefa.champions ≡ champions-league),组序按 `COMP_ORDER`
  - 数据源: sports_skills CLI(daily 赛程) + **ESPN site API 直采**(球队赛程 `site.api.espn.com/.../soccer/{league}/teams/{tid}/schedule?season=`,按 FOLLOWED_TEAMS 的 espn 组合合并——sports_skills 的 get_team_schedule 数据陈旧已弃用,巴萨返回 0 场/西班牙只有 2024 欧洲杯;沙特联/中超不在 daily 覆盖,直采 `{ksa.1,chn.1}/scoreboard?dates=` 补齐) + Sky Sports 足球 RSS(`skysports.com/rss/11095`,feedparser 直解析拿 enclosure 配图,注意 12040 是综合体育频道别用错) + BBC/ESPN RSS(文字) + Google News(转会/球队动态);ESPN 事件两种结构(scoreboard 顶层 status / schedule 在 competitions[0].status,score 可能是 {$ref,value} 对象)由 `normalize_espn_event()` 统一
  - 图片: 队徽 `a.espncdn.com/i/teamlogos/soccer/500/{teamId}.png`(浏览器 UA 可直链,curl 不带 UA 会 404),联赛徽 `leaguelogos/soccer/500/{lid}.png`(英超 23/西甲 15/意甲 12/德甲 10/法甲 9/美职联 19/欧冠 2/欧联 2310/世界杯 4/欧洲杯 74/欧国联 2395/沙特联 2488/中超 2350),新闻图走 Sky 的 365dm CDN
  - 关键防线: **未赛 = 状态非 closed 且开球时间 > 当前时间**——数据源会把已踢完的比赛(如世界杯决赛)永久遗留为 not_started,只按状态过滤会把旧比赛当"下一场"展示;赛程按北京时间重新分桶(daily 接口按自身时区给日期会串天,沙特联常见 UTC 18:00 = 北京次日 02:00,extra 抓取要前后各多拉一天);daily 接口缺 MLS 等赛事,要用关注球队赛程合并补齐
  - 主题共存防线: Butterfly 的 `.container img` 会给文章内所有 img 注入 `display:block;margin:0 auto 20px`(特异性与 `.fm-*` 打平,靠文档顺序压制),**`.fm-container img{margin:0}` 不可删**,否则联赛徽标居中/关注卡队徽错位/缩略图偏上;fm 图片必须 `loading="eager"`——主题 post_lazyload 会把 src 改写成 1x1 占位 + `data-lazy-src` 由 vanilla-lazyload 滚动回载,原生 lazy 会让浏览器延迟发请求,快滚时被其 `cancel_on_exit` 取消导致大图永久空白;联赛 id 以数据源实际为准(阿甲 = `liga-argentina`,写错 id 会让联赛名显示英文原文)
  - 关注球队 9 支(v6,卡片可点击跳详情页): 巴萨 83 / 西班牙 164 / 曼城 382 / 曼联 360 / 阿森纳 359 / 拜仁 132 / 巴黎 160 / 科莫 2572 / 迈阿密国际 20232(旧档里的 81/78/1593/788 全部失效,勿复用;皇马 86/马竞 1068 已于 v6 移出关注)
  - 球队详情页: `source/football/teams/{barcelona,spain,mancity,manutd,arsenal,bayern,psg,como,miami}.html`——薄壳 + `window.TeamPage.init()` 配置,渲染全交给 `source/js/team-page.js`(下一场/最近5场/积分榜/数据总览,走 `site.api.espn.com` schedule + `site.web.api.espn.com` standings,客户端实时拉取)与 `team-dynamic.js`(新闻/阵容);**页面内不写死任何比分/排名**(v6 前的巴萨页硬编码欧冠晋级表已清除);国家队(西班牙)无积分榜,荣誉殿堂只放历史事实;日报关注卡、归档页 chips 均链接到这些页
  - 截图目检: `scripts-py/_shot_preview.py`(隔离预览);`scripts-py/_shot_public.py`(带主题真机渲染,需先 `node serve.js` 起 4000 端口,滚动需≥1s/屏模拟真人节奏,否则 lazyload 的 cancel_on_exit 会让 365dm 大图保持空白——截图假影非 bug)
- `source/js/theme-system.js`:5 主题切换系统,`themechange` 事件 + `--footer-*` / `--theme-*-current` CSS 变量
- footer 配色衔接规则: body 背景 = `--page-bg`(页面色,内容列与两侧边距同色), html 背景 = `--footer-river-bottom`(overscroll 兜底,与水色最深处同色), **#footer 整体是一块连续渐变** `--page-bg 0% → --footer-river-top 55% → --footer-river-mid 82% → --footer-river-bottom 100%`(仿 river.ai 一体色块), river-stage 背景透明融在其中, canvas 顶部 38% 渐隐让波纹浮现 — 不要给 river-stage 单独设背景,否则会出现分界线
- 首页文章列表: `_config.butterfly.yml` 的 `index_layout: 6`(masonry) 会被 `theme-system.css` 末尾的 grid 规则覆盖为对齐双列(压掉 MasonryInfiniteGrid 的内联定位), 改布局时两边都要看
- 改 footer 配色后可用 `public/river-test.html?theme=<id>` 本地截图预览(源文件在 `source/river-test.html`,已加入 `skip_render`)
