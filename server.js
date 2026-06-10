// PNTT Server — chạy local + Vercel serverless
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlMod = require('url');

const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function handler(req, res) {
  const parsed = urlMod.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  
  // ===== TTS Proxy =====
  if (pathname === '/tts') {
    const text = (parsed.query.q || '').trim();
    if (!text) {
      res.writeHead(400);
      return res.end('Missing q parameter');
    }
    
    const ttsUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=' +
                   encodeURIComponent(text.substring(0, 200));
    
    https.get(ttsUrl, (proxyRes) => {
      // Trả về audio/mpeg
      const statusCode = proxyRes.statusCode === 200 ? 200 : 502;
      const isRedirect = proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location;
      
      if (isRedirect) {
        // Follow redirect
        https.get(proxyRes.headers.location, (r2) => {
          res.writeHead(r2.statusCode, { 'Content-Type': 'audio/mpeg' });
          r2.pipe(res);
        }).on('error', () => {
          res.writeHead(502);
          res.end('TTS proxy error');
        });
        return;
      }
      
      res.writeHead(statusCode, { 'Content-Type': 'audio/mpeg' });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.writeHead(502);
      res.end('TTS proxy error: ' + err.message);
    });
    return;
  }

  // ===== Static files =====
  let filePath = pathname === '/' ? '/index.html' : pathname;
  
  // Security: prevent directory traversal
  const fullPath = path.join(ROOT, filePath);
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 - File not found</h1>');
    }
    
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ===== Export for Vercel =====
module.exports = handler;

// ===== Local standalone server =====
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  http.createServer(handler).listen(PORT, () => {
    console.log('✓ PNTT server at http://localhost:' + PORT);
    console.log('✓ TTS proxy ready');
  });
}
