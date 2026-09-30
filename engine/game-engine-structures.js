// engine/game-engine-structures.js
// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE ESTRUCTURAS (conjuntos de edificios preparados)
//
// Problema que resuelve: antes, los edificios singulares (zigurat, templo,
// mercado…) podían aparecer sueltos o colocados "como caía", sin relación
// espacial entre ellos. Aquí cada conjunto se describe como una plantilla con
// desplazamientos relativos (dc/dr) respecto a un ancla, de modo que el
// generador siempre levanta la MISMA forma coherente: plaza, camino, edificios
// principales, decoración y NPCs.
//
// Formato (data/structures.json):
// {
//   "version": 1,
//   "structures": {
//     "zigurat_complejo": {
//       "name": "Complejo del Zigurat",
//       "epochs": ["mesopotamia"],        // "*" = todas
//       "weight": 3,                      // peso relativo en la generación
//       "maxPerMap": 1,
//       "minSpacing": 26,                  // distancia mínima a villas/otras estructuras
//       "biomes": ["alluvial", "steppe", "grass"],
//       "nearRiver": [3, 22],              // [min,max] distancia al agua (opcional)
//       "roadToNearest": true,             // carretera de acceso a la villa más cercana
//       "anchor": "center",                // center | topleft
//       "pieces": [ { "type": "ziggurat", "dc": 0, "dr": 0, "required": true } ],
//       "terrain": [ { "terrain": "road", "dc": 0, "dr": 6 } ],
//       "entities": [ { "kind": "ambient", "subtype": "date_palm", "dc": -6, "dr": -8 } ],
//       "npcs": [ { "npcType": "priestess", "name": "Sacerdotisa", "dc": 0, "dr": 8 } ]
//     }
//   }
// }
//
// Las piezas pueden ir con "chance": 0..1 (variación) y "required": true (si no
// cabe, la estructura entera se descarta). El campo "transform" (o el parámetro
// opts.transform) permite girar/reflejar el conjunto para dar variedad sin
// tener que dibujar cuatro versiones a mano.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'meso.structures';
const FILE_PATH = 'data/structures.json';

// ── Núcleo de la capital: la explanada del zigurat ──────────────────────────
// El planificador reserva el centro de la capital (`coreRings: 2` en
// settlement-utils) y ese hueco mide 29×29 celdas (-14…+14). El zigurat (12×12)
// ocupa -6…+5, así que quedan 8 celdas libres por lado: es lo que hace que el
// monumento NO esté apretado contra las casas.
//
// La plantilla de aquí abajo usa esas 8 celdas: corona pavimentada de dos celdas
// pegada al monumento, avenidas procesionales de dos celdas hasta el borde de la
// reserva y palmeras espaciadas en los rincones. Antes el núcleo eran 17×17 (2
// celdas de margen), con las avenidas pegadas a la fachada del zigurat.
const NUCLEO_CAPITAL_HALF = 14;

// Corona pavimentada alrededor del zigurat (2 celdas de ancho, sin tocar el arte).
function nucleoCapitalEsplanade() {
  const out = [];
  for (let dc = -10; dc <= 10; dc++) {
    for (let dr = -10; dr <= 10; dr++) {
      const edge = Math.max(Math.abs(dc + 0.5), Math.abs(dr + 0.5));
      if (edge < 6.5 || edge > 8.5) continue;
      out.push({ terrain: 'road', dc, dr });
    }
  }
  return out;
}

// Avenidas procesionales (N-S y E-O), de dos celdas de ancho, desde la corona
// hasta el borde de la reserva: conectan el monumento con las calles de la ciudad.
function nucleoCapitalAvenues() {
  const out = [];
  for (let d = 9; d <= NUCLEO_CAPITAL_HALF; d++) {
    out.push({ terrain: 'road', dc: 0, dr: -d }, { terrain: 'road', dc: 1, dr: -d });
    out.push({ terrain: 'road', dc: 0, dr: d }, { terrain: 'road', dc: 1, dr: d });
    out.push({ terrain: 'road', dc: -d, dr: 0 }, { terrain: 'road', dc: -d, dr: 1 });
    out.push({ terrain: 'road', dc: d, dr: 0 }, { terrain: 'road', dc: d, dr: 1 });
  }
  return out;
}

// Palmeras de los rincones y de los testeros, ya FUERA de la corona pavimentada.
function nucleoCapitalPalms() {
  const spots = [
    [-11, -11], [11, -11], [-11, 11], [11, 11],   // rincones
    [-11, 3], [11, 3], [3, -11], [3, 11],         // testeros
    [-11, -3], [11, -3], [-3, -11], [-3, 11]
  ];
  return spots.map(([dc, dr]) => ({ kind: 'ambient', subtype: 'date_palm', dc, dr }));
}

// ── Plantillas por defecto ──────────────────────────────────────────────────
// Mesopotamia: vocabulario mesopotámico (el mapa de épocas lo traduce a URSS).
// URSS: piezas soviéticas (bloques, control, industria).
export const DEFAULT_STRUCTURES = {
  // Núcleo monumental de una capital: el zigurat con su explanada y su vía
  // procesional. Está dimensionado para la reserva de 29×29 celdas que deja
  // libre el planificador de asentamientos (settlement-utils, `coreRings: 2`),
  // de modo que la retícula de manzanas se construye ALREDEDOR sin pegarse al
  // monumento: 8 celdas de explanada por lado.
  nucleo_capital: {
    name: 'Núcleo de la capital',
    epochs: ['*'],
    weight: 0,
    maxPerMap: 0,
    minSpacing: 0,
    biomes: ['*'],
    allowWater: false,
    roadToNearest: false,
    pieces: [
      // El zigurat es 12×12 y se centra en el ancla: ocupa -6…+5.
      { type: 'ziggurat', dc: 0, dr: 0, required: true },
      // Pozos de la explanada, en las esquinas y lejos de la fachada.
      { type: 'well', dc: -9, dr: -9, chance: 0.6 },
      { type: 'well', dc: 8, dr: 8, chance: 0.6 }
    ],
    terrain: [
      ...nucleoCapitalEsplanade(),
      ...nucleoCapitalAvenues()
    ],
    entities: nucleoCapitalPalms(),
    npcs: [
      // La sacerdotisa preside la escalinata; el escriba, al pie de la avenida.
      { npcType: 'priestess', name: 'Sacerdotisa', dc: 0, dr: -9 },
      { npcType: 'scribe', name: 'Escriba', dc: 7, dr: 8 }
    ]
  },

  zigurat_complejo: {
    name: 'Complejo del Zigurat',
    epochs: ['mesopotamia'],
    weight: 3,
    maxPerMap: 1,
    minSpacing: 28,
    biomes: ['alluvial', 'steppe', 'grass', 'riparian'],
    nearRiver: [15, 32],
    roadToNearest: true,
    pieces: [
      // El zigurat es 12×12 y se centra en el ancla: ocupa -6…+5. Las piezas de
      // alrededor van fuera de ese cuadrado y con AIRE de por medio (el templo a
      // 4 celdas, el granero y el mercado a 6): antes se pegaban al monumento y
      // el conjunto se veía apelotonado.
      { type: 'ziggurat', dc: 0, dr: 0, required: true },
      { type: 'temple', dc: -1, dr: -13, required: true },
      { type: 'mesopotamian_arch', dc: -1, dr: -17 },
      { type: 'granary', dc: -14, dr: 5 },
      { type: 'market', dc: 13, dr: 5 },
      { type: 'mesopotamian_baths', dc: -15, dr: -2, chance: 0.6 },
      { type: 'well', dc: 5, dr: 12, chance: 0.8 },
      { type: 'house_small', dc: -6, dr: 14, chance: 0.5 },
      { type: 'house_small', dc: 4, dr: -17, chance: 0.4 }
    ],
    terrain: [
      // Avenida al sur del zigurat, ya FUERA de su huella (dr 6-8) y camino de
      // aproximación por el oeste (dc -9…-7).
      { terrain: 'road', dc: -9, dr: 4 }, { terrain: 'road', dc: -9, dr: 5 },
      { terrain: 'road', dc: -9, dr: 6 }, { terrain: 'road', dc: -8, dr: 6 },
      { terrain: 'road', dc: -7, dr: 6 }, { terrain: 'road', dc: -6, dr: 6 },
      { terrain: 'road', dc: -5, dr: 6 }, { terrain: 'road', dc: -4, dr: 6 },
      { terrain: 'road', dc: -3, dr: 6 }, { terrain: 'road', dc: -2, dr: 6 },
      { terrain: 'road', dc: -1, dr: 6 }, { terrain: 'road', dc: 0, dr: 6 },
      { terrain: 'road', dc: 1, dr: 6 }, { terrain: 'road', dc: 2, dr: 6 },
      { terrain: 'road', dc: 3, dr: 6 }, { terrain: 'road', dc: 4, dr: 6 },
      { terrain: 'road', dc: 5, dr: 6 }, { terrain: 'road', dc: 6, dr: 6 },
      { terrain: 'road', dc: 7, dr: 6 }, { terrain: 'road', dc: 8, dr: 6 },
      { terrain: 'road', dc: 9, dr: 6 }, { terrain: 'road', dc: 10, dr: 6 },
      { terrain: 'road', dc: 11, dr: 6 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'date_palm', dc: -7, dr: -8 },
      { kind: 'ambient', subtype: 'date_palm', dc: 6, dr: -8 },
      { kind: 'ambient', subtype: 'date_palm', dc: -7, dr: 8 },
      { kind: 'ambient', subtype: 'date_palm', dc: 6, dr: 8 }
    ],
    npcs: [
      { npcType: 'priestess', name: 'Sacerdotisa', dc: -1, dr: -6 },
      { npcType: 'scribe', name: 'Escriba', dc: 3, dr: 6 }
    ]
  },

  recinto_de_templo: {
    name: 'Recinto del Templo',
    epochs: ['mesopotamia'],
    weight: 2,
    maxPerMap: 2,
    minSpacing: 13,
    biomes: ['alluvial', 'grass', 'riparian'],
    roadToNearest: true,
    pieces: [
      { type: 'temple', dc: 0, dr: 0, required: true },
      { type: 'mesopotamian_arch', dc: 0, dr: 5 },
      { type: 'house_small', dc: -6, dr: -2, chance: 0.7 },
      { type: 'house_small', dc: 5, dr: -2, chance: 0.7 },
      { type: 'well', dc: 4, dr: 4, chance: 0.8 }
    ],
    terrain: [
      { terrain: 'road', dc: 0, dr: 3 }, { terrain: 'road', dc: 0, dr: 4 },
      { terrain: 'road', dc: 0, dr: 5 }, { terrain: 'road', dc: 0, dr: 6 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'date_palm', dc: -4, dr: 3 },
      { kind: 'ambient', subtype: 'date_palm', dc: 3, dr: 3 }
    ],
    npcs: [{ npcType: 'priestess', name: 'Devota', dc: 2, dr: 4 }]
  },

  plaza_de_mercado: {
    name: 'Plaza de Mercado',
    epochs: ['mesopotamia'],
    weight: 3,
    maxPerMap: 2,
    minSpacing: 18,
    biomes: ['alluvial', 'grass', 'steppe'],
    roadToNearest: true,
    pieces: [
      { type: 'market', dc: 0, dr: 0, required: true },
      { type: 'granary', dc: 7, dr: -1 },
      { type: 'well', dc: -6, dr: 2, chance: 0.7 },
      { type: 'fountain', dc: -6, dr: -3, chance: 0.35 },
      { type: 'house_small', dc: -2, dr: 6, chance: 0.6 },
      { type: 'house_small', dc: 5, dr: 6, chance: 0.6 }
    ],
    terrain: [
      { terrain: 'road', dc: -4, dr: 4 }, { terrain: 'road', dc: -3, dr: 4 },
      { terrain: 'road', dc: -2, dr: 4 }, { terrain: 'road', dc: -1, dr: 4 },
      { terrain: 'road', dc: 0, dr: 4 }, { terrain: 'road', dc: 1, dr: 4 },
      { terrain: 'road', dc: 2, dr: 4 }, { terrain: 'road', dc: 3, dr: 4 },
      { terrain: 'road', dc: 4, dr: 4 }, { terrain: 'road', dc: 5, dr: 4 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'crate_stack', dc: -3, dr: -4, chance: 0.9 },
      { kind: 'ambient', subtype: 'crate_stack', dc: 4, dr: 3, chance: 0.9 }
    ],
    npcs: [
      { npcType: 'merchant', name: 'Mercader', dc: -4, dr: 1 },
      { npcType: 'villager', name: 'Campesino', dc: 2, dr: 3 }
    ]
  },

  granja_compleja: {
    name: 'Granja compleja',
    epochs: ['mesopotamia'],
    weight: 3,
    maxPerMap: 3,
    minSpacing: 16,
    biomes: ['alluvial', 'grass', 'riparian'],
    nearRiver: [1, 24],
    pieces: [
      { type: 'farm', dc: 0, dr: 0, required: true },
      { type: 'granary', dc: 5, dr: -2 },
      { type: 'house_small', dc: -5, dr: -2 },
      { type: 'sheepfold', dc: -6, dr: 5, chance: 0.6 },
      { type: 'pottery', dc: 6, dr: 5, chance: 0.35 },
      { type: 'well', dc: 2, dr: 6, chance: 0.7 }
    ],
    terrain: [
      { terrain: 'road', dc: 0, dr: 4 }, { terrain: 'road', dc: 0, dr: 5 }
    ],
    entities: [
      { kind: 'resource', subtype: 'weed', dc: -3, dr: 3, chance: 0.8 },
      { kind: 'resource', subtype: 'weed', dc: 3, dr: 3, chance: 0.8 }
    ],
    npcs: [{ npcType: 'farmer', name: 'Campesino', dc: 1, dr: 4 }]
  },

  embarcadero: {
    name: 'Embarcadero',
    epochs: ['*'],
    weight: 2,
    maxPerMap: 2,
    minSpacing: 16,
    biomes: ['riparian', 'alluvial', 'grass', 'water'],
    nearRiver: [0, 6],
    allowWater: true,
    pieces: [
      { type: 'dock', dc: 0, dr: 0, required: true },
      { type: 'granary', dc: -5, dr: 2 },
      { type: 'house_small', dc: -5, dr: -3, chance: 0.7 },
      { type: 'market', dc: 5, dr: 1, chance: 0.5 }
    ],
    terrain: [
      { terrain: 'road', dc: -6, dr: 0 }, { terrain: 'road', dc: -5, dr: 0 },
      { terrain: 'road', dc: -4, dr: 0 }, { terrain: 'road', dc: -3, dr: 0 },
      { terrain: 'road', dc: -2, dr: 0 }, { terrain: 'road', dc: -1, dr: 0 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'crate_stack', dc: 2, dr: 2, chance: 0.9 }
    ],
    npcs: [{ npcType: 'merchant', name: 'Barquero', dc: -2, dr: 3 }]
  },

  atalaya_frontera: {
    name: 'Atalaya de frontera',
    epochs: ['*'],
    weight: 2,
    maxPerMap: 3,
    minSpacing: 14,
    biomes: ['steppe', 'hills', 'grass', 'sand'],
    pieces: [
      { type: 'watchtower', dc: 0, dr: 0, required: true },
      { type: 'hut', dc: -3, dr: 2, chance: 0.8 },
      { type: 'sheepfold', dc: 3, dr: 2, chance: 0.5 }
    ],
    terrain: [
      { terrain: 'road', dc: 0, dr: 3 }, { terrain: 'road', dc: 0, dr: 4 }
    ],
    entities: [
      { kind: 'resource', subtype: 'stone', dc: -2, dr: -2, chance: 0.7 }
    ],
    npcs: [{ npcType: 'guard', name: 'Vigía', dc: 1, dr: 1 }]
  },

  // ── URSS ─────────────────────────────────────────────────────────────────
  bloque_vecinal: {
    name: 'Bloque vecinal soviético',
    epochs: ['urss'],
    weight: 4,
    maxPerMap: 3,
    minSpacing: 18,
    biomes: ['alluvial', 'grass', 'steppe'],
    roadToNearest: true,
    pieces: [
      { type: 'soviet_block', dc: 0, dr: 0, required: true },
      { type: 'soviet_block', dc: 13, dr: 0, chance: 0.8 },
      { type: 'soviet_block', dc: 0, dr: 9, chance: 0.6 },
      { type: 'state_warehouse', dc: -7, dr: 4 },
      { type: 'state_clinic', dc: -9, dr: -3, chance: 0.5 }
    ],
    terrain: [
      { terrain: 'concrete_road', dc: -3, dr: 4 }, { terrain: 'concrete_road', dc: -2, dr: 4 },
      { terrain: 'concrete_road', dc: -1, dr: 4 }, { terrain: 'concrete_road', dc: 0, dr: 4 },
      { terrain: 'concrete_road', dc: 1, dr: 4 }, { terrain: 'concrete_road', dc: 2, dr: 4 },
      { terrain: 'concrete_road', dc: 3, dr: 4 }, { terrain: 'concrete_road', dc: 4, dr: 4 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: -3, dr: 3, chance: 0.9 },
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: 3, dr: 3, chance: 0.9 },
      { kind: 'ambient', subtype: 'soviet_monument', dc: 6, dr: 3, chance: 0.6 },
      { kind: 'ambient', subtype: 'crate_stack', dc: -5, dr: 1, chance: 0.7 }
    ],
    npcs: [
      { npcType: 'villager', name: 'Vecino', dc: 2, dr: 5 },
      { npcType: 'villager', name: 'Vecina', dc: 5, dr: 5, chance: 0.7 }
    ]
  },

  puesto_de_control: {
    name: 'Puesto de control',
    epochs: ['urss'],
    weight: 3,
    maxPerMap: 2,
    minSpacing: 20,
    biomes: ['alluvial', 'steppe', 'grass', 'road', 'concrete_road'],
    roadToNearest: true,
    pieces: [
      { type: 'checkpoint_gate', dc: 0, dr: 0, required: true }
    ],
    terrain: [
      { terrain: 'concrete_road', dc: 0, dr: 3 }, { terrain: 'concrete_road', dc: 0, dr: 4 },
      { terrain: 'concrete_road', dc: 0, dr: 5 }, { terrain: 'concrete_road', dc: 0, dr: 6 },
      { terrain: 'concrete_road', dc: 0, dr: -1 }
    ],
    entities: [
      // Las garitas son mobiliario (entidad), no edificio: como pieza acababan
      // en la rejilla como tipo desconocido.
      { kind: 'ambient', subtype: 'guard_booth', dc: -3, dr: 2, chance: 0.9 },
      { kind: 'ambient', subtype: 'guard_booth', dc: 3, dr: 2, chance: 0.9 },
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: 2, dr: 0, chance: 0.8 },
      { kind: 'ambient', subtype: 'crate_stack', dc: -4, dr: -1, chance: 0.7 }
    ],
    npcs: [
      { npcType: 'guard', name: 'Centinela', dc: -2, dr: 3 },
      { npcType: 'guard', name: 'Cabo', dc: 2, dr: 3, chance: 0.8 }
    ]
  },

  granja_colectiva: {
    name: 'Granja colectiva',
    epochs: ['urss'],
    weight: 3,
    maxPerMap: 2,
    minSpacing: 20,
    biomes: ['alluvial', 'grass', 'steppe'],
    roadToNearest: true,
    pieces: [
      { type: 'collective_farm', dc: 0, dr: 0, required: true },
      { type: 'state_warehouse', dc: 9, dr: 2 },
      { type: 'soviet_block', dc: -8, dr: 3, chance: 0.5 },
      { type: 'farm', dc: 0, dr: 8, chance: 0.7 }
    ],
    terrain: [
      { terrain: 'concrete_road', dc: -2, dr: 6 }, { terrain: 'concrete_road', dc: -1, dr: 6 },
      { terrain: 'concrete_road', dc: 0, dr: 6 }, { terrain: 'concrete_road', dc: 1, dr: 6 },
      { terrain: 'concrete_road', dc: 2, dr: 6 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'crate_stack', dc: 4, dr: 4, chance: 0.8 },
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: 5, dr: 5, chance: 0.6 }
    ],
    npcs: [
      { npcType: 'farmer', name: 'Brigadista', dc: 3, dr: 5 },
      { npcType: 'farmer', name: 'Cosechadora', dc: -3, dr: 5, chance: 0.7 }
    ]
  },

  nucleo_industrial: {
    name: 'Núcleo industrial',
    epochs: ['urss'],
    weight: 2,
    maxPerMap: 1,
    minSpacing: 30,
    biomes: ['steppe', 'alluvial', 'hills'],
    roadToNearest: true,
    pieces: [
      { type: 'steel_foundry', dc: 0, dr: 0, required: true },
      { type: 'factory', dc: -9, dr: 6 },
      { type: 'state_warehouse', dc: 8, dr: 6 },
      { type: 'soviet_block', dc: -10, dr: -4, chance: 0.6 }
    ],
    terrain: [
      { terrain: 'concrete_road', dc: -3, dr: 5 }, { terrain: 'concrete_road', dc: -2, dr: 5 },
      { terrain: 'concrete_road', dc: -1, dr: 5 }, { terrain: 'concrete_road', dc: 0, dr: 5 },
      { terrain: 'concrete_road', dc: 1, dr: 5 }, { terrain: 'concrete_road', dc: 2, dr: 5 },
      { terrain: 'concrete_road', dc: 3, dr: 5 }
    ],
    entities: [
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: -4, dr: 4, chance: 0.8 },
      { kind: 'ambient', subtype: 'soviet_streetlight', dc: 4, dr: 4, chance: 0.8 }
    ],
    npcs: [{ npcType: 'guard', name: 'Vigilante', dc: 0, dr: 6 }]
  }
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function deepClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

export function createStructureSystem(deps) {
  /** @type {Record<string, any>} catálogo activo (defs) */
  let defs = {};
  /** @type {Array<{id:string,name:string,anchorC:number,anchorR:number,minC:number,maxC:number,minR:number,maxR:number,transform:string,variant:string}>} */
  const placed = [];
  let loadedFrom = 'defaults';

  // ── Utilidades de terreno/grid ────────────────────────────────────────────
  const grid = () => deps.getGrid();
  const biome = () => deps.getTileBiome();
  const height = () => (deps.getHeightMap ? deps.getHeightMap() : null);

  function inBounds(c, r) { return c >= 0 && r >= 0 && c < deps.COLS && r < deps.ROWS; }

  function tileIsWater(c, r) {
    try {
      if (!inBounds(c, r)) return true;
      if (deps.isRiver && deps.isRiver(c, r)) return true;
      const b = biome()[r] && biome()[r][c];
      return b === 'water';
    } catch (e) { return true; }
  }

  function tileHasBuilding(c, r) {
    try {
      return !!(grid()[r] && grid()[r][c]);
    } catch (e) { return true; }
  }

  function distanceToWater(c, r, maxRadius = 30) {
    for (let rad = 0; rad <= maxRadius; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          if (tileIsWater(c + dx, r + dy)) return rad;
        }
      }
    }
    return Infinity;
  }

  // ── Transformaciones de la plantilla ──────────────────────────────────────
  const TRANSFORMS = ['none', 'mirrorX', 'mirrorY', 'rot90', 'rot180', 'rot270'];
  function applyTransform(dc, dr, t) {
    switch (t) {
      case 'mirrorX': return [-dc, dr];
      case 'mirrorY': return [dc, -dr];
      case 'rot90': return [-dr, dc];
      case 'rot180': return [-dc, -dr];
      case 'rot270': return [dr, -dc];
      default: return [dc, dr];
    }
  }

  // ── Normalización del catálogo ────────────────────────────────────────────
  function normalizePiece(p) {
    if (!p) return null;
    const type = String(p.type || '').trim();
    if (!type) return null;
    return {
      type,
      dc: Math.round(num(p.dc, 0)),
      dr: Math.round(num(p.dr, 0)),
      chance: p.chance === undefined ? 1 : clamp(num(p.chance, 1), 0, 1),
      required: !!p.required
    };
  }
  function normalizeEntitySpec(p) {
    if (!p) return null;
    const kind = String(p.kind || 'ambient');
    const subtype = String(p.subtype || p.variant || '').trim();
    if (!subtype) return null;
    return {
      kind,
      subtype,
      variant: p.variant ? String(p.variant) : null,
      dc: Math.round(num(p.dc, 0)),
      dr: Math.round(num(p.dr, 0)),
      size: p.size === undefined ? undefined : num(p.size, 1),
      chance: p.chance === undefined ? 1 : clamp(num(p.chance, 1), 0, 1)
    };
  }
  function normalizeDef(id, raw) {
    if (!raw || typeof raw !== 'object') return null;
    const pieces = (Array.isArray(raw.pieces) ? raw.pieces : []).map(normalizePiece).filter(Boolean);
    if (!pieces.length) return null;
    const terrainList = (Array.isArray(raw.terrain) ? raw.terrain : [])
      .map(t => t && t.terrain ? { terrain: String(t.terrain), dc: Math.round(num(t.dc, 0)), dr: Math.round(num(t.dr, 0)) } : null)
      .filter(Boolean);
    const entityList = (Array.isArray(raw.entities) ? raw.entities : []).map(normalizeEntitySpec).filter(Boolean);
    const npcList = (Array.isArray(raw.npcs) ? raw.npcs : [])
      .map(n => n && (n.npcType || n.name) ? {
        npcType: String(n.npcType || 'villager'),
        name: n.name ? String(n.name) : null,
        dc: Math.round(num(n.dc, 0)),
        dr: Math.round(num(n.dr, 0)),
        chance: n.chance === undefined ? 1 : clamp(num(n.chance, 1), 0, 1)
      } : null)
      .filter(Boolean);
    const epochs = Array.isArray(raw.epochs) && raw.epochs.length
      ? raw.epochs.map(e => String(e))
      : (raw.epoch ? [String(raw.epoch)] : ['*']);
    return {
      id: String(id),
      name: String(raw.name || id),
      epochs,
      weight: clamp(num(raw.weight, 1), 0, 20),
      maxPerMap: Math.max(0, Math.round(num(raw.maxPerMap, 1))),
      minSpacing: Math.max(0, Math.round(num(raw.minSpacing, 18))),
      biomes: Array.isArray(raw.biomes) ? raw.biomes.map(String) : null,
      nearRiver: Array.isArray(raw.nearRiver) && raw.nearRiver.length === 2
        ? [Math.max(0, num(raw.nearRiver[0], 0)), Math.max(1, num(raw.nearRiver[1], 8))]
        : null,
      roadToNearest: raw.roadToNearest !== false,
      allowWater: !!raw.allowWater,
      anchor: raw.anchor === 'topleft' ? 'topleft' : 'center',
      pieces,
      terrain: terrainList,
      entities: entityList,
      npcs: npcList,
      custom: !!raw.custom
    };
  }

  function rebuild(rawDefs, source) {
    defs = {};
    Object.keys(rawDefs || {}).forEach(id => {
      const d = normalizeDef(id, rawDefs[id]);
      if (d) defs[id] = d;
    });
    loadedFrom = source || loadedFrom;
  }

  // ── Catálogo ──────────────────────────────────────────────────────────────
  function epochMatches(def, epoch) {
    if (!def.epochs || !def.epochs.length) return true;
    if (def.epochs.indexOf('*') >= 0) return true;
    return def.epochs.indexOf(epoch) >= 0;
  }
  function list(opts = {}) {
    const epoch = opts.epoch || (deps.getEpoch ? deps.getEpoch() : 'mesopotamia');
    return Object.keys(defs)
      .filter(id => opts.allEpochs || epochMatches(defs[id], epoch))
      .map(id => ({
        id,
        name: defs[id].name,
        weight: defs[id].weight,
        maxPerMap: defs[id].maxPerMap,
        epochs: defs[id].epochs,
        pieces: defs[id].pieces.length,
        placedCount: placed.filter(p => p.id === id).length,
        custom: !!defs[id].custom
      }));
  }
  function getDef(id) { return defs[id] || null; }

  function addDef(id, raw, opts = {}) {
    const d = normalizeDef(id, raw);
    if (!d) return { ok: false, reason: 'definición vacía o sin piezas' };
    d.custom = opts.custom !== false;
    defs[id] = d;
    if (opts.persist !== false) persist();
    return { ok: true, id };
  }
  function removeDef(id) {
    if (!defs[id]) return { ok: false, reason: 'no existe' };
    delete defs[id];
    persist();
    return { ok: true };
  }

  function persist() {
    try {
      const custom = {};
      Object.keys(defs).forEach(id => { if (defs[id].custom) custom[id] = defs[id]; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, structures: custom }));
    } catch (e) {}
  }
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const src = parsed && parsed.structures ? parsed.structures : parsed;
      if (!src || typeof src !== 'object') return false;
      Object.keys(src).forEach(id => {
        const d = normalizeDef(id, src[id]);
        if (d) { d.custom = true; defs[id] = d; }
      });
      loadedFrom = 'defaults+localStorage';
      return true;
    } catch (e) { return false; }
  }
  async function loadFromFile() {
    try {
      let json = null;
      if (window.__mesoPreload && window.__mesoPreload.structures) {
        json = window.__mesoPreload.structures;
      } else if (!(window.__mesoPreload && window.__mesoPreload.isElectron)) {
        try {
          const res = await fetch(FILE_PATH + '?v=' + Date.now(), { cache: 'no-store' });
          if (res && res.ok) json = await res.json();
        } catch (e) {}
      }
      if (!json) return false;
      const src = json.structures ? json.structures : json;
      if (!src || typeof src !== 'object') return false;
      Object.keys(src).forEach(id => {
        const d = normalizeDef(id, src[id]);
        if (d) defs[id] = d;
      });
      loadedFrom = (loadedFrom === 'defaults' ? 'file' : loadedFrom + '+file');
      return true;
    } catch (e) { return false; }
  }

  function exportJSON() {
    const out = {};
    Object.keys(defs).forEach(id => {
      const d = defs[id];
      out[id] = {
        name: d.name,
        epochs: d.epochs,
        weight: d.weight,
        maxPerMap: d.maxPerMap,
        minSpacing: d.minSpacing,
        ...(d.biomes ? { biomes: d.biomes } : {}),
        ...(d.nearRiver ? { nearRiver: d.nearRiver } : {}),
        ...(d.allowWater ? { allowWater: true } : {}),
        roadToNearest: d.roadToNearest,
        anchor: d.anchor,
        pieces: d.pieces,
        ...(d.terrain.length ? { terrain: d.terrain } : {}),
        ...(d.entities.length ? { entities: d.entities } : {}),
        ...(d.npcs.length ? { npcs: d.npcs } : {})
      };
    });
    return JSON.stringify({ version: 1, generatedBy: 'MesoBuilder · sistema de estructuras', structures: out }, null, 2);
  }
  function importJSON(text) {
    try {
      const parsed = typeof text === 'string' ? JSON.parse(text) : text;
      const src = parsed && parsed.structures ? parsed.structures : parsed;
      if (!src || typeof src !== 'object') return { ok: false, reason: 'JSON sin estructuras' };
      let n = 0;
      Object.keys(src).forEach(id => { if (addDef(id, src[id], { persist: false })) n++; });
      persist();
      return { ok: true, imported: n };
    } catch (e) { return { ok: false, reason: e.message }; }
  }

  // ── Geometría de la plantilla ─────────────────────────────────────────────
  function structureExtent(def, anchorC, anchorR, transform) {
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    const touch = (c, r, w = 1, h = 1) => {
      minC = Math.min(minC, c); maxC = Math.max(maxC, c + w - 1);
      minR = Math.min(minR, r); maxR = Math.max(maxR, r + h - 1);
    };
    def.pieces.forEach(p => {
      const [dc, dr] = applyTransform(p.dc, p.dr, transform);
      const size = deps.getBuildingSize(p.type) || { w: 1, h: 1 };
      // ancla: 'center' → la pieza se centra en el ancla; 'topleft' → esquina
      const w = size.w, h = size.h;
      const c = def.anchor === 'topleft' ? anchorC + dc : anchorC + dc - Math.floor(w / 2);
      const r = def.anchor === 'topleft' ? anchorR + dr : anchorR + dr - Math.floor(h / 2);
      p._c = c; p._r = r;
      touch(c, r, w, h);
    });
    def.terrain.forEach(t => {
      const [dc, dr] = applyTransform(t.dc, t.dr, transform);
      t._c = anchorC + dc; t._r = anchorR + dr;
      touch(t._c, t._r, 1, 1);
    });
    def.entities.forEach(e => {
      const [dc, dr] = applyTransform(e.dc, e.dr, transform);
      e._c = anchorC + dc; e._r = anchorR + dr;
      touch(e._c, e._r, 1, 1);
    });
    def.npcs.forEach(n => {
      const [dc, dr] = applyTransform(n.dc, n.dr, transform);
      n._c = anchorC + dc; n._r = anchorR + dr;
      touch(n._c, n._r, 1, 1);
    });
    return { minC, maxC, minR, maxR };
  }

  /** Comprueba si la estructura cabe en (anchorC, anchorR). No modifica nada. */
  function validate(id, anchorC, anchorR, opts = {}) {
    const def = defs[id];
    if (!def) return { ok: false, reason: 'estructura desconocida: ' + id };
    const epoch = opts.epoch || (deps.getEpoch ? deps.getEpoch() : 'mesopotamia');
    if (!opts.ignoreEpoch && !epochMatches(def, epoch)) {
      return { ok: false, reason: 'no aplica a la época ' + epoch };
    }
    const transform = opts.transform || 'none';
    const ext = structureExtent(def, Math.round(anchorC), Math.round(anchorR), transform);
    const pad = 1;
    if (ext.minC - pad < 0 || ext.minR - pad < 0 || ext.maxC + pad >= deps.COLS || ext.maxR + pad >= deps.ROWS) {
      return { ok: false, reason: 'se sale del mapa', extent: ext };
    }
    // agua
    if (!def.allowWater) {
      for (let r = ext.minR; r <= ext.maxR; r++) {
        for (let c = ext.minC; c <= ext.maxC; c++) {
          if (tileIsWater(c, r)) return { ok: false, reason: 'hay agua en la huella', extent: ext, at: { c, r } };
        }
      }
    }
    // edificios existentes
    for (const p of def.pieces) {
      const size = deps.getBuildingSize(p.type) || { w: 1, h: 1 };
      for (let dr = 0; dr < size.h; dr++) {
        for (let dc = 0; dc < size.w; dc++) {
          const c = p._c + dc, r = p._r + dr;
          if (tileHasBuilding(c, r)) {
            if (opts.clear) continue;
            return { ok: false, reason: 'hay construcciones en la huella', extent: ext, at: { c, r }, piece: p.type };
          }
        }
      }
    }
    // biomas
    if (def.biomes && def.biomes.length && !opts.ignoreBiome) {
      let ok = 0, total = 0;
      for (let r = ext.minR; r <= ext.maxR; r += 2) {
        for (let c = ext.minC; c <= ext.maxC; c += 2) {
          total++;
          const b = biome()[r] && biome()[r][c];
          if (def.biomes.indexOf(b) >= 0) ok++;
        }
      }
      const ratio = total ? ok / total : 0;
      if (ratio < (opts.biomeRatio === undefined ? 0.5 : opts.biomeRatio)) {
        return { ok: false, reason: `bioma poco adecuado (${Math.round(ratio * 100)}% válido)`, extent: ext, ratio };
      }
    }
    // distancia al agua
    if (def.nearRiver && !opts.ignoreRiver) {
      const d = distanceToWater(Math.round(anchorC), Math.round(anchorR), Math.ceil(def.nearRiver[1]) + 2);
      if (d < def.nearRiver[0] || d > def.nearRiver[1]) {
        return { ok: false, reason: `distancia al agua ${d} fuera de [${def.nearRiver[0]}, ${def.nearRiver[1]}]`, extent: ext, waterDistance: d };
      }
    }
    // separación con villas y otras estructuras
    const need = opts.minSpacing === undefined ? def.minSpacing : num(opts.minSpacing, def.minSpacing);
    if (need > 0 && !opts.ignoreSpacing) {
      const boxes = [
        ...(deps.getVillages ? deps.getVillages() : []).map(v => ({ name: 'villa ' + (v.name || v.type), minC: v.minC, maxC: v.maxC, minR: v.minR, maxR: v.maxR })),
        ...placed.map(p => ({ name: 'estructura ' + p.name, minC: p.minC, maxC: p.maxC, minR: p.minR, maxR: p.maxR })),
        ...(opts.extraBoxes || [])
      ];
      for (const b of boxes) {
        if (b.minC === undefined) continue;
        const gap = Math.max(
          b.minC - ext.maxC, ext.minC - b.maxC,
          b.minR - ext.maxR, ext.minR - b.maxR
        );
        if (gap < need) return { ok: false, reason: `demasiado cerca de ${b.name} (${gap} < ${need})`, extent: ext, gap };
      }
    }
    // pendiente (si hay heightmap)
    const hm = height();
    if (hm && !opts.ignoreHeight) {
      let hMin = Infinity, hMax = -Infinity;
      for (let r = ext.minR; r <= ext.maxR; r++) {
        for (let c = ext.minC; c <= ext.maxC; c++) {
          const v = hm[r] && hm[r][c];
          if (typeof v !== 'number') continue;
          if (v < hMin) hMin = v;
          if (v > hMax) hMax = v;
        }
      }
      if (Number.isFinite(hMin) && (hMax - hMin) > (opts.maxSlope === undefined ? 0.45 : opts.maxSlope)) {
        return { ok: false, reason: `terreno con pendiente (${(hMax - hMin).toFixed(2)})`, extent: ext };
      }
    }
    return { ok: true, extent: ext, transform };
  }

  // ── Colocación ────────────────────────────────────────────────────────────
  function clearArea(ext, opts = {}) {
    // quita vegetación y recursos dentro de la huella (opcional)
    if (!opts.removeEntities) return 0;
    let removed = 0;
    const list = deps.getEntities();
    for (let i = list.length - 1; i >= 0; i--) {
      const ent = list[i];
      if (!ent) continue;
      if (ent.kind !== 'tree' && ent.kind !== 'resource' && ent.kind !== 'ambient') continue;
      const c = typeof ent.col === 'number' ? ent.col : Math.floor(num(ent.x, -9999));
      const r = typeof ent.row === 'number' ? ent.row : Math.floor(num(ent.y, -9999));
      if (c >= ext.minC - 1 && c <= ext.maxC + 1 && r >= ext.minR - 1 && r <= ext.maxR + 1) {
        list.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  function placeTerrain(def, transform, opts) {
    const epoch = opts.epoch || (deps.getEpoch ? deps.getEpoch() : 'mesopotamia');
    def.terrain.forEach(t => {
      const c = t._c, r = t._r;
      if (!inBounds(c, r)) return;
      if (tileIsWater(c, r) && !def.allowWater) return;
      if (tileHasBuilding(c, r)) return;
      let terr = t.terrain;
      if (terr === 'road' && epoch === 'urss') terr = 'concrete_road';
      try { biome()[r][c] = terr; } catch (e) {}
    });
  }

  function placeEntitiesAndNpcs(def, opts) {
    const list = deps.getEntities();
    def.entities.forEach(e => {
      if (e.chance < 1 && Math.random() > e.chance) return;
      const c = e._c, r = e._r;
      if (!inBounds(c, r)) return;
      if (tileIsWater(c, r) && !def.allowWater) return;
      if (tileHasBuilding(c, r)) return;
      try {
        if (e.kind === 'tree') {
          list.push({
            id: 'tree-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            kind: 'tree', col: c, row: r, variant: e.variant || e.subtype, hp: 10,
            size: e.size === undefined ? 1.45 : e.size
          });
        } else if (e.kind === 'resource') {
          list.push({
            id: 'res-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            kind: 'resource', subtype: e.subtype, col: c, row: r, _born: Date.now(), _dropSeed: Math.random()
          });
        } else {
          list.push({
            id: 'ambient-' + e.subtype + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            kind: 'ambient', subtype: e.subtype, col: c, row: r, x: c, y: r,
            size: e.size === undefined ? 1 : e.size, nonInteractive: true
          });
        }
      } catch (err) {}
    });
    if (opts.skipNpcs) return;
    def.npcs.forEach(n => {
      if (n.chance < 1 && Math.random() > n.chance) return;
      const c = n._c, r = n._r;
      if (!inBounds(c, r)) return;
      if (tileIsWater(c, r) || tileHasBuilding(c, r)) return;
      try {
        const npc = deps.spawnNPC(n.name || undefined, c, r);
        if (npc) {
          npc.npcType = n.npcType || 'villager';
          npc._structureId = def.id;
        }
      } catch (e) {}
    });
  }

  /**
   * Coloca una estructura.
   * @returns {{ok:boolean, reason?:string, id?:string, anchor?:{c:number,r:number}, extent?:any, pieces?:Array}}
   */
  function place(id, anchorC, anchorR, opts = {}) {
    const def = defs[id];
    if (!def) return { ok: false, reason: 'estructura desconocida: ' + id };
    const ac = Math.round(num(anchorC, 0));
    const ar = Math.round(num(anchorR, 0));
    const check = validate(id, ac, ar, opts);
    if (!check.ok) return { ok: false, reason: check.reason, detail: check };
    const transform = check.transform || 'none';
    // recalcular la huella (validate ya fija las posiciones _c/_r de cada pieza)
    const ext = structureExtent(def, ac, ar, transform);

    if (opts.removeEntities !== false) clearArea(ext, { removeEntities: true });

    // 1) edificios
    const piecesPlaced = [];
    const skippedRequired = [];
    for (const p of def.pieces) {
      if (p.chance < 1 && Math.random() > p.chance) continue;
      const size = deps.getBuildingSize(p.type) || { w: 1, h: 1 };
      let placedOk = false;
      try {
        if (opts.clear) {
          // liberar toda la huella de la pieza antes de escribir
          for (let dr = 0; dr < size.h; dr++) {
            for (let dc = 0; dc < size.w; dc++) {
              const c = p._c + dc, r = p._r + dr;
              if (!inBounds(c, r)) continue;
              const cell = grid()[r][c];
              if (!cell) continue;
              const cellType = (typeof cell === 'string') ? cell : cell.type;
              const baseC = (typeof cell === 'object' && typeof cell.baseCol === 'number') ? cell.baseCol : c;
              const baseR = (typeof cell === 'object' && typeof cell.baseRow === 'number') ? cell.baseRow : r;
              try { deps.clearBuildingCells(baseC, baseR, cellType); } catch (e) { try { grid()[r][c] = null; } catch (e2) {} }
            }
          }
        }
        deps.setBuildingCells(p._c, p._r, p.type);
        placedOk = true;
      } catch (e) { placedOk = false; }
      if (placedOk) piecesPlaced.push({ type: p.type, c: p._c, r: p._r, w: size.w, h: size.h });
      else if (p.required) skippedRequired.push(p.type);
    }
    if (skippedRequired.length && opts.requireAll !== false) {
      // deshacer lo poco que se haya colocado y abortar
      piecesPlaced.forEach(pp => { try { deps.clearBuildingCells(pp.c, pp.r, pp.type); } catch (e) {} });
      return { ok: false, reason: 'no se pudo colocar: ' + skippedRequired.join(', '), extent: ext };
    }

    // 2) terreno (caminos/plazas)
    if (opts.paintTerrain !== false) placeTerrain(def, transform, opts);

    // 3) entidades y NPCs
    placeEntitiesAndNpcs(def, opts);

    // 4) carretera de acceso
    if (def.roadToNearest && opts.road !== false) {
      try {
        const target = nearestVillageCenter(ac, ar);
        if (target) {
          const gateC = Math.round((ext.minC + ext.maxC) / 2);
          const gateR = ext.maxR + 1;
          deps.carveRoadPath(gateC, gateR, target.c, target.r);
        }
      } catch (e) {}
    }

    const record = {
      id: def.id,
      name: def.name,
      anchorC: ac, anchorR: ar,
      minC: ext.minC, maxC: ext.maxC, minR: ext.minR, maxR: ext.maxR,
      transform,
      pieces: piecesPlaced
    };
    placed.push(record);
    try { deps.markMapDirty(); } catch (e) {}
    try { deps.saveState(); } catch (e) {}
    return { ok: true, id: def.id, name: def.name, anchor: { c: ac, r: ar }, extent: ext, pieces: piecesPlaced, transform };
  }

  function nearestVillageCenter(c, r) {
    const villages = (deps.getVillages ? deps.getVillages() : []) || [];
    let best = null, bestD = Infinity;
    villages.forEach(v => {
      if (v.minC === undefined) return;
      const c2 = Math.round((v.minC + v.maxC) / 2);
      const r2 = Math.round((v.minR + v.maxR) / 2);
      const d = Math.hypot(c2 - c, r2 - r);
      if (d < bestD) { bestD = d; best = { c: c2, r: r2 }; }
    });
    return best;
  }

  /** Elimina la estructura colocada cuya huella contiene (c,r). */
  function removeAt(c, r) {
    const idx = placed.findIndex(p => c >= p.minC - 1 && c <= p.maxC + 1 && r >= p.minR - 1 && r <= p.maxR + 1);
    if (idx < 0) return { ok: false, reason: 'no hay ninguna estructura aquí' };
    const rec = placed[idx];
    const def = defs[rec.id];
    let removedPieces = 0;
    (rec.pieces || []).forEach(p => {
      try { deps.clearBuildingCells(p.c, p.r, p.type); removedPieces++; } catch (e) {}
    });
    // limpiar entidades de la zona que pertenezcan al conjunto
    try {
      const list = deps.getEntities();
      for (let i = list.length - 1; i >= 0; i--) {
        const ent = list[i];
        if (!ent) continue;
        if (ent._structureId === rec.id) { list.splice(i, 1); continue; }
        if (ent.kind !== 'tree' && ent.kind !== 'resource' && ent.kind !== 'ambient') continue;
        const ec = typeof ent.col === 'number' ? ent.col : Math.floor(num(ent.x, -9999));
        const er = typeof ent.row === 'number' ? ent.row : Math.floor(num(ent.y, -9999));
        if (ec >= rec.minC - 1 && ec <= rec.maxC + 1 && er >= rec.minR - 1 && er <= rec.maxR + 1) list.splice(i, 1);
      }
    } catch (e) {}
    // restaurar bioma de caminos
    try {
      if (def) {
        structureExtent(def, rec.anchorC, rec.anchorR, rec.transform || 'none');
        def.terrain.forEach(t => {
          const c2 = t._c, r2 = t._r;
          if (inBounds(c2, r2) && !tileHasBuilding(c2, r2)) {
            const b = biome()[r2][c2];
            if (b === 'road' || b === 'concrete_road') biome()[r2][c2] = 'alluvial';
          }
        });
      }
    } catch (e) {}
    placed.splice(idx, 1);
    try { deps.markMapDirty(); } catch (e) {}
    try { deps.saveState(); } catch (e) {}
    return { ok: true, removed: rec.name, pieces: removedPieces };
  }

  // ── Captura: crear una estructura desde lo que hay en el mapa ─────────────
  /**
   * Toma los edificios/terreno/entidades alrededor de (c,r) y devuelve una
   * definición de estructura lista para guardar.
   */
  function capture(c, r, opts = {}) {
    const radius = Math.max(4, Math.round(num(opts.radius, 14)));
    const minC = Math.max(0, c - radius), maxC = Math.min(deps.COLS - 1, c + radius);
    const minR = Math.max(0, r - radius), maxR = Math.min(deps.ROWS - 1, r + radius);
    const seen = new Set();
    const pieces = [];
    const g = grid();
    for (let rr = minR; rr <= maxR; rr++) {
      for (let cc = minC; cc <= maxC; cc++) {
        const cell = g[rr] && g[rr][cc];
        if (!cell) continue;
        const type = (typeof cell === 'string') ? cell : cell.type;
        const baseC = (typeof cell === 'object' && typeof cell.baseCol === 'number') ? cell.baseCol : cc;
        const baseR = (typeof cell === 'object' && typeof cell.baseRow === 'number') ? cell.baseRow : rr;
        const key = baseC + ',' + baseR;
        if (seen.has(key)) continue;
        seen.add(key);
        pieces.push({ type, dc: baseC - c, dr: baseR - r });
      }
    }
    const terrain = [];
    const b = biome();
    for (let rr = minR; rr <= maxR; rr++) {
      for (let cc = minC; cc <= maxC; cc++) {
        const tb = b[rr] && b[rr][cc];
        if (tb === 'road' || tb === 'concrete_road' || tb === 'canal_road') {
          terrain.push({ terrain: tb, dc: cc - c, dr: rr - r });
        }
      }
    }
    const ents = [];
    (deps.getEntities() || []).forEach(ent => {
      if (!ent || ent.kind === 'player' || ent.kind === 'resource') return;
      const ec = typeof ent.col === 'number' ? ent.col : Math.floor(num(ent.x, -9999));
      const er = typeof ent.row === 'number' ? ent.row : Math.floor(num(ent.y, -9999));
      if (ec < minC || ec > maxC || er < minR || er > maxR) return;
      if (ent.kind === 'ambient') ents.push({ kind: 'ambient', subtype: ent.subtype, dc: ec - c, dr: er - r, size: ent.size });
      else if (ent.kind === 'tree') ents.push({ kind: 'tree', subtype: ent.variant || 'oak', dc: ec - c, dr: er - r, size: ent.size });
    });
    const draft = {
      name: opts.name || ('Estructura ' + new Date().toLocaleTimeString()),
      epochs: opts.epochs || ['*'],
      weight: num(opts.weight, 1),
      maxPerMap: num(opts.maxPerMap, 1),
      minSpacing: num(opts.minSpacing, 20),
      roadToNearest: opts.roadToNearest !== false,
      anchor: 'center',
      pieces,
      terrain,
      entities: ents,
      npcs: []
    };
    return { ok: pieces.length > 0, draft, stats: { pieces: pieces.length, terrain: terrain.length, entities: ents.length, radius } };
  }

  // ── Generación automática ────────────────────────────────────────────────
  /**
   * Reparte estructuras por el mapa. Pensado para llamarse desde generateMap()
   * después de las villas y antes de los recursos.
   */
  function generatePass(opts = {}) {
    const epoch = opts.epoch || (deps.getEpoch ? deps.getEpoch() : 'mesopotamia');
    const globalCap = num(opts.cap, 8);
    const attemptsPer = num(opts.attempts, 260);
    const results = { placed: [], failed: [], epoch };
    const candidates = Object.keys(defs)
      .filter(id => defs[id].weight > 0 && epochMatches(defs[id], epoch))
      .sort((a, b) => defs[b].weight - defs[a].weight);

    for (const id of candidates) {
      const def = defs[id];
      const allowed = Math.min(def.maxPerMap, globalCap - placed.length);
      if (allowed <= 0) { results.failed.push({ id, reason: 'límite alcanzado' }); continue; }
      let done = 0;
      const reasons = {};
      for (let a = 0; a < attemptsPer && done < allowed; a++) {
        const pos = samplePosition(def, opts);
        if (!pos) { reasons['sin ubicación candidata'] = (reasons['sin ubicación candidata'] || 0) + 1; continue; }
        const res = place(id, pos.c, pos.r, {
          epoch,
          transform: TRANSFORMS[Math.floor(Math.random() * TRANSFORMS.length)],
          removeEntities: true,
          minSpacing: def.minSpacing,
          extraBoxes: opts.extraBoxes || [],
          skipNpcs: !!deps.isPureMapEditor && deps.isPureMapEditor()
        });
        if (res.ok) { done++; results.placed.push({ id, name: def.name, c: pos.c, r: pos.r }); }
        else {
          // agrupar motivos para dar un informe útil (p. ej. "hay agua en la huella" ×112)
          const key = String(res.reason || 'motivo desconocido').replace(/\s*\(.*\)\s*$/, '');
          reasons[key] = (reasons[key] || 0) + 1;
        }
      }
      if (done === 0) {
        const top = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])[0];
        results.failed.push({ id, reason: top ? `${top} (×${reasons[top]})` : 'sin ubicación válida' });
      }
    }
    return results;
  }

  /** Busca una posición razonable para una estructura (sesgada por bioma/agua). */
  function samplePosition(def, opts = {}) {
    const tries = 40;
    for (let i = 0; i < tries; i++) {
      let c, r;
      if (def.nearRiver) {
        // buscar una celda de agua cercana y alejarse hacia tierra
        const wc = Math.floor(Math.random() * deps.COLS);
        const wr = Math.floor(Math.random() * deps.ROWS);
        if (!tileIsWater(wc, wr)) continue;
        const dist = def.nearRiver[0] + Math.random() * (def.nearRiver[1] - def.nearRiver[0]);
        const ang = Math.random() * Math.PI * 2;
        c = Math.round(wc + Math.cos(ang) * dist);
        r = Math.round(wr + Math.sin(ang) * dist);
      } else {
        c = Math.floor(6 + Math.random() * (deps.COLS - 12));
        r = Math.floor(6 + Math.random() * (deps.ROWS - 12));
      }
      if (!inBounds(c, r)) continue;
      if (!opts.ignoreBiome && def.biomes && def.biomes.length) {
        const b = biome()[r] && biome()[r][c];
        if (def.biomes.indexOf(b) < 0) continue;
      }
      return { c, r };
    }
    return null;
  }

  // ── Estado persistente ───────────────────────────────────────────────────
  function listPlaced() { return placed.slice(); }
  function clearPlaced(opts = {}) {
    if (opts.removeFromWorld) {
      while (placed.length) removeAt(placed[placed.length - 1].anchorC, placed[placed.length - 1].anchorR);
    } else {
      placed.length = 0;
    }
  }
  function restorePlaced(list) {
    placed.length = 0;
    (Array.isArray(list) ? list : []).forEach(p => { if (p && p.id) placed.push(p); });
  }

  // ── init ─────────────────────────────────────────────────────────────────
  function init() {
    rebuild(deepClone(DEFAULT_STRUCTURES) || {}, 'defaults');
    loadFromStorage();
    loadFromFile().then(() => { try { deps.onCatalogChanged && deps.onCatalogChanged(); } catch (e) {} }).catch(() => {});
    return { count: Object.keys(defs).length, from: loadedFrom };
  }

  return {
    init,
    list,
    listPlaced,
    getDef,
    addDef,
    removeDef,
    validate,
    place,
    removeAt,
    capture,
    generatePass,
    exportJSON,
    importJSON,
    persist,
    clearPlaced,
    restorePlaced,
    get source() { return loadedFrom; },
    get defaultsCount() { return Object.keys(DEFAULT_STRUCTURES).length; }
  };
}
