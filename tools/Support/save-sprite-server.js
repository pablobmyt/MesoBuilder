#!/usr/bin/env node
// HTTP server for pixel editor integration.
// POST /save-sprite        { name, dataURI }   → writes PNG to temp-sprites/
// POST /save-entity-pixels { icons: {...} }    → overwrites data/entity-pixels.json

const http = require('http');
const fs = require('fs');
const path = require('path');

const ENTITY_PIXELS_PATH = path.resolve(__dirname, '../../data/entity-pixels.json');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const PORT = process.env.PORT || 3001;
const OUT_DIR = path.resolve(__dirname, 'temp-sprites');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // ── Save entity-pixels.json ───────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/save-entity-pixels') {
    try {
      const body = await readBody(req);
      const obj = JSON.parse(body);
      if (!obj || typeof obj !== 'object') throw new Error('invalid payload');
      // Accept { icons: {...} } or just { ... } (raw icons map)
      const payload = obj.icons ? obj : { icons: obj };
      fs.writeFileSync(ENTITY_PIXELS_PATH, JSON.stringify(payload, null, 2), 'utf8');
      console.log('[save-entity-pixels] Saved', ENTITY_PIXELS_PATH, Object.keys(payload.icons || {}).length, 'icons');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: true, path: ENTITY_PIXELS_PATH }));
    } catch (e) {
      console.error('[save-entity-pixels] Error', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: false, error: String(e.message) }));
    }
    return;
  }

  // ── Save PNG sprite ───────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/save-sprite') {
    try {
      const body = await readBody(req);
      const obj = JSON.parse(body);
      const name = obj.name || ('sprite-' + Date.now() + '.png');
      const dataURI = obj.dataURI || obj.dataUrl || null;
      if (!dataURI || typeof dataURI !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ ok: false, error: 'missing dataURI' }));
        return;
      }
      const matches = dataURI.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
      if (!matches) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ ok: false, error: 'invalid dataURI' }));
        return;
      }
      const buffer = Buffer.from(matches[2], 'base64');
      const safeName = path.basename(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const outPath = path.join(OUT_DIR, safeName);
      fs.writeFileSync(outPath, buffer);
      console.log('[save-sprite] Saved', outPath);
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: true, path: outPath }));
    } catch (e) {
      console.error('[save-sprite] Error', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ ok: false, error: String(e.message) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(JSON.stringify({ ok: false, error: 'not-found' }));
});

server.listen(PORT, () => {
  console.log(`Save server on http://localhost:${PORT}`);
  console.log(`  POST /save-sprite         → PNG to temp-sprites/`);
  console.log(`  POST /save-entity-pixels  → overwrites data/entity-pixels.json`);
});
