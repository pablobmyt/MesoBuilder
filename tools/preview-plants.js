// tools/preview-plants.js
// ─────────────────────────────────────────────────────────────────────────────
// Imprime en ASCII las fases del TRIGO que genera `engine/plant-art.js`, para
// retocar el arte sin abrir el juego.
//
// Uso:  node tools/preview-plants.js
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'engine', 'plant-art.js');

function load() {
  const body = fs.readFileSync(SRC, 'utf8').replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(body + '\nreturn { buildWheatStages, wheatSpriteKey, WHEAT_STAGE_NAMES };')();
}

const CHARS = {
  '#6FA644': 'g', '#4E7C2F': 'G', '#7FB44A': 'l',
  '#5F9139': 'g', '#3E6B25': 'G',
  '#8FBF53': 'e', '#6A9C38': 'E',
  '#C8A84B': 'w', '#8B6914': 'W', '#B48F3A': 'y',
  '#E0C06A': 'o', '#A67C2A': 'O'
};

function ascii(stage) {
  const g = [];
  for (let y = 0; y < stage.h; y++) g.push(new Array(stage.w).fill('.'));
  for (const p of stage.pixels) {
    if (p[1] >= 0 && p[1] < stage.h && p[0] >= 0 && p[0] < stage.w) {
      g[p[1]][p[0]] = CHARS[String(p[2]).toUpperCase()] || '?';
    }
  }
  return g.map(r => r.join('')).join('\n');
}

const api = load();
const stages = api.buildWheatStages();
stages.forEach((s, i) => {
  console.log(`\n== ${api.wheatSpriteKey(i)} (${api.WHEAT_STAGE_NAMES[i]}) ${s.w}x${s.h} - ${s.pixels.length} pixeles`);
  console.log(ascii(s));
});
