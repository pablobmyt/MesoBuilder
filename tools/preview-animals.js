// tools/preview-animals.js
// ─────────────────────────────────────────────────────────────────────────────
// Dibuja en ASCII los animales de `engine/animal-art.js` para revisar el arte y
// la animación sin abrir el juego.
//
// Uso:
//   node tools/preview-animals.js                       todos, idle/walk/run
//   node tools/preview-animals.js horse                 sólo el caballo
//   node tools/preview-animals.js horse "walk,trot,gallop,rear,neigh" --una
//   node tools/preview-animals.js horse gallop --vertical   fases apiladas
//   node tools/preview-animals.js horse rear --fase 0.5     una fase concreta
//
// `--una` imprime sólo la primera fase de cada estado (para ver muchos estados
// de golpe) y `--vertical` apila las fases en vez de ponerlas en paralelo (el
// caballo mide 40 px de ancho y cuatro fases no caben en la consola). OJO: las
// poses fuertes (encabritarse, relinchar…) son envolventes que empiezan y acaban
// en 0, así que la FASE 0 ES LA POSE NEUTRA: para verlas hay que pedir ~0,5.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'engine', 'animal-art.js');

const src = fs.readFileSync(MODULE, 'utf8').replace(/^export\s+/gm, '');
// eslint-disable-next-line no-new-func
const art = new Function(src + '\nreturn { animalPixelsFor, ANIMAL_KINDS };')();

const args = process.argv.slice(2);
const ESTADOS_CONOCIDOS = ['idle', 'walk', 'trot', 'run', 'gallop', 'neigh', 'rear', 'paw', 'graze', 'drink', 'shake', 'lie', 'hurt', 'dead'];
const pedidos = args.filter(a => art.ANIMAL_KINDS.indexOf(a) >= 0);
const kinds = pedidos.length ? pedidos : art.ANIMAL_KINDS;
const estadosArg = args.filter(a => a.indexOf('--') !== 0 && ESTADOS_CONOCIDOS.indexOf(a.split(',')[0]) >= 0);
const estados = [];
for (const e of (estadosArg.length ? estadosArg : ['idle,walk,run'])) for (const s of e.split(',')) if (s) estados.push(s);
const unaSola = args.includes('--una');
const vertical = args.includes('--vertical');
// Fase concreta (0..1): las poses fuertes son envolventes y en la fase 0 se ven
// en su posición neutra.
let fasePedida = null;
{
  const i = args.indexOf('--fase');
  if (i >= 0 && args[i + 1] !== undefined) fasePedida = Number(args[i + 1]);
}

// Color → carácter legible
function charFor(color, pal) {
  if (color === pal.outline) return '#';
  if (color === pal.eye) return 'o';
  if (color === pal.nose) return 'n';
  if (color === pal.paw) return '=';
  if (color === pal.tail) return 'w';
  if (color === pal.mane) return 'm';
  if (color === pal.hoof) return 'H';
  if (color === pal.light) return 'L';
  if (color === pal.mid) return 'M';
  if (color === pal.dark) return 'D';
  return '?';
}

function gridDe(kind, estado, fase) {
  const { w, h, pixels, pal } = art.animalPixelsFor(kind, estado, fase);
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(new Array(w).fill('.'));
  for (const p of pixels) grid[p[1]][p[0]] = charFor(p[2], pal);
  return grid.map(r => r.join(''));
}

for (const kind of kinds) {
  for (const estado of estados) {
    const fases = fasePedida == null ? (unaSola ? [0] : [0, 0.25, 0.5, 0.75]) : [fasePedida];
    const renders = fases.map(f => gridDe(kind, estado, f));
    console.log('== ' + kind + ' :: ' + estado + (unaSola ? '' : ' :: fases ' + fases.join('/')) + ' ==');
    if (vertical) {
      renders.forEach((r, i) => {
        console.log('-- fase ' + fases[i] + ' --');
        r.forEach(l => console.log(l));
      });
    } else {
      const alto = renders[0].length;
      for (let y = 0; y < alto; y++) console.log(renders.map(f => f[y]).join('   '));
    }
    console.log('');
  }
}
