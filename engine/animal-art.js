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

  // CABALLO: el bicho al que más se le mira la cara (se monta, tiene acciones y
  // sale en la intro del carro), así que va con proporciones de caballo de verdad:
  //
  //   · El cuerpo (barriga → cruz) es el 45 % del alto y las patas el 55 %.
  //   · El cuello sube en diagonal desde el pecho y la cabeza lleva hocico largo,
  //     ollar, orejas y un mechón de crin.
  //   · La CRUZ y el LOMO llevan luz (`body` se sombrea por filas), la barriga es
  //     clara, las cañas van en tono oscuro y el casco casi negro.
  //
  // Va en coordenadas relativas al SUELO (`F` es donde apoyan los cascos) y con
  // `g.setOffset()` desplazado: así las poses que suben (encabritarse, relincho)
  // tienen su propia rejilla más alta (`hFor`) sin tocar las demás. OJO: el lienzo
  // del fotograma tiene que medir también esa altura (ver `bitmapFor`), o la
  // cabeza de las poses altas se recorta.
  horse: {
    w: 40, h: 26,
    hFor(state) {
      if (state === 'rear') return 36;      // encabritado: medio cuerpo en el aire
      if (state === 'neigh') return 31;     // relincho: cuello y crin arriba
      if (state === 'gallop') return 27;    // galope: el cuerpo se estira
      return 26;
    },
    pal: {
      outline: '#221509', light: '#C08040', mid: '#8E5A28', dark: '#5A3618',
      eye: '#100C06', nose: '#2A1A0E', tail: '#2A1B0E', mane: '#241608',
      paw: '#6B4420', hoof: '#1E1208'
    },
    build(g, a) {
      // Alto extra de la rejilla (rear/neigh): el caballo baja para seguir
      // apoyando los cascos en el mismo píxel del suelo.
      const S = Math.max(0, g.h - 26);
      const dy = a.bodyDy || 0;
      g.setOffset(a.bodyDx || 0, S + dy);
      const back = !!a.back;
      const rear = a.rearDy || 0;             // el tercio delantero se levanta
      const headDy = a.headDy || 0;
      const headDx = a.headDx || 0;
      const cuello = a.neckStretch || 0;      // el cuello se estira hacia delante
      const mouth = a.mouth ? 1 : 0;
      const mono = a.maneFly || 0;
      const tailDx = a.tailDx || 0, tailDy = a.tailDy || 0;
      const lf = a.legFrontLift || 0, lf2 = a.legFrontLift2 || 0;
      const lb = a.legBackLift || 0, lb2 = a.legBackLift2 || 0;
      const fSwing = a.legFrontSwing || 0, bSwing = a.legBackSwing || 0;
      const earDy = a.earDy || 0;
      // 40×26 de rejilla: suelo en y=24, barriga y=16, cruz y=9, orejas y=2.
      const F = 24;
      const legTop = 13.6;                    // de dónde nace la caña
      const yCas = F - dy - (a.legShort || 0);
      // ── PATAS: caña fina y casco ancho. El casco NO sube con el balanceo del
      //    cuerpo (de ahí el `-dy` en la nacencia), así el caballo no flota.
      const patas = back
        ? [{ x: 15.0, lift: lb, dx: 0 }, { x: 17.4, lift: lb2, dx: 0 },
           { x: 22.6, lift: lf, dx: 0 }, { x: 25.0, lift: lf2, dx: 0 }]
        : [{ x: 8.4, lift: lb, dx: bSwing }, { x: 11.0, lift: lb2, dx: bSwing * 0.7 },
           { x: 26.6, lift: lf, dx: fSwing }, { x: 29.2, lift: lf2, dx: fSwing * 0.8 }];
      patas.forEach(p => {
        const x0 = p.x + p.dx;
        const y0 = legTop - p.lift - dy;
        const y1 = yCas;
        if (y1 - y0 < 1.4) return;
        // 3 px de ancho: con 2 px el contorno se come el color de la caña y la pata
        // sale como una raya negra.
        g.rect(x0, y0, x0 + 2.4, y1 - 1.1, 'paw');           // caña
        g.rect(x0 - 0.3, y1 - 1.1, x0 + 2.7, y1, 'hoof');    // casco
      });
      // ── COLA (de la grupa hacia abajo; de espaldas va por el centro) ──
      const colaX = back ? 20.2 : 4.4;
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        g.ellipse(colaX - t * 1.6 + tailDx * (0.3 + t), 10.0 + t * 9.4 + tailDy * (0.5 + t),
          1.9 - t * 0.5, 1.9 - t * 0.45, 'mane');
      }
      // ── CUERPO: barriga clara, tronco, pecho y grupa. Se sombrea aparte del
      //    cuello: si comparten etiqueta, las filas del lomo salen oscuras porque
      //    el degradado se calcula sobre toda la silueta.
      g.ellipse(17.0, 12.2 - rear * 0.35, 13.0, 4.3, 'body');
      g.ellipse(17.0, 14.8 - rear * 0.2, 11.4, 1.5, 'belly');
      g.ellipse(28.2, 11.8 - rear * 0.55, 3.1, 3.6, 'body');   // pecho
      g.ellipse(7.2, 11.6 - rear * 0.15, 3.5, 3.9, 'body');    // grupa
      if (back) {
        // ── DE ESPALDAS: grupa de frente, cola por el centro y la cabeza asomando.
        g.ellipse(18.0, 11.4, 8.2, 4.4, 'body');
        g.ellipse(18.0, 14.6, 6.4, 1.4, 'belly');
        for (let i = 0; i <= 7; i++) {
          const t = i / 7;
          g.ellipse(20.4 + t * 1.6 + headDx * t, 8.4 - t * 4.2 + headDy * 0.4, 2.5 - t * 0.7, 2.7 - t * 0.6, 'neck');
        }
        g.ellipse(22.0 + headDx, 3.4 + headDy, 2.7, 2.3, 'neck');
        g.tri(20.4 + headDx, 2.4 + headDy + earDy, 20.8 + headDx, -0.4 + headDy + earDy, 21.9 + headDx, 2.2 + headDy + earDy, 'neck');
        g.tri(22.4 + headDx, 2.2 + headDy + earDy, 23.1 + headDx, -0.5 + headDy + earDy, 24.1 + headDx, 2.2 + headDy + earDy, 'neck');
        g.ellipse(22.0 + headDx, 1.0 + headDy + mono * 0.6, 1.3, 1.1, 'mane');
        g.eye(21.6 + headDx, 3.4 + headDy);
        return;
      }
      // ── CUELLO: tubo que se estrecha del pecho a la nuca ──
      const nbX = 28.4, nbY = 9.8 - rear * 0.5;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        g.ellipse(nbX + t * (6.2 + cuello) + headDx * t,
          nbY - t * (4.6 + headDy * 0.6) + headDy * 0.4,
          2.5 - t * 0.9, 2.9 - t * 0.85, 'neck');
      }
      // ── CABEZA: cráneo, hocico largo, belfo y ollar ──
      const hx = 35.4 + cuello * 0.9 + headDx, hy = 4.8 - rear * 0.7 + headDy;
      g.ellipse(hx, hy, 2.8, 2.3, 'neck');
      g.rect(hx + 0.6, hy + 0.4, hx + 5.0, hy + 2.4, 'neck');            // caña del hocico
      g.rect(hx + 1.2, hy + 2.2, hx + 5.2, hy + 3.0 + mouth, 'belly');    // belfo (se abre)
      g.nose(hx + 5.3, hy + 1.3, 'nose');                                 // ollar
      g.tri(hx - 1.7, hy - 0.4 + earDy, hx - 1.3, hy - 3.6 + earDy, hx + 0.1, hy - 0.8 + earDy, 'neck');
      g.tri(hx + 0.7, hy - 0.8 + earDy, hx + 1.3, hy - 3.4 + earDy, hx + 2.3, hy - 0.8 + earDy, 'neck');
      // ── CRIN: a lo largo de la nuca (sin llegar a tapar la cabeza) + mechón ──
      for (let i = 0; i <= 11; i++) {
        const t = i / 11;
        if (t > 0.8) continue;
        g.ellipse(nbX - 0.8 + t * (7.4 + cuello), nbY - 2.5 - t * (5.0 + headDy * 0.5) + (a.maneDy || 0)
          - rear * 0.45 * (1 - t) + headDy * 0.2,
          1.4 + mono * t * 0.5, 1.9 + mono * t * 0.6, 'mane');
      }
      g.ellipse(hx - 1.2, hy - 2.6 + mono * 0.5, 1.5, 1.4 + mono * 0.4, 'mane');
      g.eye(hx + 1.0, hy - 0.3);
    }
  }
};

// ── Rejilla de arte ─────────────────────────────────────────────────────────
// Cada celda guarda una ETIQUETA ('body', 'belly', 'tail', 'paw', 'eye'…) y al
// final se convierte en píxeles: contorno donde toca el aire, sombreado por
// franjas verticales y colores fijos para ojos/nariz.
function makeGrid(w, h) {
  const cells = new Map();
  // Desplazamiento global de la rejilla: las poses que crecen hacia arriba
  // (el caballo encabritado) usan una rejilla más alta y se bajan con esto para
  // seguir apoyando en el mismo suelo.
  let offX = 0, offY = 0;
  const put = (x, y, tag) => {
    const xi = Math.round(x + offX), yi = Math.round(y + offY);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
    if (tag === 'eye' || tag === 'nose') { cells.set(xi + ',' + yi, tag); return; }
    const prev = cells.get(xi + ',' + yi);
    if (prev === 'eye' || prev === 'nose') return;
    cells.set(xi + ',' + yi, tag);
  };
  return {
    w, h, cells,
    setOffset: (dx, dy) => { offX = dx || 0; offY = dy || 0; },
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
    // Crin y casco van con su propio color (en el caballo son casi negros): si se
    // dejaran al sombreado por filas saldrían marrones.
    if (tag === 'mane') { out.push([x, y, pal.mane || pal.dark]); return; }
    if (tag === 'hoof') { out.push([x, y, pal.hoof || pal.outline]); return; }
    if (tag === 'paw') { out.push([x, y, pal.paw]); return; }
    if (tag === 'belly') { out.push([x, y, pal.light]); return; }
    const b = bounds.get(tag) || { y0: y, y1: y };
    const span = Math.max(1, b.y1 - b.y0);
    const t = (y - b.y0) / span;
    out.push([x, y, t < 0.34 ? pal.light : t < 0.72 ? pal.mid : pal.dark]);
  });
  return out;
}

// Alto de rejilla de un estado (el caballo encabritado necesita más alto).
function gridHFor(spec, state) {
  let h = spec.h;
  try { if (typeof spec.hFor === 'function') h = spec.hFor(state || 'idle'); } catch (e) {}
  return Math.max(4, Math.round(h || 8));
}

// ── Animación ───────────────────────────────────────────────────────────────
// Devuelve los desplazamientos de cada parte para una fase 0..1.
function animFor(kind, state, p) {
  const a = {
    bodyDy: 0, bodyDx: 0, headDy: 0, headDx: 0, earDy: 0, tailDy: 0, tailDx: 0,
    legFrontLift: 0, legFrontLift2: 0, legBackLift: 0, legBackLift2: 0,
    legFrontSwing: 0, legBackSwing: 0, legShort: 0,
    maneDy: 0, maneFly: 0, neckStretch: 0, rearDy: 0, mouth: 0
  };
  const s = state || 'idle';
  const caballo = (kind === 'horse');
  // ── Caballo: aires y acciones propias ──
  if (caballo && (s === 'walk' || s === 'trot' || s === 'gallop')) {
    const galope = s === 'gallop';
    const trote = s === 'trot';
    const swing = Math.sin(p * TAU), swing2 = Math.sin(p * TAU + Math.PI);
    if (galope) {
      // Galope: las manos se estiran adelante y los remos recogen para empujar,
      // con una fase de suspensión (los cuatro en el aire a la vez).
      const salto = Math.max(0, Math.sin(p * TAU * 2));
      a.legFrontLift = Math.round(1 + swing * 2 + salto * 2);
      a.legFrontLift2 = Math.round(1 + swing2 * 2 + salto * 1.4);
      a.legBackLift = Math.round(1 + swing2 * 2 + salto * 1.8);
      a.legBackLift2 = Math.round(1 + swing * 2 + salto * 1.2);
      a.legFrontSwing = Math.round(swing * 2.6);
      a.legBackSwing = Math.round(-swing2 * 2.0);
      a.bodyDy = -Math.abs(Math.round(Math.sin(p * TAU * 2) * 1.6));
      a.headDy = -1;
      a.neckStretch = 1.6;
      a.maneFly = 1;
      a.maneDy = Math.round(Math.sin(p * TAU * 3) * 0.6);
      a.tailDy = Math.round(Math.sin(p * TAU * 3) * 1.4);
      a.tailDx = -1.6;
      a.earDy = -1;
    } else {
      // Paso (4 tiempos) y trote (2 tiempos, en diagonal).
      const lift = trote ? 2 : 1;
      a.legFrontLift = swing > 0 ? Math.round(swing * lift) : 0;
      a.legFrontLift2 = swing2 > 0 ? Math.round(swing2 * lift) : 0;
      a.legBackLift = swing2 > 0 ? Math.round(swing2 * lift) : 0;
      a.legBackLift2 = swing > 0 ? Math.round(swing * lift) : 0;
      a.legFrontSwing = Math.round(swing * (trote ? 1.4 : 0.8));
      a.legBackSwing = Math.round(-swing * (trote ? 1.2 : 0.7));
      a.bodyDy = -Math.abs(Math.round(Math.sin(p * TAU * 2) * (trote ? 1.2 : 0.6)));
      a.headDy = trote ? -1 + Math.round(Math.sin(p * TAU * 2) * 1) : 0;
      a.maneDy = Math.round(Math.sin(p * TAU * 2) * 0.6);
      a.tailDy = Math.round(Math.sin(p * TAU * 2) * (trote ? 1.1 : 0.6));
    }
    return a;
  }
  if (caballo && s === 'neigh') {
    // Relincho: sube la cabeza, abre el belfo y la crin se levanta. Envolvente:
    // sube, se mantiene y baja (además un par de cabeceos).
    const env = Math.sin(Math.min(1, p) * Math.PI);
    a.headDy = -Math.round(3 * env + Math.abs(Math.sin(p * TAU * 3)) * 0.8);
    a.neckStretch = 0.6 + env * 0.8;
    a.mouth = env > 0.35 ? 1 : 0;
    a.maneFly = Math.round(env * 1.4);
    a.maneDy = -Math.round(env * 0.8);
    a.bodyDy = -Math.round(env * 0.6);
    a.earDy = -Math.round(env);
    a.tailDy = Math.round(Math.sin(p * TAU * 2) * 1.6);
    return a;
  }
  if (caballo && s === 'rear') {
    // Encabritarse: el tercio delantero sube, las manos se recogen y el cuerpo
    // se apoya en los remos.
    const env = Math.sin(Math.min(1, p) * Math.PI);
    a.rearDy = Math.round(8 * env);
    a.legFrontLift = Math.round(6 * env + env * 2);
    a.legFrontLift2 = Math.round(6 * env + env * 1.4);
    a.legFrontSwing = Math.round(env * 1.6);
    a.headDy = -Math.round(env * 1.2);
    a.mouth = env > 0.5 ? 1 : 0;
    a.maneFly = Math.round(env * 1.6);
    a.maneDy = -Math.round(env * 1.2);
    a.tailDy = Math.round(Math.sin(p * TAU * 1.5) * 1.4);
    a.earDy = -Math.round(env);
    return a;
  }
  if (caballo && s === 'paw') {
    // Piafar: una mano escarba el suelo mientras la cabeza baja un poco.
    const golpe = Math.abs(Math.sin(p * TAU * 2));
    a.legFrontLift = Math.round(2 + golpe * 2);
    a.legFrontSwing = Math.round(Math.sin(p * TAU * 2) * 1.6);
    a.headDy = 2 + Math.round(Math.sin(p * TAU * 2) * 0.6);
    a.neckStretch = 0.4;
    a.tailDy = Math.round(Math.sin(p * TAU) * 1.2);
    a.bodyDy = -Math.round(golpe * 0.4);
    return a;
  }
  if (caballo && (s === 'graze' || s === 'drink')) {
    // Pastar / beber: la cabeza baja al suelo (y al beber da sorbos).
    const sorbo = (s === 'drink') ? Math.abs(Math.sin(p * TAU * 2)) : 0;
    a.headDy = Math.round((s === 'drink' ? 6 : 7) + sorbo * 1.2 + Math.sin(p * TAU * 0.5) * 0.6);
    a.neckStretch = 0.8;
    a.maneDy = 2 + Math.round(sorbo);
    a.tailDy = Math.round(Math.sin(p * TAU) * 0.8);
    a.earDy = Math.round(Math.sin(p * TAU * 1.5) * 0.8);
    return a;
  }
  if (caballo && s === 'shake') {
    // Sacudirse: el cuerpo se menea a los lados, la crin y la cola vuelan.
    const vib = Math.sin(p * TAU * 3);
    a.bodyDx = Math.round(vib * 1.6);
    a.headDx = Math.round(-vib * 1.2);
    a.headDy = Math.round(Math.abs(vib) * 0.8);
    a.maneFly = Math.round(Math.abs(vib) * 1.6);
    a.maneDy = Math.round(-Math.abs(vib) * 1.2);
    a.tailDx = Math.round(vib * 2);
    a.earDy = -1;
    a.legFrontSwing = Math.round(vib * 0.8);
    return a;
  }
  if (caballo && s === 'lie') {
    // Echado: el cuerpo baja al suelo y las patas se recogen.
    const env = Math.sin(Math.min(1, p) * Math.PI * 0.5);
    a.bodyDy = Math.round(5 + env * 1.5);
    a.legShort = 6;
    a.headDy = 3;
    a.neckStretch = 0.4;
    a.tailDy = Math.round(Math.sin(p * TAU) * 0.8);
    a.earDy = -1;
    return a;
  }
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
  // OJO: el lienzo mide la rejilla REAL del estado, no `spec.h`. Las poses altas
  // (el caballo encabritado o relinchando) usan una rejilla más alta: si el lienzo
  // se quedaba en `spec.h`, todo lo que sobresalía se recortaba y el caballo
  // encabritado perdía la cabeza y el cuello.
  const alto = gridHFor(spec, state);
  const g = makeGrid(spec.w, alto);
  spec.build(g, Object.assign(animFor(kind, state, bucket / FRAMES), { back: !!back }));
  const pixels = finishGrid(g, spec.pal);
  const cv = document.createElement('canvas');
  cv.width = spec.w; cv.height = alto;
  const c = cv.getContext('2d');
  for (const p of pixels) { c.fillStyle = p[2]; c.fillRect(p[0], p[1], 1, 1); }
  bmp = { canvas: cv, w: spec.w, h: alto };
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
    const moving = state === 'run' || state === 'walk' || state === 'trot' || state === 'gallop';
    phase = moving ? ((now * (state === 'run' || state === 'gallop' ? 0.0055 : 0.0034)) % 1) : ((now * 0.0009) % 1);
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
  const g = makeGrid(spec.w, gridHFor(spec, state));
  spec.build(g, animFor(kind, state || 'idle', phase01 == null ? 0 : phase01));
  return { w: spec.w, h: g.h, pixels: finishGrid(g, spec.pal), pal: spec.pal };
}

export const ANIMAL_KINDS = Object.keys(SPECS);
