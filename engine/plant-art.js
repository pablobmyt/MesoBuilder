/**
 * Arte de las plantas cultivadas: TRIGO por fases de crecimiento
 * ---------------------------------------------------------------------------
 * Mismo espiritu que `tree-art.js` y `animal-art.js`: el arte se GENERA con
 * codigo en vez de vivir como una rejilla suelta en el JSON, asi que crece con
 * el juego y se puede retocar de un vistazo con `node tools/preview-plants.js`
 * (que lo imprime en ASCII).
 *
 * Cuatro fases, pensadas para que el cambio se VEA en el mapa:
 *   0 semillas     : terrón de tierra volteada con los granos a la vista y dos briznas
 *   1 tallos verdes: ya se distinguen los tallos y las hojas
 *   2 espigando    : los tallos se doblan y asoman las espigas verdes
 *   3 maduro       : espigas doradas, el tallo se vence hacia un lado
 *
 * El motor registra estos sprites en `ENTITY_PIXEL_LIBRARY` al arrancar, asi que
 * los dibuja con el camino normal (bitmap cacheado + balanceo por viento).
 */

// Paletas: verdes para las fases tempranas, dorados para la espiga madura.
const P = {
  sprout: { stem: '#6FA644', stemLo: '#4E7C2F', leaf: '#7FB44A' },
  green:  { stem: '#5F9139', stemLo: '#3E6B25', leaf: '#7FB44A' },
  earGrn: { stem: '#5F9139', stemLo: '#3E6B25', leaf: '#7FB44A', ear: '#8FBF53', earLo: '#6A9C38' },
  ripe:   { stem: '#C8A84B', stemLo: '#8B6914', leaf: '#B48F3A', ear: '#E0C06A', earLo: '#A67C2A' }
};

function put(list, x, y, color) {
  if (!color) return;
  list.push([x | 0, y | 0, color]);
}

// Tallo vertical con curva suave: `bend` son los pixeles que se vence la punta.
// Los nudos (cada 3 px) van un tono mas oscuro, que es lo que da volumen.
function stalk(list, x, yBottom, altura, bend, pal, { nodos = true } = {}) {
  for (let i = 0; i <= altura; i++) {
    const t = altura ? i / altura : 0;
    const dx = Math.round(bend * t * t);
    const color = (nodos && i > 1 && i % 3 === 0) ? pal.stemLo : pal.stem;
    put(list, x + dx, yBottom - i, color);
  }
  return { x: x + Math.round(bend), y: yBottom - altura };
}

// Hoja: un tramo horizontal que sale del tallo y cae una fila.
function leaf(list, x, y, dir, largo, color, colorLo) {
  for (let i = 1; i <= largo; i++) {
    put(list, x + dir * i, y - Math.round(i * 0.5), i === largo ? colorLo : color);
  }
}

// Espiga: granos a los dos lados del tallo, terminada en punta.
function ear(list, x, yTip, largo, pal) {
  for (let i = 0; i < largo; i++) {
    const y = yTip + i;
    const ancho = (i === largo - 1) ? 0 : 1;
    put(list, x, y, pal.ear);
    if (ancho) { put(list, x - 1, y, pal.earLo); put(list, x + 1, y, pal.ear); }
  }
  put(list, x, yTip - 1, pal.ear);
  put(list, x, yTip - 2, pal.earLo);
}

// ── Fase 0: SEMILLAS (terrón de tierra removida con las semillas a la vista) ──
// Pedido: «cuando pongamos el cultivo, necesito que se vea un trozo de hierba con
// semillas». Antes la fase 0 era un brote más, casi idéntico al hierbajo; ahora es
// una PARCELA SEMBRADA: montón de tierra volteada, los granos encima y dos briznas
// asomando. Así se distingue de un campo vacío y se ve que hay algo plantado.
function semillas() {
  const l = [];
  const tierra = '#6B4423', tierraLo = '#4A2C13', tierraHi = '#8A5A31';
  const sem = '#E8D98A', semLo = '#C8A84B';
  const briz = P.sprout;
  // Montón de tierra volteada: tres filas, más ancha abajo.
  const anchos = [4, 7, 10];
  for (let i = 0; i < anchos.length; i++) {
    const w = anchos[i];
    const x0 = Math.round((10 - w) / 2);
    const y = anchos.length === 3 ? (4 + i) : (4 + i);
    for (let x = 0; x < w; x++) {
      const px = x0 + x;
      const color = (i === 0) ? tierraHi : (x === 0 || x === w - 1) ? tierraLo : tierra;
      put(l, px, y, color);
    }
  }
  // Semillas a la vista sobre los terrones (el detalle que pide el jugador).
  put(l, 2, 5, sem); put(l, 5, 5, semLo); put(l, 8, 5, sem);
  put(l, 1, 6, semLo); put(l, 4, 6, sem); put(l, 7, 6, sem); put(l, 9, 6, semLo);
  put(l, 3, 4, sem); put(l, 6, 4, semLo);
  // Dos briznas cortas: acaba de sembrarse.
  put(l, 3, 3, briz.stem); put(l, 3, 2, briz.leaf);
  put(l, 7, 3, briz.stemLo);
  return { w: 10, h: 7, pixels: l, name: 'semillas' };
}

// ── Fase 1: tallos verdes con hojas ──
function tallos() {
  const l = [];
  const pal = P.green;
  const a = stalk(l, 3, 8, 5, 0, pal);
  leaf(l, 3, 6, -1, 2, pal.leaf, pal.stemLo);
  const b = stalk(l, 5, 8, 7, 1, pal);
  leaf(l, 5, 7, 1, 2, pal.leaf, pal.stemLo);
  const c = stalk(l, 7, 8, 4, 0, pal);
  leaf(l, 7, 6, 1, 1, pal.leaf, pal.stemLo);
  put(l, a.x, a.y - 1, pal.stem);
  put(l, b.x, b.y - 1, pal.stem);
  put(l, 2, 8, pal.stemLo); put(l, 8, 8, pal.stemLo);
  return { w: 9, h: 9, pixels: l, name: 'tallos' };
}

// ── Fase 2: espigando (espigas todavia verdes) ──
function espigando() {
  const l = [];
  const pal = P.earGrn;
  const alturas = [[3, 7, 0], [5, 9, -1], [7, 6, 1], [9, 8, 0]];
  alturas.forEach(([x, h, bend]) => {
    const top = stalk(l, x, 11, h, bend, pal);
    ear(l, top.x, top.y - 1, 3, pal);
  });
  leaf(l, 3, 8, -1, 2, pal.leaf, pal.stemLo);
  leaf(l, 5, 9, 1, 2, pal.leaf, pal.stemLo);
  leaf(l, 9, 8, 1, 2, pal.leaf, pal.stemLo);
  for (let x = 2; x <= 10; x++) put(l, x, 11, pal.stemLo);
  return { w: 11, h: 12, pixels: l, name: 'espigando' };
}

// ── Fase 3: maduro (espigas doradas y tallos vencidos) ──
function maduro() {
  const l = [];
  const pal = P.ripe;
  const alturas = [[3, 9, -1], [5, 11, -2], [7, 10, 1], [9, 12, 2], [11, 8, 1]];
  alturas.forEach(([x, h, bend], i) => {
    const top = stalk(l, x, 13, h, bend, pal);
    ear(l, top.x, top.y - 1, 4 + (i % 2), pal);
  });
  leaf(l, 3, 10, -1, 3, pal.leaf, pal.stemLo);
  leaf(l, 5, 11, 1, 3, pal.leaf, pal.stemLo);
  leaf(l, 9, 11, -1, 2, pal.leaf, pal.stemLo);
  leaf(l, 11, 9, 1, 3, pal.leaf, pal.stemLo);
  for (let x = 2; x <= 12; x++) put(l, x, 13, pal.stemLo);
  // Granos caidos: un par de pixeles dorados en el suelo
  put(l, 4, 13, pal.ear); put(l, 10, 13, pal.earLo);
  return { w: 13, h: 14, pixels: l, name: 'maduro' };
}

// ══ FAMILIAS DE CULTIVO ════════════════════════════════════════════════════
// «Los cultivos tienen el mismo aspecto»: todos los tipos comparten las cuatro
// fases de trigo. Ahora cada familia tiene SU arte, siguiendo la referencia de
// pixel-art de huerto cenital:
//   · vine  → vid con TUTOR de madera y racimos de uva morada
//   · bush  → mata frondosa con frutos colgando (pimiento/berenjena)
//   · leafy → roseta de hojas con cogollo blanco en el centro (col/coliflor)
// La fase 0 (tierra volteada con las semillas) es común: es el momento de
// sembrar y se ve igual en cualquier cultivo.

const MADERA = { palo: '#8A6432', paloLo: '#5E4420' };
const UVAS = { uva: '#6B3FA0', uvaLo: '#4A2870', uvaHi: '#9A6FD0' };

// Tutor de madera (dos palos cruzados y una cuerda) para las trepadoras.
function tutor(l, x, yBase, alto) {
  for (let i = 0; i <= alto; i++) put(l, x, yBase - i, i % 3 === 0 ? MADERA.paloLo : MADERA.palo);
  put(l, x - 1, yBase - Math.round(alto * 0.55), MADERA.paloLo);
  put(l, x + 1, yBase - Math.round(alto * 0.72), MADERA.palo);
}

// ── Fase 1: brote con dos hojas (común a mata y col) ──
function broteDoble(x0, yBase, pal) {
  const l = [];
  put(l, x0, yBase, pal.stemLo); put(l, x0, yBase - 1, pal.stem);
  put(l, x0 - 1, yBase - 2, pal.leaf); put(l, x0 + 1, yBase - 2, pal.leaf);
  put(l, x0, yBase - 2, pal.stem);
  return l;
}

// ── VID (tutor + uvas) ──
function vidGuiando() {
  const l = [];
  const pal = P.green;
  tutor(l, 5, 9, 7);
  for (let i = 0; i < 5; i++) {
    const y = 8 - i * 1.4;
    put(l, 5 + (i % 2 ? 1 : -1), Math.round(y), pal.leaf);
    if (i % 2 === 0) put(l, 5 + (i % 4 === 0 ? -2 : 2), Math.round(y), pal.stemLo);
  }
  leaf(l, 5, 8, -1, 2, pal.leaf, pal.stemLo);
  leaf(l, 5, 5, 1, 2, pal.leaf, pal.stemLo);
  return { w: 10, h: 11, pixels: l, name: 'vid-guiando' };
}
function vidUvas() {
  const l = [];
  const pal = P.green;
  tutor(l, 5, 11, 9);
  for (let i = 0; i < 6; i++) {
    const y = 10 - i * 1.5;
    put(l, 5 + (i % 2 ? 1 : -1), Math.round(y), pal.leaf);
    put(l, 5 + (i % 3 === 0 ? -2 : 2), Math.round(y), i % 2 ? pal.leaf : pal.stemLo);
  }
  // Dos racimos: uvas apiladas en triangulo invertido
  const racimo = (cx, cy) => {
    put(l, cx, cy, UVAS.uvaHi); put(l, cx - 1, cy, UVAS.uva); put(l, cx + 1, cy, UVAS.uva);
    put(l, cx - 1, cy + 1, UVAS.uva); put(l, cx + 1, cy + 1, UVAS.uvaLo); put(l, cx, cy + 1, UVAS.uva);
    put(l, cx, cy + 2, UVAS.uvaLo);
  };
  racimo(2, 5); racimo(8, 7);
  for (let x = 1; x <= 9; x++) put(l, x, 11, pal.stemLo);
  return { w: 11, h: 13, pixels: l, name: 'vid-uvas' };
}

// ── MATA con frutos (pimiento / berenjena) ──
function mataPlanta() {
  const l = [];
  const pal = P.green;
  stalk(l, 4, 8, 4, 0, pal);
  stalk(l, 6, 8, 5, 1, pal);
  leaf(l, 4, 6, -1, 2, pal.leaf, pal.stemLo);
  leaf(l, 6, 5, 1, 2, pal.leaf, pal.stemLo);
  leaf(l, 5, 8, -1, 1, pal.leaf, pal.stemLo);
  for (let x = 2; x <= 8; x++) put(l, x, 8, pal.stemLo);
  return { w: 9, h: 9, pixels: l, name: 'mata' };
}
function mataFruto() {
  const l = [];
  const pal = P.green;
  stalk(l, 3, 11, 5, -1, pal);
  stalk(l, 5, 11, 8, 0, pal);
  stalk(l, 7, 11, 6, 1, pal);
  stalk(l, 9, 11, 4, 1, pal);
  leaf(l, 5, 8, -1, 3, pal.leaf, pal.stemLo);
  leaf(l, 7, 9, 1, 3, pal.leaf, pal.stemLo);
  leaf(l, 3, 9, -1, 2, pal.leaf, pal.stemLo);
  leaf(l, 9, 10, 1, 2, pal.leaf, pal.stemLo);
  // Frutos amarillos colgando (dos grandes y uno pequeño)
  const fruto = (cx, cy, r) => {
    put(l, cx, cy, '#E8B93F'); put(l, cx + 1, cy, '#F2D06A'); put(l, cx, cy + 1, '#C99A2A');
    put(l, cx + 1, cy + 1, '#E8B93F'); if (r) { put(l, cx, cy + 2, '#C99A2A'); put(l, cx + 1, cy + 2, '#E8B93F'); }
  };
  fruto(4, 6, 1); fruto(8, 7, 0); fruto(6, 9, 0);
  for (let x = 2; x <= 10; x++) put(l, x, 11, pal.stemLo);
  return { w: 12, h: 13, pixels: l, name: 'mata-fruto' };
}

// ── COL / COLIFLOR (roseta con cogollo) ──
function colRoseta() {
  const l = [];
  const pal = P.green;
  for (const [x, dir] of [[3, -1], [5, 0], [7, 1]]) {
    leaf(l, x, 7, dir, 3, pal.leaf, pal.stemLo);
    stalk(l, x, 7, 3, Math.round(dir * 0.5), pal);
  }
  for (let x = 2; x <= 8; x++) put(l, x, 7, pal.stemLo);
  return { w: 9, h: 9, pixels: l, name: 'col-roseta' };
}
function colRepollo() {
  const l = [];
  const pal = P.green;
  // Hojas exteriores grandes (dos capas) alrededor del cogollo
  for (const [x, dir, largo] of [[2, -1, 4], [4, -1, 3], [9, 1, 4], [8, 1, 3], [6, 0, 3]]) {
    leaf(l, x, 11, dir, largo, pal.leaf, pal.stemLo);
    leaf(l, x, 9, dir, Math.max(1, largo - 1), pal.leaf, pal.stemLo);
  }
  stalk(l, 3, 11, 6, -1, pal);
  stalk(l, 6, 11, 8, 0, pal);
  stalk(l, 9, 11, 6, 1, pal);
  // Cogollo: bola blanco-verdosa en el centro
  const cogollo = (cx, cy) => {
    put(l, cx, cy, '#F0EFE2'); put(l, cx - 1, cy, '#E2E4D2'); put(l, cx + 1, cy, '#FAFAF0');
    put(l, cx, cy + 1, '#E2E4D2'); put(l, cx - 1, cy + 1, '#FAFAF0'); put(l, cx + 1, cy + 1, '#D8DCC6');
    put(l, cx, cy + 2, '#CFD4BC');
  };
  cogollo(4, 5); cogollo(7, 6);
  for (let x = 1; x <= 11; x++) put(l, x, 11, pal.stemLo);
  return { w: 13, h: 13, pixels: l, name: 'col-repollo' };
}

// Constructores por familia: 4 fases cada una (0 = semillas, común).
const CROP_BUILDERS = {
  wheat: [semillas, tallos, espigando, maduro],
  vine:  [semillas, () => ({ w: 9, h: 9, pixels: (() => { const l = broteDoble(4, 8, P.green); tutor(l, 5, 8, 6); return l; })(), name: 'vid-brote' }), vidGuiando, vidUvas],
  bush:  [semillas, () => ({ w: 8, h: 8, pixels: broteDoble(4, 7, P.green), name: 'mata-brote' }), mataPlanta, mataFruto],
  leafy: [semillas, () => ({ w: 8, h: 8, pixels: broteDoble(4, 7, P.green), name: 'col-brote' }), colRoseta, colRepollo]
};

export const CROP_TYPES = ['wheat', 'vine', 'bush', 'leafy'];

// Nombre bonito de cada familia (para avisos y el registro de pruebas).
export const CROP_TYPE_NAMES = { wheat: 'Trigo', vine: 'Vid', bush: 'Mata de fruto', leafy: 'Col' };

export function buildCropStages(type) {
  const b = CROP_BUILDERS[type] || CROP_BUILDERS.wheat;
  return b.map(fn => fn());
}

export function buildWheatStages() {
  return buildCropStages('wheat');
}

// Clave del sprite de una fase (0..3) para una familia.
export function cropSpriteKey(type, stage) {
  const t = CROP_BUILDERS[type] ? type : 'wheat';
  return t + Math.max(0, Math.min(3, stage | 0));
}

// Compatibilidad con el nombre antiguo (trigo).
export function wheatSpriteKey(stage) {
  return cropSpriteKey('wheat', stage);
}

// Registra las fases de TODAS las familias en la libreria de sprites del motor.
export function registerPlantSprites(library) {
  try {
    if (!library) return {};
    const out = {};
    CROP_TYPES.forEach(type => {
      const stages = buildCropStages(type);
      const keys = [];
      stages.forEach((s, i) => {
        const key = cropSpriteKey(type, i);
        if (!library[key]) {
          library[key] = {
            grid: Math.max(s.w, s.h),
            gridW: s.w,
            gridH: s.h,
            pixels: s.pixels.map(p => p.slice()),
            _cropType: type,
            _cropStage: i
          };
        }
        keys.push(key);
      });
      out[type] = keys;
    });
    return out;
  } catch (e) { return {}; }
}

export const WHEAT_STAGE_NAMES = ['Semillas', 'Tallos', 'Espigando', 'Maduro'];
export const CROP_STAGE_NAMES = ['Semillas', 'Brote', 'Planta', 'Fruto'];
