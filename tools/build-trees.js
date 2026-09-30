// tools/build-trees.js
// ─────────────────────────────────────────────────────────────────────────────
// Vuelca los árboles generados por `engine/tree-art.js` a
// `data/entity-pixels.json` (claves tree0..tree6), que es de donde el motor lee
// las plantillas del bosque y los sprites de los árboles-entidad. Así el arte
// vive en UN solo sitio (el generador) y el JSON es sólo su volcado.
//
// El generador es un módulo ES (lo importa el motor desde el navegador), así que
// aquí se evalúa quitando la palabra `export`: es un fichero puro, sin imports.
//
// Uso:  node tools/build-trees.js [--dry] [--preview]
//   --preview  dibuja los árboles en ASCII por consola (para revisarlos)
//   --dry      no escribe nada, sólo dice qué cambiaría
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(ROOT, 'engine', 'tree-art.js');
const PIXELS_JSON = path.join(ROOT, 'data', 'entity-pixels.json');
const dry = process.argv.includes('--dry');
const preview = process.argv.includes('--preview');

// Carga el módulo ES del generador como CommonJS sin duplicar el arte.
function loadGenerator() {
  const src = fs.readFileSync(GENERATOR, 'utf8');
  const body = src.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(body + '\nreturn { buildTreeTemplates, drawTreePixels, treeSwayPhase, treeSwayBend, TREE_PALETTES, TREE_KIND_PALETTE, TREE_KIND_NAME };')();
}

// Reemplaza el bloque de una clave del JSON respetando el formato del fichero.
function replaceBlock(text, key, block) {
  const start = text.indexOf('"' + key + '": {');
  if (start < 0) return null;
  const braceStart = text.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {                       // saltar cadenas
      i++;
      while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; i++; }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  return text.slice(0, start) + block + text.slice(end + 1);
}

// Bloque del JSON con el formato del fichero (6 píxeles por línea, 8 espacios).
function blockFor(key, tpl) {
  const grid = Math.max(tpl.w, tpl.h);
  const PER = 6;
  const rows = [];
  for (let i = 0; i < tpl.pixels.length; i += PER) {
    rows.push('        ' + tpl.pixels.slice(i, i + PER)
      .map(p => '[' + p[0] + ',' + p[1] + ',"' + p[2] + '"]').join(','));
  }
  return '"' + key + '": {\n      "grid": ' + grid + ',\n      "pixels": [\n' +
    rows.join(',\n') + '\n      ]\n    }';
}

// Vista ASCII: una letra por familia de color, para revisar la silueta.
function ascii(tpl, pal) {
  const map = {};
  map[pal.outline] = '#'; map[pal.dark] = '2'; map[pal.mid] = '3';
  map[pal.light] = '4'; map[pal.hi] = '5';
  map[pal.trunk] = 'T'; map[pal.trunkLo] = 't';
  const grid = [];
  for (let y = 0; y < tpl.h; y++) grid.push(new Array(tpl.w).fill('.'));
  for (const p of tpl.pixels) {
    if (p[0] >= 0 && p[0] < tpl.w && p[1] >= 0 && p[1] < tpl.h) grid[p[1]][p[0]] = map[p[2]] || '?';
  }
  return grid.map(r => r.join('')).join('\n');
}

function main() {
  const gen = loadGenerator();
  const templates = gen.buildTreeTemplates();
  const keys = ['tree0', 'tree1', 'tree2', 'tree3', 'tree4', 'tree5', 'tree6'];

  templates.forEach((tpl, i) => {
    const nombre = (gen.TREE_KIND_NAME && gen.TREE_KIND_NAME[i]) || keys[i];
    console.log(keys[i] + ' (' + nombre + '): ' + tpl.w + 'x' + tpl.h + ' - ' + tpl.pixels.length + ' pixeles');
    if (preview) {
      const palName = (gen.TREE_KIND_PALETTE && gen.TREE_KIND_PALETTE[i]) || 'broad';
      console.log(ascii(tpl, (gen.TREE_PALETTES && gen.TREE_PALETTES[palName]) || {}));
    }
  });
  if (preview) return;

  let text = fs.readFileSync(PIXELS_JSON, 'utf8');
  const eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';   // conservar el fin de línea del fichero
  let cambios = 0;
  templates.forEach((tpl, i) => {
    const next = replaceBlock(text, keys[i], blockFor(keys[i], tpl));
    if (next == null) { console.warn('  aviso: no se encontro ' + keys[i] + ' en entity-pixels.json'); return; }
    text = next;
    cambios++;
  });
  if (dry) { console.log('--dry: habría actualizado ' + cambios + ' árboles'); return; }
  fs.writeFileSync(PIXELS_JSON, text.replace(/\r?\n/g, eol), 'utf8');
  console.log('entity-pixels.json actualizado (' + cambios + ' árboles)');
}

main();
