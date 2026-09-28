// tools/audit-sprites.js
// ─────────────────────────────────────────────────────────────────────────────
// Auditoría del pixel-art: detecta los dos defectos que se ven al jugar.
//
//   1. HUECOS INTERNOS: píxeles transparentes encerrados dentro de la silueta.
//      Al dibujarse sobre el terreno, el fondo asoma por ahí y el edificio
//      parece "agujereado" (el caso del zigurat o del redil).
//   2. DENSIDAD: píxeles de arte por celda de mapa. Lo correcto es 4 (= mismo
//      tamaño de píxel que las casas). Si es mucho menor, al escalar el sprite
//      a su huella cada píxel de arte se vuelve un bloque enorme (mosaico); si
//      es mucho mayor, el sprite se dibuja diminuto dentro de su caja y deja
//      ver el fondo alrededor.
//
// Uso:
//   node tools/audit-sprites.js            informa
//   node tools/audit-sprites.js --strict   sale con código 1 si hay defectos
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const icons = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'entity-pixels.json'), 'utf8')).icons;
const engine = fs.readFileSync(path.join(ROOT, 'engine', 'game-engine.js'), 'utf8');

// ── 1. Huecos internos ──────────────────────────────────────────────────────
// Se inunda desde el borde: lo que quede transparente sin alcanzar es un hueco.
function internalHoles(def) {
  const gw = def.gridW || def.grid, gh = def.gridH || def.grid;
  const set = new Set((def.pixels || []).map(p => p[0] + ',' + p[1]));
  const opaque = (x, y) => set.has(x + ',' + y);
  const seen = new Set();
  const queue = [];
  const push = (x, y) => {
    const k = x + ',' + y;
    if (x < 0 || y < 0 || x >= gw || y >= gh || seen.has(k) || opaque(x, y)) return;
    seen.add(k); queue.push([x, y]);
  };
  for (let x = 0; x < gw; x++) { push(x, 0); push(x, gh - 1); }
  for (let y = 0; y < gh; y++) { push(0, y); push(gw - 1, y); }
  while (queue.length) {
    const [x, y] = queue.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  let holes = 0;
  const samples = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (opaque(x, y) || seen.has(x + ',' + y)) continue;
      holes++;
      if (samples.length < 4) samples.push([x, y]);
    }
  }
  return { holes, gw, gh, samples };
}

// ── 2. Densidad por edificio ────────────────────────────────────────────────
// Huellas de BUILDINGS + tabla de alias de resolveBuildingSpriteKey.
function buildingFootprints() {
  const out = {};
  const reB = /BUILDINGS\.(\w+)\s*=\s*\{([\s\S]*?)\};/g;
  let m;
  while ((m = reB.exec(engine))) {
    const s = /size\s*:\s*\{\s*w\s*:\s*(\d+)\s*,\s*h\s*:\s*(\d+)\s*\}/.exec(m[2]);
    out[m[1]] = s ? { w: +s[1], h: +s[2] } : { w: 1, h: 1 };
  }
  // El catálogo base también está como objeto literal (`const BUILDINGS = {…}`):
  // sin esto los edificios de serie (casa, templo, zigurat…) no se auditaban.
  const lit = /const BUILDINGS = \{([\s\S]*?)\n\};/.exec(engine);
  if (lit) {
    const reEntry = /(\w+)\s*:\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let e;
    while ((e = reEntry.exec(lit[1]))) {
      const s = /size\s*:\s*\{\s*w\s*:\s*(\d+)\s*,\s*h\s*:\s*(\d+)\s*\}/.exec(e[2]);
      if (s) out[e[1]] = { w: +s[1], h: +s[2] };
    }
  }
  return out;
}

function aliases() {
  const out = {};
  const block = /const aliases = \{([\s\S]*?)\};/.exec(engine);
  if (!block) return out;
  const reA = /(\w+)\s*:\s*'([^']+)'/g;
  let a;
  while ((a = reA.exec(block[1]))) out[a[1]] = a[2];
  return out;
}

// Tipos que NO se dibujan como un sprite escalado a su huella: suelo con
// textura (road), sprites por orientación o por retícula (murallas, complejo
// metalúrgico) y objetos de mobiliario, que se dibujan con tamaño fijo.
const DRAWN_SPECIALLY = new Set(['road', 'concrete_road', 'wall_segment', 'wall_tower', 'steel_foundry', 'soviet_streetlight']);

const alias = aliases();
const sizes = buildingFootprints();
const DENSITY = 4;

const holes = [];
for (const [name, def] of Object.entries(icons)) {
  const r = internalHoles(def);
  if (!r.holes) continue;
  // Los iconos de inventario se dibujan centrados en su recuadro: sus huecos
  // (el guardamonte de la pistola) son parte del dibujo, no un defecto.
  const isItem = (def.gridW || def.grid) >= 27;
  if (isItem) continue;
  holes.push({ name, ...r });
}

const density = [];
for (const [type, sz] of Object.entries(sizes)) {
  if (DRAWN_SPECIALLY.has(type)) continue;
  const key = icons[type] ? type : (alias[type] && icons[alias[type]] ? alias[type] : null);
  if (!key) { density.push({ type, huella: `${sz.w}x${sz.h}`, problema: 'sin sprite (se dibuja sólo su sombra)' }); continue; }
  const def = icons[key];
  const gw = def.gridW || def.grid, gh = def.gridH || def.grid;
  const factor = Math.min(gw / sz.w, gh / sz.h) / DENSITY;
  // El repertorio va refinado ×8 (densidad 32 px de arte por celda) para que el
  // motor pueda REDUCIRLO al tamaño del solar con grano fino, así que el rango
  // acepta hasta 9 (el tope del refinado) y sigue avisando de los sprites
  // heredados que se quedan en densidad 4 o menos.
  if (factor < 0.8 || factor > 9.0) {
    density.push({
      type, sprite: key, huella: `${sz.w}x${sz.h}`, arte: `${gw}x${gh}`,
      esperado: `${sz.w * DENSITY}x${sz.h * DENSITY}`, factor: +factor.toFixed(2)
    });
  }
}

// ── 3. Silueta maciza dentro de la huella ───────────────────────────────────
// Los edificios monumentales se dibujan sobre el terreno y el sprite tapa TODA
// su huella (el arte puede sobresalir hacia arriba, pero no dejar huecos): si
// deja transparencias dentro de la caja, el suelo asoma y el edificio se ve
// "transparente". Los edificios con patio (pozos, rediles) quedan exentos.
const MUST_BE_SOLID = new Set(['ziggurat']);
const hollow = [];
for (const type of MUST_BE_SOLID) {
  const sz = sizes[type];
  const key = icons[type] ? type : (alias[type] && icons[alias[type]] ? alias[type] : null);
  if (!sz || !key) { hollow.push({ type, nota: 'sin huella o sin sprite' }); continue; }
  const def = icons[key];
  const gw = def.gridW || def.grid, gh = def.gridH || def.grid;
  const set = new Set((def.pixels || []).map(p => p[0] + ',' + p[1]));
  const boxH = Math.min(gh, sz.h * DENSITY);
  const y0 = gh - boxH;
  let n = 0; const samples = [];
  for (let y = y0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (set.has(x + ',' + y)) continue;
      n++;
      if (samples.length < 4) samples.push([x, y + ' (fila ' + y + ')']);
    }
  }
  if (n) hollow.push({ type, arte: `${gw}x${gh}`, huella: `${sz.w}x${sz.h}`, huecos: n, samples });
}

console.log('Iconos: ' + Object.keys(icons).length + ' · edificios: ' + Object.keys(sizes).length);
console.log('Huecos internos (transparencias dentro de la silueta): ' + holes.length);
holes.forEach(h => console.log('  ' + h.name.padEnd(26) + h.gw + 'x' + h.gh + '  huecos=' + h.holes + '  p.ej. ' + JSON.stringify(h.samples[0])));
console.log('Densidad de arte fuera de rango (esperado ≈' + DENSITY + ' px por celda): ' + density.length);
density.forEach(d => console.log('  ' + d.type.padEnd(26) + 'huella ' + d.huella.padEnd(7) + (d.arte ? 'arte ' + d.arte.padEnd(8) + 'esperado ' + d.esperado.padEnd(8) + 'factor ' + d.factor : d.problema)));
console.log('Siluetas que dejan ver el suelo dentro de su huella: ' + hollow.length);
hollow.forEach(h => console.log('  ' + h.type.padEnd(26) + (h.nota || ('arte ' + h.arte.padEnd(8) + 'huella ' + h.huella.padEnd(7) + 'huecos ' + h.huecos + '  p.ej. ' + JSON.stringify(h.samples[0])))));

const bad = holes.length + density.length + hollow.length;
if (strict && bad) { console.log('\n--strict: hay ' + bad + ' defectos de arte.'); process.exitCode = 1; }
else if (!bad) console.log('\nArte correcto.');
