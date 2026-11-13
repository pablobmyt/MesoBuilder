// tools/hoja-arte.mjs
// ─────────────────────────────────────────────────────────────────────────────
// MEDIR HOJAS DE SPRITES SIN ABRIR UN EDITOR DE IMAGEN.
//
// Las hojas de este proyecto llevan fondo TRANSPARENTE, a veces un damero pintado
// y líneas guía rojas/amarillas, así que "¿dónde está el dibujo?" no se ve a ojo
// de programa. Estas herramientas lo separan por color y lo cuentan.
//
// Uso:
//   node tools/hoja-arte.mjs ascii  <png> <x0> <x1> <y0> <y1> [celda]   dibuja la zona en texto
//   node tools/hoja-arte.mjs perfil <png> <x0> <x1> <y0> <y1>           silueta por filas + caja del arte
//   node tools/hoja-arte.mjs blobs  <png> [y0] [y1] [areaMin]           lista de dibujos (componentes conexas)
//   node tools/hoja-arte.mjs celdas <png> [y0] [y1]                     catálogo por celdas (rótulo gris + dibujo)
//   node tools/hoja-arte.mjs puntos <png> x1,y1 x2,y2 …                 color y ALFA en puntos sueltos
//
// La "caja del arte" que saca `perfil` es la que se copia a `data/entity-views.json`
// como `vistas.iso` / `vistas.sup` (x, y, w, h). Truco: el borde del dibujo NO debe
// tocar el rectángulo por los cuatro lados a la vez salvo que sea un sprite cuadrado
// (los muros lo son en la vista de arriba); si el relleno es muy bajo, el recorte se
// ha ido al fondo o al dibujo de al lado.
//
// Para comprobar cómo queda un recorte DENTRO del juego (misma escala y anclaje):
// abre `tools/muralla-preview.html` con el servidor de desarrollo (`node scripts/dev-server.js`).
import fs from 'node:fs';
import zlib from 'node:zlib';

// ── Lector de PNG (8 bits, sin entrelazar) ──────────────────────────────────
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 0 ? 1 : 0;
  if (bd !== 8 || !ch) throw new Error('PNG no soportado (bitDepth=' + bd + ', colorType=' + ct + '). Guarda la hoja a 8 bits RGBA.');
  const stride = w * ch, out = Buffer.alloc(w * h * ch);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev ? prev[i] : 0;
      const c = (prev && i >= ch) ? prev[i - ch] : 0;
      const x = line[i];
      let v;
      switch (f) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          v = x + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c)); break;
        }
        default: throw new Error('filtro PNG ' + f + ' no soportado');
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, ct, data: out };
}

class Hoja {
  constructor(ruta) {
    const img = decodePNG(fs.readFileSync(ruta));
    this.w = img.w; this.h = img.h; this.ch = img.ch; this.d = img.data;
    this.ruta = ruta;
  }
  rgba(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * this.ch;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.ch === 4 ? this.d[i + 3] : 255];
  }
  lum(x, y) { const [r, g, b] = this.rgba(x, y); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  // ¿este píxel es DIBUJO? (opaco y de tono cálido o azulado: no fondo, ni damero, ni guía)
  esArte(x, y) {
    const [r, g, b, a] = this.rgba(x, y);
    if (a < 24) return false;                        // transparencia
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (l < 0.10) return false;                      // negro (marcos y sombras puras)
    if (r > 150 && g < 100 && b < 100) return false; // línea guía roja
    if (r > 150 && g > 150 && b < 100) return false;  // línea guía amarilla
    if (b > r + 18) return l > 0.15;                 // azulado (banda esmaltada)
    if (r - b < 26 || r - g > 70) return false;      // gris, blanco, damero
    return l > 0.15;
  }
  esGrisRotulo(x, y) {   // barra gris con el nombre de cada celda
    const [r, g, b, a] = this.rgba(x, y);
    if (a < 24) return false;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return (mx - mn) < 26 && l > 0.30 && l < 0.80;
  }
  cajaArte(x0, x1, y0, y1) {
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, px = 0;
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++)
        if (this.esArte(x, y)) { px++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    return px ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, px } : null;
  }
}

// ── ascii ───────────────────────────────────────────────────────────────────
const RAMP = ' .:-=+*#%@';
function clase(h, x, y) {
  const [r, g, b, a] = h.rgba(x, y);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (a < 24) return '·';                 // transparencia
  if (b > r + 18) return '~';             // azul (banda esmaltada)
  if (mx - mn < 26) return l > 0.85 ? ' ' : '+';   // gris/blanco
  if (r - b > 25) return l > 0.60 ? 'o' : (l > 0.42 ? 'x' : 'X');   // arena / marrón
  return RAMP[Math.min(RAMP.length - 1, Math.round(l * (RAMP.length - 1)))];
}
function cmdAscii(h, [x0, x1, y0, y1, celda]) {
  const cel = Number(celda) || 6;
  const X0 = Math.max(0, Number(x0) | 0), X1 = Math.min(h.w, Number(x1) | 0);
  const Y0 = Math.max(0, Number(y0) | 0), Y1 = Math.min(h.h, Number(y1) | 0);
  let cab = '     ';
  for (let x = X0; x < X1; x += cel * 10) cab += String(x).padEnd(10);
  console.log(cab);
  for (let y = Y0; y < Y1; y += cel) {
    let fila = String(y).padStart(4) + ' ';
    for (let x = X0; x < X1; x += cel) {
      const cuenta = {};
      for (let j = y; j < Math.min(y + cel, Y1); j++)
        for (let i = x; i < Math.min(x + cel, X1); i++) { const c = clase(h, i, j); cuenta[c] = (cuenta[c] || 0) + 1; }
      let mejor = ' ', best = -1;
      for (const c in cuenta) if (cuenta[c] > best) { best = cuenta[c]; mejor = c; }
      fila += mejor;
    }
    console.log(fila);
  }
  console.log('leyenda: · transparencia  ~ azul  o/x/X arena (claro→oscuro)  + gris  (espacio) blanco');
}

// ── perfil ──────────────────────────────────────────────────────────────────
function cmdPerfil(h, [x0, x1, y0, y1]) {
  const X0 = Number(x0) | 0, X1 = Number(x1) | 0, Y0 = Number(y0) | 0, Y1 = Number(y1) | 0;
  for (let y = Y0; y < Y1; y++) {
    let ini = -1, fin = -1, n = 0;
    for (let x = X0; x < X1; x++) if (h.esArte(x, y)) { if (ini < 0) ini = x; fin = x; n++; }
    if (ini < 0) continue;
    if (y % 4 === 0) console.log(String(y).padStart(4) + '  x ' + String(ini).padStart(4) + '..' + String(fin).padStart(4) +
      '  ancho ' + String(fin - ini + 1).padStart(4) + ' |' + ' '.repeat(Math.round((ini - X0) / 6)) + '#'.repeat(Math.max(1, Math.round((fin - ini + 1) / 6))));
  }
  const caja = h.cajaArte(X0, X1, Y0, Y1);
  if (!caja) { console.log('no hay arte en ese rectángulo'); return; }
  console.log('CAJA DEL ARTE:  x ' + caja.x + ' y ' + caja.y + ' w ' + caja.w + ' h ' + caja.h +
    '   (relleno ' + (100 * caja.px / (caja.w * caja.h)).toFixed(0) + ' % del rectángulo)');
  console.log('para data/entity-views.json:  { "x": ' + caja.x + ', "y": ' + caja.y + ', "w": ' + caja.w + ', "h": ' + caja.h + ' }');
}

// ── blobs ───────────────────────────────────────────────────────────────────
function cmdBlobs(h, [y0, y1, areaMin]) {
  const Y0 = Math.max(0, Number(y0) || 0), Y1 = Math.min(h.h, Number(y1) || h.h), AREA = Number(areaMin) || 400, PASO = 2;
  const W = Math.floor(h.w / PASO), H = Math.floor((Y1 - Y0) / PASO);
  const mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let si = false;
    for (let dj = 0; dj < PASO && !si; dj++) for (let di = 0; di < PASO && !si; di++) if (h.esArte(i * PASO + di, Y0 + j * PASO + dj)) si = true;
    mask[j * W + i] = si ? 1 : 0;
  }
  const visto = new Uint8Array(W * H), pila = [], out = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!mask[j * W + i] || visto[j * W + i]) continue;
    let i0 = i, i1 = i, j0 = j, j1 = j, n = 0;
    pila.length = 0; pila.push(j * W + i); visto[j * W + i] = 1;
    while (pila.length) {
      const p = pila.pop(), px = p % W, py = (p - px) / W;
      n++;
      if (px < i0) i0 = px; if (px > i1) i1 = px; if (py < j0) j0 = py; if (py > j1) j1 = py;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (mask[q] && !visto[q]) { visto[q] = 1; pila.push(q); }
      }
    }
    const area = n * PASO * PASO;
    if (area >= AREA) out.push({ x: i0 * PASO, y: Y0 + j0 * PASO, w: (i1 - i0 + 1) * PASO, h: (j1 - j0 + 1) * PASO, px: area });
  }
  out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  console.log('dibujos: ' + out.length + '   (hoja ' + h.w + 'x' + h.h + ', y ' + Y0 + '..' + Y1 + ')');
  out.forEach((b, i) => console.log(String(i + 1).padStart(3) + ')  x ' + String(b.x).padStart(4) + ' y ' + String(b.y).padStart(4) +
    '  w ' + String(b.w).padStart(4) + ' h ' + String(b.h).padStart(3) + '   px ' + b.px));
}

// ── celdas ──────────────────────────────────────────────────────────────────
function cmdCeldas(h, [y0, y1]) {
  const Y0 = Number(y0) || 0, Y1 = Math.min(h.h, Number(y1) || h.h);
  const bandas = []; let ini = -1;
  for (let y = Y0; y <= Y1; y++) {
    let n = 0;
    if (y < Y1) for (let x = 0; x < h.w; x++) if (h.esGrisRotulo(x, y)) n++;
    const es = y < Y1 && n / h.w > 0.45;
    if (es && ini < 0) ini = y;
    if (!es && ini >= 0) { if (y - ini >= 8) bandas.push([ini, y - 1]); ini = -1; }
  }
  console.log('bandas de rótulo: ' + bandas.length);
  let n = 0;
  bandas.forEach(([ya, yb], bi) => {
    const celdas = []; let c0 = -1, hueco = 0;
    for (let x = 0; x <= h.w; x++) {
      let gris = false;
      if (x < h.w) { let k = 0; for (let y = ya; y <= yb; y++) if (h.esGrisRotulo(x, y)) k++; gris = k / (yb - ya + 1) > 0.5; }
      if (gris) { if (c0 < 0) c0 = x; hueco = 0; }
      else if (c0 >= 0) { hueco++; if (hueco > 12) { celdas.push([c0, x - hueco]); c0 = -1; hueco = 0; } }
    }
    const fin = (bandas[bi + 1] ? bandas[bi + 1][0] : Y1) - 1;
    celdas.forEach(([xa, xb]) => {
      const caja = h.cajaArte(xa, xb, yb + 1, fin);
      n++;
      if (!caja) { console.log(String(n).padStart(3) + ')  rótulo y ' + ya + '  celda x ' + xa + '-' + xb + '  →  (sin dibujo)'); return; }
      console.log(String(n).padStart(3) + ')  rótulo y ' + String(ya).padStart(4) + '  celda x ' + String(xa).padStart(4) + '-' + String(xb).padStart(4) +
        '  →  dibujo x ' + String(caja.x).padStart(4) + ' y ' + String(caja.y).padStart(4) + '  w ' + String(caja.w).padStart(4) + ' h ' + String(caja.h).padStart(3));
    });
  });
}

// ── puntos ──────────────────────────────────────────────────────────────────
function cmdPuntos(h, puntos) {
  for (const p of puntos) {
    const [x, y] = p.split(',').map(Number);
    const [r, g, b, a] = h.rgba(x, y);
    console.log('  (' + x + ',' + y + ')  rgba(' + r + ',' + g + ',' + b + ',' + a + ')');
  }
}

// ── main ────────────────────────────────────────────────────────────────────
const [cmd, ruta, ...args] = process.argv.slice(2);
if (!cmd || !ruta) {
  console.log('Uso: node tools/hoja-arte.mjs <ascii|perfil|blobs|celdas|puntos> <png> [args]');
  console.log('  ascii  <png> <x0> <x1> <y0> <y1> [celda]   dibuja la zona en texto');
  console.log('  perfil <png> <x0> <x1> <y0> <y1>           silueta por filas + caja del arte (la que va al JSON)');
  console.log('  blobs  <png> [y0] [y1] [areaMin]           lista de dibujos');
  console.log('  celdas <png> [y0] [y1]                     catálogo por celdas');
  console.log('  puntos <png> x1,y1 x2,y2 …                 color y alfa en puntos sueltos');
  process.exit(1);
}
const hoja = new Hoja(ruta);
console.log('[' + cmd + '] ' + hoja.ruta + '  ' + hoja.w + 'x' + hoja.h + '  canales ' + hoja.ch);
if (cmd === 'ascii') cmdAscii(hoja, args);
else if (cmd === 'perfil') cmdPerfil(hoja, args);
else if (cmd === 'blobs') cmdBlobs(hoja, args);
else if (cmd === 'celdas') cmdCeldas(hoja, args);
else if (cmd === 'puntos') cmdPuntos(hoja, args);
else console.log('comando desconocido: ' + cmd);
