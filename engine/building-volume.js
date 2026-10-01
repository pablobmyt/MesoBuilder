// engine/building-volume.js
// ─────────────────────────────────────────────────────────────────────────────
// VOLUMEN 2.5D de los edificios: se aplica EN EL MOTOR y **sólo en la vista
// isométrica**. Es la pieza que faltaba para que el mismo sprite se vea bien en
// las dos vistas.
//
// POR QUÉ AQUÍ Y NO GRABADO EN EL JSON
// El arte de los edificios es un ALZADO (visto de frente). En la vista de arriba
// (ortogonal) un alzado es exactamente lo que se quiere: el edificio se lee de un
// golpe y el juego queda limpio. En la vista isométrica, en cambio, un alzado
// plano parece un recorte pegado al suelo: necesita volumen. El volumen es una
// DEFORMACIÓN (baja el alzado, levanta el pretil hacia las esquinas, pinta un
// tejado encima), y esa deformación es justo lo que estropea la vista de arriba
// (un edificio con el tejado en pico parece una tienda de campaña). Como un sprite
// no puede ser las dos cosas a la vez, el volumen se añade al vuelo en isométrico
// y el JSON guarda el arte original.
//
// CÓMO SE CONSTRUYE (por columnas de la silueta):
//
//   1. El cuerpo del alzado baja `T` filas: encima queda el sitio del tejado.
//   2. El PRETIL (la franja de arriba del arte) se levanta hacia las esquinas
//      `VOL_EDGE_SLOPE` px por px: así el alero dibuja una «V» en vez de una raya
//      horizontal, que es lo que delata que el dibujo es plano.
//   3. Debajo de ese pretil levantado se RELLENA el hueco con el material del muro
//      (son las paredes laterales, que suben hacia las esquinas).
//   4. Encima va el TEJADO, con CUMBRERA PLANA: franja horizontal arriba y el
//      alero en «V» abajo, con las filas de esteras paralelas al alero.
//
// La puerta y las ventanas NO se deforman: sólo se toca el pretil y lo de arriba.
//
// OJO con dos cosas que ya costaron una vuelta cada una:
//  · Copiar el arte píxel a píxel en la diagonal NO vale: el detalle de 1 px se
//    intercala consigo mismo y sale un tablero de ajedrez. Las caras nuevas se
//    pintan con el MATERIAL del edificio (color medio del pretil y del muro,
//    saltando los contornos oscuros).
//  · Dibujar la ARISTA DE ATRÁS del rombo (la «Λ») remata el efecto tienda de
//    campaña. Con cumbrera plana se lee como tejado plano, que es lo correcto en
//    Mesopotamia. `window._mesoVolumenArista = true` la recupera para comparar.
// ─────────────────────────────────────────────────────────────────────────────

import { shadeHexColor } from './character-art.js';

// Ajustes vivos (se pueden tocar desde la consola: `MESO_DEBUG.testDraw.vistas()`).
export const VOLUMEN = {
  activo: true,        // false → los edificios se dibujan con su alzado original
  pendiente: 0.35,     // lo que sube el alero en las esquinas (× distancia al centro)
  tejado: 0.35,        // alto del tejado en el centro, en anchos de arte
  arista: false,       // true → tejado con vértice detrás (pico) en vez de cumbrera plana
  stripFrac: 0.09,     // alto del pretil que sigue al tejado (fracción del arte)
  stripMin: 3,
  stripMax: 10
};

// ── VISTA DE ARRIBA (planta / TECHO) — APAGADA POR DEFECTO ──────────────────
// El experimento: en la vista ortogonal el mundo se ve desde arriba, así que el
// edificio se pintaba con su PLANTA (tejado plano con pretil, como la viñeta
// «TECHO» de la hoja de referencia) en vez de con su alzado de siempre.
//
// SE QUEDÓ APAGADO (2026-10-01): al jugador le pareció que el juego se rompía;
// con la planta, cada casa dejaba de ser la casa dibujada y pasaba a ser una
// tapa gris con pretil — se pierde todo el arte del sprite. La vista de arriba
// vuelve a enseñar el ALZADO, que es como se ha jugado siempre.
//
// El código sigue aquí, detrás de la bandera, por si algún día se quiere volver a
// mirar: `MESO_DEBUG.testDraw.vistas({ superior: true })`. Nada más.
export const VISTAS = {
  superior: false,     // vista de arriba → planta de tejado (false = alzado de siempre)
  volumetrico: true    // isométrico → alzado + volumen 2.5D
};

// Materiales del edificio sacados de su propio arte: el pretil (franja de arriba)
// y el muro (cuerpo). Se cachean por sprite.
const _materiales = new Map();

function hexLum(hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return 1;
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
}

function mediaHex(lista) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const hex of lista) {
    if (typeof hex !== 'string' || hex[0] !== '#') continue;
    const x = parseInt(hex.slice(1), 16);
    r += (x >> 16) & 255; g += (x >> 8) & 255; b += x & 255; n++;
  }
  if (!n) return null;
  const h2 = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + h2(r / n) + h2(g / n) + h2(b / n);
}

/**
 * Colores con los que pintar las vistas generadas (tejado, pretil y muro), sacados
 * del propio arte del sprite. Se cachea por nombre.
 */
export function materialesDeEdificio(nombre, pixels, gw, gh) {
  const hit = _materiales.get(nombre);
  if (hit) return hit;
  let minY = gh, maxY = -1;
  const strip = Math.max(VOLUMEN.stripMin, Math.min(VOLUMEN.stripMax, Math.round(gh * VOLUMEN.stripFrac)));
  const csTejado = [], csTejadoClaro = [], csMuro = [];
  for (const p of pixels) {
    if (!p || !p[2]) continue;
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (const p of pixels) {
    if (!p || !p[2]) continue;
    if (p[1] <= minY + strip && hexLum(p[2]) >= 0.22) csTejado.push(p[2]);
    if (p[1] <= minY + 2 && hexLum(p[2]) >= 0.34) csTejadoClaro.push(p[2]);
    if (p[1] > minY + strip && p[1] < maxY - 2 && hexLum(p[2]) >= 0.26) csMuro.push(p[2]);
  }
  const mat = {
    tejado: mediaHex(csTejado) || mediaHex(csTejado) || '#B08040',
    pretil: mediaHex(csTejadoClaro) || mediaHex(csTejado) || '#C9A058',
    muro: mediaHex(csMuro) || mediaHex(csTejado) || '#B08040'
  };
  _materiales.set(nombre, mat);
  return mat;
}

/** Olvida los materiales calculados (al recargar el arte o tocar los ajustes). */
export function limpiarMateriales() { _materiales.clear(); }

/**
 * Pinta la PLANTA del edificio (vista de arriba) en un rectángulo de pantalla.
 * Es la técnica de dibujado de la vista ortogonal: tejado plano con pretil, trama
 * de esteras y un respiradero, todo dentro de la huella exacta del edificio.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  esquina izquierda (px de pantalla)
 * @param {number} y  esquina superior
 * @param {number} w  ancho de la huella en px
 * @param {number} h  alto de la huella en px
 * @param {{tejado:string, pretil:string, muro:string}} mat  materiales del edificio
 */
export function drawPlantaTecho(ctx, x, y, w, h, mat) {
  const X = Math.round(x), Y = Math.round(y), W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
  const borde = Math.max(1, Math.round(Math.min(W, H) * 0.10));   // pretil
  const luz = (hex, f) => shadeHexColor(hex, f);
  ctx.save();
  // 1) Tejado: material del edificio, con la trama de esteras cada 4 px y un
  //    degradado suave (más luz arriba-izquierda).
  ctx.fillStyle = luz(mat.tejado, 0.86);
  ctx.fillRect(X, Y, W, H);
  ctx.fillStyle = luz(mat.tejado, 0.78);
  for (let ry = 4; ry < H - borde; ry += 4) ctx.fillRect(X + borde, Y + Math.round(ry), W - borde * 2, 1);
  ctx.fillStyle = luz(mat.tejado, 0.94);
  ctx.fillRect(X + borde, Y + borde, W - borde * 2, Math.max(1, Math.round((H - borde * 2) * 0.4)));
  // 2) Pretil: marco del material claro, con línea de sombra por dentro.
  ctx.fillStyle = luz(mat.pretil, 1.05);
  ctx.fillRect(X, Y, W, borde);                                 // arriba (recibe luz)
  ctx.fillRect(X, Y, borde, H);                                 // izquierda
  ctx.fillStyle = luz(mat.pretil, 0.72);
  ctx.fillRect(X, Y + H - borde, W, borde);                      // abajo (sombra)
  ctx.fillRect(X + W - borde, Y, borde, H);                      // derecha
  ctx.fillStyle = luz(mat.tejado, 0.52);
  ctx.fillRect(X + borde, Y + borde, W - borde * 2, 1);          // sombra interior
  ctx.fillRect(X + borde, Y + borde, 1, H - borde * 2);
  // 3) Respiradero/leña (el detalle que da vida al tejado en la vista de arriba).
  const vx = X + Math.round(W * 0.62), vy = Y + Math.round(H * 0.28);
  const vw = Math.max(2, Math.round(W * 0.14)), vh = Math.max(2, Math.round(H * 0.12));
  ctx.fillStyle = luz(mat.muro, 0.55);
  ctx.fillRect(vx, vy, vw, vh);
  ctx.fillStyle = luz(mat.muro, 1.15);
  ctx.fillRect(vx, vy, vw, 1);
  ctx.fillRect(vx, vy, 1, vh);
  // 4) Contorno: separa el edificio del suelo (y del vecino).
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(X, Y, W, 1);
  ctx.fillRect(X, Y + H - 1, W, 1);
  ctx.fillRect(X, Y, 1, H);
  ctx.fillRect(X + W - 1, Y, 1, H);
  ctx.restore();
}


/**
 * Devuelve una copia con volumen de los píxeles de un edificio.
 * @param {Array<[number,number,string]>} pixels  arte (alzado) del sprite
 * @param {number} gw  ancho de la rejilla (huella)
 * @param {number} gh  alto de la rejilla (huella)
 * @returns {{pixels: Array, gridH: number, alto: number}}  `alto` = filas añadidas
 */
export function addIsometricVolume(pixels, gw, gh) {
  const v = VOLUMEN;
  const lum = (hex) => {
    if (typeof hex !== 'string' || hex[0] !== '#') return 1;
    const n = parseInt(hex.slice(1), 16);
    return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  };
  const mapa = new Map();          // "x,y" → color
  const topY = new Map();          // x → fila más alta con píxel
  let minY = gh, maxY = -1;
  for (const p of pixels) {
    if (!p || !p[2]) continue;
    mapa.set(p[0] + ',' + p[1], p[2]);
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
    const t = topY.get(p[0]);
    if (t === undefined || p[1] < t) topY.set(p[0], p[1]);
  }
  if (maxY < 0) return { pixels, gridH: gh, alto: 0 };

  const ancho = gw;
  const T = Math.max(4, Math.round(v.tejado * ancho));            // alto del tejado
  const L = Math.max(2, Math.min(T, Math.round(v.pendiente * ancho / 2)));  // subida en las esquinas
  const strip = Math.max(v.stripMin, Math.min(v.stripMax, Math.round(gh * v.stripFrac)));

  // Materiales: el pretil para el tejado y el muro para las paredes laterales.
  const csTejado = [], csMuro = [];
  for (const p of pixels) {
    if (!p || !p[2]) continue;
    if (p[1] <= minY + strip && lum(p[2]) >= 0.22) csTejado.push(p[2]);
    if (p[1] > minY + strip && p[1] < maxY - 2 && lum(p[2]) >= 0.26) csMuro.push(p[2]);
  }
  const media = (lista) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const hex of lista) {
      if (typeof hex !== 'string' || hex[0] !== '#') continue;
      const x = parseInt(hex.slice(1), 16);
      r += (x >> 16) & 255; g += (x >> 8) & 255; b += x & 255; n++;
    }
    if (!n) return null;
    const h2 = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    return '#' + h2(r / n) + h2(g / n) + h2(b / n);
  };
  const matTejado = media(csTejado) || media([...mapa.values()]) || '#B08040';
  const matMuro = media(csMuro) || matTejado;

  const cache = new Map();
  const tono = (hex, f) => {
    const k = hex + '|' + f.toFixed(3);
    if (cache.has(k)) return cache.get(k);
    const out = shadeHexColor(hex, f);
    cache.set(k, out);
    return out;
  };

  const out = [];
  const centro = ancho / 2;
  for (const [x, y0] of topY) {
    const u = Math.abs(x + 0.5 - centro);                        // distancia al centro
    const drop = Math.min(L, Math.round(v.pendiente * u));       // cuánto sube aquí
    // 1) El cuerpo del alzado (por debajo del pretil).
    for (let y = y0 + strip; y <= maxY; y++) {
      const c = mapa.get(x + ',' + y);
      if (!c) continue;
      const t = (y - minY) / Math.max(1, maxY - minY);
      out.push([x, y + T, tono(c, 1.05 - 0.15 * t)]);
    }
    // 2) El pretil, levantado `drop` px.
    for (let y = y0; y < y0 + strip && y <= maxY; y++) {
      const c = mapa.get(x + ',' + y);
      if (!c) continue;
      let f = 1.06;                                 // cresta iluminada
      if (y === y0 + 2 || y === y0 + 3) f *= 0.90;  // sombra bajo el alero
      out.push([x, y + T - drop, tono(c, f)]);
    }
    // 3) El hueco bajo el pretil: pared lateral con hiladas del adobe.
    for (let k = 1; k <= drop; k++) {
      const y = y0 + strip + T - k;
      let f = 0.66 - 0.10 * (k / Math.max(1, L));
      if ((y % 4) === 3) f *= 0.88;
      out.push([x, y, tono(matMuro, f)]);
    }
    // 4) El tejado: del alero (el pretil) a la cumbrera.
    const alero = y0 + T - drop;
    const arista = v.arista ? (minY + Math.round(v.pendiente * u)) : minY;
    for (let y = arista; y < alero; y++) {
      const d = alero - y;                          // profundidad hacia atrás
      let f = 0.99 - 0.14 * (d / Math.max(1, T));
      if (d % 4 === 0) f *= 0.89;                   // fila de esteras
      if (y === arista) f *= 1.07;                  // cresta de atrás iluminada
      if (d === 1) f *= 0.86;                       // junta con el alero
      out.push([x, y, tono(matTejado, f)]);
    }
  }
  // Contacto con el suelo: la última fila del alzado se apaga.
  const ySuelo = maxY + T;
  for (const p of out) if (p[1] === ySuelo) p[2] = tono(p[2], 0.80);

  return { pixels: out, gridH: Math.max(gh, ySuelo + 1), alto: T };
}

/** Filas que añade el volumen a un edificio de `gw` de ancho (para reservar sitio). */
export function volumenExtra(gw) {
  return Math.max(4, Math.round(VOLUMEN.tejado * gw));
}
