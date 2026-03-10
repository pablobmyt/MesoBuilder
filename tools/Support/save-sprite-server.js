#!/usr/bin/env node
// Simple HTTP server to accept POST /save-sprite with JSON { name, dataURI }
// Writes files to tools/support/temp-sprites/<name>

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const OUT_DIR = path.resolve(__dirname, 'temp-sprites');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  if (req.method === 'POST' && req.url === '/save-sprite') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        const name = obj.name || ('sprite-' + Date.now() + '.png');
        const dataURI = obj.dataURI || obj.dataUrl || obj.dataUrl || null;
        if (!dataURI || typeof dataURI !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'missing dataURI' }));
          return;
        }
        const matches = dataURI.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
        if (!matches) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid dataURI' }));
          return;
        }
        const b64 = matches[2];
        const buffer = Buffer.from(b64, 'base64');
        const safeName = path.basename(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const outPath = path.join(OUT_DIR, safeName);
        fs.writeFileSync(outPath, buffer);
        console.log('Saved sprite', outPath);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, path: outPath }));
      } catch (e) {
        console.error('save error', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not-found' }));
});

server.listen(PORT, () => console.log(`Sprite save server listening on http://localhost:${PORT}/save-sprite`));
