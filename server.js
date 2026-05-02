const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = path.dirname(__filename);
const SETTINGS_FILE = path.join(dir, 'server_settings.json');

// 读取服务端设置
function loadServerSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch(e) {}
  // 文件不存在时自动创建默认文件
  saveServerSettings({ expressCustomer: '', expressKey: '' });
  return { expressCustomer: '', expressKey: '' };
}

function saveServerSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const mimes = {
  'html': 'text/html; charset=utf-8',
  'js': 'application/javascript; charset=utf-8',
  'css': 'text/css; charset=utf-8',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:8282');
  const pathname = url.pathname;

  // ── 代理：GET /api/express（快递100物流查询）──────────────────────────
  if (pathname === '/api/express' && req.method === 'GET') {
    const com = url.searchParams.get('com') || '';
    const num = url.searchParams.get('num') || '';
    const settings = loadServerSettings();
    const { expressCustomer: customer, expressKey: secretKey } = settings;

    if (!customer || !secretKey) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: '0', message: '请先在系统设置中配置快递100的Customer ID和API密钥' }));
      return;
    }

    // param：不含 resultv2（resultv2 只作额外参数传递，不参与签名）
    const paramJson = JSON.stringify({ com, num });
    // 快递100 签名算法：MD5(param + customer + secretKey).toUpperCase()
    const sign = crypto
      .createHash('md5')
      .update(paramJson + customer + secretKey)
      .digest('hex')
      .toUpperCase();

    // 使用 application/json POST 方式，避免 URL-encoded 歧义
    const postBody = JSON.stringify({
      customer,
      sign,
      param: paramJson,
      resultv2: '1'   // 请求完整物流轨迹
    });

    const proxyReq = http.request(
      {
        hostname: 'poll.kuaidi100.com',
        path: '/poll/query.do',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(postBody)
        },
        timeout: 10000
      },
      (proxyRes) => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(body);
        });
      }
    );
    proxyReq.on('error', (e) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: '0', message: '网络错误：' + e.message }));
    });
    proxyReq.on('timeout', () => { proxyReq.destroy(); res.end(JSON.stringify({ status: '0', message: '请求超时' })); });
    proxyReq.write(postBody);
    proxyReq.end();
    return;
  }

  // ── 代理：GET /api/settings 读取服务端设置 ───────────────────────────
  if (pathname === '/api/settings' && req.method === 'GET') {
    const settings = loadServerSettings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(settings));
    return;
  }

  // ── 代理：POST /api/settings 保存服务端设置 ─────────────────────────
  if (pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        saveServerSettings(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: e.message }));
      }
    });
    return;
  }

  // ── 静态文件服务 ──────────────────────────────────────────────────────
  let urlPath = pathname;
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(dir, urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('Not Found'); return;
  }
  const ext = path.extname(filePath).slice(1);
  res.writeHead(200, { 'Content-Type': mimes[ext] || 'text/plain' });
  res.end(fs.readFileSync(filePath));
});

server.listen(8282, () => console.log('Server running at http://localhost:8282'));
