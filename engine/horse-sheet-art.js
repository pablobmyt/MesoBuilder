// engine/horse-sheet-art.js
// ─────────────────────────────────────────────────────────────────────────────
// CABALLOS CON LA HOJA DE SPRITES DEL USUARIO (un solo caballo + animación real).
//
// El caballo se dibujaba PROCEDURAL (`animal-art.js`: formas + rejilla de arte).
// Ahora se recorta de la hoja del usuario. Si la hoja falta o está rota, se
// vuelve al procedural: esto nunca deja al juego sin caballos.
//
// ── DOS LECCIONES QUE COSTARON UNA RONDA ─────────────────────────────────────
// 1) La hoja NO es una tira de fotogramas. Medido: las columnas son PELAJES (20
//    capas, del castaño al blanco) y las filas son POSES. Y ojo: las bandas 0-3
//    son el MISMO caballo con variaciones mínimas (no un ciclo) y las 7-10 son el
//    MISMO caballo con CUATRO SILLAS DISTINTAS. Recorrerlas como "fotogramas"
//    hacía que el caballo pareciese ir ROTANDO ENTRE VARIOS CABALLOS (al ir
//    montado, cambiaba de silla en cada fotograma).
//
//    SOLUCIÓN: un ÚNICO dibujo base (banda `base` sin silla / `baseMontura` con
//    silla) y la animación se hace POR PARTES, como en `animal-art.js`.
//
// 2) El motor pedía el arte "de espaldas" al caminar hacia arriba (`back`) y ahí
//    caía al caballo PROCEDURAL: al cambiar de dirección el jugador veía OTRO
//    caballo. Ahora la hoja se usa para todas las direcciones (sólo hay perfil, y
//    se espeja al ir hacia la izquierda), así que el caballo es siempre el mismo.
//
// ── EL RIG ───────────────────────────────────────────────────────────────────
// Del sprite base se sacan las piezas midiendo la máscara de alfa:
//   · `lineaPatas`: la fila donde aparecen más manchas separadas (las 4 patas).
//   · `tronco`: todo lo de ARRIBA de esa fila (cuerpo, cuello, cabeza, cola).
//   · `patas[]`: cada mancha de la franja inferior, recortada con su fila de
//     arriba ESTIRADA hacia arriba. Esa prolongación queda tapada por el tronco
//     y es lo que permite mover la pata sin que se despegue del cuerpo.
// Cada fotograma se compone dibujando las patas (desplazadas) y el tronco encima
// (con su balanceo). El tamaño del lienzo es el MISMO en todos los fotogramas de
// un estado: si no, el caballo cambiaría de tamaño entre fotogramas.
//
// Las animaciones de la hoja que son poses DE VERDAD del mismo caballo (pastar,
// encabritarse, tumbarse) sí se cogen de su banda: ver `tipo: 'hoja'` en
// `data/horse-sheet.json`.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const MARGEN_LADOS = 7;     // el desplazamiento máximo de una pata (4 px) + aire
const MARGEN_ARRIBA = 7;    // el balanceo del tronco (3 px) + aire
const ESTIRADO = 14;        // filas que se prolonga la pata hacia arriba (bajo el tronco)

let _datos = null;            // data/horse-sheet.json
let _lienzo = null;           // la hoja con el damero ya quitado
let _cfgFondo = {};           // umbrales de `fondo` del JSON
let _promesa = null;          // carga en curso (para no lanzarla dos veces)
let _avisoDado = false;
const _cache = new Map();     // clave de fotograma → canvas recortado/compuesto
const _rigs = new Map();      // "s|m|pelaje" → rig (o null si no se pudo medir)

function _esElectron() {
  return !!(window.__mesoPreload && window.__mesoPreload.isElectron);
}

// En Electron la página vive en `file://` y un fetch relativo no vale; se usa el
// esquema propio `meso-local://` (mismas cabeceras CORS, ver electron/main.js).
function _urlDe(ruta) {
  const base = _esElectron() ? ('meso-local://' + ruta) : ruta;
  return base + (base.indexOf('?') < 0 ? '?v=' + Date.now() : '');
}

async function _leerJson(ruta) {
  try {
    const res = await fetch(_urlDe(ruta));
    if (res && res.ok) return await res.json();
  } catch (e) { /* sin fichero: se sigue con el caballo procedural */ }
  return null;
}

function _cargarImagen(ruta) {
  return new Promise((res, rej) => {
    const img = new Image();
    // Hace falta para poder leer los píxeles con getImageData (quitar el damero).
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('no carga ' + ruta));
    img.src = _urlDe(ruta);
  });
}

// ── Quitar el damero de transparencia ────────────────────────────────────────
// El fondo es el damero (dos grises casi blancos, 252 y 233) MÁS la SOMBRA gris
// que trae cada caballo debajo. Se marca como candidato todo píxel gris neutro y
// no muy oscuro, y después se propaga desde los bordes: lo que no se alcanza (el
// caballo, incluido el blanco de un pinto) se queda.
// OJO: la sombra no es un detalle cosmético. Es la que TAPA los huecos entre las
// patas, y sin quitarla el caballo es una mancha maciza de la que no se pueden
// separar las patas para animarlas.
function _quitarDamero(img, cfg) {
  _cfgFondo = cfg || {};
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let datos;
  try { datos = ctx.getImageData(0, 0, w, h); } catch (e) { return cv; }   // lienzo sucio: se deja tal cual
  const d = datos.data;
  const lum = (cfg && cfg.luminancia) || 105;
  const sat = (cfg && cfg.saturacion) || 30;

  const candidato = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if ((mx - mn) < sat && (r + g + b) / 3 > lum) candidato[p] = 1;
  }

  const fondo = new Uint8Array(w * h);
  const pila = [];
  const mete = (x, y) => {
    const p = y * w + x;
    if (candidato[p] && !fondo[p]) { fondo[p] = 1; pila.push(p); }
  };
  for (let x = 0; x < w; x++) { mete(x, 0); mete(x, h - 1); }
  for (let y = 0; y < h; y++) { mete(0, y); mete(w - 1, y); }
  while (pila.length) {
    const p = pila.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) mete(x - 1, y);
    if (x < w - 1) mete(x + 1, y);
    if (y > 0) mete(x, y - 1);
    if (y < h - 1) mete(x, y + 1);
  }
  for (let p = 0, i = 3; p < w * h; p++, i += 4) {
    if (fondo[p]) d[i] = 0;
    else if (d[i] === 0) d[i] = 255;      // por si el PNG ya traía alfa
  }

  // 2 · HALO. Entre el caballo y el damero hay píxeles de mezcla (el contorno
  // marrón se funde con el gris del fondo) que NO cumplen el criterio de arriba
  // (tienen algo de color y menos brillo) y se quedaban pegados al borde: en el
  // juego se veían como un borde blanquecino, y alrededor del hocico daba la
  // impresión de un manchón blanco en la cara. Se comen dos pasadas de borde,
  // sólo donde el píxel es CLARO (una mezcla con un fondo casi blanco) — el
  // contorno de verdad del caballo es oscuro y no se toca.
  for (let paso = 0; paso < 2; paso++) {
    const quitar = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (fondo[p]) continue;
        let toca = false;
        for (let dy = -1; dy <= 1 && !toca; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) { toca = true; break; }
            if (fondo[ny * w + nx]) { toca = true; break; }
          }
        }
        if (!toca) continue;
        const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = (r + g + b) / 3;
        const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        if (lum > 140 && (mx - mn) < 60) quitar.push(p);
      }
    }
    for (const p of quitar) fondo[p] = 1;
  }

  // 3 · BOLSAS ENCERRADAS. La crin, las riendas o el propio hueco entre las patas
  // pueden CERRAR un trozo de damero: como no se alcanza desde fuera, el relleno
  // no lo quita y en el juego se ve como un manchón claro en el caballo (en el
  // caballo con silla, justo en la garganta — parece una mancha blanca en la
  // cara). Para no llevarse por delante el BLANCO DE VERDAD del dibujo (la
  // estrella de la cara, las manchas del pinto) se usa el TAMAÑO: las bolsas de
  // damero son de decenas de píxeles (21-72 medidos) y las manchas pintadas son
  // mucho mayores (143-426 medidos). El tope se puede ajustar en el JSON
  // (`bolsasMaxPx`).
  const topeBolsas = Math.max(0, (_cfgFondo && _cfgFondo.bolsasMaxPx) || 120);
  let bolsas = 0;
  const vistos = new Uint8Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (vistos[p0] || fondo[p0] || !esClaro(p0, d)) { vistos[p0] = 1; continue; }
    const comp = [p0];
    const pila = [p0];
    vistos[p0] = 1;
    while (pila.length) {
      const p = pila.pop();
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (vistos[q] || fondo[q] || !esClaro(q, d)) continue;
          vistos[q] = 1;
          comp.push(q);
          pila.push(q);
        }
      }
    }
    if (comp.length <= topeBolsas) {
      for (const p of comp) fondo[p] = 1;
      bolsas++;
    }
  }

  for (let p = 0, i = 3; p < w * h; p++, i += 4) {
    if (fondo[p]) d[i] = 0;
  }
  ctx.putImageData(datos, 0, 0);
  _bolsasInfo = { quitadas: bolsas, tope: topeBolsas };
  return cv;
}
let _bolsasInfo = null;

// Un píxel "claro y gris": el damero (los dos tonos) y también el blanco del
// dibujo. Decidir cuál es cuál es cosa del patrón (ver arriba).
function esClaro(p, d) {
  const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2];
  const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
  return ((r + g + b) / 3) > 190 && (mx - mn) < 40;
}

// ── Lectura de la hoja ───────────────────────────────────────────────────────

function _pelaje() {
  try {
    if (typeof window._caballoPelaje === 'number') {
      const n = (_datos && _datos.columnas) || 1;
      return Math.max(0, Math.min(n - 1, window._caballoPelaje | 0));
    }
  } catch (e) { /* sin window */ }
  return (_datos && typeof _datos.pelajePorDefecto === 'number') ? _datos.pelajePorDefecto : 0;
}

/** Rectángulo del sprite de una banda para un pelaje dado. */
function _rect(banda, pelaje) {
  const cuadros = (banda && banda.cuadros) || [];
  if (!cuadros.length) return null;
  const col = Math.max(0, Math.min(cuadros.length - 1, pelaje | 0));
  return cuadros[col] || cuadros[0];
}

function _canvasDe(rect) {
  const w = Math.max(1, rect[2]), h = Math.max(1, rect[3]);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  c.drawImage(_lienzo, rect[0], rect[1], w, h, 0, 0, w, h);
  return cv;
}

// ── El rig: tronco + patas ───────────────────────────────────────────────────

function _construirRig(montado) {
  if (!_lienzo || !_datos) return null;
  const pelaje = _pelaje();
  const clave = (montado ? 'm' : 's') + '|' + pelaje;
  if (_rigs.has(clave)) return _rigs.get(clave);

  const idxBanda = (montado && _datos.baseMontura != null) ? _datos.baseMontura : _datos.base;
  const rect = _rect((_datos.bandas || [])[idxBanda], pelaje);
  if (!rect) { _rigs.set(clave, null); return null; }

  const base = _canvasDe(rect);
  const bw = base.width, bh = base.height;
  let d;
  try { d = base.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, bw, bh).data; }
  catch (e) { _rigs.set(clave, null); return null; }

  const opaco = (x, y) => d[(y * bw + x) * 4 + 3] > 30;
  const runsDe = (y) => {
    const out = []; let ini = -1;
    for (let x = 0; x < bw; x++) {
      if (opaco(x, y)) { if (ini < 0) ini = x; }
      else if (ini >= 0) { out.push([ini, x - 1]); ini = -1; }
    }
    if (ini >= 0) out.push([ini, bw - 1]);
    // Las manchas de 1 px son ruido del PNG (viene de un JPEG), no una pata:
    // si se cuelan, la fila "con más manchas" sale en el sitio equivocado.
    return out.filter((r) => r[1] - r[0] + 1 >= 2);
  };

  // 1 · el suelo: la última fila con algo.
  let pie = bh - 1;
  while (pie > 0 && runsDe(pie).length === 0) pie--;
  // 2 · la fila donde las patas están MÁS separadas (es la que se usa de corte).
  let lineaPatas = -1, mejor = null;
  for (let y = pie; y >= 0; y--) {
    const r = runsDe(y);
    if (r.length < 2) break;
    if (!mejor || r.length > mejor.length) { mejor = r; lineaPatas = y; }
  }
  if (!mejor || mejor.length < 2 || lineaPatas < 2) { _rigs.set(clave, null); return null; }

  // 3 · cada mancha crece hacia abajo siguiendo sus propios tramos (las pezuñas
  //     abren más que la caña). Sin tolerancia: si dos patas se tocan en alguna
  //     fila es que de verdad son una sola silueta y se quedan juntas.
  let ventanas = mejor.map((r) => [r[0], r[1]]);
  for (let it = 0; it < 3; it++) {
    for (const v of ventanas) {
      for (let y = lineaPatas; y <= pie; y++) {
        for (const r of runsDe(y)) {
          if (r[1] >= v[0] && r[0] <= v[1]) {
            v[0] = Math.min(v[0], r[0]);
            v[1] = Math.max(v[1], r[1]);
          }
        }
      }
    }
  }
  // 4 · sólo son PATAS las manchas que LLEGAN AL SUELO. La cola cuelga por la
  //     misma franja y a veces sale como mancha suelta: si se colara, acabaría
  //     meneándose como una pata. Se queda con las 4 más "carnosas" por si el
  //     PNG trae además alguna mota.
  const alcanzaElSuelo = (v) => {
    for (let y = pie; y >= lineaPatas; y--) {
      for (let x = v[0]; x <= v[1]; x++) if (opaco(x, y)) return y;
    }
    return -1;
  };
  const peso = (v) => {
    let n = 0;
    for (let y = lineaPatas; y <= pie; y++) for (let x = v[0]; x <= v[1]; x++) if (opaco(x, y)) n++;
    return n;
  };
  ventanas = ventanas
    .map((v) => ({ v, fin: alcanzaElSuelo(v), n: peso(v) }))
    .filter((o) => o.fin >= pie - 2)
    .sort((a, b) => b.n - a.n).slice(0, 4)
    .map((o) => o.v).sort((a, b) => a[0] - b[0]);
  if (ventanas.length < 2) { _rigs.set(clave, null); return null; }

  // 5 · tronco = el sprite ENTERO menos las patas (así la cola y la cabeza se
  //     quedan con el cuerpo y se mecen con él); patas = cada ventana con su fila
  //     de arriba estirada hacia arriba (queda debajo del tronco y tapa la costura).
  const tronco = document.createElement('canvas');
  tronco.width = bw; tronco.height = bh;
  const tc = tronco.getContext('2d');
  tc.imageSmoothingEnabled = false;
  tc.drawImage(base, 0, 0);
  for (const v of ventanas) tc.clearRect(v[0], lineaPatas, v[1] - v[0] + 1, bh - lineaPatas);

  const altoPata = pie - lineaPatas + 1;
  const patas = ventanas.map((v) => {
    const pw = v[1] - v[0] + 1;
    const cv = document.createElement('canvas');
    cv.width = pw; cv.height = altoPata + ESTIRADO;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(base, v[0], lineaPatas, pw, altoPata, 0, ESTIRADO, pw, altoPata);
    c.drawImage(base, v[0], lineaPatas, pw, 1, 0, 0, pw, ESTIRADO);
    return { canvas: cv, x: v[0], y: lineaPatas, w: pw, h: altoPata };
  });

  const rig = {
    pelaje, montado, bw, bh, lineaPatas, pie, patas, tronco,
    // El lienzo del fotograma deja aire a los lados (el vaivén de las patas) y
    // arriba (el balanceo del tronco). El PIE queda pegado al borde de abajo.
    W: bw + MARGEN_LADOS * 2, H: bh + MARGEN_ARRIBA,
  };
  _rigs.set(clave, rig);
  return rig;
}

// Desplazamientos de cada pata (dx, dy) y balanceo del tronco, para un índice de
// fotograma 0..3 y un modo. El caballo mira a la DERECHA.
function _movimiento(modo, idx, nPatas) {
  const dxs = new Array(nPatas).fill(0);
  const dys = new Array(nPatas).fill(0);
  let bob = 0, bodyDx = 0;
  const fase = (off) => (((idx + off) % 4) + 4) % 4;
  const seno = (off) => Math.sin(TAU * fase(off) / 4);
  const reparte = (i) => Math.round(i * 4 / Math.max(1, nPatas)) % 4;   // 4 patas → 0,1,2,3
  const alterna = (i) => (i % 2) * 2;                                   // trote: en diagonal
  const anda = (off, amp, lift) => {
    const s = seno(off);
    return [Math.round(s * amp), Math.max(0, Math.round(s * lift))];
  };

  if (modo === 'reposo') {
    bob = (idx % 2) ? -1 : 0;                       // respira
    return { dxs, dys, bob, bodyDx };
  }
  if (modo === 'piafar') {
    const i = nPatas - 1;                           // la mano de delante
    const tabla = [[0, 0], [1, 2], [0, 0], [0, 1]];
    dxs[i] = tabla[idx][0] * (nPatas > 2 ? 1 : 1);
    dys[i] = tabla[idx][1];
    bob = (idx === 3) ? -1 : 0;
    return { dxs, dys, bob, bodyDx };
  }
  if (modo === 'sacudir') {
    bodyDx = Math.round(seno(0) * 2);
    bob = -Math.round(Math.abs(seno(0)) * 1);
    for (let i = 0; i < nPatas; i++) dxs[i] = bodyDx;
    return { dxs, dys, bob, bodyDx };
  }

  const amp = modo === 'galope' ? 4 : modo === 'trote' ? 3 : 2;
  const lift = modo === 'galope' ? 3 : modo === 'trote' ? 2 : 1;
  for (let i = 0; i < nPatas; i++) {
    const off = modo === 'trote' ? alterna(i) : reparte(i);
    const [dx, dy] = anda(off, amp, lift);
    dxs[i] = dx; dys[i] = dy;
  }
  if (modo === 'galope') {
    // Con suspensión: el tronco sube y baja dos veces por zancada y se adelanta.
    bob = -Math.round(Math.abs(Math.sin(TAU * fase(0) / 4)) * 3);
    bodyDx = Math.round(seno(1) * 1);
    if (idx === 1) { for (let i = 0; i < nPatas; i++) dys[i] = Math.max(dys[i], 2); }
  } else if (modo === 'trote') {
    bob = -Math.round(Math.abs(Math.sin(TAU * fase(0) / 4)) * 2);
  } else {
    bob = -Math.round(Math.abs(Math.sin(TAU * fase(0) / 4)) * 1);
  }
  return { dxs, dys, bob, bodyDx };
}

function _frameDelRig(rig, modo, idx) {
  const W = rig.W, H = rig.H;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const mov = _movimiento(modo, idx, rig.patas.length);
  const ox = MARGEN_LADOS + mov.bodyDx, oy = MARGEN_ARRIBA;
  // PATAS primero (el tronco va encima y tapa la unión).
  for (let i = 0; i < rig.patas.length; i++) {
    const p = rig.patas[i];
    const dx = mov.dxs[i] || 0, dy = mov.dys[i] || 0;
    c.drawImage(p.canvas, p.x + dx, oy + p.y + dy - ESTIRADO);
  }
  // TRONCO: se mece (bob = arriba/abajo).
  c.drawImage(rig.tronco, ox, oy + mov.bob);
  return cv;
}

// ── API ──────────────────────────────────────────────────────────────────────

/** Carga la hoja y el JSON. Devuelve true si el arte nuevo está listo. */
export async function initHorseSheet() {
  if (_lienzo && _datos) return true;
  if (_promesa) return _promesa;
  _promesa = (async () => {
    try {
      const datos = await _leerJson('data/horse-sheet.json');
      if (!datos || !datos.hoja) return false;
      const img = await _cargarImagen(datos.hoja);
      _lienzo = _quitarDamero(img, datos.fondo);
      _datos = datos;
      _cache.clear();
      _rigs.clear();
      console.log('[caballos] hoja cargada: ' + datos.bandas.length + ' bandas · ' +
        datos.columnas + ' pelajes · base ' + datos.base +
        (datos.baseMontura != null ? ' (montado ' + datos.baseMontura + ')' : ''));
      return true;
    } catch (e) {
      if (!_avisoDado) {
        _avisoDado = true;
        console.warn('[caballos] no se pudo usar la hoja de caballos (' + (e && e.message) + '): ' +
          'se sigue dibujando el caballo procedural');
      }
      return false;
    }
  })();
  return _promesa;
}

export function horseSheetReady() { return !!(_lienzo && _datos); }

/** La tabla de animaciones tal como viene del JSON (para depurar/editar). */
export function horseSheetInfo() {
  if (!_datos) return null;
  const rig = _construirRig(false);
  return {
    hoja: _datos.hoja, bandas: _datos.bandas.length, columnas: _datos.columnas,
    base: _datos.base, baseMontura: _datos.baseMontura, pelaje: _pelaje(),
    anims: Object.keys(_datos.anims || {}),
    rigPatas: rig ? rig.patas.length : 0,
    rigCorte: rig ? rig.lineaPatas : null,
    rigAlto: rig ? rig.bw + 'x' + rig.bh : null,
    bolsas: _bolsasInfo,
  };
}

export function horseSheetCoatCount() { return (_datos && _datos.columnas) || 0; }

export function horseSheetDefaultCoat() { return _pelaje(); }

/**
 * Fotograma listo para dibujar.
 * @param {string} estado 'idle' | 'walk' | 'trot' | 'gallop' | 'rear' | …
 * @param {object} [opts] { montado, phase01, now, forzarFotograma }
 * @returns {{canvas:HTMLCanvasElement, w:number, h:number}|null}
 */
export function horseSheetFrame(estado, opts) {
  if (!_datos || !_lienzo) return null;
  const op = opts || {};
  // Nombres que usa el motor y que en la hoja se llaman de otra forma.
  const ALIAS = { run: 'gallop', sprint: 'gallop', hurt: 'idle', dead: 'lie' };
  const nombre = ALIAS[estado] || estado;
  const anim = (_datos.anims || {})[nombre] ||
               (_datos.anims || {}).walk || (_datos.anims || {}).idle;
  if (!anim) return null;
  const montado = !!op.montado;

  // Cuántos fotogramas tiene la animación y cuál toca.
  const n = (anim.tipo === 'rig') ? 4 : Math.max(1, (anim.filas || []).length);
  let idx;
  if (typeof op.forzarFotograma === 'number') {
    idx = Math.max(0, Math.min(n - 1, op.forzarFotograma | 0));
  } else if (op.phase01 != null) {
    // Acción (piafar, encabritarse…): avanza UNA vez con la acción, no en bucle.
    idx = Math.max(0, Math.min(n - 1, Math.floor(op.phase01 * n)));
  } else {
    const t = op.now || Date.now();
    const fps = Math.max(1, Math.min(40, Number(anim.fps) || 8));
    idx = Math.floor((t / 1000) * fps) % n;
  }

  // Los estados de tipo 'hoja' son POSES completas del mismo caballo. Cuando el
  // caballo va MONTADO y esa pose no tiene versión con silla (pastar, tumbarse…),
  // se usa el rig montado en reposo: así nunca pierde la silla.
  const usaRig = (anim.tipo === 'rig') || (montado && !anim.filas);
  const clave = nombre + '|' + idx + '|' + pelajeClave() + '|' + (montado ? 'm' : 's') + '|' + (usaRig ? 'rig' : 'hoja');

  const ya = _cache.get(clave);
  if (ya) return ya;

  let canvas = null;
  if (usaRig) {
    const rig = _construirRig(montado) || _construirRig(false);
    if (rig) canvas = _frameDelRig(rig, anim.modo || 'paso', idx);
  } else {
    const filas = anim.filas || [];
    const banda = (_datos.bandas || [])[filas[Math.min(idx, filas.length - 1)]];
    const rect = _rect(banda, _pelaje());
    if (rect) canvas = _canvasDe(rect);
  }
  if (!canvas) return null;

  const rec = { canvas, w: canvas.width, h: canvas.height };
  _cache.set(clave, rec);
  return rec;
}

function pelajeClave() { return _pelaje(); }

/**
 * Proveedor para `animal-art.js` (`setAnimalArtProvider`). Devuelve null cuando no
 * es un caballo o cuando no hay hoja: entonces manda el arte procedural.
 * OJO: NO se devuelve null para `back` (caminar hacia arriba). La hoja sólo trae
 * perfil, pero si ahí cayéramos al procedural el jugador vería OTRO caballo al
 * cambiar de dirección — que es justo lo que había que arreglar.
 */
export function horseSheetProvider(kind, state, bucket, back, opts) {
  if (kind !== 'horse') return null;
  try {
    if (localStorage.getItem('meso.spriteStyle') === 'clasico') return null;
  } catch (e) { /* sin localStorage: se usa la hoja */ }
  return horseSheetFrame(state, {
    montado: !!(opts && opts.mounted),
    phase01: (opts && opts.phase01 != null) ? opts.phase01 : null,
    now: (opts && opts.now) || Date.now(),
  });
}

// ── Depuración en la consola del juego ───────────────────────────────────────
// `MESO_HORSESHEET.tira('gallop')` devuelve un canvas con los 4 fotogramas de una
// animación en fila (se puede document.body.appendChild(...) para mirarlo).
try {
  window.MESO_HORSESHEET = {
    ready: horseSheetReady,
    info: horseSheetInfo,
    pelajes: horseSheetCoatCount,
    pelaje: () => _pelaje(),
    setPelaje: (n) => { try { window._caballoPelaje = n; } catch (e) {} _cache.clear(); _rigs.clear(); return _pelaje(); },
    init: initHorseSheet,
    frame: (estado, montado, i) => horseSheetFrame(estado, { montado: !!montado, forzarFotograma: i || 0 }),
    tira: (estado, montado) => {
      if (!_datos || !_lienzo) return null;
      const n = ((_datos.anims || {})[estado] || {}).tipo === 'rig' ? 4
        : Math.max(1, (((_datos.anims || {})[estado] || {}).filas || []).length);
      const fs = [];
      for (let i = 0; i < n; i++) { const f = horseSheetFrame(estado, { montado: !!montado, forzarFotograma: i }); if (f) fs.push(f); }
      if (!fs.length) return null;
      const W = fs.reduce((a, f) => a + f.w + 6, 6), H = Math.max(...fs.map((f) => f.h)) + 12;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      let x = 6;
      fs.forEach((f, i) => {
        c.drawImage(f.canvas, x, H - 6 - f.h);
        c.fillStyle = '#c00'; c.font = '10px monospace'; c.fillText(String(i), x + 1, 10);
        x += f.w + 6;
      });
      return cv;
    },
  };
} catch (e) { /* sin window (Node) */ }
