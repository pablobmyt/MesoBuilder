// tools/build-interiors.js
// ─────────────────────────────────────────────────────────────────────────────
// Generador de los interiores de los edificios (data/interiors/*.json).
//
// El interior se escribe aquí como ARTE ASCII, igual que los sprites de los
// edificios: es más corto, se revisa de un vistazo y no se cuelan despistes
// (muebles dentro de un muro, puertas que no están en el muro, etc.).
//
//   #  muro            .  suelo            r  alfombra
//   D  puerta (vano)   P  cuadro          W  ventana      T  antorcha
//   b  cama            t  mesa            c  silla        s  estantería
//   k  cofre           p  ornamento       l  planta       o  mostrador
//   f  hogar (fogón)
//
// CONVENIO (lo que espera el motor):
//   · Anillo de muros de una celda en todo el perímetro.
//   · El vano `D` va en el muro sur (última fila) y también en la fila de
//     justo encima, que es la que mira el motor para el cartel «Salir [E]».
//   · `entryCol`/`entryRow` (dentro de la sala, delante del vano) van en la
//     RAÍZ del JSON y también en cada planta.
//
// Uso:  node tools/build-interiors.js [--dry]
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'interiors');
const dry = process.argv.includes('--dry');

const CHARS = {
  '#': 'wall', '.': 'floor', r: 'rug', D: 'door', P: 'painting', W: 'window', T: 'torch',
  b: 'bed', t: 'table', c: 'chair', s: 'bookshelf', k: 'chest', p: 'pot', l: 'plant',
  o: 'counter', f: 'firepit'
};

const PALETTES = {
  adobe: {
    back: '#9B7B5A', backDark: '#8B6B4A', backLight: '#AB8B6A',
    left: '#8B6B4A', leftDark: '#7B5B3A', right: '#AB8B6A', rightDark: '#9B7B5A',
    floor: '#C8A87A', floorDark: '#BFA070', trim: '#5A3A1A', baseboard: '#4A2A0A', ceiling: '#3A2A1A'
  },
  ladrillo: {
    back: '#A2643E', backDark: '#8B5334', backLight: '#B87A50',
    left: '#8B5334', leftDark: '#77452B', right: '#B87A50', rightDark: '#A2643E',
    floor: '#C9A87C', floorDark: '#BC9C70', trim: '#5A3A1A', baseboard: '#4A2A0A', ceiling: '#3A2A1A'
  },
  soviet: {
    back: '#8A8F96', backDark: '#6E737A', backLight: '#A2A7AE',
    left: '#7A7F86', leftDark: '#63686E', right: '#9AA0A8', rightDark: '#848A92',
    floor: '#9A9186', floorDark: '#8C8478', trim: '#4A4E54', baseboard: '#3A3E44', ceiling: '#2E3238'
  }
};

// ── Interiores ──────────────────────────────────────────────────────────────
// `art` es la planta; `palette` el juego de colores; `npcs` los habitantes.
const INTERIORS = {
  'house-small': {
    palette: 'adobe',
    defaultFloor: 0,
    chestItems: ['wheat', 'wheat', 'stone', 'brick'],
    floors: [{
      name: 'Planta baja',
      art: [
        '#########',
        '#P##W##P#',
        '#bb.ttcc#',
        '#...rr..#',
        '#p.rr.k.#',
        '####D####',
        '####D####'
      ],
      npcs: [{ col: 5, row: 2, name: 'Aldeana' }]
    }]
  },

  house: {
    palette: 'adobe',
    defaultFloor: 0,
    chestItems: ['wheat', 'brick', 'bread'],
    floors: [{
      name: 'Planta baja',
      art: [
        '###########',
        '#P##W###P##',
        '#bb...s.k.#',
        '#bb.....t.#',
        '#...rr.cc.#',
        '#p..rr....#',
        '#l.......p#',
        '#####D#####',
        '#####D#####'
      ],
      npcs: [{ col: 6, row: 2, name: 'Aldeano' }, { col: 3, row: 7, name: 'Anciana' }]
    }]
  },

  house_large: {
    palette: 'ladrillo',
    defaultFloor: 0,
    chestItems: ['wheat', 'bread', 'stone'],
    floors: [{
      name: 'Planta baja',
      art: [
        '#############',
        '#P###W####P##',
        '#bb......s.k#',
        '#bb..rr...t.#',
        '#....rr.cc..#',
        '#p.....###..#',
        '#l..........#',
        '#..tt..p.l..#',
        '######D######',
        '######D######'
      ],
      npcs: [{ col: 4, row: 3, name: 'Aldeano' }, { col: 9, row: 3, name: 'Aldeana' }, { col: 6, row: 7, name: 'Niña' }]
    }]
  },

  house_garden: {
    palette: 'adobe',
    defaultFloor: 0,
    chestItems: ['wheat', 'wheat', 'brick'],
    floors: [{
      name: 'Patio interior',
      art: [
        '###########',
        '#P##W###P##',
        '#b..ll..k.#',
        '#b.llll...#',
        '#..rrr..cc#',
        '#p.rrr....#',
        '#..ll.ll..#',
        '#####D#####',
        '#####D#####'
      ],
      npcs: [{ col: 5, row: 2, name: 'Jardinera' }, { col: 8, row: 5, name: 'Aldeano' }]
    }]
  },

  residential_tower: {
    palette: 'soviet',
    defaultFloor: 0,
    chestItems: ['brick', 'stone', 'bread'],
    floors: [
      {
        name: 'Portal',
        art: [
          '#########',
          '#P##W##P#',
          '#oo...s.#',
          '#c......#',
          '#...rr..#',
          '#k......#',
          '####D####',
          '####D####'
        ],
        npcs: [{ col: 5, row: 6, name: 'Conserje' }]
      },
      {
        name: 'Primer piso',
        art: [
          '#########',
          '#P##W##P#',
          '#bb...s.#',
          '#bb..rr.#',
          '#....rr.#',
          '#p.....c#',
          '####D####',
          '####D####'
        ],
        npcs: [{ col: 4, row: 3, name: 'Mikhail Petrov' }, { col: 6, row: 6, name: 'Olga Sokolova' }]
      },
      {
        name: 'Segundo piso',
        art: [
          '#########',
          '#P##W##P#',
          '#..k.s..#',
          '#tt...bb#',
          '#cc...bb#',
          '#...rr..#',
          '####D####',
          '####D####'
        ],
        npcs: [{ col: 3, row: 5, name: 'Yuri Volkov' }]
      }
    ]
  },

  house_player_home: {
    palette: 'adobe',
    defaultFloor: 0,
    chestItems: ['wheat', 'bread', 'stone'],
    floors: [{
      name: 'Casa familiar',
      art: [
        '###########',
        '#P##W###T##',
        '#bb...s...#',
        '#bb.....k.#',
        '#..rrr..cc#',
        '#p.rrr....#',
        '#l..f.....#',
        '#####D#####',
        '#####D#####'
      ],
      npcs: [
        { col: 3, row: 5, name: 'Madre', npcType: 'villager' },
        { col: 8, row: 3, name: 'Hermana', npcType: 'villager' },
        { col: 6, row: 6, name: 'Padre', npcType: 'villager' }
      ]
    }]
  }
};

// ── Conversión ──────────────────────────────────────────────────────────────
function toTiles(art) {
  return art.map(row => row.split('').map(ch => {
    const t = CHARS[ch];
    if (!t) throw new Error('carácter desconocido en el arte: ' + ch);
    return t;
  }));
}

function validateTiles(name, tiles) {
  const problems = [];
  const h = tiles.length, w = tiles[0].length;
  for (const row of tiles) if (row.length !== w) problems.push('filas de distinto ancho');
  // Anillo de muros: perímetro cerrado (la puerta cuenta como muro).
  const isWallLike = (t) => t === 'wall' || t === 'painting' || t === 'window' || t === 'torch' || t === 'door';
  for (let c = 0; c < w; c++) {
    if (!isWallLike(tiles[0][c])) problems.push('hueco en el muro norte en la columna ' + c);
    if (!isWallLike(tiles[h - 1][c])) problems.push('hueco en el muro sur en la columna ' + c);
  }
  for (let r = 0; r < h; r++) {
    if (!isWallLike(tiles[r][0])) problems.push('hueco en el muro oeste en la fila ' + r);
    if (!isWallLike(tiles[r][w - 1])) problems.push('hueco en el muro este en la fila ' + r);
  }
  // Puerta en el muro sur y en la fila de dentro (lo que mira el motor).
  const doorCols = [];
  for (let c = 0; c < w; c++) if (tiles[h - 1][c] === 'door') doorCols.push(c);
  if (doorCols.length !== 1) problems.push('el muro sur debe tener exactamente una puerta (tiene ' + doorCols.length + ')');
  if (doorCols.length === 1 && tiles[h - 2][doorCols[0]] !== 'door') problems.push('falta la puerta en la fila de dentro (fila ' + (h - 2) + ')');
  if (problems.length) throw new Error(name + ': ' + problems.join(' · '));
  return { w, h, doorCol: doorCols[0] };
}

function buildOne(id, def) {
  const floors = [];
  let firstDoor = null;
  for (const f of def.floors) {
    const tiles = toTiles(f.art);
    const info = validateTiles(id + '/' + f.name, tiles);
    if (!firstDoor) firstDoor = info;
    floors.push({
      name: f.name,
      width: info.w,
      height: info.h,
      entryCol: info.doorCol,
      entryRow: info.h - 2,
      wallPalette: PALETTES[def.palette] || PALETTES.adobe,
      tiles,
      npcs: f.npcs || []
    });
  }
  return {
    interiorId: id,
    defaultFloor: def.defaultFloor || 0,
    entryCol: firstDoor.doorCol,
    entryRow: firstDoor.h - 2,
    chestItems: def.chestItems || ['wheat'],
    npcs: floors[0].npcs || [],
    floors
  };
}

// ── Escritura ───────────────────────────────────────────────────────────────
let written = 0;
for (const [id, def] of Object.entries(INTERIORS)) {
  try {
    const data = buildOne(id, def);
    const file = path.join(OUT_DIR, id + '.json');
    if (!dry) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    written++;
    const f0 = data.floors[0];
    console.log('  ' + id.padEnd(22) + f0.width + '×' + f0.height + '  plantas: ' + data.floors.length +
      '  puerta: col ' + data.entryCol + '  npcs: ' + (data.npcs || []).length);
  } catch (e) {
    console.error('  ' + id + ' → ERROR: ' + e.message);
    process.exitCode = 1;
  }
}
console.log((dry ? 'Validados' : 'Escritos') + ' ' + written + ' interiores en data/interiors/');
