// engine/tree-art.js
// ─────────────────────────────────────────────────────────────────────────────
// Árboles del mundo: arte pixel-art GENERADO + dibujado con balanceo de viento.
//
// Por qué generado y no dibujado a mano árbol por árbol: el bosque del mapa son
// miles de árboles y hay varias especies. Un generador determinista (semilla por
// especie) da variedad sin repetir, mantiene la MISMA paleta en todos y, al ser
// código puro, se puede ejecutar también desde Node (`tools/build-trees.js`)
// para volcar los mismos sprites a `data/entity-pixels.json` (así el editor de
// píxeles, los árboles-entidad y el bosque del mapa usan el mismo arte).
//
// Estilo (el del resto del juego): píxeles gordos, contorno oscuro, tres verdes
// más un brillo, luz desde arriba-izquierda, tronco con dos tonos y raíces.
//
// Índices de la lista (los que espera el motor):
//   0 árbol ancho · 1 árbol alto · 2 conífera · 3 olivo/sauce · 4 arbolillo
//   5 seto · 6 manojo de hierba
// ─────────────────────────────────────────────────────────────────────────────

const PALETTES = {
  broad:   { outline: '#16331C', dark: '#1E4A24', mid: '#4F8A3A', light: '#78B657', hi: '#9ED46E', trunk: '#4B2E18', trunkLo: '#6B4526' },
  tall:    { outline: '#173420', dark: '#22502C', mid: '#548F3E', light: '#7FBC5C', hi: '#A8DA7A', trunk: '#4B2E18', trunkLo: '#6B4526' },
  conifer: { outline: '#0F2A18', dark: '#1B4528', mid: '#2F6B38', light: '#468C48', hi: '#63A85C', trunk: '#3A2413', trunkLo: '#573A20' },
  olive:   { outline: '#2A3A1C', dark: '#3F5420', mid: '#5F7A2E', light: '#86A445', hi: '#A9C263', trunk: '#4A3620', trunkLo: '#6A4E2C' },
  bush:    { outline: '#1A3A20', dark: '#26512B', mid: '#3F7A38', light: '#5C9E48', hi: '#7CBC62', trunk: '#4B2E18', trunkLo: '#6B4526' }
};

// RNG determinista (mulberry32): la misma semilla da siempre el mismo árbol.
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rasteriza una lista de elipses en una rejilla dispersa (clave "x,y").
function blobCells(blobs, W, H) {
  const cells = new Map();
  for (const b of blobs) {
    const x0 = Math.max(0, Math.floor(b.cx - b.rx)), x1 = Math.min(W - 1, Math.ceil(b.cx + b.rx));
    const y0 = Math.max(0, Math.floor(b.cy - b.ry)), y1 = Math.min(H - 1, Math.ceil(b.cy + b.ry));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - b.cx) / b.rx, dy = (y - b.cy) / b.ry;
        if (dx * dx + dy * dy <= 1) cells.set(x + ',' + y, true);
      }
    }
  }
  return cells;
}

// Colorea una silueta: contorno oscuro de la SILUETA (no de los claros),
// degradado vertical (más claro arriba) con un empujón de luz hacia la izquierda
// y algunos claros entre hojas (sin contornear, si no se llena de ruido).
function shade(done, cells, pal, W, H, rand, opts = {}) {
  const solid = opts.solid || null;
  const has = (x, y) => cells.has(x + ',' + y) || (solid ? solid.has(x + ',' + y) : false);
  const top = new Array(W).fill(Infinity);
  const bot = new Array(W).fill(-Infinity);
  cells.forEach((_v, key) => {
    const [x, y] = key.split(',').map(Number);
    if (y < top[x]) top[x] = y;
    if (y > bot[x]) bot[x] = y;
  });
  const holeChance = opts.holes == null ? 0.05 : opts.holes;
  let cx = 0, n = 0;
  for (let x = 0; x < W; x++) { if (isFinite(top[x])) { cx += x; n++; } }
  cx = n ? cx / n : W / 2;
  cells.forEach((_v, key) => {
    const [x, y] = key.split(',').map(Number);
    const isEdge = !has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1)
      || !has(x - 1, y - 1) || !has(x + 1, y - 1) || !has(x - 1, y + 1) || !has(x + 1, y + 1);
    if (isEdge) { done.push([x, y, pal.outline]); return; }
    const span = Math.max(1, bot[x] - top[x]);
    let t = (y - top[x]) / span;
    if (x < cx) t -= 0.08;                 // luz desde arriba-izquierda
    const color = t < 0.16 ? pal.hi : t < 0.4 ? pal.light : t < 0.72 ? pal.mid : pal.dark;
    if (rand() < holeChance) return;        // claros entre hojas (sin contorno)
    done.push([x, y, color]);
  });
}

// Tronco: dos columnas (izquierda clara, derecha oscura) y raíces al pie.
// `solid` (opcional) acumula las celdas ocupadas para que la copa no se contornee
// contra el tronco y quede una banda oscura en la unión.
function trunkPixels(done, cx, topY, bottomY, thickness, pal, roots, solid) {
  for (let y = topY; y <= bottomY; y++) {
    for (let i = 0; i < thickness; i++) {
      const x = cx + i;
      const color = i === 0 ? pal.trunkLo : pal.trunk;
      done.push([x, y, color]);
      if (solid) solid.add(x + ',' + y);
    }
    if (roots && y === bottomY) {
      done.push([cx - 1, y, pal.trunk]);
      done.push([cx + thickness, y, pal.dark]);
      if (solid) { solid.add((cx - 1) + ',' + y); solid.add((cx + thickness) + ',' + y); }
    }
  }
}

// ── Especies ────────────────────────────────────────────────────────────────

function makeBroad(seed) {
  const rand = rng(seed);
  const W = 13, H = 16;
  const cx = 6, topY = 7, botY = 14;
  const done = [];
  const solid = new Set();
  trunkPixels(done, cx - 1, topY, botY, 2, PALETTES.broad, true, solid);
  const blobs = [
    { cx: cx - 2.2, cy: 4.4, rx: 4.0, ry: 3.8 },
    { cx: cx + 2.0, cy: 4.7, rx: 3.8, ry: 3.6 },
    { cx: cx - 0.2, cy: 2.6, rx: 3.4, ry: 3.0 },
    { cx: cx + 3.6, cy: 7.6, rx: 2.3, ry: 2.1 },
    { cx: cx - 3.8, cy: 7.8, rx: 2.1, ry: 2.0 }
  ];
  const cells = blobCells(blobs, W, H);
  shade(done, cells, PALETTES.broad, W, H, rand, { holes: 0.05, solid });
  return { pixels: done, w: W, h: H };
}

function makeTall(seed) {
  const rand = rng(seed);
  const W = 9, H = 19;
  const cx = 4, topY = 12, botY = 17;
  const done = [];
  const solid = new Set();
  trunkPixels(done, cx, topY, botY, 2, PALETTES.tall, true, solid);
  const blobs = [
    { cx: cx, cy: 3.2, rx: 2.6, ry: 3.0 },
    { cx: cx, cy: 6.4, rx: 3.2, ry: 3.2 },
    { cx: cx, cy: 9.8, rx: 3.0, ry: 2.8 },
    { cx: cx - 2.4, cy: 7.6, rx: 1.6, ry: 1.8 },
    { cx: cx + 2.4, cy: 8.2, rx: 1.6, ry: 1.8 }
  ];
  const cells = blobCells(blobs, W, H);
  shade(done, cells, PALETTES.tall, W, H, rand, { holes: 0.05, solid });
  return { pixels: done, w: W, h: H };
}

function makeConifer(seed) {
  const rand = rng(seed);
  const W = 15, H = 20;
  const cx = 7, topY = 16, botY = 18;
  const done = [];
  const solid = new Set();
  trunkPixels(done, cx - 1, topY, botY, 2, PALETTES.conifer, true, solid);
  const cells = new Map();
  // Un solo triángulo con TRES faldas (cada 5 filas el ancho salta un píxel):
  // se lee como abeto y no deja filas enteras de contorno.
  const rows = 15;
  const maxHalf = 6;
  for (let y = 0; y <= rows; y++) {
    const p = y / rows;
    let half = 0.45 + p * (maxHalf - 0.45);
    if ((y + 1) % 5 === 0) half += 1;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) cells.set(x + ',' + y, true);
  }
  shade(done, cells, PALETTES.conifer, W, H, rand, { holes: 0.02, solid });
  return { pixels: done, w: W, h: H };
}

function makeOlive(seed) {
  const rand = rng(seed);
  const W = 15, H = 16;
  const cx = 7, topY = 9, botY = 14;
  const done = [];
  const solid = new Set();
  trunkPixels(done, cx - 1, topY, botY, 2, PALETTES.olive, true, solid);
  // Tronco que se abre en dos hacia la copa
  [[cx - 3, topY - 1, PALETTES.olive.trunk], [cx - 3, topY - 2, PALETTES.olive.trunkLo],
   [cx + 2, topY - 1, PALETTES.olive.trunk], [cx + 2, topY - 2, PALETTES.olive.trunkLo]].forEach(([x, y, col]) => {
    done.push([x, y, col]); solid.add(x + ',' + y);
  });
  const blobs = [
    { cx: cx - 2.8, cy: 4.8, rx: 4.0, ry: 3.4 },
    { cx: cx + 2.6, cy: 5.0, rx: 3.8, ry: 3.3 },
    { cx: cx, cy: 3.6, rx: 3.4, ry: 2.8 }
  ];
  const cells = blobCells(blobs, W, H);
  shade(done, cells, PALETTES.olive, W, H, rand, { holes: 0.05, solid });
  return { pixels: done, w: W, h: H };
}

function makeSapling(seed) {
  const rand = rng(seed);
  const W = 9, H = 12;
  const cx = 4, topY = 6, botY = 10;
  const done = [];
  const solid = new Set();
  trunkPixels(done, cx, topY, botY, 1, PALETTES.bush, true, solid);
  const blobs = [
    { cx: cx - 1.0, cy: 3.8, rx: 2.9, ry: 2.7 },
    { cx: cx + 1.6, cy: 4.4, rx: 2.4, ry: 2.2 }
  ];
  const cells = blobCells(blobs, W, H);
  shade(done, cells, PALETTES.bush, W, H, rand, { holes: 0.05, solid });
  return { pixels: done, w: W, h: H };
}

function makeBush(seed) {
  const rand = rng(seed);
  const W = 11, H = 7;
  const cx = 5;
  const done = [];
  const blobs = [
    { cx: cx - 2.0, cy: 3.4, rx: 3.2, ry: 2.4 },
    { cx: cx + 2.2, cy: 3.6, rx: 2.8, ry: 2.2 },
    { cx: cx, cy: 2.6, rx: 2.4, ry: 1.8 }
  ];
  const cells = blobCells(blobs, W, H);
  shade(done, cells, PALETTES.bush, W, H, rand, { holes: 0.08 });
  return { pixels: done, w: W, h: H };
}

function makeGrassTuft(seed) {
  const rand = rng(seed);
  const W = 6, H = 5;
  const done = [];
  const pal = PALETTES.bush;
  const blades = [
    [1, [1, 2, 3, 4]], [3, [0, 1, 2, 3]], [4, [1, 2, 3]]
  ];
  for (const [x, ys] of blades) {
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      const color = i === 0 ? pal.hi : i === 1 ? pal.light : i === 2 ? pal.mid : pal.dark;
      done.push([x, y, color]);
      if (rand() < 0.4) done.push([x + 1, y, pal.mid]);
    }
  }
  return { pixels: done, w: W, h: H };
}

// Los 7 sprites, en el orden que espera el motor.
export function buildTreeTemplates() {
  return [
    makeBroad(11), makeTall(23), makeConifer(37), makeOlive(53),
    makeSapling(71), makeBush(89), makeGrassTuft(101)
  ];
}

// Paletas por especie (las usa también `tools/build-trees.js` para previsualizar).
export const TREE_PALETTES = PALETTES;
export const TREE_KIND_PALETTE = ['broad', 'tall', 'conifer', 'olive', 'bush', 'bush', 'bush'];
export const TREE_KIND_NAME = ['arbol ancho', 'arbol alto', 'conifera', 'olivo/sauce', 'arbolillo', 'seto', 'hierba'];

// ── Dibujado ────────────────────────────────────────────────────────────────

// Cuánto se dobla la copa (en píxeles de ARTE de arriba a abajo).
export const TREE_SWAY_BUCKETS = [-2, -1, 0, 1, 2];

// Caché de árboles pre-renderizados con el balanceo YA aplicado.
// Un bosque son cientos de árboles por fotograma: dibujarlos píxel a píxel
// costaba ~6 ms de los 16 ms del fotograma (medido con `MESO.perf.sections()`).
// Aquí cada plantilla se pinta una vez por fase de viento en un lienzo al tamaño
// del arte y luego cada árbol es UN drawImage escalado (nítido, sin suavizado).
const _swayCache = new WeakMap();   // tpl (array de píxeles) -> Map("bucket|w|h", {canvas, pad})

export function treeSwayBitmap(tpl, tplKey, bucket) {
  try {
    if (!tpl || !tpl.length) return null;
    let perTpl = _swayCache.get(tpl);
    if (!perTpl) { perTpl = new Map(); _swayCache.set(tpl, perTpl); }
    const key = bucket + '|' + (tplKey || 0);
    const hit = perTpl.get(key);
    if (hit) return hit;
    let maxX = 0, maxY = 0;
    for (const p of tpl) { if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
    const pad = 2;                                   // margen para el doblez
    const cv = document.createElement('canvas');
    cv.width = maxX + 1 + pad * 2;
    cv.height = maxY + 1;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (const p of tpl) {
      if (!p || !p[2]) continue;
      const off = Math.round(bucket * ((maxY - p[1]) / Math.max(1, maxY)));
      c.fillStyle = p[2];
      c.fillRect(p[0] + pad + off, p[1], 1, 1);
    }
    const rec = { canvas: cv, pad };
    perTpl.set(key, rec);
    return rec;
  } catch (e) { return null; }
}

// Dibuja un árbol meciéndose: la BASE queda clavada y cada fila se desplaza más
// cuanto más alta está (la copa se dobla, no se mueve en bloque).
// opts: { bend (píxeles en la copa), scale }
export function drawTreePixels(ctx, tpl, sx, sy, scale, opts = {}) {
  if (!tpl || !tpl.pixels) return;
  const bend = Number(opts.bend) || 0;
  const s = Math.max(0.4, Number(scale) || 1);
  const cell = Math.max(1, Math.round(s));
  const maxY = Math.max(1, (tpl.h || 1) - 1);
  const px = tpl.pixels;
  for (let i = 0; i < px.length; i++) {
    const p = px[i];
    if (!p || !p[2]) continue;
    const off = bend ? bend * ((maxY - p[1]) / maxY) : 0;
    ctx.fillStyle = p[2];
    ctx.fillRect(Math.round(sx + p[0] * s + off), Math.round(sy + p[1] * s), cell, cell);
  }
}

// Fase de balanceo por celda (para que no se muevan todas a la vez).
export function treeSwayPhase(col, row) {
  const v = (col * 73856093) ^ (row * 19349663);
  return ((v >>> 0) % 628) / 100;
}

// Desplazamiento (en píxeles) de la copa en este instante.
export function treeSwayBend(col, row, now, wind, amplitude) {
  const phase = treeSwayPhase(col, row);
  const amp = (Number(amplitude) || 2) * (Number(wind) || 1);
  const t = (now || Date.now()) * 0.0016;
  return Math.sin(t + phase) * amp;
}
