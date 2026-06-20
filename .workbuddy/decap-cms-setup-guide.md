# Decap CMS 部署指南 · Axtrivc's Blog

本文档指导你完成博客后台管理系统的 OAuth 登录配置。代码部分我已经完成，剩下两个外部配置需要你本人操作（涉及账号授权，我无法代替）。

---

## 整体架构

```
浏览器 → https://axtrivc.github.io/admin/
         ↓ 点击「Login with GitHub」
         ↓ 跳转到 GitHub 授权页
         ↓ 授权后回调到 Cloudflare Worker
         ↓ Worker 拿到 access_token，重定向回 /admin/
         ↓ Decap CMS 用 token 直接读写 GitHub 仓库
         ↓ 提交到 master → 触发 GitHub Actions → 自动部署
```

**已完成 ✅**
- `source/admin/index.html` — Decap CMS 入口页面
- `source/admin/config.yml` — CMS 配置（三个集合：博客文章、足球晚报、西语笔记）
- `_config.yml` 已添加 `admin/**` 到 `skip_render`
- 已推送 master，GitHub Actions 自动部署中

**待你完成 ⏳**
- 步骤 1：创建 GitHub OAuth App
- 步骤 2：部署 Cloudflare Worker（OAuth 代理）

---

## 步骤 1：创建 GitHub OAuth App

GitHub OAuth App 是让 Decap CMS 能代表你访问仓库的「通行证」。

1. 打开 https://github.com/settings/applications/new
   （或在 https://github.com/settings/developers 点击「New OAuth App」）

2. 填写表单：

   | 字段 | 填写内容 |
   |------|---------|
   | **Application name** | `Axtrivc Blog Admin`（随意，便于自己识别） |
   | **Homepage URL** | `https://axtrivc.github.io` |
   | **Application description** | `Decap CMS for blog editing`（可选） |
   | **Authorization callback URL** | `https://axtrivc-oauth.pages.dev/callback` |

   > ⚠️ callback URL 中的 `axtrivc-oauth.pages.dev` 是步骤 2 部署 Worker 后的域名。如果你打算用别的 Worker 名字，这里要同步改。

3. 点击 **Register application**

4. 注册后，你会看到一个页面：
   - **Client ID**：直接显示（类似 `Iv1.abc123...`）→ **记下来**
   - **Client Secret**：点击「Generate a new client secret」→ 生成后只显示一次 → **立刻记下来**（关掉就再也看不到了）

---

## 步骤 2：部署 Cloudflare Worker（OAuth 代理）

Decap CMS 用 GitHub OAuth 登录时，需要一个服务器中转拿 token。我们用 Cloudflare Workers（免费额度每天 10 万次请求，绰绰有余）。

### 2.1 注册 Cloudflare（如果没有账号）

打开 https://dash.cloudflare.com/sign-up ，邮箱注册即可，不需要绑定信用卡。

### 2.2 创建 Worker

1. 登录后，左侧菜单 → **Workers & Pages** → **Create application** → **Create Worker**
2. **Name**：填 `axtrivc-oauth`（部署后域名就是 `axtrivc-oauth.<你的子域>.workers.dev`）
3. 点 **Deploy**

### 2.3 粘贴代码

1. 部署成功后点击 **Edit code**
2. 把左侧 `worker.js` 的内容全部删掉
3. 粘贴 `C:\Users\leecl\blog\.workbuddy\decap-oauth-worker.js` 里的完整代码（我已经写好了）
4. 点右上角 **Save and deploy**

### 2.4 配置环境变量

1. 回到 Worker 详情页 → **Settings** → **Variables**（位于 Environment Variables 区）
2. 添加以下 4 个变量（Production 环境）：

   | 变量名 | 值 |
   |--------|-----|
   | `CLIENT_ID` | 步骤 1 拿到的 Client ID |
   | `CLIENT_SECRET` | 步骤 1 拿到的 Client Secret |
   | `REDIRECT_URL` | `https://axtrivc-oauth.<你的子域>.workers.dev/callback` |
   | `ALLOWED_ORIGIN` | `https://axtrivc.github.io` |

   **Client Secret** 一定要点「Encrypt」加密保存。

3. 保存

---

## 步骤 3：验证

### 3.1 等 GitHub Actions 部署完成

打开 https://github.com/Axtrivc/Axtrivc.github.io/actions
看最新一次 workflow 是否显示 ✅ 绿勾（约 1-2 分钟）。

### 3.2 访问后台

打开 https://axtrivc.github.io/admin/

应该看到 Decap CMS 登录界面，点击 **Login with GitHub**：
- 跳转到 GitHub 授权页 → 点 Authorize
- 自动跳回 `/admin/` → 看到三个集合：
  - 📝 博客文章
  - ⚽ 足球晚报
  - 🇪🇸 西班牙语笔记

### 3.3 测试写文章

1. 点「博客文章」→ **New 博客文章**
2. 填标题、正文（支持 Markdown 富文本编辑器）
3. 点 **Publish** → 会直接提交到 master → 自动触发部署 → 1-2 分钟后文章上线

> 💡 我开启了 `editorial_workflow`（编辑工作流），所以默认会进入草稿状态。
> 想直接发布：在草稿页面右上角点 **Publish now** 即可。

---

## 常见问题

### Q：登录后提示「Permission denied」？
检查 OAuth App 的授权范围。到 https://github.com/settings/applications 找到你的 App，确认授权了 `repo` 权限。

### Q：登录成功但看不到文章列表？
检查 `config.yml` 里的 `repo` 和 `branch` 是否正确：
- repo: `Axtrivc/Axtrivc.github.io`
- branch: `master`

### Q：回调报错「redirect_uri_mismatch」？
GitHub OAuth App 的 Authorization callback URL 必须和 Worker 的实际域名完全一致（包括协议 https:// 和路径 /callback）。去 OAuth App 设置里核对。

### Q：其他人能登录我的后台吗？
**不能**。只有你的 GitHub 账号能授权这个 OAuth App。其他人访问 `/admin/` 点 Login 时，会被 GitHub 拒绝（除非他们也是这个仓库的 collaborator）。

### Q：我想给其他作者开放权限？
在 GitHub 仓库 Settings → Collaborators 加他们的 GitHub 用户名。他们用自己账号登录 CMS，就能提交（但提交会走 editorial workflow，你审核后才上线）。

### Q：能否不用 Cloudflare Worker？
可以。备选方案：
- **Netlify Identity**：https://decapcms.org/docs/github-backend/#github-with-netlify
- **Vercel Serverless Functions**：写法和 Cloudflare Worker 类似

但 Cloudflare Worker 是 Decap CMS 官方推荐的方案，最省心。

---

## 文件清单

| 文件 | 作用 |
|------|------|
| `source/admin/index.html` | CMS 入口页面（加载 Decap CMS CDN） |
| `source/admin/config.yml` | CMS 配置（集合、字段、后端） |
| `_config.yml` 的 `skip_render` | 防止 Hexo 把 admin/ 当模板渲染 |
| `.workbuddy/decap-oauth-worker.js` | Cloudflare Worker 源码（手动部署到 Cloudflare） |
| `.github/workflows/deploy.yml` | 已有的部署工作流（无需修改） |

---

## 安全说明

- Client Secret 加密存储在 Cloudflare，不会出现在前端代码里
- Worker 只接受 `ALLOWED_ORIGIN` 来源的请求
- OAuth state 校验防止 CSRF
- 仓库权限遵循 GitHub 原本的 collaborator 机制
- `/admin/` 页面加了 `<meta name="robots" content="noindex">`，不会被搜索引擎收录
