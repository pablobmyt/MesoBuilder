/**
 * Arte del personaje (jugador y NPCs) — MÓDULO COMPARTIDO
 * ---------------------------------------------------------------------------
 * Este fichero es la ÚNICA fuente de verdad del aspecto del personaje:
 *   · la paleta por defecto y las opciones de color del editor,
 *   · los presets (oficio, título, paleta y ropa),
 *   · las rejillas de los sprites detallados por época (24×24),
 *   · la armadura del guardia de puerta (se pinta encima, deducida del sprite),
 *   · el recoloreo (`mapDetailedHumanoidColor`) y el dibujo (`drawHumanoid`).
 *
 * Lo importan DOS sitios:
 *   1. `engine/game-engine.js` → dibuja al jugador y a los NPCs en el mundo.
 *   2. `index.html` (menú) → vista previa del editor de personaje.
 *
 * Antes el menú tenía su propio arte (unas rejillas ASCII de 8×8 sin relación
 * con el sprite del juego), así que la vista previa mostraba un personaje que
 * NO era el que luego aparecía al jugar. Al compartir este módulo, la vista
 * previa y el juego dibujan la misma rejilla con el mismo recoloreo.
 */

// ── Paleta por defecto ──────────────────────────────────────────────────────
export const DEFAULT_PALETTE = {
  skin: '#FFAC75',
  hair: '#B96B27',
  cloth: '#4F772D',
  trim: '#9E2A2B'
};

// Colores ofrecidos por el editor de personaje (menú).
export const PALETTE_OPTIONS = {
  skin: ['#C8956C', '#CFA07A', '#D2A178', '#B7835E'],
  hair: ['#2C1A0A', '#3D2510', '#1A1208', '#5A3A1A'],
  cloth: ['#8B6914', '#2E6FA3', '#4A7C3F', '#A0522D', '#D2691E'],
  trim: ['#DAA520', '#C8A84B', '#E8D5A3', '#F5ECD7']
};

// ── Ropas (rejilla simple de la silueta; el sprite detallado manda) ─────────
export const CHARACTER_OUTFITS = {
  // Todas las rejillas son 12 filas × 10 columnas. Tokens:
  // h = pelo · s = piel · c = tela · t = remate (acento)
  tunic: {
    name: 'Túnica',
    desc: 'Clásica y equilibrada.',
    map: [
      '...hhhh...',
      '..hssssh..',
      '..hssssh..',
      '..hs..sh..',
      '...ssss...',
      '..tcccct..',
      '.ttcccctt.',
      '..cccccc..',
      '...cttc...',
      '...c..c...',
      '..cc..cc..',
      '..ct..tc..'
    ]
  },
  robe: {
    name: 'Toga',
    desc: 'Larga y ceremonial.',
    map: [
      '...hhhh...',
      '..hssssh..',
      '..hssssh..',
      '..hs..sh..',
      '...ssss...',
      '..tttttt..',
      '..tcccct..',
      '..cccccc..',
      '..cccccc..',
      '..ccttcc..',
      '..cccccc..',
      '.ttcccctt.'
    ]
  },
  shawl: {
    name: 'Manto',
    desc: 'Con hombros marcados.',
    map: [
      '...hhhh...',
      '..hssssh..',
      '..hssssh..',
      '..hs..sh..',
      '...ssss...',
      '.tttttttt.',
      '.ttcccctt.',
      '..tcccct..',
      '...cccc...',
      '...cttc...',
      '..cc..cc..',
      '..cc..cc..'
    ]
  },
  armor: {
    name: 'Armadura',
    desc: 'Más robusta y ornamentada.',
    map: [
      '...hhhh...',
      '..hhsshh..',
      '..hssssh..',
      '..hs..sh..',
      '...ssss...',
      '..tttttt..',
      '.ttcccctt.',
      '.ttcccctt.',
      '..tcccct..',
      '..tttttt..',
      '..tc..ct..',
      '..tt..tt..'
    ]
  },
  worker: {
    name: 'Delantal',
    desc: 'Práctica para trabajar.',
    map: [
      '...hhhh...',
      '..hssssh..',
      '..hssssh..',
      '..hs..sh..',
      '...ssss...',
      '..cccccc..',
      '..ctttcc..',
      '..cccccc..',
      '..tcccct..',
      '...c..c...',
      '..cc..cc..',
      '..ss..ss..'
    ]
  }
};

// ── Presets ─────────────────────────────────────────────────────────────────
export const CHARACTER_PRESETS = [
  { id:'scribe', name:'Ninsun', title:'Escriba', classId:'scribe', outfit:'robe', palette:{ skin:'#CFA07A', hair:'#2C1A0A', cloth:'#2E6FA3', trim:'#DAA520' } },
  { id:'scout', name:'Kishar', title:'Explorador', classId:'scout', outfit:'shawl', palette:{ skin:'#C79063', hair:'#3D2510', cloth:'#4A7C3F', trim:'#C8A84B' } },
  { id:'builder', name:'Urim', title:'Maestro de obras', classId:'builder', outfit:'worker', palette:{ skin:'#D2A178', hair:'#1A1208', cloth:'#A0522D', trim:'#E8D5A3' } },
  { id:'priest', name:'Enhedu', title:'Sacerdote', classId:'priest', outfit:'robe', palette:{ skin:'#CFA07A', hair:'#3A2612', cloth:'#F5ECD7', trim:'#8B6914' } },
  { id:'merchant', name:'Tamar', title:'Mercader', classId:'merchant', outfit:'tunic', palette:{ skin:'#C8956C', hair:'#2B1C12', cloth:'#D2691E', trim:'#C8A84B' } }
];

/**
 * Protagonista del MODO HISTORIA. Es fijo: el guion (`docs/GUION-NARRATIVO.md`)
 * describe a Adapa como cazador superviviente de Kidu-Lam, así que su aspecto
 * no se elige: piel curtida, pelo oscuro, sayal de lana y remates de cuero.
 */
export const PRESET_ADAPA = {
  id: 'adapa',
  name: 'Adapa',
  title: 'Cazador de Kidu-Lam',
  classId: 'scout',
  outfit: 'shawl',
  story: true,
  palette: { skin: '#C79063', hair: '#2C1A0A', cloth: '#8F7A4E', trim: '#A0522D' }
};

/**
 * Paleta de la GUARDIA DE PUERTA (control militar y aduanero). La armadura se
 * pinta encima con `drawSoldierKit`; aquí sólo van los colores de debajo (piel,
 * pelo, ropa): la túnica de lana y el sayal rojo bajo la coraza de bronce en
 * Mesopotamia, y el uniforme y la pelliza sobre el peto de acero en la URSS.
 */
export const GATE_GUARD_PALETTES = {
  mesopotamia: { skin: '#C79063', hair: '#2C1A0A', cloth: '#7A3A2A', trim: '#8E2B23' },
  urss: { skin: '#E0B48C', hair: '#3B2A1A', cloth: '#3E4A5A', trim: '#8E2B23' }
};

/** Paleta del guardia según la época (Mesopotamia por defecto). */
export function gateGuardPalette(epochId) {
  return (epochId === 'urss') ? GATE_GUARD_PALETTES.urss : GATE_GUARD_PALETTES.mesopotamia;
}

// ── Sprites detallados por época (24×24) ────────────────────────────────────
export const DETAILED_HUMANOID_SPRITE_URSS = {
  grid: 24,
  pixels: [
    [8,3,"#000000"],[9,3,"#000000"],[10,3,"#000000"],[11,3,"#000000"],[12,3,"#000000"],[13,3,"#000000"],[14,3,"#000000"],[15,3,"#000000"],
    [7,4,"#000000"],[8,4,"#98551B"],[9,4,"#98551B"],[10,4,"#98551B"],[11,4,"#98551B"],[12,4,"#98551B"],[13,4,"#98551B"],[14,4,"#98551B"],[15,4,"#98551B"],[16,4,"#000000"],
    [7,5,"#000000"],[8,5,"#B96B27"],[9,5,"#B96B27"],[10,5,"#B96B27"],[11,5,"#B96B27"],[12,5,"#B96B27"],[13,5,"#B96B27"],[14,5,"#B96B27"],[15,5,"#98551B"],[16,5,"#000000"],
    [6,6,"#000000"],[7,6,"#B96B27"],[8,6,"#B96B27"],[9,6,"#B96B27"],[10,6,"#B96B27"],[11,6,"#B96B27"],[12,6,"#B96B27"],[13,6,"#B96B27"],[14,6,"#B96B27"],[15,6,"#98551B"],[16,6,"#000000"],
    [6,7,"#000000"],[7,7,"#B96B27"],[8,7,"#B96B27"],[9,7,"#98551B"],[10,7,"#98551B"],[11,7,"#B96B27"],[12,7,"#B96B27"],[13,7,"#B96B27"],[14,7,"#B96B27"],[15,7,"#98551B"],[16,7,"#000000"],
    [6,8,"#000000"],[7,8,"#FFAC75"],[8,8,"#FFAC75"],[9,8,"#B96B27"],[10,8,"#B96B27"],[11,8,"#FFAC75"],[12,8,"#FFAC75"],[13,8,"#FFAC75"],[14,8,"#B96B27"],[15,8,"#98551B"],[16,8,"#000000"],
    [6,9,"#000000"],[7,9,"#FFAC75"],[8,9,"#FFAC75"],[9,9,"#FFAC75"],[10,9,"#FFAC75"],[11,9,"#FFAC75"],[12,9,"#FFAC75"],[13,9,"#FFAC75"],[14,9,"#FFAC75"],[15,9,"#98551B"],[16,9,"#000000"],
    [6,10,"#000000"],[7,10,"#FFAC75"],[8,10,"#FFAC75"],[9,10,"#FFAC75"],[10,10,"#FFAC75"],[11,10,"#FFAC75"],[12,10,"#FFAC75"],[13,10,"#FFAC75"],[14,10,"#FFAC75"],[15,10,"#FFAC75"],[16,10,"#000000"],
    [6,11,"#000000"],[7,11,"#FFAC75"],[8,11,"#000000"],[9,11,"#FFAC75"],[10,11,"#FFAC75"],[11,11,"#FFAC75"],[12,11,"#000000"],[13,11,"#FFAC75"],[14,11,"#FFAC75"],[15,11,"#FFAC75"],[16,11,"#000000"],
    [6,12,"#000000"],[7,12,"#FFAC75"],[8,12,"#FFAC75"],[9,12,"#FFAC75"],[10,12,"#98551B"],[11,12,"#98551B"],[12,12,"#FFAC75"],[13,12,"#FFAC75"],[14,12,"#FFAC75"],[15,12,"#FFAC75"],[16,12,"#000000"],
    [6,13,"#000000"],[7,13,"#FFAC75"],[8,13,"#FFAC75"],[9,13,"#98551B"],[10,13,"#000000"],[11,13,"#000000"],[12,13,"#98551B"],[13,13,"#FFAC75"],[14,13,"#FFAC75"],[15,13,"#FFAC75"],[16,13,"#000000"],
    [6,14,"#000000"],[7,14,"#FFAC75"],[8,14,"#FFAC75"],[9,14,"#FFAC75"],[10,14,"#FFAC75"],[11,14,"#FFAC75"],[12,14,"#FFAC75"],[13,14,"#FFAC75"],[14,14,"#FFAC75"],[15,14,"#FFAC75"],[16,14,"#000000"],
    [7,15,"#000000"],[8,15,"#000000"],[9,15,"#000000"],[10,15,"#000000"],[11,15,"#000000"],[12,15,"#000000"],[13,15,"#000000"],[14,15,"#000000"],[15,15,"#000000"],
    [7,16,"#4F772D"],[8,16,"#4F772D"],[9,16,"#FFFFFF"],[10,16,"#4F772D"],[11,16,"#4F772D"],[12,16,"#4F772D"],[13,16,"#D6E2E6"],[14,16,"#D6E2E6"],[15,16,"#000000"],
    [6,17,"#000000"],[7,17,"#4F772D"],[8,17,"#D6E2E6"],[9,17,"#4F772D"],[10,17,"#4F772D"],[11,17,"#4F772D"],[12,17,"#4F772D"],[13,17,"#9E2A2B"],[14,17,"#9E2A2B"],[15,17,"#D6E2E6"],[16,17,"#000000"],
    [6,18,"#000000"],[7,18,"#FFAC75"],[8,18,"#4F772D"],[9,18,"#4F772D"],[10,18,"#4F772D"],[11,18,"#4F772D"],[12,18,"#4F772D"],[13,18,"#9E2A2B"],[14,18,"#9E2A2B"],[15,18,"#7D838C"],[16,18,"#000000"],
    [6,19,"#000000"],[7,19,"#3A5A40"],[8,19,"#4F772D"],[9,19,"#4F772D"],[10,19,"#D6E2E6"],[11,19,"#4F772D"],[12,19,"#3A5A40"],[13,19,"#9E2A2B"],[14,19,"#9E2A2B"],[15,19,"#7D838C"],[16,19,"#000000"],
    [7,20,"#000000"],[8,20,"#836343"],[9,20,"#836343"],[10,20,"#D6E2E6"],[11,20,"#836343"],[12,20,"#836343"],[13,20,"#000000"],[14,20,"#000000"],[15,20,"#000000"],
    [8,21,"#000000"],[9,21,"#836343"],[10,21,"#836343"],[11,21,"#836343"],[12,21,"#836343"],[13,21,"#000000"],
    [8,22,"#000000"],[9,22,"#3D4045"],[11,22,"#3D4045"],[12,22,"#000000"],
    [8,23,"#000000"],[9,23,"#000000"],[11,23,"#000000"],[12,23,"#000000"]
  ]
};

export const DETAILED_HUMANOID_SPRITE_MESOPOTAMIA = {
  grid: 24,
  // OJO con las filas 3 y 4: el pelo de arriba (filas 0-2) y la cara (filas 5-8)
  // estaban separados por dos filas vacias, y eso se veia como una LINEA
  // TRANSPARENTE cruzando la cabeza. Ahora las filas 3 y 4 son pelo (y el borde
  // oscuro de la linea del pelo justo encima de la cara).
  pixels: [
    [11,0,"#111111"],[12,0,"#111111"],[10,1,"#111111"],[11,1,"#222222"],[12,1,"#222222"],[13,1,"#111111"],[10,2,"#222222"],[11,2,"#1A1A1A"],[12,2,"#1A1A1A"],[13,2,"#222222"],[14,2,"#222222"],[9,3,"#111111"],
    [10,3,"#222222"],[11,3,"#222222"],[12,3,"#1A1A1A"],[13,3,"#1A1A1A"],[14,3,"#222222"],
    [10,4,"#111111"],[11,4,"#1A1A1A"],[12,4,"#1A1A1A"],[13,4,"#1A1A1A"],[14,4,"#111111"],
    [11,6,"#B88A68"],[12,6,"#D9AE8C"],[13,6,"#000000"],[14,6,"#D9AE8C"],[11,7,"#D9AE8C"],[12,7,"#B88A68"],[13,7,"#D9AE8C"],[14,7,"#111111"],[11,8,"#B88A68"],[12,8,"#B88A68"],
    [10,9,"#C89D42"],[11,9,"#40E0D0"],[12,9,"#C89D42"],[13,9,"#7F1F24"],[14,9,"#C89D42"],[8,10,"#D9AE8C"],[9,10,"#D9AE8C"],[10,10,"#B88A68"],[11,10,"#24324F"],[12,10,"#1A253A"],[13,10,"#24324F"],[14,10,"#D9AE8C"],[15,10,"#D9AE8C"],
    [8,11,"#B88A68"],[9,11,"#D9AE8C"],[10,11,"#1A253A"],[11,11,"#24324F"],[12,11,"#24324F"],[13,11,"#1A253A"],[14,11,"#B88A68"],[15,11,"#B88A68"],[9,12,"#B88A68"],[10,12,"#1A253A"],[11,12,"#C89D42"],[12,12,"#C89D42"],[13,12,"#C89D42"],[14,12,"#24324F"],[15,12,"#D9AE8C"],
    [10,13,"#24324F"],[11,13,"#1A253A"],[12,13,"#C89D42"],[13,13,"#E0C06A"],[14,13,"#C89D42"],[9,14,"#1A253A"],[10,14,"#24324F"],[11,14,"#24324F"],[12,14,"#1A253A"],[13,14,"#24324F"],[14,14,"#24324F"],
    [9,15,"#D9AE8C"],[10,15,"#B88A68"],[11,15,"#24324F"],[12,15,"#1A253A"],[13,15,"#24324F"],[14,15,"#B88A68"],[15,15,"#D9AE8C"],[10,16,"#C89D42"],[11,16,"#E0C06A"],[12,16,"#C89D42"],[13,16,"#7F1F24"],[14,16,"#7F1F24"],[15,16,"#C89D42"],
    [10,17,"#C89D42"],[11,17,"#C89D42"],[12,17,"#7F1F24"],[13,17,"#7F1F24"],[14,17,"#7F1F24"],[15,17,"#C89D42"],[10,18,"#7F1F24"],[11,18,"#9B2A2D"],[12,18,"#7F1F24"],[13,18,"#9B2A2D"],[14,18,"#7F1F24"],[15,18,"#9B2A2D"],
    [10,19,"#7F1F24"],[11,19,"#7F1F24"],[12,19,"#7F1F24"],[13,19,"#7F1F24"],[14,19,"#7F1F24"],[15,19,"#7F1F24"],[10,20,"#C89D42"],[11,20,"#B48F3A"],[12,20,"#C89D42"],[13,20,"#B48F3A"],[14,20,"#C89D42"],[15,20,"#B48F3A"],
    [10,21,"#D9AE8C"],[11,21,"#B88A68"],[13,21,"#D9AE8C"],[14,21,"#B88A68"],[10,22,"#D9AE8C"],[11,22,"#8E6B4B"],[13,22,"#D9AE8C"],[14,22,"#8E6B4B"],[10,23,"#8E6B4B"],[11,23,"#8E6B4B"],[13,23,"#8E6B4B"],[14,23,"#8E6B4B"],
    [10,5,"#222222"],[11,5,"#D9AE8C"],[12,5,"#D9AE8C"],[13,5,"#1A1A1A"],[14,5,"#111111"],[10,6,"#D9AE8C"],[10,7,"#D9AE8C"]
  ]
};

export const USE_DETAILED_HUMANOID_SPRITE = true;

/** Sprite detallado que corresponde a una época (Mesopotamia por defecto). */
export function humanoidSpriteFor(epochId) {
  const key = epochId || 'mesopotamia';
  return key === 'urss' ? DETAILED_HUMANOID_SPRITE_URSS : DETAILED_HUMANOID_SPRITE_MESOPOTAMIA;
}

export function humanoidGridSize(epochId) {
  if (USE_DETAILED_HUMANOID_SPRITE) return humanoidSpriteFor(epochId).grid;
  const rowWidth = (CHARACTER_OUTFITS.tunic.map[0] || '').length || 10;
  return Math.max(rowWidth, CHARACTER_OUTFITS.tunic.map.length || 12);
}

export function humanoidHeadRows(epochId) {
  if (!USE_DETAILED_HUMANOID_SPRITE) return 4;
  return humanoidSpriteFor(epochId) === DETAILED_HUMANOID_SPRITE_URSS ? 15 : 16;
}

// ── Color ───────────────────────────────────────────────────────────────────
export function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

export function shadeHexColor(hex, factor = 1) {
  try {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(value)) return hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    const toHex = (n) => clampByte(n).toString(16).padStart(2, '0');
    return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`.toUpperCase();
  } catch (e) {
    return hex;
  }
}

/**
 * Traduce un color «clave» del sprite detallado al color real del personaje.
 * El arte está pintado con tonos fijos; aquí se sustituyen por la piel, el pelo,
 * la tela y los remates de la paleta elegida (conservando luces y sombras).
 */
export function mapDetailedHumanoidColor(baseColor, palette, sprite) {
  const skin = (palette && palette.skin) || DEFAULT_PALETTE.skin;
  const hair = (palette && palette.hair) || DEFAULT_PALETTE.hair;
  const cloth = (palette && palette.cloth) || DEFAULT_PALETTE.cloth;
  const trim = (palette && palette.trim) || DEFAULT_PALETTE.trim;
  const color = String(baseColor || '').toUpperCase();
  if (sprite === DETAILED_HUMANOID_SPRITE_MESOPOTAMIA) {
    if (color === '#D9AE8C') return skin;
    if (color === '#B88A68') return shadeHexColor(skin, 0.86);
    if (color === '#8E6B4B') return shadeHexColor(skin, 0.62);
    if (color === '#24324F') return cloth;
    if (color === '#1A253A') return shadeHexColor(cloth, 0.72);
    if (color === '#C89D42') return trim;
    if (color === '#E0C06A') return shadeHexColor(trim, 1.18);
    if (color === '#B48F3A') return shadeHexColor(trim, 0.86);
    if (color === '#7F1F24') return shadeHexColor(trim, 0.7);
    if (color === '#9B2A2D') return shadeHexColor(trim, 0.82);
    if (color === '#111111') return shadeHexColor(hair, 0.42);
    if (color === '#1A1A1A') return shadeHexColor(hair, 0.5);
    if (color === '#222222') return shadeHexColor(hair, 0.58);
    if (color === '#40E0D0') return shadeHexColor(trim, 1.35);
    return baseColor;
  }
  if (color === '#FFAC75') return skin;
  if (color === '#98551B') return shadeHexColor(hair, 0.86);
  if (color === '#B96B27') return shadeHexColor(hair, 1.04);
  if (color === '#4F772D') return cloth;
  if (color === '#3A5A40') return shadeHexColor(cloth, 0.72);
  if (color === '#D6E2E6') return shadeHexColor(cloth, 1.32);
  if (color === '#9E2A2B') return trim;
  return baseColor;
}

/**
 * Dibuja el personaje detallado (el del juego) en un contexto cualquiera.
 * Lo usa la VISTA PREVIA del menú para que se vea exactamente el sprite que
 * aparecerá al jugar.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{skin,hair,cloth,trim}} palette
 * @param {number} x  esquina izquierda (px de destino)
 * @param {number} y  esquina superior (px de destino)
 * @param {number} scale  px de pantalla por píxel de arte
 * @param {{epoch?:string, flip?:boolean}} [opts]  `flip` espeja el sprite (el de
 *        Mesopotamia está pintado al revés y el motor lo espeja al mirar al frente)
 */
export function drawHumanoid(ctx, palette, x, y, scale, opts) {
  const options = opts || {};
  const sprite = humanoidSpriteFor(options.epoch);
  const grid = sprite.grid || 24;
  const s = Math.max(1, scale || 1);
  const flip = !!options.flip;
  const pal = palette || DEFAULT_PALETTE;
  for (let i = 0; i < sprite.pixels.length; i++) {
    const p = sprite.pixels[i];
    if (!p || !p[2]) continue;
    const px = flip ? (grid - 1 - p[0]) : p[0];
    ctx.fillStyle = mapDetailedHumanoidColor(p[2], pal, sprite);
    ctx.fillRect(Math.round(x + px * s), Math.round(y + p[1] * s), s, s);
  }
}

// ── GUARDIA DE PUERTA (control de paso) ─────────────────────────────────────
// El sprite detallado es ÚNICO por época (24×24) y la ropa no cambia el dibujo,
// así que la armadura NO puede ser otra rejilla: se pinta ENCIMA, en las mismas
// coordenadas de arte, para que quede alineada con el personaje.
//
// La silueta se DEDUCE del propio sprite: se clasifican sus píxeles en piel,
// pelo y ropa, y la armadura sólo se pinta donde hay cuerpo (así el casco sigue
// la forma de la cabeza y el peto la del torso en las dos épocas).
const SPRITE_CLASSES = {
  mesopotamia: {
    skin: ['#D9AE8C', '#B88A68', '#8E6B4B'],
    hair: ['#111111', '#1A1A1A', '#222222'],
    cloth: ['#24324F', '#1A253A', '#7F1F24', '#9B2A2D']
  },
  urss: {
    skin: ['#FFAC75'],
    hair: ['#98551B', '#B96B27'],
    cloth: ['#4F772D', '#3A5A40', '#D6E2E6', '#9E2A2B', '#7D838C']
  }
};

// Material de la armadura por época: bronce con penacho (Mesopotamia) o acero
// con estrella y fusil (URSS).
const KIT_COLORS = {
  mesopotamia: { metal: '#C08A3E', dark: '#7C5522', accent: '#8E2B23', weapon: '#6B4A2A' },
  urss: { metal: '#8A93A0', dark: '#525A67', accent: '#8E2B23', weapon: '#2C2C2C' }
};

const _soldierKitCache = new Map();

/**
 * Píxeles de la armadura de un guardia, en coordenadas del sprite (24×24).
 * @param {string} [epochId] 'mesopotamia' (por defecto) o 'urss'
 * @returns {{x:number,y:number,color:string}[]}
 */
export function soldierKitPixels(epochId) {
  const epoch = (epochId === 'urss') ? 'urss' : 'mesopotamia';
  if (_soldierKitCache.has(epoch)) return _soldierKitCache.get(epoch);
  const sprite = humanoidSpriteFor(epoch);
  const cls = SPRITE_CLASSES[epoch];
  const pal = KIT_COLORS[epoch];
  const grid = sprite.grid || 24;
  const classMap = new Map();
  const head = { c0: Infinity, c1: -Infinity, r0: Infinity, r1: -Infinity };
  const body = { c0: Infinity, c1: -Infinity, r0: Infinity, r1: -Infinity };
  // Primera fila con PIEL = donde empieza la cara. El casco cubre justo lo de
  // arriba (pelo y frente) y deja la cara a la vista.
  let faceTop = Infinity;
  let hairTop = Infinity;
  const grow = (box, x, y) => {
    if (x < box.c0) box.c0 = x;
    if (x > box.c1) box.c1 = x;
    if (y < box.r0) box.r0 = y;
    if (y > box.r1) box.r1 = y;
  };
  const clsOf = (hex) => {
    const h = String(hex || '').toUpperCase();
    if (cls.skin.indexOf(h) >= 0) return 'skin';
    if (cls.hair.indexOf(h) >= 0) return 'hair';
    if (cls.cloth.indexOf(h) >= 0) return 'cloth';
    return null;
  };
  (sprite.pixels || []).forEach(p => {
    if (!p || !p[2]) return;
    const kind = clsOf(p[2]);
    classMap.set(p[0] + ',' + p[1], kind);
    if (kind === 'skin' || kind === 'hair') grow(head, p[0], p[1]);
    else if (kind === 'cloth') grow(body, p[0], p[1]);
    if (kind === 'skin' && p[1] < faceTop) faceTop = p[1];
    if (kind === 'hair' && p[1] < hairTop) hairTop = p[1];
  });

  const out = [];
  const push = (x, y, color) => {
    if (y < -2 || y > grid - 1 || x < 0 || x > grid - 1) return;
    out.push({ x, y, color });
  };

  // ── Casco: pelo y frente, con el borde justo encima de los ojos ────────────
  if (head.c1 >= head.c0) {
    const top = Number.isFinite(hairTop) ? hairTop : head.r0;
    const brow = Number.isFinite(faceTop) ? Math.max(top + 2, faceTop - 1) : (head.r0 + 3);
    for (let r = top; r <= brow; r++) {
      for (let c = head.c0; c <= head.c1; c++) {
        const k = classMap.get(c + ',' + r);
        if (k !== 'skin' && k !== 'hair') continue;
        push(c, r, (r === brow) ? pal.dark : pal.metal);
      }
    }
    // Guardas de las mejillas: dos filas por debajo del borde, sólo en los
    // laterales (el centro queda libre para la cara).
    for (let r = brow + 1; r <= brow + 2; r++) {
      [head.c0, head.c0 + 1, head.c1 - 1, head.c1].forEach(c => {
        if (classMap.get(c + ',' + r) !== 'skin') return;
        push(c, r, pal.dark);
      });
    }
    // Penacho / estrella del casco, sobre la frente
    const mid = Math.round((head.c0 + head.c1) / 2);
    [-1, 0, 1].forEach(dc => push(mid + dc, top - 1, pal.accent));
    push(mid, top - 2, pal.accent);
  }

  // ── Coraza: peto de metal sobre la ropa + hombreras + cinto ────────────────
  if (body.c1 >= body.c0) {
    const beltRow = Math.min(body.r1, body.r0 + 4);
    for (let r = body.r0; r <= beltRow; r++) {
      for (let c = body.c0; c <= body.c1; c++) {
        if (classMap.get(c + ',' + r) !== 'cloth') continue;
        push(c, r, (r === beltRow) ? pal.dark : pal.metal);
      }
    }
    for (const c of [body.c0 - 1, body.c1 + 1]) {
      for (let r = body.r0; r <= body.r0 + 1; r++) push(c, r, pal.dark);
    }
    const midB = Math.round((body.c0 + body.c1) / 2);
    push(midB, body.r0, pal.accent);
    push(midB, body.r0 + 1, pal.accent);
  }

  // ── Arma en ristre: lanza (Mesopotamia) o fusil (URSS) junto al cuerpo ─────
  const anchorRight = Math.max(body.c1, head.c1);
  const wx = Math.min(grid - 2, Math.max(anchorRight + 3, head.c0));
  const top = Math.max(1, Math.min(body.r0 || head.r1, grid - 8) - 2);
  for (let r = top + 2; r < grid; r++) push(wx, r, pal.weapon);
  push(wx, top, pal.metal);
  push(wx, top + 1, pal.metal);

  const kit = Object.freeze(out);
  _soldierKitCache.set(epoch, kit);
  return kit;
}

/**
 * Dibuja la armadura del guardia ENCIMA del personaje (mismo origen y escala que
 * `drawHumanoid`, así que se alinea píxel a píxel con el sprite del jugador).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  esquina izquierda (px de destino)
 * @param {number} y  esquina superior (px de destino)
 * @param {number} scale  px de pantalla por píxel de arte
 * @param {{epoch?:string, dir?:string, flip?:boolean, anim?:{bob?:number}}} [opts]
 */
export function drawSoldierKit(ctx, x, y, scale, opts) {
  const options = opts || {};
  const epoch = (options.epoch === 'urss') ? 'urss' : 'mesopotamia';
  const pixels = soldierKitPixels(epoch);
  const sprite = humanoidSpriteFor(epoch);
  const grid = sprite.grid || 24;
  const s = Math.max(1, scale || 1);
  const dir = options.dir || 'down';
  // Mismo convenio de espejo que `drawCharacterPixels`: el arte de Mesopotamia
  // está pintado al revés, así que se espeja para mirar hacia donde camina.
  const artMirrored = (sprite === DETAILED_HUMANOID_SPRITE_MESOPOTAMIA);
  const flip = (options.flip !== undefined)
    ? !!options.flip
    : (artMirrored ? (dir !== 'left') : (dir === 'left'));
  const bob = (options.anim && options.anim.bob) || 0;
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    const px = flip ? (grid - 1 - p.x) : p.x;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(x + px * s), Math.round(y + (p.y + bob) * s), s, s);
  }
}

/** Devuelve el color de un token de las rejillas de ropa (túnica, toga…). */
export function outfitTokenColor(token, palette) {
  const pal = palette || DEFAULT_PALETTE;
  if (token === 'h') return pal.hair;
  if (token === 's') return pal.skin;
  if (token === 'c') return pal.cloth;
  if (token === 't') return pal.trim;
  return null;
}
