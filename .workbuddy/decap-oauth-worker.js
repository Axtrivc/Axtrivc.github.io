/**
 * Decap CMS GitHub OAuth 代理（重写版）
 * 部署到 Cloudflare Workers
 *
 * 工作流程（Decap CMS 期望的 popup + postMessage 模式）：
 * 1. CMS 打开 popup 访问 /api/auth → 重定向到 GitHub 授权页
 * 2. 用户授权后 GitHub 回调到 /callback?code=xxx&state=xxx
 * 3. Worker 换取 access_token
 * 4. Worker 返回一个 HTML 页面，用 window.opener.postMessage 通知 CMS
 * 5. CMS 关闭 popup，登录完成
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 健康检查
    if (pathname === '/') {
      return new Response(JSON.stringify({ ok: true, service: 'decap-oauth-proxy' }), { headers: JSON_HEADERS });
    }

    // 1) 发起授权：浏览器访问 /api/auth → 重定向到 GitHub
    if (pathname === '/api/auth') {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: env.CLIENT_ID,
        redirect_uri: env.REDIRECT_URL,
        scope: 'repo,user',
        state,
      });
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://github.com/login/oauth/authorize?${params}`,
          'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        },
      });
    }

    // 2) GitHub 回调：code → access_token → 返回 HTML（postMessage 给父窗口）
    if (pathname === '/callback') {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const cookieHeader = request.headers.get('Cookie') || '';
      const expectedState = (cookieHeader.match(/oauth_state=([^;]+)/) || [])[1];

      if (!code || !state || state !== expectedState) {
        return htmlResponse(renderErrorPage('授权失败', 'state 校验失败，请重试'));
      }

      // 换 token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET,
          code,
          redirect_uri: env.REDIRECT_URL,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return htmlResponse(renderErrorPage('GitHub 返回错误', JSON.stringify(tokenData)));
      }

      // 关键：返回 HTML 页面，用 postMessage 把 token 发给 CMS 主窗口
      // CMS 期望的 message 格式：authorization:github:success:{...JSON...}
      const messagePayload = JSON.stringify({
        token: tokenData.access_token,
        provider: 'github',
      });

      return htmlResponse(renderSuccessPage(messagePayload, env.ALLOWED_ORIGIN));
    }

    return new Response('Not Found', { status: 404 });
  },
};

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// 授权成功页面：postMessage 通知父窗口后自动关闭
function renderSuccessPage(payload, allowedOrigin) {
  const origin = allowedOrigin || 'https://axtrivc.github.io';
  const safePayload = payload.replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>授权完成</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f6f8fa;
      color: #24292e;
    }
    .card {
      text-align: center;
      padding: 2rem 3rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #e1e4e8;
      border-top-color: #07C160;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>授权成功，正在登录...</p>
  </div>
  <script>
    (function() {
      var origin = ${JSON.stringify(origin)};
      var payload = ${JSON.stringify(safePayload)};
      var msg = 'authorization:github:success:' + payload;

      function finish() {
        if (window.opener) {
          window.opener.postMessage(msg, origin);
          setTimeout(function() { window.close(); }, 500);
        } else {
          // 直接访问场景：跳回 admin
          window.location.href = origin + '/admin/';
        }
      }

      // 等待父窗口准备好
      if (window.opener) {
        // 先发送 pong 响应（Decap CMS 会先 ping）
        window.addEventListener('message', function(e) {
          if (e.origin === origin && e.data === 'authorizing:github') {
            e.source.postMessage(msg, origin);
            setTimeout(function() { window.close(); }, 500);
          }
        });
        // 同时主动发送一次
        finish();
      } else {
        finish();
      }
    })();
  </script>
</body>
</html>`;
}

// 错误页面
function renderErrorPage(title, detail) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>授权失败</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f6f8fa;
      color: #cb2431;
    }
    .card {
      text-align: center;
      padding: 2rem 3rem;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      max-width: 480px;
    }
    pre {
      text-align: left;
      background: #f6f8fa;
      padding: 0.75rem;
      border-radius: 4px;
      font-size: 12px;
      overflow-x: auto;
      color: #586069;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>❌ ${title}</h2>
    <pre>${detail.replace(/</g, '&lt;')}</pre>
    <p style="margin-top:1rem"><a href="javascript:window.close()">关闭窗口</a></p>
  </div>
</body>
</html>`;
}
