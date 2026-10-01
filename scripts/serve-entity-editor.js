// scripts/serve-entity-editor.js
// Arranca el servidor del editor de entidades y abre el navegador en él.
//
//   npm run editor            (intenta el 4321; si está ocupado, coge el siguiente libre)
//   npm run editor -- 4400    (puerto concreto)
//
// Sirve el proyecto entero (como scripts/dev-server.js, para que el editor pueda
// leer `data/entity-pixels.json` y las hojas de `data/sheets/`) y añade la API para
// guardar las asignaciones EN EL PROYECTO (módulo `entity-views-api.js`, el mismo que
// usa el dev-server):
//
//   GET  /api/estado   -> identifica la API (lo usa el editor para encontrarla)
//   GET  /api/vistas   -> devuelve data/entity-views.json
//   POST /api/vistas   -> escribe data/entity-views.json
//   POST /api/hoja     -> copia el PNG elegido a data/sheets/
//
// Antes el editor guardaba en `localStorage`, y eso tenía dos problemas: el juego
// abierto en OTRO sitio (Electron, otro puerto, otro navegador) no lo veía, y el
// dato quedaba escondido en el navegador en vez de en el repositorio. Ahora lo que
// guardas va al fichero y viaja con el proyecto.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { crearApiVistas } = require('./entity-views-api');

const ROOT = path.join(__dirname, '..');
const RUTA_EDITOR = '/tools/Support/entity-sheet-editor.html';
const PUERTO_PEDIDO = Number(process.argv[2] || process.env.MESO_EDITOR_PORT) || 4321;
const api = crearApiVistas(ROOT, { etiqueta: 'editor' });

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
  '.properties': 'text/plain; charset=utf-8'
};

function safeJoin(root, target) {
  const resolved = path.resolve(root, '.' + path.sep + target.replace(/^[/\\]+/, ''));
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

const servidor = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }

  // ── API de las vistas de entidad (módulo compartido con el dev-server) ──
  if (api.manejar(req, res, urlPath)) return;

  if (urlPath === '/' || urlPath === '') urlPath = RUTA_EDITOR;

  const fichero = safeJoin(ROOT, urlPath);
  if (!fichero) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(fichero, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fichero).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(fichero).pipe(res);
  });
});

function abrirNavegador(url) {
  const comando =
    process.platform === 'win32' ? 'start "" "' + url + '"' :
    process.platform === 'darwin' ? 'open "' + url + '"' :
    'xdg-open "' + url + '"';
  exec(comando, (err) => {
    if (err) console.log('[editor] abre esto en el navegador: ' + url);
  });
}

let puerto = PUERTO_PEDIDO;

// ¿Hay ya un servidor en ese puerto? OJO: el dev-server se ata a `::` (IPv6) y
// `localhost` puede resolver a ::1, así que se comprueba con `localhost`, no con
// 127.0.0.1. Compartir el puerto NO vale: el navegador hablaría con el otro
// servidor y la API de guardado daría 404.
function puertoOcupado(p) {
  return new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port: p, path: '/index.html', timeout: 1200 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  while (await puertoOcupado(puerto)) {
    if (puerto >= PUERTO_PEDIDO + 9) {
      console.error('[editor] del ' + PUERTO_PEDIDO + ' al ' + (PUERTO_PEDIDO + 9) + ' están todos ocupados.');
      process.exit(1);
    }
    console.log('[editor] el puerto ' + puerto + ' ya está sirviendo el proyecto; pruebo el ' + (puerto + 1) + '…');
    puerto++;
  }
  servidor.on('error', (e) => {
    console.error('[editor] no he podido abrir el servidor: ' + e.message);
    process.exit(1);
  });
  servidor.listen(puerto, () => {
    const url = 'http://localhost:' + puerto + RUTA_EDITOR;
    console.log('[editor] MesoBuilder · editor de entidades');
    console.log('[editor]   ' + url);
    console.log('[editor]   las asignaciones se guardan en data/entity-views.json');
    console.log('[editor] Ctrl+C para parar el servidor');
    if (!process.env.MESO_EDITOR_NO_ABRIR) abrirNavegador(url);
  });
})();
