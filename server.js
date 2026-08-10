/* Minimal zero-dependency static server for the AKB Fee Collection app,
 * plus an optional WhatsApp bulk-reminder API endpoint.
 *
 * Static hosting: binds to process.env.PORT.
 *
 * Optional password protection (recommended for a public deploy):
 *   APP_PASSWORD  (and optionally APP_USER, default "admin") -> HTTP Basic Auth.
 *
 * Optional WhatsApp Business API sending (server-side; token stays here):
 *   WA_PROVIDER = meta | interakt | gupshup
 *   WA_TOKEN    = API token / key (secret)
 *   WA_TEMPLATE = approved template name (meta/interakt) or template id (gupshup)
 *   WA_LANG     = template language code (default "en")
 *   WA_PARAMS   = comma list of fields mapped to the template body variables,
 *                 in order. Available fields: name, balance, grade, school, id.
 *                 Default "name,balance"  ({{1}}=name, {{2}}=balance)
 *   Meta only:     WA_PHONE_ID
 *   Gupshup only:  WA_SOURCE (sender number), WA_APP (app name)
 * Sending requires APP_PASSWORD to be set (so the endpoint isn't public).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const USER = process.env.APP_USER || 'admin';
const PASS = process.env.APP_PASSWORD || '';
const SCHOOL = 'AKB School of Excellence';

const WA = {
  provider: (process.env.WA_PROVIDER || '').toLowerCase().trim(),
  token: process.env.WA_TOKEN || '',
  template: process.env.WA_TEMPLATE || '',
  lang: process.env.WA_LANG || 'en',
  phoneId: process.env.WA_PHONE_ID || '',
  source: process.env.WA_SOURCE || '',
  app: process.env.WA_APP || '',
  params: (process.env.WA_PARAMS || 'name,balance').split(',').map(s => s.trim()).filter(Boolean)
};
function waConfigured() { return !!(WA.provider && WA.token && WA.template); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8'
};

function unauthorized(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="AKB Fee Collection", charset="UTF-8"', 'Content-Type': 'text/plain' });
  res.end('Authentication required');
}
function checkAuth(req) {
  if (!PASS) return true;
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const i = decoded.indexOf(':');
  return decoded.slice(0, i) === USER && decoded.slice(i + 1) === PASS;
}
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let data = '', n = 0;
    req.on('data', c => { n += c.length; if (n > (limit || 2e6)) { reject(new Error('Body too large')); req.destroy(); } else data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
function normPhone(p) {
  let d = String(p == null ? '' : p).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d;
}

// Send one template message via the configured provider. Throws on failure.
async function waSendOne(rcpt) {
  const to = normPhone(rcpt.phone);
  if (to.length < 11) throw new Error('bad phone');
  const fields = { name: rcpt.name || '', balance: rcpt.balance || '', grade: rcpt.grade || '', school: SCHOOL, id: rcpt.id || '' };
  const params = WA.params.map(k => String(fields[k] != null ? fields[k] : ''));
  if (WA.provider === 'meta') {
    const body = { messaging_product: 'whatsapp', to, type: 'template', template: { name: WA.template, language: { code: WA.lang }, components: [{ type: 'body', parameters: params.map(t => ({ type: 'text', text: t })) }] } };
    const r = await fetch(`https://graph.facebook.com/v20.0/${WA.phoneId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + WA.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('meta ' + r.status + ': ' + (await r.text()).slice(0, 180));
  } else if (WA.provider === 'interakt') {
    const body = { countryCode: '+91', phoneNumber: to.replace(/^91/, ''), type: 'Template', template: { name: WA.template, languageCode: WA.lang, bodyValues: params } };
    const r = await fetch('https://api.interakt.ai/v1/public/message/', { method: 'POST', headers: { Authorization: 'Basic ' + WA.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('interakt ' + r.status + ': ' + (await r.text()).slice(0, 180));
  } else if (WA.provider === 'gupshup') {
    const form = new URLSearchParams();
    form.set('channel', 'whatsapp'); form.set('source', WA.source); form.set('destination', to); form.set('src.name', WA.app);
    form.set('template', JSON.stringify({ id: WA.template, params }));
    const r = await fetch('https://api.gupshup.io/wa/api/v1/template/msg', { method: 'POST', headers: { apikey: WA.token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    if (!r.ok) throw new Error('gupshup ' + r.status + ': ' + (await r.text()).slice(0, 180));
  } else {
    throw new Error('unknown WA_PROVIDER "' + WA.provider + '"');
  }
}

async function handleSendReminders(req, res) {
  if (!PASS) return sendJSON(res, 403, { error: 'Set APP_PASSWORD before enabling WhatsApp sending.' });
  if (!waConfigured()) return sendJSON(res, 400, { error: 'WhatsApp not configured (set WA_PROVIDER, WA_TOKEN, WA_TEMPLATE).' });
  let payload;
  try { payload = JSON.parse(await readBody(req)); } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }); }
  const recipients = Array.isArray(payload && payload.recipients) ? payload.recipients.slice(0, 1000) : [];
  if (!recipients.length) return sendJSON(res, 400, { error: 'No recipients' });
  let sent = 0, failed = 0; const errors = [];
  for (const r of recipients) {
    try { await waSendOne(r); sent++; }
    catch (e) { failed++; if (errors.length < 25) errors.push((r.name || r.phone || '?') + ': ' + e.message); }
    await new Promise(rs => setTimeout(rs, 120)); // gentle pacing
  }
  console.log(`WhatsApp reminders: sent ${sent}, failed ${failed}`);
  sendJSON(res, 200, { sent, failed, errors });
}

const server = http.createServer((req, res) => {
  if (!checkAuth(req)) return unauthorized(res);
  const urlPathRaw = (req.url || '/').split('?')[0];

  // --- API routes ---
  if (urlPathRaw === '/api/wa-status' && req.method === 'GET')
    return sendJSON(res, 200, { configured: waConfigured(), provider: WA.provider || null });
  if (urlPathRaw === '/api/send-reminders' && req.method === 'POST')
    return handleSendReminders(req, res).catch(e => sendJSON(res, 500, { error: String(e && e.message || e) }));

  // --- static files ---
  let urlPath = decodeURIComponent(urlPathRaw);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      if (!err && st && st.isDirectory()) filePath = path.join(filePath, 'index.html');
      return sendFile(filePath, res, () => sendFile(path.join(ROOT, 'index.html'), res, () => { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }));
    }
    sendFile(filePath, res, () => { res.writeHead(404); res.end('Not found'); });
  });
});

function sendFile(filePath, res, onErr) {
  fs.readFile(filePath, (err, data) => {
    if (err) return onErr();
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const fresh = (ext === '.html' || ext === '.js' || ext === '.css');
    const cache = fresh ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log('AKB Fee Collection on port ' + PORT +
    (PASS ? ' (password protected)' : ' (NO PASSWORD — set APP_PASSWORD to protect it)') +
    (waConfigured() ? ' · WhatsApp: ' + WA.provider : ' · WhatsApp: not configured'));
});
