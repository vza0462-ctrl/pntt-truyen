const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
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

http.createServer((req, res) => {
  // ===== TTS Proxy: chống CORS cho Google TTS =====
  if (req.url.startsWith('/tts?')) {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const text = params.get('q') || '';
    if (!text.trim()) {
      res.writeHead(400);
      return res.end('Missing q parameter');
    }
    
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=' +
                encodeURIComponent(text.substring(0, 200));
    
    httpsGet(url, res);
    return;
  }

  // ===== Static files =====
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  
  const fp = path.join(ROOT, url);
  
  if (!fp.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404 - File not found</h1>');
    }
    
    const ext = path.extname(fp);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('✓ PNTT server running at http://localhost:' + PORT);
  console.log('✓ TTS proxy ready (CORS-free)');
});

/** Fetch từ Google TTS và pipe response về client */
function httpsGet(url, res) {
  const https = require('https');
  https.get(url, (proxyRes) => {
    // Pipe headers
    const headers = { 'Content-Type': 'audio/mpeg' };
    res.writeHead(proxyRes.statusCode || 200, headers);
    
    // Pipe data
    proxyRes.on('data', chunk => res.write(chunk));
    proxyRes.on('end', () => res.end());
  }).on('error', (err) => {
    console.error('TTS proxy error:', err.message);
    res.writeHead(500);
    res.end('TTS proxy error');
  });
}
