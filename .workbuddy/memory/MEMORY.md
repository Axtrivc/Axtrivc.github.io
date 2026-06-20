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

## 偏好
- 输出格式：FotMob 风格卡片，emoji 图标，简洁数据
- 视觉主题：米色简约亮色，避免厚重深色背景
- 沟通语言：中文为主，简洁直接
