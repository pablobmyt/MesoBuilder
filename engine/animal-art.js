// engine/animal-art.js
// ─────────────────────────────────────────────────────────────────────────────
// Animales del juego (conejo, zorro, perro/Kidu y lobo) dibujados como
// pixel-art GENERADO y animado por partes.
//
// Antes: los conejos y zorros eran elipses vectoriales suaves (nada de pixel
// art) y el perro y el lobo eran un mapa de bits FIJO: se movían por el mapa
// deslizándose, sin patas, sin cola, sin orejas. Aquí cada animal se compone de
// formas (cuerpo, cabeza, orejas, cola, patas) sobre una rejilla de arte; la
// animación mueve cada parte y el contorno y el sombreado se calculan solos, así
// que el bicho siempre queda con el mismo estilo que el resto del juego.
//
// Rendimiento: el dibujado por animal y fotograma se cachea en un lienzo por
// (animal, estado, fotograma): en pantalla sólo se hace UN drawImage.
//
// Estados: 'idle' · 'walk' · 'run' · 'hurt' · 'dead'
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

const SPECS = {
  rabbit: {
    w: 13, h: 11,
    pal: { outline: '#3A2A1E', light: '#EFE6D2', mid: '#D8CBB0', dark: '#B3A489', eye: '#20160C', nose: '#D98B8B', tail: '#FFFFFF', paw: '#A99A80' },
    build(g, a) {
      const dy = a.bodyDy;
      // cuerpo + barriga + rabo
      g.ellipse(5.0, 6.2 + dy, 3.4, 2.6, 'body');
      g.ellipse(5.2, 7.4 + dy, 2.6, 1.3, 'belly');
      g.ellipse(1.7, 6.4 + dy + a.tailDy, 1.2, 1.1, 'tail');
      // cabeza, hocico y orejas
      const hy = dy + a.headDy;
      g.ellipse(8.4, 4.6 + hy, 2.3, 2.1, 'body');
      g.ellipse(10.2, 5.2 + hy, 1.0, 0.8, 'body');
      g.nose(10.9, 5.0 + hy, 'nose');
      g.ellipse(7.4, 2.2 + hy + a.earDy, 0.6, 2.0, 'body');   // orejas
      g.ellipse(8.7, 2.4 + hy + a.earDy, 0.6, 2.0, 'body');
      // patas (ciclo de salto)
      g.rect(7.4, 7.6 + dy - a.legFrontLift, 8.6, 9.4 + dy - a.legFrontLift, 'paw');
      g.rect(3.0, 7.4 + dy - a.legBackLift, 4.4, 9.4 + dy - a.legBackLift, 'paw');
      g.eye(9.2, 4.2 + hy);
    }
  },

  fox: {
    w: 15, h: 11,
    pal: { outline: '#33200F', light: '#E8A15A', mid: '#D07A32', dark: '#A8551C', eye: '#1A1008', nose: '#241610', tail: '#E8E0D0', paw: '#3A2411' },
    build(g, a) {
      const dy = a.bodyDy;
      g.ellipse(5.8, 6.0 + dy, 3.9, 2.2, 'body');
      g.ellipse(5.6, 7.1 + dy, 3.0, 1.2, 'belly');
      // cola poblada (se menea como una fila curvada)
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        g.ellipse(3.0 - i * 0.42, 5.2 + dy + a.tailDy * t * 2 + t * 0.5, 1.05 - t * 0.35, 1.0 - t * 0.3, t > 0.75 ? 'tailTip' : 'body');
      }
      const hy = dy + a.headDy;
      g.ellipse(9.8, 4.8 + hy, 2.1, 1.9, 'body');
      g.ellipse(11.6, 5.4 + hy, 1.5, 0.9, 'body');
      g.nose(12.7, 5.2 + hy, 'nose');
      g.tri(8.8, 4.0 + hy + a.earDy, 9.8, 1.5 + hy + a.earDy, 10.6, 4.0 + hy + a.earDy, 'paw');
      g.tri(10.8, 4.0 + hy + a.earDy, 11.8, 1.9 + hy + a.earDy, 12.6, 4.2 + hy + a.earDy, 'paw');
      // cuatro patas en trote
      g.rect(6.9, 7.2 + dy - a.legFrontLift, 7.6, 9.4 + dy - a.legFrontLift, 'paw');
      g.rect(8.4, 7.2 + dy - a.legFrontLift2, 9.1, 9.4 + dy - a.legFrontLift2, 'paw');
      g.rect(3.4, 7.2 + dy - a.legBackLift, 4.1, 9.4 + dy - a.legBackLift, 'paw');
      g.rect(4.9, 7.2 + dy - a.legBackLift2, 5.6, 9.4 + dy - a.legBackLift2, 'paw');
      g.eye(10.4, 4.4 + hy);
    }
  },

  dog: {
    w: 15, h: 12,
    pal: { outline: '#2A1A10', light: '#C08A4E', mid: '#9A6A34', dark: '#714B22', eye: '#1A1008', nose: '#241610', tail: '#E4DCC8', paw: '#4A2E16' },
    build(g, a) {
      const dy = a.bodyDy;
      g.ellipse(5.8, 6.6 + dy, 4.0, 2.4, 'body');
      g.ellipse(5.6, 7.8 + dy, 3.1, 1.3, 'belly');
      // cola levantada que se menea
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        g.ellipse(2.6 - i * 0.16, 5.0 + dy - t * 1.6 + a.tailDy * (0.4 + t), 1.0 - t * 0.35, 1.05 - t * 0.35, 'tail');
      }
      const hy = dy + a.headDy;
      g.ellipse(9.9, 5.0 + hy, 2.4, 2.2, 'body');
      g.rect(10.6, 5.4 + hy, 12.6, 6.6 + hy, 'body');           // hocico
      g.nose(13.2, 5.8 + hy, 'nose');
      // orejas caídas (se mueven con el trote)
      g.ellipse(9.0, 3.2 + hy + a.earDy, 1.0, 1.6, 'paw');
      g.ellipse(11.0, 3.4 + hy + a.earDy, 1.0, 1.6, 'paw');
      g.rect(6.9, 8.0 + dy - a.legFrontLift, 7.7, 10.6 + dy - a.legFrontLift, 'paw');
      g.rect(8.5, 8.0 + dy - a.legFrontLift2, 9.3, 10.6 + dy - a.legFrontLift2, 'paw');
      g.rect(3.2, 8.0 + dy - a.legBackLift, 4.0, 10.6 + dy - a.legBackLift, 'paw');
      g.rect(4.8, 8.0 + dy - a.legBackLift2, 5.6, 10.6 + dy - a.legBackLift2, 'paw');
      g.eye(10.5, 4.6 + hy);
    }
  },

  wolf: {
    w: 17, h: 12,
    pal: { outline: '#1C1A18', light: '#9AA0A6', mid: '#71767C', dark: '#4E5359', eye: '#F2C230', nose: '#161616', tail: '#3E4247', paw: '#33383D' },
    build(g, a) {
      const dy = a.bodyDy;
      g.ellipse(6.2, 6.6 + dy, 4.4, 2.5, 'body');
      g.ellipse(6.0, 7.8 + dy, 3.3, 1.3, 'belly');
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        g.ellipse(2.4 - i * 0.34, 5.6 + dy + t * 0.8 + a.tailDy * t, 1.15 - t * 0.35, 1.15 - t * 0.35, 'tail');
      }
      const hy = dy + a.headDy;
      g.ellipse(10.8, 4.9 + hy, 2.5, 2.2, 'body');
      g.ellipse(12.9, 5.6 + hy, 1.7, 1.0, 'body');
      g.nose(14.2, 5.4 + hy, 'nose');
      g.tri(9.6, 4.0 + hy + a.earDy, 10.4, 1.0 + hy + a.earDy, 11.4, 4.0 + hy + a.earDy, 'paw');
      g.tri(11.8, 4.0 + hy + a.earDy, 12.7, 1.4 + hy + a.earDy, 13.5, 4.2 + hy + a.earDy, 'paw');
      g.rect(7.2, 7.8 + dy - a.legFrontLift, 8.1, 10.6 + dy - a.legFrontLift, 'paw');
      g.rect(9.0, 7.8 + dy - a.legFrontLift2, 9.9, 10.6 + dy - a.legFrontLift2, 'paw');
      g.rect(3.4, 7.8 + dy - a.legBackLift, 4.3, 10.6 + dy - a.legBackLift, 'paw');
      g.rect(5.2, 7.8 + dy - a.legBackLift2, 6.1, 10.6 + dy - a.legBackLift2, 'paw');
      g.eye(11.5, 4.4 + hy);
      g.eyePixel(12.1, 4.6 + hy);
    }
  },

  // CABALLO (rediseñado): ahora con proporciones de caballo de verdad — cuerpo
  // alargado, cuello inclinado, cabeza con hocico largo mirando adelante-abajo,
  // crin a lo largo del cuello, cola colgando y cuatro patas finas con casco.
  horse: {
    w: 36, h: 25,
    pal: { outline: '#241A12', light: '#AA6E36', mid: '#8E5A28', dark: '#5E3A18', eye: '#141008', nose: '#3A2416', tail: '#2E1E10', paw: '#4A2E16', mane: '#2A1B0E' },
    build(g, a) {
      const dy = a.bodyDy;
      const hy = dy + a.headDy;
      // DE ESPALDAS (`a.back`): el caballo se ve por detras, asi que la cara no
      // asoma y la cola va en el CENTRO de la grupa, no en un costado.
      const back = !!a.back;
      // ── Patas (finas, con casco) ──
      const patas = back
        ? [{ x: 12.0, lift: a.legBackLift }, { x: 14.4, lift: a.legBackLift2 },
           { x: 20.2, lift: a.legFrontLift }, { x: 22.6, lift: a.legFrontLift2 }]
        : [{ x: 8.4, lift: a.legBackLift }, { x: 11.0, lift: a.legBackLift2 },
           { x: 22.0, lift: a.legFrontLift }, { x: 24.6, lift: a.legFrontLift2 }];
      patas.forEach(p => {
        g.rect(p.x, 13.5 + dy - p.lift, p.x + 1.6, 21.5 + dy - p.lift, 'paw');
        // casco
        g.rect(p.x - 0.2, 20.6 + dy - p.lift, p.x + 1.9, 21.9 + dy - p.lift, 'mane');
      });
      // ── Cuerpo ──
      g.ellipse(16.0, 10.8 + dy, 8.6, 4.1, 'body');
      g.ellipse(16.0, 12.6 + dy, 6.6, 1.7, 'belly');
      g.ellipse(23.0, 10.6 + dy, 2.8, 3.2, 'body');          // pecho
      g.ellipse(9.0, 10.6 + dy, 3.0, 3.4, 'body');           // grupa
      // ── Cola (colgando; de espaldas, en el centro) ──
      const colaX = back ? 17.4 : 6.6;
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        g.ellipse(colaX - t * 1.1, 9.0 + dy + t * 8.4 + a.tailDy * (0.6 + t), 1.25 - t * 0.35, 1.35 - t * 0.3, 'tail');
      }
      if (back) {
        // Grupa de frente: el cuerpo mas corto y la cabeza asomando por detras.
        g.ellipse(17.2, 9.4 + dy, 5.4, 4.4, 'body');
        g.ellipse(17.2, 12.4 + dy, 4.0, 1.6, 'belly');
        for (let i = 0; i <= 5; i++) {
          const t = i / 5;
          g.ellipse(17.4 + t * 1.4, 6.4 + dy - t * 3.0 + hy * 0.3, 1.9 - t * 0.4, 2.0 - t * 0.4, 'body');
        }
        g.ellipse(18.6, 2.6 + hy, 2.3, 1.9, 'body');
        g.tri(17.4, 1.6 + hy + a.earDy, 17.8, -0.6 + hy + a.earDy, 18.8, 1.4 + hy + a.earDy, 'body');
        g.tri(19.4, 1.4 + hy + a.earDy, 20.0, -0.7 + hy + a.earDy, 20.9, 1.4 + hy + a.earDy, 'body');
        g.ellipse(18.4, 0.6 + hy, 1.1, 1.0, 'mane');
        return;
      }
      // ── Cuello inclinado (del pecho a la cabeza) ──
      for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        g.ellipse(22.6 + t * 5.6, 8.6 + dy - t * 4.6 + hy * 0.35, 1.9 - t * 0.5, 2.2 - t * 0.5, 'body');
      }
      // ── Cabeza: craneo + hocico largo mirando adelante y abajo ──
      g.ellipse(28.6, 4.4 + hy, 2.5, 2.1, 'body');
      g.rect(29.4, 4.6 + hy, 33.2, 6.6 + hy, 'body');
      g.rect(30.0, 6.4 + hy, 33.2, 7.2 + hy, 'dark');
      g.nose(33.6, 5.6 + hy, 'nose');
      // orejas (dos triangulitos)
      g.tri(27.4, 3.4 + hy + a.earDy, 27.7, 0.8 + hy + a.earDy, 28.8, 3.2 + hy + a.earDy, 'body');
      g.tri(29.3, 3.2 + hy + a.earDy, 29.9, 0.9 + hy + a.earDy, 30.8, 3.2 + hy + a.earDy, 'body');
      // ── Crin: a lo largo del cuello y un mechon en la frente ──
      for (let i = 0; i <= 9; i++) {
        const t = i / 9;
        g.ellipse(21.6 + t * 6.8, 7.2 + dy - t * 5.0 + (a.maneDy || 0), 1.0, 1.5, 'mane');
      }
      g.ellipse(28.4, 2.4 + hy, 1.2, 1.1, 'mane');
      g.eye(29.2, 3.9 + hy);
    }
  }
};

// ── Rejilla de arte ─────────────────────────────────────────────────────────
// Cada celda guarda una ETIQUETA ('body', 'belly', 'tail', 'paw', 'eye'…) y al
// final se convierte en píxeles: contorno donde toca el aire, sombreado por
// franjas verticales y colores fijos para ojos/nariz.
function makeGrid(w, h) {
  const cells = new Map();
  const put = (x, y, tag) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
    if (tag === 'eye' || tag === 'nose') { cells.set(xi + ',' + yi, tag); return; }
    const prev = cells.get(xi + ',' + yi);
    if (prev === 'eye' || prev === 'nose') return;
    cells.set(xi + ',' + yi, tag);
  };
  return {
    w, h, cells,
    rect: (x0, y0, x1, y1, tag) => { for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) put(x, y, tag); },
    ellipse: (cx, cy, rx, ry, tag) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) put(x, y, tag);
        }
      }
    },
    tri: (x0, y0, x1, y1, x2, y2, tag) => {
      const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
      const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
      const area = (ax, ay, bx, by, cx2, cy2) => (ax - cx2) * (by - cy2) - (bx - cx2) * (ay - cy2);
      const d1 = area(x0, y0, x1, y1, x2, y2);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const d2 = area(x, y, x1, y1, x2, y2), d3 = area(x0, y0, x, y, x2, y2), d4 = area(x0, y0, x1, y1, x, y);
          const neg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);
          const pos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);
          if (!(neg && pos)) put(x, y, tag);
        }
      }
    },
    nose: (x, y, tag) => put(x, y, tag),
    eye: (x, y) => put(x, y, 'eye'),
    eyePixel: (x, y) => put(x, y, 'eye')
  };
}

// Convierte la rejilla en píxeles [x, y, color] con contorno y sombreado.
function finishGrid(g, pal) {
  const cells = g.cells;
  const has = (x, y) => cells.has(x + ',' + y);
  const bounds = new Map();
  cells.forEach((tag, key) => {
    if (tag === 'eye' || tag === 'nose') return;
    const [x, y] = key.split(',').map(Number);
    const b = bounds.get(tag) || { y0: Infinity, y1: -Infinity };
    if (y < b.y0) b.y0 = y;
    if (y > b.y1) b.y1 = y;
    bounds.set(tag, b);
  });
  const out = [];
  cells.forEach((tag, key) => {
    const [x, y] = key.split(',').map(Number);
    if (tag === 'eye') { out.push([x, y, pal.eye]); return; }
    if (tag === 'nose') { out.push([x, y, pal.nose]); return; }
    // Contorno: cualquier celda del cuerpo que toca el aire (4 direcciones).
    if (!has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1)) { out.push([x, y, pal.outline]); return; }
    if (tag === 'tail' || tag === 'tailTip') { out.push([x, y, tag === 'tailTip' ? pal.tail : pal.dark]); return; }
    if (tag === 'paw') { out.push([x, y, pal.paw]); return; }
    if (tag === 'belly') { out.push([x, y, pal.light]); return; }
    const b = bounds.get(tag) || { y0: y, y1: y };
    const span = Math.max(1, b.y1 - b.y0);
    const t = (y - b.y0) / span;
    out.push([x, y, t < 0.34 ? pal.light : t < 0.72 ? pal.mid : pal.dark]);
  });
  return out;
}

// ── Animación ───────────────────────────────────────────────────────────────
// Devuelve los desplazamientos de cada parte para una fase 0..1.
function animFor(kind, state, p) {
  const a = {
    bodyDy: 0, headDy: 0, earDy: 0, tailDy: 0,
    legFrontLift: 0, legFrontLift2: 0, legBackLift: 0, legBackLift2: 0
  };
  const s = state || 'idle';
  if (s === 'run' || s === 'walk') {
    const fast = s === 'run';
    const swing = Math.sin(p * TAU);
    const swing2 = Math.sin(p * TAU + Math.PI);
    const lift = fast ? 2 : 1;
    a.legFrontLift = swing > 0 ? Math.round(swing * lift) : 0;
    a.legFrontLift2 = swing2 > 0 ? Math.round(swing2 * lift) : 0;
    a.legBackLift = swing2 > 0 ? Math.round(swing2 * lift) : 0;
    a.legBackLift2 = swing > 0 ? Math.round(swing * lift) : 0;
    a.bodyDy = fast ? -Math.abs(Math.round(Math.sin(p * TAU * 2) * 1.4)) : -Math.abs(Math.round(Math.sin(p * TAU * 2) * 0.6));
    a.headDy = fast ? -1 : 0;
    a.tailDy = Math.sin(p * TAU * 2) * (fast ? 1.2 : 0.6);
    a.earDy = fast ? Math.round(Math.sin(p * TAU * 2 + 1) * 1) : 0;
    if (kind === 'rabbit') {
      // Salto: el cuerpo sube en arco y las patas se recogen en el aire.
      const hop = Math.max(0, Math.sin(p * Math.PI));
      a.bodyDy = -Math.round(hop * 2.4);
      a.legFrontLift = Math.round(hop * 2);
      a.legBackLift = Math.round(hop * 2);
      a.earDy = -Math.round(hop * 1.2);
      a.headDy = -Math.round(hop * 0.6);
    }
  } else if (s === 'hurt' || s === 'dead') {
    a.bodyDy = 1;
    a.headDy = 1;
    a.legFrontLift = 0;
  } else {
    // Reposo: respira (sube y baja un píxel) y mueve orejas/cola despacio.
    a.bodyDy = Math.sin(p * TAU) > 0.3 ? -1 : 0;
    a.headDy = a.bodyDy;
    a.earDy = Math.sin(p * TAU * 1.5) > 0.6 ? -1 : 0;
    a.tailDy = Math.round(Math.sin(p * TAU * 2) * 1.0);
  }
  return a;
}

const BITMAPS = new Map();
const FRAMES = 8;

function bitmapFor(kind, state, bucket, back) {
  const key = kind + '|' + state + '|' + bucket + '|' + (back ? 'back' : 'front');
  let bmp = BITMAPS.get(key);
  if (bmp) return bmp;
  const spec = SPECS[kind] || SPECS.rabbit;
  const g = makeGrid(spec.w, spec.h);
  spec.build(g, Object.assign(animFor(kind, state, bucket / FRAMES), { back: !!back }));
  const pixels = finishGrid(g, spec.pal);
  const cv = document.createElement('canvas');
  cv.width = spec.w; cv.height = spec.h;
  const c = cv.getContext('2d');
  for (const p of pixels) { c.fillStyle = p[2]; c.fillRect(p[0], p[1], 1, 1); }
  bmp = { canvas: cv, w: spec.w, h: spec.h };
  BITMAPS.set(key, bmp);
  return bmp;
}

/**
 * Dibuja un animal.
 * @param {CanvasRenderingContext2D} ctx
 * @param {'rabbit'|'fox'|'dog'|'wolf'} kind
 * @param {number} x centro horizontal (px de pantalla)
 * @param {number} yBase base (px de pantalla, donde apoya las patas)
 * @param {number} ancho ancho deseado en px
 * @param {object} [opts] { state, phase01, flip, now, ent }
 */
export function drawAnimal(ctx, kind, x, yBase, ancho, opts = {}) {
  const spec = SPECS[kind] || SPECS.rabbit;
  const state = opts.state || 'idle';
  const now = opts.now || Date.now();
  // Fase: si el bicho se está moviendo la marca la velocidad de la marcha; si no,
  // el reloj (respiración, coleteo, orejas).
  let phase = opts.phase01;
  if (phase == null) {
    const moving = state === 'run' || state === 'walk';
    phase = moving ? ((now * (state === 'run' ? 0.0055 : 0.0034)) % 1) : ((now * 0.0009) % 1);
  }
  const bucket = Math.floor(phase * FRAMES) % FRAMES;
  const back = !!opts.back;
  const bmp = bitmapFor(kind, state, bucket, back);
  const w = Math.max(6, Math.round(ancho));
  const h = Math.max(6, Math.round(w * (bmp.h / bmp.w)));
  const px = Math.round(x - w / 2);
  const py = Math.round(yBase - h);
  try {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (opts.flip) {
      ctx.translate(x, yBase);
      ctx.scale(-1, 1);
      ctx.drawImage(bmp.canvas, -w / 2, -h, w, h);
    } else {
      ctx.drawImage(bmp.canvas, px, py, w, h);
    }
    ctx.restore();
  } catch (e) { /* ignore */ }
  return { x: px, y: py, w, h };
}

/** Ancho/ratio de un animal (para sombras y barras de vida). */
export function animalAspect(kind) {
  const spec = SPECS[kind] || SPECS.rabbit;
  return spec.w / spec.h;
}

/** ¿Existe el animal? (para poder pedir variantes sin miedo) */
export function hasAnimal(kind) {
  return !!SPECS[kind];
}

/**
 * Píxeles del animal para una fase dada, SIN dibujar. Se usa para previsualizar
 * y revisar el arte desde Node (`node tools/preview-animals.js`).
 * @returns {{ w:number, h:number, pixels:number[][] }}
 */
export function animalPixelsFor(kind, state, phase01) {
  const spec = SPECS[kind] || SPECS.rabbit;
  const g = makeGrid(spec.w, spec.h);
  spec.build(g, animFor(kind, state || 'idle', phase01 == null ? 0 : phase01));
  return { w: spec.w, h: spec.h, pixels: finishGrid(g, spec.pal), pal: spec.pal };
}

export const ANIMAL_KINDS = Object.keys(SPECS);
