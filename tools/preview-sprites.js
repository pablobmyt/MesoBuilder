// tools/preview-sprites.js
// ─────────────────────────────────────────────────────────────────────────────
// Imprime en ASCII (consola) cualquier sprite de `data/entity-pixels.json`, con
// el mismo criterio que usa el motor para colocarlo en pantalla. Sirve para
// revisar el arte de los edificios sin abrir el juego: proporciones, dónde
// apoya en el suelo, si el volumen se sale de la caja de la huella, etc.
//
// Uso:
//   node tools/preview-sprites.js house                un sprite
//   node tools/preview-sprites.js house temple market  varios
//   node tools/preview-sprites.js --list               lista los que hay
//   node tools/preview-sprites.js --step 2 house       reduce a la mitad
//   node tools/preview-sprites.js --iso house          añade la silueta del rombo
//                                                      de la huella (útil para ver
//                                                      si el volumen «casa» con la
//                                                      rejilla isométrica)
//
// Leyenda del dibujo: cada píxel se representa con un carácter según su
// luminosidad (`#` oscuro → `.` claro) y el hueco con espacio.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'entity-pixels.json');

// Mismos valores que el motor: la rejilla del rombo isométrico mide 2 celdas de
// ancho por ISO_RATIO*2 de alto, y el sprite se estira a la huella.
const ISO_RATIO = 0.6;

const RAMP = ' .:-=+*#%@';

function lum(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return null;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

function charFor(hex) {
  const l = lum(hex);
  if (l === null) return '?';
  // Oscuro = carácter «denso» para que se lean las siluetas.
  const i = Math.max(0, Math.min(RAMP.length - 1, Math.round((1 - l) * (RAMP.length - 1))));
  return RAMP[i];
}

function load() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return raw.icons || raw;
}

function printSprite(name, def, opts) {
  const step = Math.max(1, opts.step | 0);
  const pixels = def.pixels || [];
  const gw = def.gridW || def.grid || 1;
  const gh = def.gridH || def.grid || 1;
  let mx = 0, my = 0;
  for (const p of pixels) { if (!p) continue; if (p[0] > mx) mx = p[0]; if (p[1] > my) my = p[1]; }
  const w = mx + 1, h = my + 1;
  // Se dibuja con un margen a la izquierda para que quepa la silueta del rombo.
  const padX = opts.iso ? Math.ceil((gw * 0.5) / step) + 2 : 1;
  const cols = Math.ceil(w / step) + padX * 2;
  const rows = Math.ceil(h / step) + (opts.iso ? Math.ceil(gh / step) : 0) + 2;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
  const put = (x, y, ch, over) => {
    const cx = Math.floor(x / step) + padX, cy = Math.floor(y / step) + 1;
    if (cy < 0 || cy >= rows || cx < 0 || cx >= cols) return;
    if (!over && grid[cy][cx] !== ' ') return;
    grid[cy][cx] = ch;
  };

  // 1) Silueta de la huella (rombo isométrico) y caja de la rejilla, de fondo.
  if (opts.iso) {
    const cx = gw / 2, cy = h;                        // centro de la huella: el
    const a = gw / 2, b = (gh * ISO_RATIO) / 2;       // art apoya en la fila de abajo
    for (let y = 0; y < rows * step; y++) {
      for (let x = 0; x < cols * step; x++) {
        const dx = Math.abs(x - cx) / a, dy = Math.abs(y - cy) / b;
        if (dx + dy <= 1) put(x, y, '·', false);
      }
    }
  }
  for (let x = 0; x < gw; x += step) { put(x, 0, '-', true); put(x, h - 1, '-', true); }
  for (let y = 0; y < h; y += step) { put(0, y, '|', true); put(gw - 1, y, '|', true); }

  // 2) El arte, encima.
  for (const p of pixels) {
    if (!p || !p[2]) continue;
    put(p[0], p[1], charFor(p[2]), true);
  }

  const cab = `=== ${name}  →  rejilla ${gw}×${gh} · arte ${w}×${h} px` +
    (w > gw ? ` (sobresale ${w - gw} px a la derecha)` : '') +
    (h > gh ? ` (sobresale ${h - gh} px hacia arriba)` : '');
  console.log(cab);
  console.log(grid.map(r => r.join('')).join('\n'));
  console.log('');
}

function main() {
  const argv = process.argv.slice(2);
  let step = 1;
  let iso = false;
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--step') { step = Number(argv[++i]) || 1; continue; }
    if (a === '--iso') { iso = true; continue; }
    if (a === '--list') {
      const icons = load();
      console.log(Object.keys(icons).join('\n'));
      return;
    }
    names.push(a);
  }
  const icons = load();
  if (!names.length) names.push('house');
  for (const n of names) {
    const def = icons[n];
    if (!def) { console.log('No existe el sprite: ' + n); continue; }
    printSprite(n, def, { step, iso });
  }
}

main();
