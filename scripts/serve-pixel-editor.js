// scripts/serve-pixel-editor.js
// Servidor mínimo para el editor de píxeles standalone
const { createServer } = require('http');
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const PORT = 3458;
const toolsDir = join(__dirname, '..', 'tools', 'Support');
const dataDir = join(__dirname, '..', 'data');
const frDataDir = join(__dirname, '..', '..', 'Football-Retro', 'Football-Retro', 'data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

// ════════════ API: Guardar sprite ════════════
function saveSpriteToFile(fileName, spriteName, grid, pixels) {
  // Determinar ruta real
  let filePath;
  if (fileName === 'entity-pixels.json') {
    filePath = join(dataDir, fileName);
  } else {
    filePath = join(frDataDir, fileName);
  }
  if (!existsSync(filePath)) return { error: 'Archivo no encontrado: ' + fileName };
  
  const raw = readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  const pxArr = pixels.map(p => [p.x, p.y, p.color]);
  
  if (fileName === 'entity-pixels.json') {
    if (!json.icons) json.icons = {};
    json.icons[spriteName] = { grid, pixels: pxArr };
  } else if (fileName === 'sprites-penalty.json') {
    // Convertir pixels a formato rows/palette
    if (!json[spriteName] && !json.rows) {
      json[spriteName] = { rows: pixelsToRows(grid, pixels), palette: extractPalette(pixels) };
    } else if (json[spriteName]) {
      json[spriteName] = { rows: pixelsToRows(grid, pixels), palette: extractPalette(pixels) };
    }
  } else if (fileName === 'sprites.json') {
    if (!json.sprites) json.sprites = [];
    const idx = json.sprites.findIndex(s => s.id === spriteName || s.name === spriteName);
    if (idx >= 0) {
      json.sprites[idx] = { ...json.sprites[idx], id: spriteName, grid, pixels: pxArr };
    } else {
      json.sprites.push({ id: spriteName, grid, pixels: pxArr });
    }
  }
  
  const { writeFileSync } = require('fs');
  writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
  return { ok: true, file: fileName, sprite: spriteName, pixels: pxArr.length };
}

function pixelsToRows(grid, pixels) {
  const rows = [];
  const map = {};
  pixels.forEach(p => { map[p.x + ',' + p.y] = p.color; });
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const cm = {}, rm = {};
  let ci = 0;
  function getChar(c) { if (cm[c]) return cm[c]; const ch = chars[ci++]; cm[c] = ch; rm[ch] = c; return ch; }
  for (let y = 0; y < grid; y++) {
    let r = '';
    for (let x = 0; x < grid; x++) {
      r += map[x + ',' + y] ? getChar(map[x + ',' + y]) : '.';
    }
    rows.push(r);
  }
  return rows;
}

function extractPalette(pixels) {
  const pal = {};
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ci = 0;
  const seen = new Set();
  pixels.forEach(p => {
    if (!seen.has(p.color)) {
      seen.add(p.color);
      pal[chars[ci++]] = p.color;
    }
  });
  return pal;
}

const server = createServer((req, res) => {
  // ── API POST ──
  if (req.method === 'POST' && req.url === '/api/save-sprite') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, spriteName, grid, pixels } = JSON.parse(body);
        if (!file || !spriteName || !grid || !pixels) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Faltan campos: file, spriteName, grid, pixels' }));
        }
        const result = saveSpriteToFile(file, spriteName, grid, pixels);
        res.writeHead(result.error ? 400 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  const urlPath = req.url === '/' ? '/pixel-editor-standalone.html' : req.url;
  let fullPath = join(toolsDir, urlPath);
  if (!existsSync(fullPath) && urlPath.startsWith('/data/')) {
    fullPath = join(dataDir, urlPath.replace('/data/', '/'));
  }
  if (!existsSync(fullPath) && urlPath.startsWith('/data/')) {
    fullPath = join(frDataDir, urlPath.replace('/data/', '/'));
  }
  if (existsSync(fullPath)) {
    const ext = require('path').extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(readFileSync(fullPath, 'utf-8'));
  } else {
    res.writeHead(404);
    res.end('Not found: ' + urlPath);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🎨 Pixel Editor en http://127.0.0.1:${PORT}`);
  console.log('🛑 Pulsa Ctrl+C para parar');
});
