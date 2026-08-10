/* Minimal zero-dependency static server for the AKB Fee Collection app.
 * Designed for Railway / any PaaS: binds to process.env.PORT.
 *
 * Optional password protection (STRONGLY recommended for a public deploy,
 * because the app contains student personal data):
 *   set env var  APP_PASSWORD  (and optionally APP_USER, default "admin")
 * When APP_PASSWORD is set, the whole site requires HTTP Basic Auth.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const USER = process.env.APP_USER || 'admin';
const PASS = process.env.APP_PASSWORD || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8'
};

function unauthorized(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="AKB Fee Collection", charset="UTF-8"',
    'Content-Type': 'text/plain'
  });
  res.end('Authentication required');
}

function checkAuth(req) {
  if (!PASS) return true; // auth disabled unless APP_PASSWORD is set
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const i = decoded.indexOf(':');
  const u = decoded.slice(0, i), p = decoded.slice(i + 1);
  return u === USER && p === PASS;
}

const server = http.createServer((req, res) => {
  if (!checkAuth(req)) return unauthorized(res);

  // resolve path safely
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      if (!err && st && st.isDirectory()) filePath = path.join(filePath, 'index.html');
      return sendFile(filePath, res, () => {
        // fall back to index.html (hash-router SPA)
        sendFile(path.join(ROOT, 'index.html'), res, () => {
          res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
        });
      });
    }
    sendFile(filePath, res, () => { res.writeHead(404); res.end('Not found'); });
  });
});

function sendFile(filePath, res, onErr) {
  fs.readFile(filePath, (err, data) => {
    if (err) return onErr();
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    // HTML/JS/CSS must always revalidate so code updates show immediately after
    // a redeploy; static images can cache for a day.
    const fresh = (ext === '.html' || ext === '.js' || ext === '.css');
    const cache = fresh ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log('AKB Fee Collection running on port ' + PORT +
    (PASS ? ' (password protected)' : ' (NO PASSWORD — set APP_PASSWORD to protect it)'));
});
