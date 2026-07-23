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
  - `hero-inject.js`:首页 hero(ASCII 河流 shader + 左下角 typed 副标题 + hero 下方 `.hero-fade` 渐变带 v6)——渐变带 = 动画自身的延伸,不是手调色带:river-hero.js 在主循环 `gpuTimedDraw()` 后与 `freezeStaticHero()` 快照后各回调一次 `window.__heroFrameHook(canvas)`(同一同步任务,WebGL 缓冲未被合成清除,外部 rAF/定时器取样会得到纯黑帧,勿绕行);heroJs 以 15fps 取 canvas 底边 mh 行(按显示比例换算 ≈ 底边以上 27% 场景)**垂直翻转**铺满渐变带(带顶 = 动画底边那一行,星野/山体纹理无缝续入——薄条拉伸会产生"点变线"分界,必须用整块镜像),再由「渐晕 + 粗颗粒径向团块 + 细噪声」destination-out 遮罩溶解成碎尾(遮罩仅 resize 时重建);色彩衬底 = 底边采样均色 → 动画夜色系(#101E38/#1B3566/#46608E/#8BA7C6)→ `--page-bg`(监听 window 的 `themechange`),挂钩沉默 >800ms 且静态兜底图在播时改从 `#heroStill` img 取样;另叠加稀疏同款 RAMP_ASCII 字符 12fps 闪烁(密度限于顶部 55%,颜色取底边亮粒子);IntersectionObserver 不可见即停
  - `footer-river-inject.js`:footer 水流动画注入(canvas 在 `source/js/axtrivc-river.js`)
  - `cache-bust.js` / `inject-site-config.js`:资源版本号 / 站点配置注入
  - `post-desc-fix.js`:首页摘要修复(剔除正文内联 `<style>/<script>` 块,防止足球日报卡片预览漏 CSS)
- `scripts-py/football_daily_v2.py`:足球日报生成器(GitHub Actions `football-daily.yml` 每天早/晚各跑一次,当前为 **FotMob 浅色卡片风休赛期模式**,世界杯模式已随赛事结束移除),写 `source/_posts/football-{morning|evening}-YYYY-MM-DD.md` 并**重建 `source/football/index.html` 归档页**(`update_archive_index()`,v1→v2 迁移时曾漏移植导致归档停更);`--archive-only` 只重建归档不拉数据,`--preview` 只写本地备份
  - 数据源: sports_skills CLI(ESPN 赛程) + Sky Sports 足球 RSS(`skysports.com/rss/11095`,feedparser 直解析拿 enclosure 配图,注意 12040 是综合体育频道别用错) + BBC/ESPN RSS(文字) + Google News(转会/球队动态)
  - 图片: 队徽 `a.espncdn.com/i/teamlogos/soccer/500/{teamId}.png`(浏览器 UA 可直链,curl 不带 UA 会 404),联赛徽 `leaguelogos/soccer/500/{lid}.png`,新闻图走 Sky 的 365dm CDN
  - 关键防线: **未赛 = 状态非 closed 且开球时间 > 当前时间**——数据源会把已踢完的比赛(如世界杯决赛)永久遗留为 not_started,只按状态过滤会把旧比赛当"下一场"展示;赛程按北京时间重新分桶(daily 接口按自身时区给日期会串天);daily 接口缺 MLS 等赛事,要用关注球队赛程合并补齐
  - 主题共存防线: Butterfly 的 `.container img` 会给文章内所有 img 注入 `display:block;margin:0 auto 20px`(特异性与 `.fm-*` 打平,靠文档顺序压制),**`.fm-container img{margin:0}` 不可删**,否则联赛徽标居中/关注卡队徽错位/缩略图偏上;fm 图片必须 `loading="eager"`——主题 post_lazyload 会把 src 改写成 1x1 占位 + `data-lazy-src` 由 vanilla-lazyload 滚动回载,原生 lazy 会让浏览器延迟发请求,快滚时被其 `cancel_on_exit` 取消导致大图永久空白;联赛 id 以数据源实际为准(阿甲 = `liga-argentina`,写错 id 会让联赛名显示英文原文)
  - 关注球队 ESPN ID: 巴萨 83 / 皇马 86 / 马竞 1068 / 迈阿密国际 20232 / 西班牙 164(旧档里的 81/78/1593/788 全部失效,勿复用)
  - 截图目检: `scripts-py/_shot_preview.py`(隔离预览);`scripts-py/_shot_public.py`(带主题真机渲染,需先 `node serve.js` 起 4000 端口,滚动需≥1s/屏模拟真人节奏,否则 lazyload 的 cancel_on_exit 会让 365dm 大图保持空白——截图假影非 bug)
- `source/js/theme-system.js`:5 主题切换系统,`themechange` 事件 + `--footer-*` / `--theme-*-current` CSS 变量
- footer 配色衔接规则: body 背景 = `--page-bg`(页面色,内容列与两侧边距同色), html 背景 = `--footer-river-bottom`(overscroll 兜底,与水色最深处同色), **#footer 整体是一块连续渐变** `--page-bg 0% → --footer-river-top 55% → --footer-river-mid 82% → --footer-river-bottom 100%`(仿 river.ai 一体色块), river-stage 背景透明融在其中, canvas 顶部 38% 渐隐让波纹浮现 — 不要给 river-stage 单独设背景,否则会出现分界线
- 首页文章列表: `_config.butterfly.yml` 的 `index_layout: 6`(masonry) 会被 `theme-system.css` 末尾的 grid 规则覆盖为对齐双列(压掉 MasonryInfiniteGrid 的内联定位), 改布局时两边都要看
- 改 footer 配色后可用 `public/river-test.html?theme=<id>` 本地截图预览(源文件在 `source/river-test.html`,已加入 `skip_render`)
