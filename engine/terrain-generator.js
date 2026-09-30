/**
 * GENERADOR DE TERRENO COHERENTE (ruido de valor + fbm) — MÓDULO COMPARTIDO
 * ---------------------------------------------------------------------------
 * Portado del generador que ya funcionaba en el **editor de mapas**
 * (`tools/Support/map-editor-standalone.html` → `generateCoherentBiomes`), que
 * elige el bioma a partir de dos campos continuos (elevación y humedad) en vez
 * de bandas fijas por columna: los biomas salen en manchas coherentes y las
 * transiciones son suaves.
 *
 * DIFERENCIA CLAVE para el mundo que crece: el ruido se evalúa en
 * **coordenadas de mundo** (celdas), no normalizadas por el tamaño del mapa.
 * El campo de elevación/humedad y el meandro del río son funciones PURAS de
 * (columna, fila) y de la semilla mundial, así que una región generada más
 * tarde (al ampliar el mapa por un borde) encaja sin costuras con la anterior.
 *
 * Lo usan:
 *   1. `engine/game-engine.js` → biomas iniciales de `generateMap` y las bandas
 *      nuevas del crecimiento del mundo (`expandWorld`).
 *   2. (futuro) el editor de mapas, sustituyendo su copia local.
 */

// ── Perfiles por época (los del editor, con los biomas del motor) ───────────
// IMPORTANTE (umbrales): los campos `elevation`/`moisture` se mueven casi
// siempre entre 0.25 y 0.55 (fbm de ruido de valor: media ~0.5, recorrido útil
// pequeño). Con umbrales «de manual» (0.7-0.8) NO se generaba ni una colina ni
// un bosque: el mapa salía como una llanura idéntica de lado a lado y daba la
// impresión de «se repite la misma sección». Estos números salen de medir los
// cuantiles reales de los dos campos (ver `tools/` o el historial de _tune).
//   elevación: q35=0.35  q45=0.38  q80=0.47  q92=0.51
//   humedad:   q18=0.24  q30=0.28  q47=0.32  q78=0.42  q90=0.50
export const TERRAIN_PROFILES = {
  mesopotamia: {
    riverAmp: 12,         // meandro del río (celdas, ±)
    riverWidthBase: 5,    // ancho base (el motor usaba RIVER_WIDTH_BASE = 5)
    riverWidthRand: 2,
    // Frecuencia del ruido: celdas de mundo por celda de ruido.
    // 180/7 ≈ 26 columnas por mancha de elevación (antes 3.1 → manchas de 58).
    elevFreq: 7.0,
    moistFreq: 9.0,
    detailFreq: 22,       // detalle fino que rompe las manchas grandes
    detailAmp: 0.15,
    elevNoiseMix: 0.62,   // peso del ruido frente a la latitud
    // El peso del ruido baja y el de la humedad del río sube: el mundo salía
    // árido de lado a lado (steppe/alluvial/saline) y apenas había tierra
    // fértil que labrar. OJO: no hay que pasarse. `drawTreesVisible` pinta UN
    // ÁRBOL POR CELDA de bioma `forest`, así que el área de bosque es
    // directamente la cantidad de árboles dibujados: con el bosque al 12 % la
    // pantalla era una alfombra verde y no se veía el suelo.
    moistNoiseMix: 0.56,
    rivMoist: 6.5,        // radios de humedad junto al río
    hillThreshold: 0.512,
    forestThreshold: 0.470,  // bosque ~4-5 % (antes 0,43 → 12 %)
    grassThreshold: 0.360, // praderas verdes y cultivables (sin árboles: se ve el suelo)
    marshThreshold: 0.452,
    marshElevMax: 0.370,
    salineMoisture: 0.280,
    salineElevMin: 0.400,
    steppeMoisture: 0.320
  },
  urss: {
    riverAmp: 10,
    riverWidthBase: 4,
    riverWidthRand: 2,
    elevFreq: 7.5,
    moistFreq: 10.0,
    detailFreq: 24,
    detailAmp: 0.16,
    elevNoiseMix: 0.66,
    moistNoiseMix: 0.58,
    rivMoist: 5.5,
    hillThreshold: 0.495,
    forestThreshold: 0.468,
    grassThreshold: 0.365,
    marshThreshold: 0.460,
    marshElevMax: 0.385,
    salineMoisture: 0.300,
    salineElevMin: 0.385,
    steppeMoisture: 0.340
  },
  medieval: {
    riverAmp: 11,
    riverWidthBase: 5,
    riverWidthRand: 2,
    elevFreq: 6.5,
    moistFreq: 8.5,
    detailFreq: 21,
    detailAmp: 0.14,
    elevNoiseMix: 0.60,
    moistNoiseMix: 0.54,
    rivMoist: 6.8,
    hillThreshold: 0.507,
    forestThreshold: 0.462,
    grassThreshold: 0.355,
    marshThreshold: 0.448,
    marshElevMax: 0.365,
    salineMoisture: 0.275,
    salineElevMin: 0.405,
    steppeMoisture: 0.318
  }
};

// Biomas que existen en el motor (para validar/mapear desde el editor).
export const TERRAIN_BIOMES = [
  'water', 'riparian', 'hills', 'forest', 'marsh', 'saline', 'steppe', 'alluvial'
];

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

/**
 * Crea un generador de terreno con una **referencia de normalización fija**
 * (el tamaño del mapa inicial). Esa referencia es lo que hace que el ruido no
 * cambie al crecer el mundo.
 *
 * @param {{refCols?:number, refRows?:number, seed?:number, epoch?:string}} [opts]
 */
export function createTerrainGenerator(opts = {}) {
  const REF_W = Math.max(16, Number(opts.refCols) || 180);
  const REF_H = Math.max(16, Number(opts.refRows) || 120);
  // Filas de los corredores logísticos (canales), en coordenadas absolutas: no
  // cambian al ampliar el mapa (son obra humana, no terreno).
  const canalRows = [0.27, 0.54, 0.80].map(f => Math.floor(REF_H * f));

  // ── Ruido de valor + fbm (idéntico al del editor) ─────────────────────────
  function hash2D(x, y, seed) {
    let n = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function valueNoise2D(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const n00 = hash2D(x0, y0, seed);
    const n10 = hash2D(x0 + 1, y0, seed);
    const n01 = hash2D(x0, y0 + 1, seed);
    const n11 = hash2D(x0 + 1, y0 + 1, seed);
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  function fbm(x, y, seed, oct = 4) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += valueNoise2D(x * freq, y * freq, seed + i * 101) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / Math.max(0.0001, norm);
  }

  // ── Río: centro y ancho de una fila (función pura → sin costuras) ────────
  // Antes el motor hacía un paseo aleatorio por filas: al ampliar el mapa el
  // meandro no continuaba. Con senos de periodo largo el río sigue igual de
  // orgánico y se puede evaluar en cualquier fila, antes o después de crecer.
  function riverCenterAt(base, row, seed, profile) {
    const amp = profile.riverAmp;
    const a = Math.sin(row * 0.045 + seed * 0.017);
    const b = Math.sin(row * 0.131 + seed * 0.031);
    return base + amp * (a * 0.78 + b * 0.22);
  }

  function riverWidthAt(row, seed, profile) {
    return profile.riverWidthBase + Math.floor(valueNoise2D(row * 0.11, 0.5, seed + 13) * profile.riverWidthRand);
  }

  /** Perfil de época resuelto (mesopotamia por defecto). */
  function profileFor(epochId) {
    return TERRAIN_PROFILES[epochId === 'urss' ? 'urss' : (epochId === 'medieval' ? 'medieval' : 'mesopotamia')];
  }

  /** Época normalizada a las claves del módulo. */
  function epochKey(epochId) {
    return epochId === 'urss' ? 'urss' : (epochId === 'medieval' ? 'medieval' : 'mesopotamia');
  }

  /** Ríos verticales del motor: [{base, name}] (Río Don y Río Ob Nord). */
  function riverSpanAt(rivers, row, seed, profile) {
    const out = [];
    for (let i = 0; i < rivers.length; i++) {
      const base = Number(rivers[i] && rivers[i].base) || 0;
      const center = riverCenterAt(base, row, seed, profile);
      const width = riverWidthAt(row, seed, profile);
      out.push({ center, width, half: Math.max(1, Math.floor(width / 2)) });
    }
    return out;
  }

  /** Cauces de una fila, resolviendo época y semilla desde `cfg`. */
  function spansAt(row, cfg = {}) {
    return riverSpanAt(cfg.rivers || [], row, (Number(cfg.seed) || 0) | 0, profileFor(cfg.epoch));
  }

  // ── Bioma de una celda ──────────────────────────────────────────────────
  function biomeAt(col, row, cfg = {}) {
    const epoch = epochKey(cfg.epoch);
    const P = TERRAIN_PROFILES[epoch];
    const seed = (Number(cfg.seed) || 0) | 0;
    const rivers = Array.isArray(cfg.rivers) ? cfg.rivers : [];

    // Distancia al agua (0 = dentro del cauce).
    let distRiver = Infinity;
    const spans = riverSpanAt(rivers, row, seed, P);
    for (let i = 0; i < spans.length; i++) {
      const d = Math.abs(col - spans[i].center) - spans[i].half;
      if (d < distRiver) distRiver = d;
    }
    if (distRiver <= 0) return 'water';

    // Coordenadas normalizadas por la REFERENCIA FIJA (no por el tamaño actual).
    const x = (col + 0.5) / REF_W;
    const y = (row + 0.5) / REF_H;
    // Latitud de periodo muy largo: el norte es llanura y el sur se vuelve
    // salino/pantanoso, pero el patrón no se repite cada mapa.
    const lat = 0.1 + 0.55 * (0.5 + 0.5 * Math.sin(y * 0.9 - 1.1));
    // Detalle fino: rompe las manchas grandes de ruido para que el mapa no se
    // vea como cuatro parches enormes repetidos.
    const detalle = fbm(x * P.detailFreq, y * P.detailFreq, seed + 313, 3) - 0.5;
    const elevNoiseMix = Number(P.elevNoiseMix) || 0.62;
    const moistNoiseMix = Number(P.moistNoiseMix) || 0.58;
    const elevFreq = Number(P.elevFreq) || 7.0;
    const moistFreq = Number(P.moistFreq) || 9.0;
    const detAmp = Number(P.detailAmp) || 0.15;
    const elevation = clamp01(
      fbm(x * elevFreq, y * elevFreq, seed + 91, 5) * elevNoiseMix +
      (lat + (x - 0.5) * (x - 0.5) * 0.08) * (1 - elevNoiseMix) +
      detalle * detAmp
    );
    const moisture = clamp01(
      fbm(x * moistFreq, y * moistFreq, seed + 707, 4) * moistNoiseMix +
      Math.exp(-distRiver / (Number(P.rivMoist) || 6.0)) * (1 - moistNoiseMix) +
      detalle * detAmp * 0.8
    );

    if (distRiver <= 1) return 'riparian';
    // ORDEN IMPORTANTE: el humedal (húmedo y BAJO) se comprueba antes que el
    // bosque. Al revés nunca salía ni un humedal: cualquier celda lo bastante
    // húmeda caía antes en «forest» y `marsh` quedaba a 0 en todo el mapa.
    if (elevation > P.hillThreshold) return 'hills';
    if (moisture > P.marshThreshold && elevation < P.marshElevMax) return 'marsh';
    if (moisture > P.forestThreshold) return 'forest';
    // PRAderas: el escalón que faltaba. Antes, todo lo que no era bosque ni
    // humedal caía en alluvial/steppe/saline (tierra seca) y el mundo se veía
    // mustio, con muy poca tierra que labrar. Ahora la franja húmeda intermedia
    // es hierba verde: cultivable, con vegetación y agradable a la vista.
    if (moisture > (Number(P.grassThreshold) || 0.36)) return 'grass';
    if (moisture < P.salineMoisture && elevation > P.salineElevMin) return 'saline';
    if (moisture < P.steppeMoisture) return 'steppe';
    return 'alluvial';
  }

  /**
   * Rellena una región del mapa con el generador coherente.
   * @param {(col:number,row:number)=>void} setCell  recibe el bioma de cada celda
   * @param {{c0:number,r0:number,cols:number,rows:number,seed?:number,epoch?:string,rivers?:Array}} cfg
   */
  function fillRegion(setCell, cfg = {}) {
    const c0 = Math.round(cfg.c0) || 0;
    const r0 = Math.round(cfg.r0) || 0;
    const cols = Math.max(0, Math.round(cfg.cols) || 0);
    const rows = Math.max(0, Math.round(cfg.rows) || 0);
    let water = 0;
    const counts = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const col = c0 + c;
        const row = r0 + r;
        const biome = biomeAt(col, row, cfg);
        counts[biome] = (counts[biome] || 0) + 1;
        if (biome === 'water') water++;
        setCell(col, row, biome);
      }
    }
    return { cells: cols * rows, water, counts };
  }

  /** Altura 0..1 coherente (para el mapa de altura y el fondo de montañas). */
  function heightAt(col, row, cfg = {}) {
    const seed = (Number(cfg.seed) || 0) | 0;
    const x = (col + 0.5) / REF_W;
    const y = (row + 0.5) / REF_H;
    let h = 0.3 + 0.3 * fbm(x * 2.6, y * 2.6, seed + 331, 3) + 0.12 * valueNoise2D(x * 6.5, y * 6.5, seed + 517);
    const biome = cfg.biome;
    if (biome === 'alluvial' || biome === 'marsh' || biome === 'riparian') h *= 0.35;
    else if (biome === 'steppe') h = Math.max(h, 0.42);
    else if (biome === 'hills') h = Math.max(h, 0.78);
    return clamp01(h);
  }

  return {
    valueNoise2D,
    fbm,
    biomeAt,
    heightAt,
    fillRegion,
    riverCenterAt,
    riverWidthAt,
    riverSpanAt,
    spansAt,
    profileFor,
    epochKey,
    canalRows: canalRows.slice(),
    refCols: REF_W,
    refRows: REF_H
  };
}
