// tools/preview-animals.js
// ─────────────────────────────────────────────────────────────────────────────
// Dibuja en ASCII los animales de `engine/animal-art.js` para revisar el arte y
// la animación sin abrir el juego (los dos fotogramas que se imprimen son el
// principio y la mitad del ciclo, que es donde más se nota).
//
// Uso:  node tools/preview-animals.js [conejo zorro perro lobo] [estado]
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'engine', 'animal-art.js');

const src = fs.readFileSync(MODULE, 'utf8').replace(/^export\s+/gm, '');
// eslint-disable-next-line no-new-func
const art = new Function(src + '\nreturn { animalPixelsFor, ANIMAL_KINDS };')();

const args = process.argv.slice(2);
const estados = ['idle', 'walk', 'run'];
const pedidos = args.filter(a => art.ANIMAL_KINDS.indexOf(a) >= 0);
const kinds = pedidos.length ? pedidos : art.ANIMAL_KINDS;

// Color → carácter legible
function charFor(color, pal) {
  if (color === pal.outline) return '#';
  if (color === pal.eye) return 'o';
  if (color === pal.nose) return 'n';
  if (color === pal.paw) return '=';
  if (color === pal.tail) return 'w';
  if (color === pal.light) return 'L';
  if (color === pal.mid) return 'M';
  if (color === pal.dark) return 'D';
  return '?';
}

function printAnimal(kind, estado) {
  const fases = [0, 0.25, 0.5, 0.75];
  const render = fases.map(f => {
    const { w, h, pixels, pal } = art.animalPixelsFor(kind, estado, f);
    const grid = [];
    for (let y = 0; y < h; y++) grid.push(new Array(w).fill('.'));
    for (const p of pixels) grid[p[1]][p[0]] = charFor(p[2], pal);
    return grid.map(r => r.join(''));
  });
  console.log('== ' + kind + ' · ' + estado + ' ==');
  for (let y = 0; y < render[0].length; y++) {
    console.log(render.map(f => f[y]).join('   '));
  }
  console.log('');
}

for (const kind of kinds) {
  for (const estado of estados) printAnimal(kind, estado);
}
