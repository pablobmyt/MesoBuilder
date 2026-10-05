/* ═══════════════════════════════════════════════════════════════════════════
   CADÁVERES — DESCOMPOSICIÓN Y ESQUELETOS
   ───────────────────────────────────────────────────────────────────────────
   Pedido: «cuando se muere alguien, debe aparecer un cuerpo descomponiéndose
   poco a poco quedando al final un esqueleto; si el asesinato es dentro de una
   estructura, tiene que aparecer la tumba que ya aparece».

   Así que un cuerpo pasa por CUATRO estados, contados desde la muerte:

     0. FRESCO      (0-8 s)     el cuerpo como estaba (con su charco).
     1. HINCHADO    (8-22 s)    se apaga a verde-gris, salen moscas.
     2. HUESOS      (22-34 s)   los huesos asoman bajo la carne (que se desvanece).
     3. ESQUELETO   (34 s →)    sólo huesos: se queda ahí para siempre.

   A los 40 s el cuerpo se CONVIERTE en un `kind: 'skeleton'` (una entidad
   inerte que se guarda con la partida), así que no se acumula IA ni colisiones:
   un esqueleto es decorado, como una roca.

   DENTRO DE UNA ESTRUCTURA no hay descomposición: se levanta la TUMBA de
   siempre (`createGrave`), que es lo que ya hacía el motor. Se considera
   «dentro de una estructura» si el jugador está en un interior
   (`window.currentInterior`) o si el cuerpo cae sobre la celda de un edificio
   habitable.

   Este módulo sólo pinta y decide la etapa; quién muere y cuándo lo decide el
   motor (markEntityDowned / cleanupExpiredCorpses en engine/game-engine.js).
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Etapas ──────────────────────────────────────────────────────────────────
export const ETAPAS = [
  { id: 'fresco',    nombre: 'Cuerpo fresco',      hastaMs: 8000 },
  { id: 'hinchado',  nombre: 'Descomponiéndose',   hastaMs: 22000 },
  { id: 'huesos',    nombre: 'Huesos y jirones',   hastaMs: 34000 },
  { id: 'esqueleto', nombre: 'Esqueleto',          hastaMs: Infinity }
];

// Tiempo total desde la muerte hasta que el cuerpo es un esqueleto fijo. Es el
// valor que usa el motor como «cuánto dura un cadáver» (CORPSE_LINGER_MS).
export const DESCOMPOSICION_MS = 40000;

// ── Rejillas de píxeles ─────────────────────────────────────────────────────
// Las rejillas de un esqueleto tumbado: calavera a la izquierda, costillar en
// medio y pelvis/piernas a la derecha. Tokens: b hueso claro · B hueso oscuro ·
// o cuencas · . vacío (el motor ya usa este formato de filas de caracteres).
const ASCII_ESQUELETO_HUMANO = [
  '..................',
  '.....oooo.........',
  '....obbbbo........',
  '....ob..bo........',
  '.....obbo.........',
  '..bbbbbbbbbbbbb...',
  '..b.b.b.b.b.b.....',
  '..B.B.B.B.B.B.....',
  '.....bbbb.........',
  '....bb..bb........',
  '....BB..BB........'
];

const ASCII_ESQUELETO_ANIMAL = [
  '............',
  '...oooo.....',
  '..obbbbo....',
  '.bbbbbbbbb..',
  '.b.b.b.b.b..',
  '..b..b..b...',
  '...bbbbb....'
];

const PALETA_HUESO = {
  b: '#EDE6D2',   // hueso iluminado
  B: '#B9AE94',   // hueso en sombra
  o: '#2A241C'    // cuencas y huecos
};

// Convierte filas de caracteres en la lista [x,y,color] que usa el motor.
function rejillaAFilas(rows, paleta) {
  const pixels = [];
  rows.forEach((fila, y) => {
    for (let x = 0; x < fila.length; x++) {
      const ch = fila[x];
      if (ch === '.' || ch === ' ') continue;
      const color = paleta[ch];
      if (color) pixels.push([x, y, color]);
    }
  });
  return { grid: rows[0].length, w: rows[0].length, h: rows.length, pixels };
}

export const ESPECIES_ESQUELETO = {
  humano: { clave: 'esqueleto_humano', def: rejillaAFilas(ASCII_ESQUELETO_HUMANO, PALETA_HUESO) },
  animal: { clave: 'esqueleto_animal', def: rejillaAFilas(ASCII_ESQUELETO_ANIMAL, PALETA_HUESO) }
};

// ¿Qué esqueleto le toca a cada cuerpo? Los bichos pequeños dejan un montón de
// huesos (variante animal) y las personas (o bichos grandes) un esqueleto
// humano. OJO: los conejos y los zorros NO traen `kind`, así que el tamaño es el
// que decide en ese caso (0,45 un conejo · 0,7 un zorro · 1+ una persona).
export function esqueletoPara(kind, size) {
  const k = String(kind || '');
  if (k === 'rabbit' || k === 'fox') return 'animal';
  const s = Number(size);
  if (Number.isFinite(s) && s > 0 && s <= 1.05) return 'animal';
  return 'humano';
}

// ── Utilidades de color ─────────────────────────────────────────────────────
function hexARgb(hex) {
  try {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  } catch (e) { return null; }
}

function mezclarColores(a, b, t) {
  const ca = hexARgb(a), cb = hexARgb(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, Number(t) || 0));
  const r = Math.round(ca.r + (cb.r - ca.r) * k);
  const g = Math.round(ca.g + (cb.g - ca.g) * k);
  const bl = Math.round(ca.b + (cb.b - ca.b) * k);
  return `rgb(${r},${g},${bl})`;
}

// Paleta del personaje apagándose: verde-gris de putrefacción cada vez más
// oscuro. Se aplica a TODO (piel, pelo, ropa) porque el cuerpo deja de ser
// «alguien» y pasa a ser materia.
const TINTE_PODRIDO = '#5C6B4A';
export function paletaPodrida(palette, etapa) {
  const base = palette || {};
  const t = etapa <= 1 ? 0.42 : (etapa === 2 ? 0.68 : 0.85);
  const caido = (c) => mezclarColores(c || '#8A7A66', TINTE_PODRIDO, t);
  return {
    skin: caido(base.skin),
    hair: mezclarColores(caido(base.hair), '#2E2A22', 0.5),
    cloth: caido(base.cloth),
    trim: caido(base.trim)
  };
}

// ── Paleta de HUESOS ────────────────────────────────────────────────────────
// Pedido: «el esqueleto tiene que tener la misma forma que el personaje y estar
// en la misma posición (tumbado)». Así que el esqueleto NO es una calavera
// genérica: es EL MISMO PERSONAJE pintado con hueso (misma silueta, mismos
// brazos y piernas, misma ropa) y tumbado igual que el cadáver.
//
// Los cuatro tonos se meten por donde entra la paleta del personaje:
//   piel → hueso claro · pelo → hueso oscuro (contorno y cuencas)
//   ropa → hueso medio · remates → hueso en sombra (tintado con la ropa que
//   llevaba, para que dos esqueletos no salgan calcados).
export const HUESO = {
  claro:  '#EDE6D2',
  medio:  '#D6CCB2',
  sombra: '#B9AE94',
  oscuro: '#6A5F4B'
};
export function paletaHuesos(palette) {
  const ropa = (palette && palette.cloth) || null;
  return {
    skin: HUESO.claro,
    hair: HUESO.oscuro,
    cloth: HUESO.medio,
    trim: ropa ? mezclarColores(HUESO.sombra, ropa, 0.22) : HUESO.sombra
  };
}

// ── Sistema ─────────────────────────────────────────────────────────────────
export function createCorpseArt(deps) {
  const D = deps || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Hora (0..3) de la descomposición según el tiempo transcurrido en ms.
  function etapaDeCadaver(ms) {
    const t = Math.max(0, Number(ms) || 0);
    for (let i = 0; i < ETAPAS.length; i++) if (t < ETAPAS[i].hastaMs) return i;
    return ETAPAS.length - 1;
  }

  function etapaInfo(ms) {
    return ETAPAS[etapaDeCadaver(ms)] || ETAPAS[0];
  }

  // ── Piezas de dibujo compartidas ─────────────────────────────────────────
  // Charco: crece con la descomposición y se seca al final (queda un cerco).
  function charco(ctx, cx, cy, tileSize, etapa) {
    try {
      const r = Math.max(5, tileSize * (0.30 + etapa * 0.045));
      const a = etapa === 0 ? 0.42 : (etapa === 1 ? 0.36 : (etapa === 2 ? 0.24 : 0.14));
      ctx.save();
      ctx.fillStyle = `rgba(88,26,22,${a})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + tileSize * 0.06, r, Math.max(2, r * 0.36), 0, 0, Math.PI * 2);
      ctx.fill();
      if (etapa >= 2) {
        // Cerco seco: el charco se ha ido, queda la mancha.
        ctx.strokeStyle = `rgba(70,44,30,${0.28})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy + tileSize * 0.06, r * 1.05, Math.max(2, r * 0.4), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } catch (e) {}
  }

  // Moscas: tres puntitos que revolotean alrededor del cuerpo. Es lo que hace que
  // «se vea» que está podrido sin cambiar el sprite (a poco zoom no se notaría).
  function moscas(ctx, cx, cy, tileSize, etapa, semilla) {
    try {
      const ahora = Date.now();
      const n = etapa === 1 ? 3 : 2;
      ctx.save();
      ctx.fillStyle = 'rgba(22,20,16,0.8)';
      for (let i = 0; i < n; i++) {
        const f = ahora / (240 + i * 90) + (semilla || 0) + i * 2.1;
        const rx = tileSize * (0.22 + i * 0.06);
        const x = cx + Math.cos(f) * rx;
        const y = cy - tileSize * 0.22 + Math.sin(f * 1.7) * tileSize * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } catch (e) {}
  }

  // Huesos (etapas 2 y 3). El esqueleto es EL MISMO PERSONAJE con la paleta de
  // huesos y la MISMA postura que el cuerpo (tumbado y girado igual), así que
  // ocupa exactamente el mismo sitio: si el cuerpo estaba tumbado mirando a la
  // derecha, el esqueleto queda igual.
  //
  // `o` (opcional) trae la paleta y la escala del muerto. Sin ellas —bichos, o
  // esqueletos de partidas viejas sin paleta— se usa el sprite de huesos de
  // siempre (`esqueleto_humano` / `esqueleto_animal`).
  function huesos(ctx, cx, cy, w, h, variante, o) {
    if (!ctx) return;
    const pal = o && o.palette;
    if (pal && typeof D.drawCharacterPixels === 'function') {
      ctx.save();
      try {
        ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2.2);
        D.drawCharacterPixels(
          ctx, paletaHuesos(pal),
          Math.floor(-w * 0.5), Math.floor(-h * 0.65),
          Math.max(1, Number(o.scale) || 1),
          { dir: 'right', frame: 0 }
        );
      } catch (e) {
        // Si el muñeco no se puede pintar, mejor el sprite genérico que nada.
        try { ctx.restore(); } catch (e2) {}
        try {
          const esp = ESPECIES_ESQUELETO[variante] || ESPECIES_ESQUELETO.humano;
          if (typeof D.drawSprite === 'function') D.drawSprite(esp.clave, cx, cy + h * 0.06, w * 1.05, h * 0.72, { noShadow: true });
        } catch (e3) {}
        return;
      }
      try { ctx.restore(); } catch (e) {}
      return;
    }
    try {
      const esp = ESPECIES_ESQUELETO[variante] || ESPECIES_ESQUELETO.humano;
      if (typeof D.drawSprite === 'function') {
        D.drawSprite(esp.clave, cx, cy + h * 0.06, w * 1.05, h * 0.72, { noShadow: true });
      }
    } catch (e) {}
  }

  // ── Cuerpo humanoide (jugador, NPC, enemigo con forma humana) ────────────
  // `o` = { ctx, cx, cy, w, h, scale, palette, etapa, tileSize, semilla, rotar }
  function dibujarHumanoide(o) {
    const ctx = o.ctx;
    if (!ctx) return;
    const etapa = clamp(Number(o.etapa) || 0, 0, ETAPAS.length - 1);
    const tileSize = Math.max(8, Number(o.tileSize) || 16);
    const w = Number(o.w) || tileSize, h = Number(o.h) || tileSize;
    const rotar = (o.rotar === undefined) ? true : !!o.rotar;

    // Sombra y charco (van debajo del cuerpo).
    try {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.ellipse(o.cx, o.cy + Math.max(2, tileSize * 0.12), Math.max(6, w * 0.32), Math.max(3, h * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } catch (e) {}
    charco(ctx, o.cx, o.cy, tileSize, etapa);

    // Los huesos van DEBAJO: en la etapa 2 asoman a través de la carne. Se pintan
    // con la figura del muerto (misma forma y misma postura, ver `huesos`).
    if (etapa >= 2) huesos(ctx, o.cx, o.cy, w, h, o.varianteEsqueleto || 'humano', o);

    // La carne se desvanece: a los 22 s ya está translúcida y a los 34 s no está.
    if (etapa < 3) {
      try {
        ctx.save();
        ctx.globalAlpha = etapa === 2 ? 0.42 : 1;
        const pal = etapa === 0 ? (o.palette || {}) : paletaPodrida(o.palette, etapa);
        if (rotar) {
          ctx.translate(o.cx, o.cy);
          ctx.rotate(-Math.PI / 2.2);
          D.drawCharacterPixels(ctx, pal, Math.floor(-w * 0.5), Math.floor(-h * 0.65), Math.max(1, Number(o.scale) || 1), { dir: 'right', frame: 0 });
        } else {
          D.drawCharacterPixels(ctx, pal, Math.floor(o.cx - w * 0.5), Math.floor(o.cy - h * 0.65), Math.max(1, Number(o.scale) || 1), { dir: 'right', frame: 0 });
        }
        ctx.restore();
      } catch (e) {}
    }
    if (etapa >= 1) moscas(ctx, o.cx, o.cy, tileSize, etapa, o.semilla);
    if (etapa >= 2) {
      // Jirones de ropa enredados en los huesos: da la sensación de que allí
      // había alguien, no un montón de huesos cualquiera.
      try {
        ctx.save();
        ctx.globalAlpha = etapa === 2 ? 0.5 : 0.32;
        ctx.fillStyle = paletaPodrida(o.palette, etapa).cloth;
        ctx.beginPath();
        ctx.ellipse(o.cx - w * 0.18, o.cy + h * 0.16, Math.max(3, tileSize * 0.16), Math.max(2, tileSize * 0.07), 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } catch (e) {}
    }
  }

  // ── Cuerpo de animal (conejo, zorro, enemigo redondo) ────────────────────
  // `o` = { ctx, x, y, tileSize, etapa, color, colorCharco, ancho, alto, semilla }
  function dibujarAnimal(o) {
    const ctx = o.ctx;
    if (!ctx) return;
    const etapa = clamp(Number(o.etapa) || 0, 0, ETAPAS.length - 1);
    const tileSize = Math.max(8, Number(o.tileSize) || 16);
    const cx = o.x + tileSize * 0.5;
    const cy = o.y + tileSize * 0.66;
    const rw = Math.max(4, Number(o.ancho) || tileSize * 0.22);
    const rh = Math.max(2, Number(o.alto) || tileSize * 0.07);
    const color = etapa === 0 ? (o.color || '#BBAA9A') : mezclarColores(o.color || '#BBAA9A', TINTE_PODRIDO, etapa >= 2 ? 0.6 : 0.4);

    // CUIDADO con los `save/restore`: tienen que ir emparejados (un `save` de más
    // deja el contexto con el alfa del cuerpo y los huesos salían transparentes).
    if (etapa < 3) {
      try {
        ctx.save();
        ctx.globalAlpha = etapa === 2 ? 0.45 : 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw, rh, -0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } catch (e) {}
    }
    try {
      charco(ctx, cx, cy + tileSize * 0.08, tileSize, etapa);
      if (etapa >= 2) huesos(ctx, cx, cy - tileSize * 0.02, tileSize * 0.9, tileSize * 0.5, 'animal');
    } catch (e) {}
    if (etapa >= 1) moscas(ctx, cx, cy - tileSize * 0.1, tileSize, etapa, o.semilla);
  }

  // ── Esqueleto permanente (entidad `kind: 'skeleton'`) ────────────────────
  // Con `o.palette` (la del muerto) se dibuja SU FIGURA, tumbada y en el mismo
  // sitio donde cayó: el motor manda la geometría exacta del cadáver
  // (`cx`/`cy`/`w`/`h`/`scale`, ver `geometriaDeCuerpoCaido` en game-engine.js),
  // para que el paso de «cadáver» a «esqueleto» no mueva nada de sitio.
  function dibujarEsqueletoFijo(o) {
    const ctx = o && o.ctx;
    if (!ctx) return;
    const tileSize = Math.max(8, Number(o.tileSize) || 16);
    const variante = o.variante === 'animal' ? 'animal' : 'humano';
    // ¿Hay figura del muerto, o toca el sprite de huesos genérico? Los bichos
    // (conejos, zorros) traen `figura:false` y usan su montón de huesos.
    const conFigura = !!(o.figura !== false && o.palette && typeof D.drawCharacterPixels === 'function');
    const w = conFigura ? (Number(o.w) || tileSize) : tileSize * (variante === 'animal' ? 0.85 : 1.15);
    const h = conFigura ? (Number(o.h) || tileSize) : tileSize * (variante === 'animal' ? 0.5 : 0.8);
    const x = Number(o.x) || 0, y = Number(o.y) || 0;
    const cx = Number.isFinite(Number(o.cx)) ? Number(o.cx) : x + tileSize * 0.5;
    const cy = Number.isFinite(Number(o.cy)) ? Number(o.cy) : y + tileSize * 0.72;
    const huesosY = conFigura ? cy : cy - tileSize * 0.06;
    try {
      // Sombra + cerco seco: sigue habiendo «algo» allí, no flota.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + tileSize * 0.06, tileSize * 0.3, tileSize * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,44,30,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy + tileSize * 0.06, tileSize * 0.34, tileSize * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } catch (e) {}
    huesos(ctx, cx, huesosY, w, h, variante, conFigura ? o : null);
  }

  // Registra los dos esqueletos en la librería de sprites del motor (igual que
  // hace `registerPlantSprites` con los cultivos).
  function registrarSprites(library) {
    try {
      const lib = library || (typeof window !== 'undefined' ? window.ENTITY_PIXEL_LIBRARY : null);
      if (!lib) return {};
      const out = {};
      for (const [variante, info] of Object.entries(ESPECIES_ESQUELETO)) {
        const def = {
          grid: info.def.grid,
          gridW: info.def.w,
          gridH: info.def.h,
          pixels: info.def.pixels.map(p => p.slice()),
          esqueleto: true
        };
        lib[info.clave] = def;
        out[variante] = info.clave;
      }
      return out;
    } catch (e) { return {}; }
  }

  return {
    ETAPAS,
    DESCOMPOSICION_MS,
    etapaDeCadaver,
    etapaInfo,
    paletaPodrida,
    paletaHuesos,
    HUESO,
    dibujarHumanoide,
    dibujarAnimal,
    dibujarEsqueletoFijo,
    registrarSprites,
    esqueletoPara,
    esqueletoKeyPara: (variante) => (ESPECIES_ESQUELETO[variante] || ESPECIES_ESQUELETO.humano).clave
  };
}
