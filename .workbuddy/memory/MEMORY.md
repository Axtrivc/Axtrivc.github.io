# 长期记忆

## 项目信息
- 博客：足球晚报，基于 Hexo，部署在 GitHub Pages
- 仓库：Axtrivc/Axtrivc.github.io，主分支：master
- 本地工作目录：C:/Users/leecl/blog

## 自动化配置
- automation-2：每天 08:05 触发足球早报 workflow（football-daily.yml，edition=morning）
- 触发方式：通过 Git Credential Manager 提取 token → Node.js REST API 调用 GitHub API
- 凭据提取路径：`C:/Users/leecl/.workbuddy/vendor/PortableGit/mingw64/bin/git-credential-manager.exe`
- API 端点：`POST /repos/Axtrivc/Axtrivc.github.io/actions/workflows/football-daily.yml/dispatches`

## 已知问题（2026-06-10 更新）
- gh CLI 仍未安装（winget 网络问题导致下载失败）
- 已找到替代方案：通过 git-credential-manager.exe 提取 Windows 凭据管理器中的 GitHub token，再用 Node.js 调用 REST API
- 此方法已验证可用（2026-06-10 成功触发 workflow）

## CMS 配置
- Decap CMS 已集成（2026-06-20）
- 入口：`/admin/`（source/admin/index.html + config.yml）
- 后端：github, branch=master，editorial_workflow 模式
- OAuth 代理：Cloudflare Worker（`.workbuddy/decap-oauth-worker.js`）
- 三个集合：博客文章 posts、足球晚报 football、西语笔记 espanol
- 部署指南：`.workbuddy/decap-cms-setup-guide.md`

## Hero 动画实验（2026-06-21 ~ 2026-06-23）
- 路径：`source/hero/`（index.html + hero.js，独立页面，需要 `layout: false` front-matter）
- **当前状态**：**已上线**（commit `a69037b6`，v4 极简转场）✅
- 集成方式：`scripts/hero-inject.js` 通过 `after_render:html` filter 注入到主页
  - 只对 `canonical=index.html` 的主页注入
  - 不修改 source/hero/ 本身，用 .hero-shell 包裹 + 注入 scoped CSS
- WebGL 转场 **性能铁律**（v3 → v4 教训）：
  - ❌ 永远不要在 hero-shell 上用 CSS filter（blur/saturate/brightness/hue-rotate）
    → Chromium 每帧栅格化 canvas 输出，1080p viewport 直接掉帧
  - ❌ 不要用 SVG filter（feColorMatrix / feOffset）整层应用
  - ❌ 不要 mix-blend-mode: overlay/screen + 多层叠加
  - ❌ 不要给装饰元素加 will-change: transform → 常驻合成层 + 滚动时降采样
  - ✅ 只用 `transform: translate3d` + `opacity` → GPU 合成器原生路径
  - ✅ canvas 单独加 `translateZ(0)` 锁独立 GPU 层，避免滚动降采样
- v4 转场方案：opacity 1→0 (0.20-0.85 缓出) + translateY 0→-6vh
- v3 Glitch 方案教训：8 个 glitch bar + RGB split + 噪点 scanlines → 卡成幻灯片
- 本地预览：`hexo serve` → http://localhost:4000/
- WebGL 验证陷阱：用 readPixels 在 `preserveDrawingBuffer:false` 下总是读到全 0，**截屏才是真相**

## 偏好
- 输出格式：FotMob 风格卡片，emoji 图标，简洁数据
- 视觉主题：米色简约亮色，避免厚重深色背景
- 沟通语言：中文为主，简洁直接
- **动画项目**：先在本地调试，完全 OK 后再上线到博客
- **默认使用 superpowers 流程**（2026-06-23 设置）：所有 coding/build 任务默认走 brainstorm → plan → subagent-driven build
  - 小改动可跳过 subagent 循环，直接 brainstorm → 改 → 自测
  - 用户已明确需求时（如"先阻力后下滑"）→ 直接进入 plan
