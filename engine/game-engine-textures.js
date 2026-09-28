// engine/game-engine-textures.js
// ─────────────────────────────────────────────────────────────────────────────
// Texturas de suelo para CAMINOS.
//
// Los caminos son suelo, no edificios: dibujarlos con las mismas 4 rejillas de
// arte que una casa (4 px por celda) los dejaba como un damero de cuadros
// planos. En su lugar se generan texturas de píxel a la resolución REAL de la
// celda en pantalla (el zoom manda) y se cachean por (tipo, tamaño), así que:
//
//   · el empedrado tiene detalle de verdad (losas irregulares, juntas, grava),
//   · no hay geometría fraccionaria ni dameros de subcuadros,
//   · el coste es un drawImage por celda (las texturas se generan una vez).
//
// Además, aquí vive el "autotiling" de bordillos: cada celda mira a sus vecinas
// y sólo dibuja bordillo en los lados que NO continúan camino. Un camino recto
// sale con dos bordillos continuos y un cruce sale abierto, como debe ser.
//
// Independiente del motor: no toca estado global, sólo recibe lo que necesita.
// ─────────────────────────────────────────────────────────────────────────────

// PRNG determinista: la misma celda da siempre la misma textura (nada de
// "hervir" al mover la cámara) y el fichero no depende de Math.random.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const KIND_LIGHT = 0.18;
const KIND_DARK = -0.2;

// Aclara/oscurece un hex (para biseles de las losas).
function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => {
    let out = Math.round(v + 255 * amount);
    if (out < 0) out = 0; if (out > 255) out = 255;
    return out.toString(16).padStart(2, '0');
  };
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

const KINDS = {
  // Camino de tierra apisonada (Mesopotamia): grava clara prensada.
  dirt: {
    mortar: '#8B7448',
    mortarTint: ['#7E693F', '#968055', '#9A8657'],
    stones: ['#C8AC77', '#BC9F68', '#D2B884', '#B09458'],
    pebbles: ['#A98F5E', '#D8C494', '#8E7645'],
    curbDark: '#977B48',
    curbLight: '#DCBF87'
  },
  // Empedrado de losas (Mesopotamia, calles de ciudad): caliza cálida.
  stone: {
    mortar: '#7A6A4C',
    mortarTint: ['#6F6044', '#83734F', '#756549'],
    stones: ['#C2B596', '#B5A484', '#CBBE9E', '#A8997A'],
    pebbles: ['#94825F', '#D3C7A8', '#7E6E4E'],
    curbDark: '#6E6046',
    curbLight: '#DACBA8'
  },
  // Hormigón / asfalto (URSS).
  concrete: {
    mortar: '#83878E',
    mortarTint: ['#7B7F86', '#8B8F96', '#767A81'],
    stones: ['#92969D', '#9BA0A7', '#888C93', '#A2A7AE'],
    pebbles: ['#7E8289', '#A8ADB4', '#73777E'],
    curbDark: '#63676D',
    curbLight: '#AEB3BA'
  },
  // Tablones de madera (puentes).
  wood: {
    mortar: '#4A2F12',
    mortarTint: ['#452C10', '#513415', '#3E280E'],
    stones: ['#8B5A38', '#7C4E30', '#9A6640', '#6E442A'],
    pebbles: ['#5C3A1A', '#A8764A', '#4A2F12'],
    curbDark: '#3E280E',
    curbLight: '#B98557'
  }
};

// ── Detalle del terreno por bioma ──────────────────────────────────────────
// Capa fina (fondo transparente) que se pinta ENCIMA del color del bioma: dunas
// y guijarros en la arena, matas y flores en el césped, grietas secas, sal…
// Da vida al suelo sin tocar el color base ni la lógica de juego.
const BIOME_DETAIL = {
  sand: {
    marks: [['pebble', '#B9A176'], ['pebble', '#E8DCBE'], ['ripple', 'rgba(120,96,60,0.16)'], ['ripple', 'rgba(255,246,220,0.18)']]
  },
  alluvial: {
    marks: [['crack', 'rgba(110,80,40,0.22)'], ['pebble', '#B08A50'], ['tuft', '#8FA85E'], ['tuft', '#A8C070']]
  },
  grass: {
    marks: [['tuft', '#5E9440'], ['tuft', '#79B050'], ['flower', '#E8D060'], ['flower', '#E08080']]
  },
  steppe: {
    marks: [['tuft', '#A88F4E'], ['tuft', '#C0A860'], ['pebble', '#9C8A60'], ['crack', 'rgba(120,90,40,0.18)']]
  },
  riparian: {
    marks: [['tuft', '#4E8A34'], ['tuft', '#6EAA4A'], ['pebble', '#7E9A6A'], ['flower', '#D8E070']]
  },
  marsh: {
    marks: [['pond', 'rgba(50,90,110,0.35)'], ['tuft', '#3E7A4A'], ['tuft', '#5E9A62'], ['pebble', '#6E8A80']]
  },
  saline: {
    marks: [['crust', 'rgba(255,255,255,0.30)'], ['crust', 'rgba(230,236,240,0.35)'], ['pebble', '#CFD6DA'], ['crack', 'rgba(150,160,170,0.25)']]
  },
  hills: {
    marks: [['rock', '#8A8272'], ['rock', '#6E685C'], ['tuft', '#7E8A5E'], ['pebble', '#A79C86']]
  },
  forest: {
    marks: [['tuft', '#3E6B34'], ['tuft', '#4E8040'], ['pebble', '#5E6B4A'], ['flower', '#C8D890']]
  }
};

function buildDetail(g, size, R, spec) {
  const put = (kind, color) => {
    const x = Math.floor(R() * size);
    const y = Math.floor(R() * size);
    g.fillStyle = color;
    switch (kind) {
      case 'pebble':
        g.fillRect(x, y, R() < 0.5 ? 1 : 2, 1);
        break;
      case 'ripple':
        g.fillRect(x, y, Math.max(3, Math.round(size * 0.3)), 1);
        break;
      case 'crack':
        g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
        break;
      case 'tuft':
        g.fillRect(x, y, 1, 3); g.fillRect(x - 1, y + 1, 1, 2); g.fillRect(x + 1, y + 1, 1, 2);
        break;
      case 'flower':
        g.fillRect(x, y, 1, 1);
        break;
      case 'pond':
        g.fillRect(x, y, 2, 1); g.fillRect(x - 1, y + 1, 4, 1); g.fillRect(x, y + 2, 2, 1);
        break;
      case 'crust':
        g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 2, 1);
        break;
      case 'rock':
        g.fillRect(x, y, 2, 2); g.fillRect(x + 1, y + 1, 1, 1);
        break;
      default:
        g.fillRect(x, y, 1, 1);
    }
  };
  const marks = spec.marks || [];
  const count = Math.max(3, Math.round(size * 0.9));
  for (let i = 0; i < count + 3; i++) {
    const m = marks[Math.floor(R() * marks.length)];
    if (m) put(m[0], m[1]);
  }
}

// ── Generación de una textura (una variante) ────────────────────────────────
function buildCobbles(g, size, R, kind) {
  const K = KINDS[kind] || KINDS.dirt;
  const mortar = K.mortarTint[Math.floor(R() * K.mortarTint.length)] || K.mortar;
  g.fillStyle = mortar;
  g.fillRect(0, 0, size, size);

  // Grava suelta en las juntas (antes de las losas: las losas la tapan).
  const pebbles = Math.max(3, Math.round(size * 0.5));
  for (let i = 0; i < pebbles; i++) {
    const px = Math.floor(R() * size);
    const py = Math.floor(R() * size);
    const s = R() < 0.75 ? 1 : 2;
    g.fillStyle = K.pebbles[Math.floor(R() * K.pebbles.length)];
    g.globalAlpha = 0.5 + R() * 0.4;
    g.fillRect(px, py, s, s);
  }
  g.globalAlpha = 1;

  // Losas en rejilla irregular: cada losa se desplaza y cambia de tamaño.
  // Las losas que caen a medias en el borde se dibujan también por el lado
  // contrario (tiling toroidal): así el empedrado es CONTINUO entre celdas y
  // no se ve la costura de la rejilla de caminos.
  const n = Math.max(2, Math.round(size / 7));
  const cell = size / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Desplazamiento y tamaño muy irregulares: si todas las losas fueran
      // iguales el empedrado parecería un muro de ladrillos.
      const cx = (i + 0.5) * cell + (R() - 0.5) * cell * 0.5;
      const cy = (j + 0.5) * cell + (R() - 0.5) * cell * 0.5;
      let w = Math.round(cell * (0.58 + R() * 0.42));
      let h = Math.round(cell * (0.58 + R() * 0.42));
      if (R() < 0.25) { w = Math.round(w * 0.72); h = Math.round(h * 0.72); } // piedra pequeña suelta
      if (w < 2) w = 2; if (h < 2) h = 2;
      let sx = Math.round(cx - w / 2);
      let sy = Math.round(cy - h / 2);
      const base = K.stones[Math.floor(R() * K.stones.length)];
      const jit = (R() - 0.5) * 0.09;
      const oxs = [0]; if (sx < 0) oxs.push(size); else if (sx + w > size) oxs.push(-size);
      const oys = [0]; if (sy < 0) oys.push(size); else if (sy + h > size) oys.push(-size);
      for (const ox of oxs) {
        for (const oy of oys) paintStone(g, sx + ox, sy + oy, w, h, base, jit, mortar);
      }
    }
  }

  // Polvo/suciedad: motas de 1 px que quitan el aspecto de "azulejo plano".
  const speckles = Math.max(6, Math.round(size * 1.2));
  for (let i = 0; i < speckles; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
    g.fillRect(Math.floor(R() * size), Math.floor(R() * size), 1, 1);
  }
}

// Una losa: cuerpo + bisel (luz arriba-izquierda, sombra abajo-derecha) y las
// esquinas comidas con el color de la junta (se lee redondeada sin difuminar).
function paintStone(g, sx, sy, w, h, base, jit, mortar) {
  g.fillStyle = tint(base, jit);
  g.fillRect(sx, sy, w, h);
  g.fillStyle = tint(base, KIND_LIGHT);
  g.fillRect(sx, sy, w, 1);
  g.fillRect(sx, sy, 1, h);
  g.fillStyle = tint(base, KIND_DARK);
  g.fillRect(sx, sy + h - 1, w, 1);
  g.fillRect(sx + w - 1, sy, 1, h);
  if (w > 3 && h > 3) {
    g.fillStyle = mortar;
    g.fillRect(sx, sy, 1, 1);
    g.fillRect(sx + w - 1, sy, 1, 1);
    g.fillRect(sx, sy + h - 1, 1, 1);
    g.fillRect(sx + w - 1, sy + h - 1, 1, 1);
  }
}

function buildConcrete(g, size, R) {
  const K = KINDS.concrete;
  g.fillStyle = K.mortarTint[Math.floor(R() * K.mortarTint.length)];
  g.fillRect(0, 0, size, size);

  // Manchas grandes (desgaste del firme).
  for (let i = 0; i < Math.max(2, Math.round(size / 8)); i++) {
    const w = Math.round(size * (0.18 + R() * 0.3));
    const h = Math.round(size * (0.12 + R() * 0.25));
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    g.fillRect(Math.floor(R() * (size - w)), Math.floor(R() * (size - h)), w, h);
  }

  // Grietas cortas en escalera (2-4 tramos).
  const cracks = R() < 0.6 ? 1 : 2;
  for (let i = 0; i < cracks; i++) {
    let cx = Math.floor(R() * size);
    let cy = Math.floor(R() * size);
    const steps = 3 + Math.floor(R() * 3);
    g.fillStyle = 'rgba(20,22,26,0.30)';
    for (let s = 0; s < steps; s++) {
      const len = 2 + Math.floor(R() * 3);
      for (let k = 0; k < len; k++) {
        g.fillRect(cx, cy, 1, 1);
        if (R() < 0.6) cx += 1; else cy += 1;
      }
    }
  }

  // Grano fino + junta perimetral (la losa de hormigón se lee por su junta).
  const speckles = Math.max(8, Math.round(size * 1.4));
  for (let i = 0; i < speckles; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.08)';
    g.fillRect(Math.floor(R() * size), Math.floor(R() * size), 1, 1);
  }
  g.fillStyle = 'rgba(20,22,26,0.16)';
  g.fillRect(0, 0, size, 1); g.fillRect(0, size - 1, size, 1);
  g.fillRect(0, 0, 1, size); g.fillRect(size - 1, 0, 1, size);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(1, 1, size - 2, 1); g.fillRect(1, 1, 1, size - 2);
}

export function createTextures(deps = {}) {
  const getKind = typeof deps.getKind === 'function' ? deps.getKind : (() => 'dirt');
  const cache = new Map();
  const canDraw = (typeof document !== 'undefined') && !!document.createElement;

  // 6 variantes por tipo y tamaño: dos celdas contiguas casi nunca repiten
  // dibujo (y el patrón es continuo entre celdas, así que no hay costuras).
  const VARIANTS = 6;
  function patterns(kind, size) {
    if (!canDraw) return null;
    const s = Math.max(8, Math.round(size));
    const key = kind + '|' + s;
    const hit = cache.get(key);
    if (hit) return hit;
    const list = [];
    for (let v = 0; v < VARIANTS; v++) {
      const cv = document.createElement('canvas');
      cv.width = s; cv.height = s;
      const g = cv.getContext('2d');
      const R = mulberry32((hashStr(kind) ^ (s * 2246822519) ^ (v * 3266489917)) >>> 0);
      if (kind === 'concrete') buildConcrete(g, s, R);
      else buildCobbles(g, s, R, kind);
      list.push(cv);
    }
    if (cache.size > 48) cache.clear(); // por si el usuario hace zoom extremo
    cache.set(key, list);
    return list;
  }

  // Dibuja la textura de una celda de camino. En iso la celda es un rombo: se
  // recorta con el mismo trazado para que el empedrado no salga cuadrado.
  function drawPathTile(ctx, x, y, w, h, kind, variant, opts = {}) {
    const tex = patterns(kind, Math.max(w, h));
    if (!tex) return false;
    const img = tex[((variant | 0) % tex.length + tex.length) % tex.length];
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (opts.iso) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + pw, py + ph * 0.5);
      ctx.lineTo(px, py + ph);
      ctx.lineTo(px - pw, py + ph * 0.5);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, Math.round(px - pw), py, pw * 2, ph);
      ctx.restore();
    } else {
      ctx.drawImage(img, px, py, pw, ph);
    }
    ctx.imageSmoothingEnabled = smooth;
    return true;
  }

  // Bordillos de la "autopista": pinta el borde de los lados que no siguen.
  // closed = { n, e, s, w } con true en los lados que hay que CERRAR.
  function drawCurbs(ctx, x, y, w, h, closed, kind, opts = {}) {
    if (!closed || (!closed.n && !closed.e && !closed.s && !closed.w)) return;
    const K = KINDS[kind] || KINDS.dirt;
    const big = Math.max(w, h);
    const band = Math.max(2, Math.round(big * 0.10));
    const lip = Math.max(1, Math.round(big * 0.05));
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);

    if (opts.iso) {
      // En vista isométrica la celda es un rombo: cada vecino toca UN lado.
      //   norte = arriba-izquierda · este = arriba-derecha
      //   sur   = abajo-derecha    · oeste = abajo-izquierda
      const midY = py + ph * 0.5;
      const P = {
        top: { x: px, y: py }, right: { x: px + pw, y: midY },
        bottom: { x: px, y: py + ph }, left: { x: px - pw, y: midY }
      };
      const inwards = (p, f) => ({ x: p.x + (px - p.x) * f, y: p.y + (midY - p.y) * f });
      const line = (a, b, width, color, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      const edges = { n: [P.top, P.left], e: [P.top, P.right], s: [P.right, P.bottom], w: [P.bottom, P.left] };
      const f = Math.min(0.55, band / Math.max(8, ph * 0.5));
      for (const k of ['n', 'e', 's', 'w']) if (closed[k]) line(edges[k][0], edges[k][1], band, K.curbDark, 0.6);
      for (const k of ['n', 'e', 's', 'w']) if (closed[k]) line(inwards(edges[k][0], f), inwards(edges[k][1], f), lip, K.curbLight, 0.45);
      return true;
    }

    const seg = (sx, sy, sw, sh, color, alpha) => {
      if (sw <= 0 || sh <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(px + sx, py + sy, sw, sh);
      ctx.globalAlpha = 1;
    };
    // Lado oscuro (el bordillo visto desde el firme) por los lados cerrados.
    if (closed.n) seg(0, 0, pw, band, K.curbDark, 0.55);
    if (closed.s) seg(0, ph - band, pw, band, K.curbDark, 0.55);
    if (closed.w) seg(0, 0, band, ph, K.curbDark, 0.55);
    if (closed.e) seg(pw - band, 0, band, ph, K.curbDark, 0.55);
    // Filo interior claro: da volumen (el bordillo está más alto que el firme).
    if (closed.n) seg(0, band, pw, lip, K.curbLight, 0.45);
    if (closed.s) seg(0, ph - band - lip, pw, lip, K.curbLight, 0.45);
    if (closed.w) seg(band, 0, lip, ph, K.curbLight, 0.45);
    if (closed.e) seg(pw - band - lip, 0, lip, ph, K.curbLight, 0.45);
    return true;
  }

  // Roderas: dos líneas más oscuras a lo largo del camino. Sólo cuando la
  // celda es un tramo recto (si no, un cruce tendría roderas cruzadas).
  function drawRuts(ctx, x, y, w, h, axis, kind) {
    const K = KINDS[kind] || KINDS.dirt;
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = kind === 'concrete' ? '#4E5258' : '#6E5A32';
    if (axis === 'h') {
      const ry1 = py + Math.round(ph * 0.30);
      const ry2 = py + Math.round(ph * 0.64);
      const th = Math.max(1, Math.round(ph * 0.07));
      ctx.fillRect(px, ry1, pw, th);
      ctx.fillRect(px, ry2, pw, th);
    } else if (axis === 'v') {
      const rx1 = px + Math.round(pw * 0.30);
      const rx2 = px + Math.round(pw * 0.64);
      const tw = Math.max(1, Math.round(pw * 0.07));
      ctx.fillRect(rx1, py, tw, ph);
      ctx.fillRect(rx2, py, tw, ph);
    }
    ctx.globalAlpha = 1;
  }

  function clearCache() { cache.clear(); }

  // ── Transiciones entre biomas (los bordes "limítrofes") ───────────────────
  // Colores de referencia por categoría (para el dither de frontera)
  const MY_KIND_COLORS = {
    water: ['#2E6FA3'],
    grass: ['#7EC96A', '#5E9440', '#79B050'],
    sand: ['#D8C093', '#C9A058', '#B9A176', '#E0D0A8'],
    forest: ['#3A6631', '#4A7C3F', '#2E5E2A'],
    hills: ['#8A8272', '#6E685C', '#A79C86'],
    marsh: ['#5E8A6A', '#3E7A4A', '#66806A'],
    road: ['#8B7B5B']
  };

  // Aquí está la diferencia entre un mapa de bloques y uno de 16 bits: el borde
  // entre arena y hierba, o entre agua y tierra, no se corta en seco; lleva un
  // dither (píxeles alternos) y una orilla húmeda. `selfKind` y `neigh` son
  // categorías gruesas: water | grass | sand | forest | hills | marsh | road.
  // Se dibuja directo (sin caché) porque sólo corre al reconstruir el terreno.
  function drawTransition(ctx, x, y, size, selfKind, neigh, seed, opts = {}) {
    if (!selfKind || !neigh) return false;
    const px = Math.round(x), py = Math.round(y);
    const s = Math.max(8, Math.round(size));
    const R = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const band = Math.max(2, Math.round(s * 0.22));
    const isWater = selfKind === 'water';
    const isLand = !isWater;
    const sides = [];
    if (neigh.n && neigh.n !== selfKind) sides.push(['n', neigh.n]);
    if (neigh.e && neigh.e !== selfKind) sides.push(['e', neigh.e]);
    if (neigh.s && neigh.s !== selfKind) sides.push(['s', neigh.s]);
    if (neigh.w && neigh.w !== selfKind) sides.push(['w', neigh.w]);
    if (!sides.length) return false;

    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    let clip = false;
    if (opts.iso) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + s / 2, py + s / 2);
      ctx.lineTo(px, py + s);
      ctx.lineTo(px - s / 2, py + s / 2);
      ctx.closePath();
      ctx.clip();
      clip = true;
    }

    // Caja de trabajo: en ortogonal es la celda; en iso, un cuadro centrado.
    const bx = opts.iso ? Math.round(px - s / 2) : px;
    const by = opts.iso ? Math.round(py) : py;
    const bw = s, bh = opts.iso ? s : s;

    const rectFor = (side, thickness, offset = 0) => {
      if (side === 'n') return [bx, by + offset, bw, thickness];
      if (side === 's') return [bx, by + bh - thickness - offset, bw, thickness];
      if (side === 'w') return [bx + offset, by, thickness, bh];
      return [bx + bw - thickness - offset, by, thickness, bh];
    };
    const px2 = (side, t, u) => {
      // punto (t: 0..1 a lo largo del lado, u: profundidad normal)
      if (side === 'n') return [bx + t * bw, by + u];
      if (side === 's') return [bx + t * bw, by + bh - u];
      if (side === 'w') return [bx + u, by + t * bh];
      return [bx + bw - u, by + t * bh];
    };

    for (const [side, kind] of sides) {
      // 1) Banda base: agua ←→ tierra y tierra ←→ agua
      if (isWater && kind !== 'water' && kind !== 'road') {
        // Orilla: agua somera (más clara) contra la tierra
        let [rx, ry, rw, rh] = rectFor(side, band);
        ctx.fillStyle = 'rgba(150,205,225,0.34)';
        ctx.fillRect(rx, ry, rw, rh);
        // Espuma: línea discontinua justo en el borde
        ctx.fillStyle = 'rgba(240,250,255,0.55)';
        for (let i = 0; i < bw; i += 2) {
          if (R() < 0.55) { const [a, b] = px2(side, i / bw, 1); ctx.fillRect(Math.round(a), Math.round(b), 1, 1); }
        }
        // Brillos sueltos un poco más adentro
        ctx.fillStyle = 'rgba(210,238,250,0.32)';
        for (let i = 0; i < 10; i++) {
          const [a, b] = px2(side, R(), band * (0.4 + R() * 0.6));
          ctx.fillRect(Math.round(a), Math.round(b), 1, 1);
        }
      } else if (isLand && kind === 'water') {
        // Tierra junto al agua: arena mojada y guijarros
        const wet = (selfKind === 'sand') ? 'rgba(120,95,60,0.42)' : 'rgba(70,60,45,0.40)';
        let [rx, ry, rw, rh] = rectFor(side, band);
        ctx.fillStyle = wet;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = 'rgba(50,45,35,0.30)';
        for (let i = 0; i < 12; i++) {
          const [a, b] = px2(side, R(), band * (0.2 + R() * 0.8));
          ctx.fillRect(Math.round(a), Math.round(b), 1, 1);
        }
        // Hierba colgando sobre la orilla cuando la celda es verde
        if (selfKind === 'grass' || selfKind === 'forest' || selfKind === 'marsh') {
          ctx.fillStyle = 'rgba(70,120,60,0.45)';
          for (let i = 0; i < Math.round(bw * 0.8); i++) {
            const [a, b] = px2(side, R(), band * (0.6 + R() * 0.5));
            ctx.fillRect(Math.round(a), Math.round(b), 1, 2);
          }
        }
      } else if (kind === 'road' || selfKind === 'road') {
        // Los caminos ya tienen bordillo propio: sólo un polvillo de transición
        ctx.fillStyle = 'rgba(150,120,80,0.18)';
        const [rx, ry, rw, rh] = rectFor(side, Math.max(1, Math.round(band * 0.5)));
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        // Frontera entre dos tierras (arena↔hierba, bosque↔estepa…): dither
        const into = band + 1;
        const colors = MY_KIND_COLORS[kind] || MY_KIND_COLORS.sand;
        const own = MY_KIND_COLORS[selfKind] || MY_KIND_COLORS.sand;
        ctx.globalAlpha = 0.68;
        for (let n = 0; n < into * 5; n++) {
          const u = R() * into;
          ctx.fillStyle = colors[(R() * colors.length) | 0];
          const [a, b] = px2(side, R(), u);
          ctx.fillRect(Math.round(a), Math.round(b), 1, 1);
          // y píxeles del propio bioma hacia dentro, para que no quede una línea
          if (R() < 0.6) {
            ctx.fillStyle = own[(R() * own.length) | 0];
            const [a2, b2] = px2(side, R(), into + R() * into);
            ctx.fillRect(Math.round(a2), Math.round(b2), 1, 1);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // Esquinas: sin esto quedan picos duros de una celda donde el agua (o el
    // bosque) gira en diagonal.
    const corners = [
      [neigh.nw, bx, by, 1, 1], [neigh.ne, bx + bw - 1, by, -1, 1],
      [neigh.sw, bx, by + bh - 1, 1, -1], [neigh.se, bx + bw - 1, by + bh - 1, -1, -1]
    ];
    for (const [kind, cx0, cy0, sx, sy] of corners) {
      if (!kind || kind === selfKind || kind === 'road') continue;
      const colors = MY_KIND_COLORS[kind] || MY_KIND_COLORS.sand;
      ctx.globalAlpha = 0.62;
      const reach = band + 2;
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = colors[(R() * colors.length) | 0];
        ctx.fillRect(Math.round(cx0 + sx * R() * reach), Math.round(cy0 + sy * R() * reach), 1, 1);
      }
      if (isWater && kind !== 'water') {
        ctx.fillStyle = 'rgba(150,205,225,0.30)';
        for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(cx0 + sx * R() * reach), Math.round(cy0 + sy * R() * reach), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (clip) ctx.restore();
    ctx.imageSmoothingEnabled = smooth;
    return true;
  }

  // Colores de referencia por categoría (para el dither de frontera)
  const MY_KIND_COLORS_UNUSED = null;


  // Capa de detalle del bioma (transparente): se pinta encima del color base.
  function drawDetailTile(ctx, x, y, w, h, biome, variant, opts = {}) {
    const spec = BIOME_DETAIL[biome];
    if (!spec || !spec.marks) return false;
    const key = 'detail:' + biome + '|' + Math.max(8, Math.round(Math.max(w, h)));
    let list = cache.get(key);
    if (!list) {
      if (!canDraw) return false;
      const s = Math.max(8, Math.round(Math.max(w, h)));
      list = [];
      for (let v = 0; v < 4; v++) {
        const cv = document.createElement('canvas');
        cv.width = s; cv.height = s;
        const g = cv.getContext('2d');
        const R = mulberry32((hashStr(key) ^ (v * 2654435761) ^ (s * 40503)) >>> 0);
        buildDetail(g, s, R, spec);
        list.push(cv);
      }
      if (cache.size > 48) cache.clear();
      cache.set(key, list);
    }
    const img = list[((variant | 0) % list.length + list.length) % list.length];
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (opts.iso) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + pw, py + ph * 0.5);
      ctx.lineTo(px, py + ph);
      ctx.lineTo(px - pw, py + ph * 0.5);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, Math.round(px - pw), py, pw * 2, ph);
      ctx.restore();
    } else {
      ctx.drawImage(img, px, py, pw, ph);
    }
    ctx.imageSmoothingEnabled = smooth;
    return true;
  }

  // Tablones de un puente con barandilla en los lados libres.
  // axis: 'h' (el puente cruza en horizontal) o 'v'.
  function drawBridgeCell(ctx, x, y, w, h, axis, variant, kind = 'wood', opts = {}) {
    const K = KINDS[kind] || KINDS.wood;
    if (!drawPathTile(ctx, x, y, w, h, kind, variant, opts)) return false;
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);
    const rail = Math.max(2, Math.round(Math.max(pw, ph) * 0.16));
    const line = (a, b, width, color, alpha) => {
      ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(a.x, a.y, b.w, b.h); ctx.globalAlpha = 1;
    };
    if (axis === 'h' || opts.iso) {
      // Barandillas arriba y abajo (el puente corre de izquierda a derecha)
      line({ x: px, y: py }, { w: pw, h: rail }, rail, K.curbDark, 0.85);
      line({ x: px, y: py + ph - rail }, { w: pw, h: rail }, rail, K.curbDark, 0.85);
      line({ x: px, y: py + rail }, { w: pw, h: 1 }, 1, K.curbLight, 0.7);
      line({ x: px, y: py + ph - rail - 1 }, { w: pw, h: 1 }, 1, K.curbLight, 0.7);
    } else {
      line({ x: px, y: py }, { w: rail, h: ph }, rail, K.curbDark, 0.85);
      line({ x: px + pw - rail, y: py }, { w: rail, h: ph }, rail, K.curbDark, 0.85);
      line({ x: px + rail, y: py }, { w: 1, h: ph }, 1, K.curbLight, 0.7);
      line({ x: px + pw - rail - 1, y: py }, { w: 1, h: ph }, 1, K.curbLight, 0.7);
    }
    return true;
  }

  // Puntales del puente: travesaños cada 2 celdas para que se lea la estructura.
  function drawBridgePost(ctx, x, y, w, h, axis, kind = 'wood') {
    const K = KINDS[kind] || KINDS.wood;
    const px = Math.round(x), py = Math.round(y);
    const pw = Math.round(w), ph = Math.round(h);
    const t = Math.max(2, Math.round(Math.max(pw, ph) * 0.12));
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = K.curbDark;
    if (axis === 'h' || !axis) ctx.fillRect(px + Math.round(pw / 2 - t / 2), py, t, ph);
    else ctx.fillRect(px, py + Math.round(ph / 2 - t / 2), pw, t);
    ctx.globalAlpha = 1;
    return true;
  }

  return {
    drawPathTile, drawCurbs, drawRuts, clearCache,
    drawDetailTile, drawBridgeCell, drawBridgePost, drawTransition,
    kindFor: getKind,
    hasPatterns: (kind, size) => !!patterns(kind, size),
    get stats() { return { cached: cache.size }; }
  };
}
