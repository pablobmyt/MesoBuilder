// scripts/dev-server.js
// Servidor estático mínimo para abrir MesoBuilder en un navegador (auditoría / depuración).
// Uso:  node scripts/dev-server.js [puerto]
// Por defecto: http://localhost:4321/
//
// Permite además activar el modo editor y el modo debug por query string:
//   http://localhost:4321/?debug=1
//   http://localhost:4321/?editor=1
//
// Y trae la MISMA API de guardado que el servidor del editor (`entity-views-api.js`),
// para que «Guardar en el proyecto» del editor de entidades escriba el fichero aunque
// la página la esté sirviendo este servidor:
//   GET/POST /api/vistas · POST /api/hoja · GET /api/estado
const http = require('http');
const fs = require('fs');
const path = require('path');
const { crearApiVistas } = require('./entity-views-api');

const PORT = Number(process.argv[2]) || 4321;
const ROOT = path.join(__dirname, '..');
const api = crearApiVistas(ROOT, { etiqueta: 'dev-server' });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.properties': 'text/plain; charset=utf-8'
};

function safeJoin(root, target) {
  const resolved = path.resolve(root, '.' + path.sep + target.replace(/^[/\\]+/, ''));
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // API de guardado del editor de entidades (ver scripts/entity-views-api.js)
  if (api.manejar(req, res, urlPath)) return;

  const filePath = safeJoin(ROOT, urlPath);
  if (!filePath) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('[dev-server] MesoBuilder disponible en http://localhost:' + PORT + '/');
  console.log('[dev-server]   nueva partida      -> http://localhost:' + PORT + '/?debug=1');
  console.log('[dev-server]   editor de mapas   -> http://localhost:' + PORT + '/?editor=1&debug=1');
  console.log('[dev-server]   editor de entidades-> http://localhost:' + PORT + '/tools/Support/entity-sheet-editor.html');
  console.log('[dev-server] guardar del editor   -> POST /api/vistas (escribe data/entity-views.json)');
  console.log('[dev-server] raíz: ' + ROOT);
});
