const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'public');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  // 支持目录访问自动找 index.html
  let filePath = path.normalize(path.join(root, urlPath));
  // 路径穿越防护: 解析结果必须仍在 public/ 内
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('Forbidden');
    return;
  }
  if (!path.extname(filePath)) {
    const withIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(withIndex)) filePath = withIndex;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(4000, () => console.log('Static server running at http://localhost:4000'));
