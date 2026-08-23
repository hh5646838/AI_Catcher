/**
 * 本地预览服务器（零依赖）
 * 模拟 Vercel：public/ 静态托管 + api/ Serverless Functions
 * 运行：node dev-server.js，然后访问 http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2'
};

// 缓存 API 模块
const apiModules = {};
function loadApi(name) {
  if (apiModules[name]) return apiModules[name];
  const file = path.join(API_DIR, name + '.js');
  if (!fs.existsSync(file)) return null;
  // 清除缓存以便修改后重启生效
  delete require.cache[require.resolve(file)];
  apiModules[name] = require(file);
  return apiModules[name];
}

// 读取请求体
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // API 路由
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').split('?')[0];
    const handler = loadApi(apiName);
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'API not found' }));
    }

    // 模拟 Vercel：注入 query，解析 body
    req.query = parsed.query;
    const contentType = req.headers['content-type'] || '';
    if (req.method === 'POST' && contentType.includes('application/json')) {
      const raw = await readBody(req);
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    } else {
      req.body = {};
    }

    // 模拟 Vercel 的 res.status().json().send()
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
      return res;
    };
    res.send = (body) => { res.end(body); return res; };

    try {
      await handler(req, res);
    } catch (err) {
      console.error('API Error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', detail: err.message }));
      }
    }
    return;
  }

  // 静态文件
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);

  // 防止目录穿越
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // SPA fallback 到 index.html
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (e, html) => {
        if (e) { res.writeHead(404); return res.end('Not Found'); }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  朱雀 AI 文本检测器 本地预览已启动`);
  console.log(`  👉  http://localhost:${PORT}\n`);
});
