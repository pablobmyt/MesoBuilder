// engine/game-engine-settlement-utils.js
// ─────────────────────────────────────────────────────────────────────────────
// PLANIFICADOR DE ASENTAMIENTOS (ciudades, bases militares y aldeas)
//
// Problema que resuelve
// ---------------------
// El generador anterior colocaba los edificios en listas de desplazamientos
// "a mano" (cx±9, cy-7, …) con saltos aleatorios del 18 % / 35 % y luego
// dibujaba carreteras en estrella desde cada casa al centro. El resultado era
// un montón de casas sueltas que no daban a ninguna calle, muros que no
// cerraban nada y recintos militares enormes y vacíos.
//
// Modelo nuevo (determinista y legible)
// -------------------------------------
//   1. La ciudad se organiza en una RETÍCULA: un núcleo reservado en el
//      centro, y alrededor anillos de MANZANAS separadas por CALLES de 1
//      celda. La retícula tiene paso constante, así que las calles se cruzan
//      siempre y el viario queda conexo por construcción.
//   2. Cada manzana tiene un DISTRITO (cívico / residencial / industrial /
//      agrícola / militar) y se llena por BANDAS: una fila de edificios que da
//      a la calle de arriba y otra que da a la de abajo. Los edificios se
//      empaquetan de izquierda a derecha respetando su huella real, así que no
//      hay solapes ni huecos sin sentido.
//   3. Los muros recorren el perímetro y sólo se abren en las puertas, que se
//      sitúan siempre sobre una avenida (nunca sobre una manzana).
//   4. El mobiliario urbano (farolas, palmeras, garitas, cajas) va a espaciado
//      fijo sobre las intersecciones, no esparcido al azar.
//
// El planificador es PURO: no toca el mundo. Devuelve un objeto `plan` con
// listas de rectángulos y de piezas, y el motor (spawnVillage) es quien lo
// aplica con setBuildingCells / tileBiome / entities. Así el diseño se puede
// revisar, volcar a JSON o probar sin generar un mapa.
// ─────────────────────────────────────────────────────────────────────────────

const STREET_ROAD = 'road';
const STREET_CONCRETE = 'concrete_road';

// Generador pseudoaleatorio con semilla: el mismo asentamiento con la misma
// semilla sale idéntico, cosa que hace reparables los planos.
function makeRng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Catálogo de distritos por época ─────────────────────────────────────────
// El motor traduce los tipos de Mesopotamia a URSS con EPOCH_BUILDING_MAP,
// pero aquí ya se ofrecen los nombres soviéticos para que las manzanas
// soviéticas no acaben llenas de chozas de caña.
const DISTRICTS = {
  mesopotamia: {
    // Repetición = peso: las viviendas dominan, pero cada manzana residencial
    // lleva de vez en cuando un pozo o un granero en vez de otra casa.
    residential: ['house_small', 'house_small', 'house_small', 'house_small', 'hut', 'reed_hut', 'house', 'house_garden', 'well', 'granary'],
    civic: ['mesopotamian_villa_detailed', 'mesopotamian_house', 'temple', 'mesopotamian_baths', 'granary'],
    industrial: ['granary', 'pottery', 'sheepfold', 'market', 'house_small'],
    agricultural: ['farm', 'farm', 'farm', 'farm_plot', 'granary', 'sheepfold'],
    military: ['longhouse', 'longhouse', 'granary', 'tower'],
    command: ['temple'],
    stores: ['granary', 'market', 'pottery'],
    stables: ['sheepfold', 'farm', 'hut']
  },
  urss: {
    residential: ['soviet_block', 'soviet_block', 'soviet_block', 'soviet_superblock', 'house_small'],
    civic: ['party_hq', 'state_clinic', 'soviet_block'],
    industrial: ['state_warehouse', 'factory', 'state_warehouse', 'soviet_block'],
    agricultural: ['collective_farm', 'collective_farm', 'sheepfold', 'state_warehouse'],
    military: ['soviet_block', 'soviet_block', 'state_warehouse', 'state_clinic'],
    command: ['party_hq'],
    stores: ['state_warehouse', 'state_warehouse', 'state_clinic'],
    stables: ['collective_farm', 'sheepfold', 'state_warehouse']
  }
};

// ── Plantillas geométricas ──────────────────────────────────────────────────
// block ......... tamaño de una celda de manzana (ancho × alto) en celdas
// street ........ ancho de calle entre manzanas (2 celdas: es el cambio que
//                 hace que los asentamientos se puedan RECORRER. Con 1 celda,
//                 sumada al retranqueo 0 y a que los sprites se dibujan un 25 %
//                 más grandes que su huella, las fachadas se tocaban, no se
//                 veía el suelo entre casas y parecía que no se podía pasar.)
// setback ....... retranqueo: celdas libres entre la manzana y la calle, para
//                 que los edificios no den directamente al bordillo.
// coreRings ..... 0 = núcleo de 1 celda · 1 = núcleo de 3×3 celdas (recinto)
// rings ......... anillos de manzanas alrededor del núcleo
//                (nº total de celdas por eje = 1 + 2*(coreRings + rings))
// perimeter ..... calle perimetral (1 / 0)
// wall .......... muralla perimetral
const TEMPLATES = {
  capital: {
    kind: 'capital',
    block: { w: 6, h: 6 },
    street: 3,
    setback: 0,
    coreRings: 2,            // recinto monumental (una corona de celdas): el
                             // zigurat (12×12) respira dentro de su explanada
    rings: 1,                // una corona de manzanas alrededor
    perimeter: 1,
    wall: true,
    noWallEpochs: ['urss'],      // la capital soviética usa bulevares y controles de acceso
    coreTemplate: 'nucleo_capital',
    // Callejones de la manzana: 2 celdas entre edificios (no pegados).
    blockGap: 2,
    gates: [
      // len = 2 en los cuatro lados: el arco (2×1 o 1×2) cabe en el vano y la
      // puerta se ve de verdad (con len 1 no había hueco suficiente).
      { side: 'N', at: 9, len: 2 },
      { side: 'S', at: -10, len: 2 },
      { side: 'W', at: 9, len: 2 },
      { side: 'E', at: -10, len: 2 }
    ],
    props: true
  },
  military_base: {
    kind: 'military_base',
    block: { w: 6, h: 6 },
    street: 3,
    setback: 0,
    coreRings: 0,            // patio de armas de una celda
    rings: 1,                // 8 manzanas alrededor
    perimeter: 1,
    wall: true,
    blockGap: 1,
    coreTemplate: null,
    gates: [{ side: 'S', at: -1, len: 2 }],
    coreBuildings: ['well'],
    roles: {
      '-1,-1': 'command', '0,-1': 'military', '1,-1': 'military',
      '-1,0': 'stores', '1,0': 'stables',
      '-1,1': 'military', '0,1': 'stores', '1,1': 'stables'
    },
    props: true
  },
  village: {
    kind: 'village',
    block: { w: 5, h: 5 },
    street: 2,
    setback: 0,
    coreRings: 0,            // plazuela central con pozo
    rings: 1,                // 8 manzanas
    perimeter: 0,
    wall: false,
    blockGap: 1,
    coreTemplate: null,
    gates: [],
    coreBuildings: ['well'],
    maxBuildingsPerBlock: 2,
    props: true
  },
  trading_post: {
    kind: 'trading_post',
    block: { w: 5, h: 5 },
    street: 2,
    setback: 0,
    coreRings: 0,
    rings: 1,
    perimeter: 1,
    wall: false,
    blockGap: 1,
    coreTemplate: null,
    gates: [],
    coreBuildings: ['market'],
    maxBuildingsPerBlock: 2,
    props: true
  }
};

export function createSettlementPlanner(deps) {
  const COLS = Number(deps.COLS) || 180;
  const ROWS = Number(deps.ROWS) || 120;
  const getSize = (type) => {
    try {
      const s = deps.getBuildingSize ? deps.getBuildingSize(type) : null;
      if (s && Number(s.w) > 0 && Number(s.h) > 0) return { w: Math.round(s.w), h: Math.round(s.h) };
    } catch (e) {}
    return { w: 1, h: 1 };
  };

  // ── Geometría: retícula uniforme de celdas de manzana ────────────────────
  // Las celdas de manzana forman una cuadrícula de paso constante; el núcleo
  // ocupa las celdas centrales y el resto de celdas son manzanas, de modo que
  // los edificios envuelven el núcleo sin dejar brazos de terreno vacío.
  function buildGeometry(cfg) {
    const { block, street, coreRings, rings, perimeter, wall } = cfg;
    const pitchC = block.w + street;
    const pitchR = block.h + street;
    const startC = (i) => i * pitchC - Math.floor(block.w / 2);
    const startR = (j) => j * pitchR - Math.floor(block.h / 2);
    const halfBlocks = coreRings + rings;            // índice máximo de celda
    const outerC = startC(halfBlocks) + block.w - 1; // última columna de manzana
    const outerR = startR(halfBlocks) + block.h - 1;
    const perC = outerC + (perimeter ? 1 : 0);
    const perR = outerR + (perimeter ? 1 : 0);
    const wallC = perC + (wall ? 1 : 0);
    const wallR = perR + (wall ? 1 : 0);
    const coreCells = coreRings * 2 + 1;
    const core = {
      c: startC(-coreRings),
      r: startR(-coreRings),
      w: coreCells * pitchC - street,
      h: coreCells * pitchR - street
    };
    const blocks = [];
    for (let i = -halfBlocks; i <= halfBlocks; i++) {
      for (let j = -halfBlocks; j <= halfBlocks; j++) {
        if (Math.abs(i) <= coreRings && Math.abs(j) <= coreRings) continue;  // celdas del núcleo
        blocks.push({ c: startC(i), r: startR(j), w: block.w, h: block.h, cell: { i, j } });
      }
    }
    return { pitchC, pitchR, outerC, outerR, perC, perR, wallC, wallR, core, blocks, cfg };
  }

  // ── Distritos ────────────────────────────────────────────────────────────
  function districtFor(block, geo) {
    const cfg = geo.cfg;
    const { i, j } = block.cell;
    if (cfg.roles) {
      const key = `${i},${j}`;
      if (cfg.roles[key]) return cfg.roles[key];
    }
    if (cfg.kind === 'village' || cfg.kind === 'trading_post') {
      return j < 0 ? 'residential' : 'agricultural';
    }
    // Capital: la fachada norte del recinto es el barrio cívico (templos,
    // villas, baños), el resto del norte es residencial, la banda central es
    // industrial y sólo las esquinas del sur quedan como campos de cultivo.
    if (j < 0) return Math.abs(i) <= 1 ? 'civic' : 'residential';
    if (j === 0) return 'industrial';
    if (j === 1) return 'industrial';
    return Math.abs(i) <= 1 ? 'industrial' : 'agricultural';
  }

  // Bandas horizontales de una manzana (de arriba abajo).
  function bandsOf(h) {
    const bandH = h >= 5 ? 3 : 2;
    const bands = [];
    let rem = h;
    while (rem > 0) {
      const b = Math.min(bandH, rem);
      bands.push(b);
      rem -= b;
    }
    return bands;
  }

  // ── Llenado de una manzana ──────────────────────────────────────────────
  // Primero se intenta una pieza monumental que ocupe la manzana entera; si no,
  // se empaquetan edificios por bandas, de izquierda a derecha, cada banda
  // pegada a su calle.
  //
  // DENSIDAD: las viviendas ya NO van adosadas. Iban con `gap = 0`, así que una
  // manzana entera era un bloque continuo de casas y los pueblos parecían un
  // apilamiento. Ahora todas las manzanas dejan un callejón de una celda, y una
  // de cada tres manzanas residenciales es CÍVICA: un solo edificio
  // representativo (templo, granero, mercado, villa) con el resto del solar
  // libre, como patio.
  function fillBlock(block, district, pool, rng, opts) {
    const out = [];
    const maxB = (opts && opts.maxBuildings) || 99;
    if (!pool || !pool.length) return out;
    // Callejón entre edificios de la misma manzana (la capital usa 2 celdas).
    const gap = Math.max(1, Math.round(Number(opts && opts.gap) || 1));
    // RETRANQUEO: los edificios no se pegan a la calle; queda una franja libre
    // de `inset` celdas por dentro del bordillo de la manzana. Es lo que hace
    // que se vea el suelo y que las fachadas no se solapen con los sprites del
    // lado de enfrente (que se dibujan un 25 % más anchos que su huella).
    const inset = Math.max(0, Math.round(Number(opts && opts.setback) || 0));
    const usable = {
      c: block.c + inset,
      r: block.r + inset,
      w: block.w - inset * 2,
      h: block.h - inset * 2
    };
    if (usable.w < 1 || usable.h < 1) return out;
    const sizes = pool.map(t => ({ t, s: getSize(t) }));

    const monuments = sizes
      .filter(x => x.s.w >= usable.w - 1 && x.s.h >= usable.h - 1)
      .sort((a, b) => (b.s.w * b.s.h) - (a.s.w * a.s.h));
    if (monuments.length && rng() < 0.35) {
      const m = monuments[0];
      out.push({
        c: usable.c + Math.floor((usable.w - m.s.w) / 2),
        r: usable.r + Math.floor((usable.h - m.s.h) / 2),
        w: m.s.w, h: m.s.h, type: m.t, district
      });
      // OJO: aquí hay que CORTAR. Antes seguía el relleno por bandas y levantaba
      // casas ENCIMA del monumento (el granero y la casa compartían celda, y el
      // pueblo parecía un apilamiento de sprites: era el «están muy
      // apelotonados»). Un monumento ocupa la manzana entera.
      return out;
    }

    // Manzana cívica: un edificio representativo y el resto libre
    const civicPool = (opts && opts.civicPool) || [];
    if (district === 'residential' && civicPool.length && rng() < 0.25) {
      const pick = civicPool[Math.floor(rng() * civicPool.length)];
      const sz = getSize(pick);
      out.push({
        c: usable.c + Math.max(0, Math.floor((usable.w - sz.w) / 2)),
        r: usable.r + Math.max(0, Math.floor((usable.h - sz.h) / 2)),
        w: sz.w, h: sz.h, type: pick, district: 'civic'
      });
      return out;
    }

    let r = usable.r;
    // En manzanas no residenciales se evita repetir el mismo taller varias
    // veces en la misma manzana (si no, salían 19 alfarerías seguidas).
    const usedTypes = new Set();
    // Las bandas se separan también en VERTICAL (misma `gap`): antes se apilaban
    // pegadas (`r += bandH`) y dos casas de bandas contiguas quedaban adosadas
    // por el tejado, que es lo que hacía que los pueblos pareciesen un bloque.
    while (r < usable.r + usable.h) {
      const remainingH = usable.r + usable.h - r;
      const bandH = Math.min(remainingH >= 5 ? 3 : 2, remainingH);
      if (bandH < 1) break;
      let c = usable.c;
      let guard = 0;
      let colocadosEnBanda = 0;
      while (c + 1 <= usable.c + usable.w && out.length < maxB && guard++ < 12) {
        const free = usable.c + usable.w - c;
        const candidates = sizes.filter(x => x.s.h <= bandH && x.s.w <= free);
        if (!candidates.length) break;
        const fresh = district === 'residential' ? candidates : candidates.filter(x => !usedTypes.has(x.t));
        const pool2 = fresh.length ? fresh : candidates;
        const choice = pool2[Math.floor(rng() * pool2.length)];
        usedTypes.add(choice.t);
        out.push({
          c, r: r + (bandH - choice.s.h),
          w: choice.s.w, h: choice.s.h, type: choice.t, district
        });
        colocadosEnBanda++;
        c += choice.s.w + gap;
      }
      if (!colocadosEnBanda) break;   // ya no cabe nada más en esta manzana
      r += bandH + gap;
    }
    return out;
  }

  // ── Calles: complemento de manzanas y núcleo sobre la retícula ──────────
  // Se emiten rectángulos (no celdas sueltas) agrupando columnas/filas con el
  // mismo hueco libre, de modo que quedan avenidas continuas de una pieza.
  function buildStreets(geo, kind) {
    const { perC, perR, core, blocks } = geo;
    const W = perC * 2 + 1;
    const H = perR * 2 + 1;
    const occupied = [];
    for (let r = 0; r < H; r++) occupied.push(new Array(W).fill(false));
    const mark = (rect) => {
      for (let r = rect.r + perR; r < rect.r + perR + rect.h; r++) {
        for (let c = rect.c + perC; c < rect.c + perC + rect.w; c++) {
          if (r >= 0 && r < H && c >= 0 && c < W) occupied[r][c] = true;
        }
      }
    };
    if (core) mark(core);
    blocks.forEach(mark);

    const rects = [];
    // Columnas: rangos de filas libres
    const colKey = (i) => {
      const ranges = [];
      let start = null;
      for (let r = 0; r < H; r++) {
        const free = !occupied[r][i];
        if (free && start === null) start = r;
        if (!free && start !== null) { ranges.push([start, r - 1]); start = null; }
      }
      if (start !== null) ranges.push([start, H - 1]);
      return ranges;
    };
    let prevKey = null, prevRanges = null, prevI = 0;
    const flushCols = (ranges, i0, i1) => {
      ranges.forEach(([r0, r1]) => {
        rects.push({ c: i0 - perC, r: r0 - perR, w: i1 - i0 + 1, h: r1 - r0 + 1, kind });
      });
    };
    for (let i = 0; i < W; i++) {
      const ranges = colKey(i);
      const key = JSON.stringify(ranges);
      if (key !== prevKey) {
        if (prevKey !== null && prevRanges.length) flushCols(prevRanges, prevI, i - 1);
        prevKey = key; prevRanges = ranges; prevI = i;
      }
    }
    if (prevKey !== null && prevRanges && prevRanges.length) flushCols(prevRanges, prevI, W - 1);

    // Filas: rangos de columnas libres
    const rowKey = (j) => {
      const ranges = [];
      let start = null;
      for (let i = 0; i < W; i++) {
        const free = !occupied[j][i];
        if (free && start === null) start = i;
        if (!free && start !== null) { ranges.push([start, i - 1]); start = null; }
      }
      if (start !== null) ranges.push([start, W - 1]);
      return ranges;
    };
    prevKey = null; prevRanges = null; prevI = 0;
    const flushRows = (ranges, j0, j1) => {
      ranges.forEach(([c0, c1]) => {
        rects.push({ c: c0 - perC, r: j0 - perR, w: c1 - c0 + 1, h: j1 - j0 + 1, kind });
      });
    };
    for (let j = 0; j < H; j++) {
      const ranges = rowKey(j);
      const key = JSON.stringify(ranges);
      if (key !== prevKey) {
        if (prevKey !== null && prevRanges.length) flushRows(prevRanges, prevI, j - 1);
        prevKey = key; prevRanges = ranges; prevI = j;
      }
    }
    if (prevKey !== null && prevRanges && prevRanges.length) flushRows(prevRanges, prevI, H - 1);

    // Fuera de la calle perimetral no hay viario urbano: se recorta el
    // rectángulo perimetral para no invadir el terreno natural.
    return rects;
  }

  // ── Puertas alineadas con las avenidas ──────────────────────────────────
  // Las puertas de la plantilla llevan una posición (`at`) «a ojo». Si esa
  // columna/fila no es una avenida real, la calle muere contra el lienzo: se ve
  // la calzada llegar a la muralla y cortarse. Aquí cada puerta se desplaza a la
  // avenida LIBRE más cercana (columna o fila que cruza todo el asentamiento).
  function snapGatesToStreets(geo, gates) {
    const list = (gates || []).map(g => ({ ...g }));
    if (!list.length) return list;
    const { perC, perR } = geo;
    const rects = buildStreets(geo, STREET_ROAD);
    const W = perC * 2 + 1;
    const H = perR * 2 + 1;
    const cover = [];
    for (let r = 0; r < H; r++) cover.push(new Array(W).fill(false));
    rects.forEach(rc => {
      for (let r = rc.r; r < rc.r + rc.h; r++) {
        for (let c = rc.c; c < rc.c + rc.w; c++) {
          const rr = r + perR;
          const cc = c + perC;
          if (rr >= 0 && rr < H && cc >= 0 && cc < W) cover[rr][cc] = true;
        }
      }
    });
    const isStreet = (c, r) => {
      const rr = r + perR;
      const cc = c + perC;
      return rr >= 0 && rr < H && cc >= 0 && cc < W && cover[rr][cc];
    };
    const fullCols = [];
    const fullRows = [];
    for (let c = -perC; c <= perC; c++) {
      let ok = true;
      for (let r = -perR; r <= perR && ok; r++) if (!isStreet(c, r)) ok = false;
      if (ok) fullCols.push(c);
    }
    for (let r = -perR; r <= perR; r++) {
      let ok = true;
      for (let c = -perC; c <= perC && ok; c++) if (!isStreet(c, r)) ok = false;
      if (ok) fullRows.push(r);
    }
    list.forEach(g => {
      const lines = (g.side === 'N' || g.side === 'S') ? fullCols : fullRows;
      if (!lines.length) return;
      let best = null;
      let bestD = Infinity;
      lines.forEach(v => {
        const d = Math.abs(v - g.at);
        if (d < bestD) { bestD = d; best = v; }
      });
      if (best !== null) g.at = best;
    });
    return list;
  }

  // ── Muralla + puertas + torres ──────────────────────────────────────────
  function buildWalls(geo) {
    const { cfg, wallC, wallR } = geo;
    if (!cfg.wall) return { segments: [], towers: [], gatePieces: [] };
    const segments = [];
    const towers = [];
    // `geo.gates` ya viene alineado con las avenidas (snapGatesToStreets).
    const gates = geo.gates || cfg.gates || [];
    const inGate = (side, pos) => gates.some(g => g.side === side && pos >= g.at && pos < g.at + g.len);

    // Muros N/S
    for (const side of ['N', 'S']) {
      const r = side === 'N' ? -wallR : wallR;
      let run = null;
      for (let c = -wallC; c <= wallC; c++) {
        const solid = !inGate(side, c);
        if (solid && run === null) run = c;
        if (!solid && run !== null) { segments.push({ c: run, r, w: c - run, h: 1, orient: 'h' }); run = null; }
      }
      if (run !== null) segments.push({ c: run, r, w: wallC - run + 1, h: 1, orient: 'h' });
    }
    // Muros O/E
    for (const side of ['W', 'E']) {
      const c = side === 'W' ? -wallC : wallC;
      let run = null;
      for (let r = -wallR + 1; r <= wallR - 1; r++) {
        const solid = !inGate(side, r);
        if (solid && run === null) run = r;
        if (!solid && run !== null) { segments.push({ c, r: run, w: 1, h: r - run, orient: 'v' }); run = null; }
      }
      if (run !== null) segments.push({ c, r: run, w: 1, h: wallR - run, orient: 'v' });
    }
    // Torres esquinera (2×2) hacia dentro
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        towers.push({
          c: sx > 0 ? wallC - 1 : -wallC,
          r: sy > 0 ? wallR - 1 : -wallR,
          w: 2, h: 2, corner: true
        });
      }
    }
    // Torres flanqueando cada puerta, proyectadas hacia fuera
    gates.forEach(g => {
      if (g.side === 'N' || g.side === 'S') {
        const r = g.side === 'N' ? -wallR - 1 : wallR - 1;
        towers.push({ c: g.at - 2, r, w: 2, h: 2, gate: g.side });
        towers.push({ c: g.at + g.len, r, w: 2, h: 2, gate: g.side });
      } else {
        const c = g.side === 'W' ? -wallC - 1 : wallC - 1;
        towers.push({ c, r: g.at - 2, w: 2, h: 2, gate: g.side });
        towers.push({ c, r: g.at + g.len, w: 2, h: 2, gate: g.side });
      }
    });
    // Puertas ya situadas sobre el muro (con su lado y su ancho).
    // OJO: el plano consume `walls.gates`, así que buildWalls SIEMPRE debe
    // devolver esa lista (antes devolvía sólo `gatePieces` y el planificador
    // reventaba al pedir su longitud: los asentamientos con muralla
    // desaparecían del mapa sin dejar rastro).
    const gateList = gates.map(g => {
      const onVerticalWall = (g.side === 'W' || g.side === 'E');
      return {
        ...g,
        c: onVerticalWall ? (g.side === 'W' ? -wallC : wallC) : g.at,
        r: onVerticalWall ? g.at : (g.side === 'N' ? -wallR : wallR),
        w: onVerticalWall ? 1 : g.len,
        h: onVerticalWall ? g.len : 1
      };
    });
    return { segments, towers, gates: gateList };
  }

  // ── Mobiliario urbano a espaciado fijo ──────────────────────────────────
  function buildProps(geo, epoch, rng) {
    const { cfg, perC, perR, core, blocks } = geo;
    const props = [];
    const soviet = epoch === 'urss';
    const lamp = soviet ? 'soviet_streetlight' : 'lamp_post';
    const isBlocked = (c, r) => {
      if (c >= core.c && c < core.c + core.w && r >= core.r && r < core.r + core.h) return true;
      return blocks.some(b => c >= b.c && c < b.c + b.w && r >= b.r && r < b.r + b.h);
    };
    // Avenidas: calles que recorren todo el asentamiento de lado a lado.
    const fullCols = [];
    for (let c = -perC; c <= perC; c++) {
      let ok = true;
      for (let r = -perR; r <= perR && ok; r++) if (isBlocked(c, r)) ok = false;
      if (ok) fullCols.push(c);
    }
    const fullRows = [];
    for (let r = -perR; r <= perR; r++) {
      let ok = true;
      for (let c = -perC; c <= perC && ok; c++) if (isBlocked(c, r)) ok = false;
      if (ok) fullRows.push(r);
    }
    // Farolas en las intersecciones, una de cada dos: alineadas y equidistantes.
    fullCols.forEach((c, i) => {
      fullRows.forEach((r, j) => {
        if ((i + j) % 2 !== 0) return;
        props.push({ subtype: lamp, c, r, size: 1 });
      });
    });
    // Esquinas del núcleo: palmeras (Mesopotamia) o monumento y farolas (URSS)
    const corners = [
      [core.c - 1, core.r - 1], [core.c + core.w, core.r - 1],
      [core.c - 1, core.r + core.h], [core.c + core.w, core.r + core.h]
    ];
    corners.forEach(([c, r], i) => {
      if (soviet && i === 0) props.push({ subtype: 'soviet_monument', c: c + 1, r: r + 1, size: 1.15 });
      else if (soviet) props.push({ subtype: lamp, c, r, size: 1 });
      else props.push({ subtype: 'date_palm', c, r, size: 1 });
    });
    // Vía procesional (capital) o patio de armas (fuerte): piezas a paso fijo
    const step = Math.max(2, Math.round(core.w / 4));
    for (let c = core.c; c < core.c + core.w; c += step) {
      if (cfg.kind === 'military_base') {
        props.push({ subtype: 'guard_booth', c, r: core.r - 1, size: 0.95 });
        props.push({ subtype: 'guard_booth', c, r: core.r + core.h, size: 0.95 });
      } else {
        props.push({ subtype: soviet ? 'soviet_streetlight' : 'lamp_post', c, r: core.r - 1, size: 1 });
        props.push({ subtype: soviet ? 'soviet_streetlight' : 'lamp_post', c, r: core.r + core.h, size: 1 });
      }
    }
    // Garitas junto a las puertas (las alineadas con las avenidas)
    (geo.gates || cfg.gates || []).forEach(g => {
      if (g.side === 'N') props.push({ subtype: 'guard_booth', c: g.at + 1, r: -geo.wallR + 1, size: 0.95 });
      if (g.side === 'S') props.push({ subtype: 'guard_booth', c: g.at + g.len, r: geo.wallR - 1, size: 0.95 });
      if (g.side === 'W') props.push({ subtype: 'guard_booth', c: -geo.wallC + 1, r: g.at - 1, size: 0.95 });
      if (g.side === 'E') props.push({ subtype: 'guard_booth', c: geo.wallC - 1, r: g.at + g.len, size: 0.95 });
    });
    // Cajas de suministros en las manzanas industriales o de almacén
    blocks.forEach(b => {
      const d = b.district;
      if (d !== 'industrial' && d !== 'stores') return;
      if (rng() < 0.5) return;
      props.push({ subtype: 'crate_stack', c: b.c + Math.floor(b.w / 2), r: b.r + Math.floor(b.h / 2), size: 0.95 });
    });
    return props;
  }

  /**
   * Genera el plano de un asentamiento.
   * @param {{type:string,cx:number,cy:number,epoch?:string,seed?:number,random?:Function}} opts
   * @returns {object|null} plan listo para aplicar
   */
  function planSettlement(opts) {
    const type = String(opts.type || 'village');
    const cfg = TEMPLATES[type];
    if (!cfg) return null;
    const epoch = opts.epoch === 'urss' ? 'urss' : 'mesopotamia';
    const rng = typeof opts.random === 'function' ? opts.random : makeRng(opts.seed || (Date.now() ^ (opts.cx * 7919) ^ (opts.cy * 104729) ^ 0x9e3779b9));
    const geo = buildGeometry(cfg);
    const cx = Math.round(Number(opts.cx) || 0);
    const cy = Math.round(Number(opts.cy) || 0);
    const pools = DISTRICTS[epoch];

    // Manzanas con distrito y relleno
    const buildings = [];
    geo.blocks.forEach(b => {
      b.district = districtFor(b, geo);
      const pool = pools[b.district] || pools.residential;
      const pieces = fillBlock(b, b.district, pool, rng, { maxBuildings: cfg.maxBuildingsPerBlock, civicPool: pools.civic, gap: cfg.blockGap, setback: cfg.setback });
      pieces.forEach(p => buildings.push(p));
    });

    // Núcleo: piezas sueltas (pozo / mercado) o plantilla de estructura aparte
    if (geo.core && cfg.coreBuildings && cfg.coreBuildings.length) {
      cfg.coreBuildings.forEach(t => {
        const s = getSize(t);
        buildings.push({
          c: geo.core.c + Math.floor((geo.core.w - s.w) / 2),
          r: geo.core.r + Math.floor((geo.core.h - s.h) / 2),
          w: s.w, h: s.h, type: t, district: 'core', block: null
        });
      });
    }

    const streets = buildStreets(geo, epoch === 'urss' ? STREET_CONCRETE : STREET_ROAD);
    // Las puertas se colocan sobre las AVENIDAS reales: así la calle siempre
    // desemboca en un vano y no se ve la calzada cortada contra el lienzo.
    geo.gates = snapGatesToStreets(geo, cfg.gates);
    const withoutWall = !!(cfg.noWallEpochs && cfg.noWallEpochs.indexOf(epoch) >= 0);
    const walls = (cfg.wall && !withoutWall)
      ? buildWalls(geo)
      : { segments: [], towers: [], gates: [] };
    // Sin muralla (capital URSS) las avenidas siguen teniendo control de acceso
    const gateList = walls.gates.length ? walls.gates : (withoutWall ? geo.gates : []);
    const props = cfg.props ? buildProps(geo, epoch, rng) : [];

    // Extensión total (incluye muralla) para reservar terreno y limpiar
    const halfC = geo.wallC;
    const halfR = geo.wallR;
    const plan = {
      ok: true,
      type,
      epoch,
      cx, cy,
      core: geo.core ? { c: cx + geo.core.c, r: cy + geo.core.r, w: geo.core.w, h: geo.core.h } : null,
      coreTemplate: cfg.coreTemplate,
      blocks: geo.blocks.map(b => ({ c: cx + b.c, r: cy + b.r, w: b.w, h: b.h, district: b.district, cell: b.cell })),
      buildings: buildings.map(p => ({ c: cx + p.c, r: cy + p.r, w: p.w, h: p.h, type: p.type, district: p.district })),
      streets: streets.map(s => ({ c: cx + s.c, r: cy + s.r, w: s.w, h: s.h, kind: s.kind })),
      walls: {
        segments: walls.segments.map(s => ({ c: cx + s.c, r: cy + s.r, w: s.w, h: s.h, orient: s.orient })),
        towers: walls.towers.map(t => ({ c: cx + t.c, r: cy + t.r, w: t.w, h: t.h })),
        gates: gateList.map(g => ({ ...g, c: g.side === 'W' ? cx - geo.wallC : (g.side === 'E' ? cx + geo.wallC : cx + g.at), r: g.side === 'N' ? cy - geo.wallR : (g.side === 'S' ? cy + geo.wallR : cy + g.at) }))
      },
      props: props.map(p => ({ subtype: p.subtype, c: cx + p.c, r: cy + p.r, size: p.size })),
      extent: {
        minC: Math.max(0, cx - halfC),
        maxC: Math.min(COLS - 1, cx + halfC),
        minR: Math.max(0, cy - halfR),
        maxR: Math.min(ROWS - 1, cy + halfR),
        halfC, halfR
      },
      footprint: { w: halfC * 2 + 1, h: halfR * 2 + 1 }
    };
    plan.summary = describePlan(plan);
    return plan;
  }

  // Resumen para consola: sirve para comprobar de un vistazo que el reparto
  // tiene sentido (densidad, calles, distritos) sin abrir el mapa.
  function describePlan(plan) {
    if (!plan) return null;
    const byDistrict = {};
    plan.buildings.forEach(b => { byDistrict[b.district] = (byDistrict[b.district] || 0) + 1; });
    const built = plan.buildings.reduce((a, b) => a + b.w * b.h, 0);
    // Cobertura real de viario: se cuenta cada celda una sola vez (los
    // rectángulos de columnas y de filas se solapan en los cruces).
    const seen = new Set();
    plan.streets.forEach(s => {
      for (let r = s.r; r < s.r + s.h; r++) for (let c = s.c; c < s.c + s.w; c++) seen.add(r * 1000 + c);
    });
    let streetCells = 0;
    seen.forEach(k => {
      const c = k % 1000, r = (k - c) / 1000;
      if (c < plan.extent.minC || c > plan.extent.maxC || r < plan.extent.minR || r > plan.extent.maxR) return;
      streetCells++;
    });
    const area = plan.footprint.w * plan.footprint.h;
    return {
      type: plan.type,
      footprint: `${plan.footprint.w}×${plan.footprint.h}`,
      buildings: plan.buildings.length,
      byDistrict,
      density: Number((built / area).toFixed(3)),
      streetCoverage: Number((streetCells / area).toFixed(3)),
      wallSegments: plan.walls.segments.length,
      towers: plan.walls.towers.length,
      gates: plan.walls.gates.length,
      props: plan.props.length
    };
  }

  return { planSettlement, describePlan, TEMPLATES, makeRng, districtFor };
}
