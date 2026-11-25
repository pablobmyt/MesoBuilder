// engine/horse-sheet-art.js
// ─────────────────────────────────────────────────────────────────────────────
// CABALLOS CON LA HOJA DE SPRITES (formato 2: rejilla 4x8 con FOTOGRAMAS REALES).
//
// Antes la hoja era un póster de 20 pelajes con poses sueltas y el motor tenía que
// inventarse la animación partiendo el dibujo en tronco + patas (el «rig»). La
// hoja nueva trae los fotogramas dibujados, así que aquí ya no hay rig: se
// recorta el fotograma que toca y se dibuja. Es más simple y se ve mejor.
//
// ── LA HOJA ─────────────────────────────────────────────────────────────────
//    filas 1-3   GALOPE, 11 fotogramas seguidos (4 + 4 + 3), de perfil a la derecha
//    fila  4     QUIETO: una vista por dirección → [arriba, izquierda, abajo, derecha]
//    fila  5     ANDAR por detrás (dirección «arriba»), 4 fotogramas
//    fila  6     ANDAR de perfil a la izquierda, 4 fotogramas
//    fila  7     ANDAR de frente (dirección «abajo»), 4 fotogramas
//    fila  8     ANDAR de perfil a la derecha, 4 fotogramas
//
// Las coordenadas y los fps los mide `tools/build-horse-sheet.py`, que escribe
// `data/horse-sheet.json`. Todos los recortes comparten lienzo (misma anchura y
// altura, con los cascos en el borde inferior), así que el caballo no cambia de
// tamaño al pasar de andar a galopar ni al girarse.
//
// ── ESTADOS Y LO QUE NO TRAE LA HOJA ────────────────────────────────────────
// El motor pide: idle · walk · trot · gallop · paw · shake · graze · drink ·
// rear · neigh · lie. La hoja trae quieto y andar en las CUATRO direcciones y un
// galope de perfil. Lo que no trae se resuelve así (y se avisa en `info()`):
//
//   · trot         → el clip de andar, más rápido.
//   · galope en vertical (arriba/abajo) → andar rápido: el galope sólo está de perfil.
//   · paw          → andar lento (se le ve levantar la mano).
//   · rear / lie / shake → POSE compuesta del quieto (inclinado, aplastado o
//                    vibrando). Se ve la acción sin dibujos nuevos.
//   · graze / drink / neigh → quieto (la hoja no trae esas poses).
// ─────────────────────────────────────────────────────────────────────────────

const VISTAS = ['up', 'down', 'left', 'right'];

// Dirección pedida → qué clip de la hoja se usa. `pose` es un retoque en el
// lienzo (ver `_pose`); `veces` escala los fps del clip.
const ESTADOS = {
  idle:    { clip: 'idle' },
  walk:    { clip: 'walk' },
  trot:    { clip: 'walk', veces: 2.2 },
  gallop:  { clip: 'gallop' },
  run:     { clip: 'gallop' },
  sprint:  { clip: 'gallop' },
  paw:     { clip: 'walk', veces: 0.7 },
  shake:   { clip: 'idle', pose: 'shake' },
  rear:    { clip: 'idle', pose: 'rear' },
  lie:     { clip: 'idle', pose: 'lie' },
  graze:   { clip: 'idle' },
  drink:   { clip: 'idle' },
  neigh:   { clip: 'idle' },
};
// Estados que caen al quieto porque la hoja no trae su pose (se enseñan en
// `MESO_HORSESHEET.info().sinPose`).
const SIN_POSE = ['graze', 'drink', 'neigh'];

let _datos = null;            // data/horse-sheet.json
let _lienzo = null;           // la hoja con el fondo ya quitado
let _cfgFondo = {};           // umbrales de `fondo` (hojas antiguas con damero)
let _promesa = null;          // carga en curso (para no lanzarla dos veces)
let _avisoDado = false;
let _bolsasInfo = null;
const _cache = new Map();     // clave de fotograma → { canvas, w, h, noFlip }

function _esElectron() {
  return !!(window.__mesoPreload && window.__mesoPreload.isElectron);
}

// En Electron la página vive en `file://` y un fetch relativo no vale; se usa el
// esquema propio `meso-local://` (mismas cabeceras CORS, ver electron/main.js).
// La URL es estable a propósito: añadir `?v=` en cada arranque anulaba la caché
// del navegador y volvía a bajar el PNG entero.
function _urlDe(ruta) {
  return _esElectron() ? ('meso-local://' + ruta) : ruta;
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
    // Hace falta para poder leer los píxeles con getImageData (quitar el fondo
    // de las hojas antiguas).
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('no carga ' + ruta));
    img.src = _urlDe(ruta);
  });
}

// ── Fondo para hojas ANTIGUAS (sin canal alfa) ───────────────────────────────
// La hoja nueva trae transparencia de verdad, así que esto no se ejecuta: se
// mantiene porque cualquier hoja futura con el damero «cocido» sigue entrando.
// Fondo = damero claro + sombra gris: se propaga desde los bordes (el caballo,
// blanco incluido, queda encerrado por su contorno) y después se quitan las
// «bolsas» de damero atrapadas entre las patas.
function _quitarDamero(img, cfg) {
  _cfgFondo = cfg || {};
  const w = img.width, h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let datos;
  try { datos = ctx.getImageData(0, 0, w, h); } catch (e) { return cv; }   // lienzo sucio
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
    else if (d[i] === 0) d[i] = 255;
  }

  // Halo: los píxeles de mezcla del contorno con el fondo (claros y grises).
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
        const l = (r + g + b) / 3;
        const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        if (l > 140 && (mx - mn) < 60) quitar.push(p);
      }
    }
    for (const p of quitar) fondo[p] = 1;
  }

  // Bolsas claras encerradas (huecos entre las patas). El tamaño las separa de
  // las manchas blancas de verdad del dibujo.
  const topeBolsas = Math.max(0, (_cfgFondo && _cfgFondo.bolsasMaxPx) || 120);
  let bolsas = 0;
  const vistos = new Uint8Array(w * h);
  const esClaro = (p) => {
    const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
    return ((r + g + b) / 3) > 190 && (mx - mn) < 40;
  };
  for (let p0 = 0; p0 < w * h; p0++) {
    if (vistos[p0] || fondo[p0] || !esClaro(p0)) { vistos[p0] = 1; continue; }
    const comp = [p0];
    const pila2 = [p0];
    vistos[p0] = 1;
    while (pila2.length) {
      const p = pila2.pop();
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (vistos[q] || fondo[q] || !esClaro(q)) continue;
          vistos[q] = 1;
          comp.push(q);
          pila2.push(q);
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

// ── Carga ────────────────────────────────────────────────────────────────────

/** Carga la hoja y el JSON. Devuelve true si el arte nuevo está listo. */
export async function initHorseSheet() {
  if (_lienzo && _datos) return true;
  if (_promesa) return _promesa;
  _promesa = (async () => {
    try {
      const datos = await _leerJson('data/horse-sheet.json');
      if (!datos || !datos.hoja || !datos.clips) {
        console.warn('[caballos] data/horse-sheet.json no sirve (¿formato viejo?): se sigue con el caballo procedural');
        return false;
      }
      if (datos.formato !== 2) {
        console.warn('[caballos] horse-sheet.json es de formato ' + datos.formato +
          ': regenera con `python tools/build-horse-sheet.py`');
      }
      const img = await _cargarImagen(datos.hoja);
      try { if (img.decode) await img.decode(); } catch (e) { /* se decodifica al dibujar */ }
      const tieneAlfa = datos.alfa !== false;
      _lienzo = tieneAlfa ? (() => {
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const c = cv.getContext('2d', { willReadFrequently: true });
        c.imageSmoothingEnabled = false;
        c.drawImage(img, 0, 0);
        return cv;
      })() : _quitarDamero(img, datos.fondo);
      _datos = datos;
      _cache.clear();
      const nClips = Object.keys(datos.clips).length;
      const nGalope = ((datos.clips.gallop || {}).cuadros || []).length;
      console.log('[caballos] hoja cargada: ' + nClips + ' clips · galope de ' + nGalope +
        ' fotogramas · lienzo ' + datos.lienzo.w + 'x' + datos.lienzo.h +
        (_bolsasInfo ? ' · bolsas quitadas ' + _bolsasInfo.quitadas : ''));
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

/** La tabla de clips tal como viene del JSON (para depurar y para el previsualizador). */
export function horseSheetInfo() {
  if (!_datos) return null;
  const clips = {};
  for (const k of Object.keys(_datos.clips || {})) {
    const c = _datos.clips[k];
    clips[k] = { fps: c.fps, fotogramas: (c.cuadros || []).length };
  }
  return {
    hoja: _datos.hoja,
    formato: _datos.formato,
    lienzo: _datos.lienzo,
    alfa: !!_datos.alfa,
    clips,
    estados: Object.keys(ESTADOS),
    sinPose: SIN_POSE.slice(),
    bolsas: _bolsasInfo,
  };
}

/** La hoja nueva no tiene pelajes: todos los caballos son el mismo. */
export function horseSheetCoatCount() { return 1; }
export function horseSheetDefaultCoat() { return 0; }

// ── Selección de fotograma ───────────────────────────────────────────────────

function _dirDe(opts, back) {
  const d = opts && opts.dir;
  if (VISTAS.indexOf(d) >= 0) return d;
  // Compatibilidad con las llamadas que sólo pasan `flip` / `back`.
  if (back) return 'up';
  if (opts && opts.flip) return 'left';
  return 'right';
}

// Qué clip y con qué multiplicador de fps.
function _clipDe(estado, dir) {
  const def = ESTADOS[estado] || ESTADOS.idle;
  let clip = def.clip;
  let veces = def.veces || 1;
  if (clip === 'gallop' && (dir === 'up' || dir === 'down')) {
    // El galope sólo está dibujado de perfil: en vertical se usa el andar rápido.
    clip = 'walk';
    veces = 2.4;
  }
  // El galope es UN clip (no hay uno por dirección): es de perfil a la derecha.
  return { nombre: clip === 'gallop' ? 'gallop' : (clip + '_' + dir), def, veces };
}

function _recorte(clave, rect) {
  let rec = _cache.get(clave);
  if (rec) return rec;
  try {
    const w = Math.max(1, rect[2]), h = Math.max(1, rect[3]);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(_lienzo, rect[0], rect[1], w, h, 0, 0, w, h);
    rec = { canvas: cv, w, h };
  } catch (e) { rec = null; }
  _cache.set(clave, rec);
  return rec;
}

// Poses que la hoja no trae, compuestas con el sprite de quieto.
function _pose(rec, tipo, dir) {
  const clave = 'pose|' + tipo + '|' + dir + '|' + rec.w + 'x' + rec.h;
  const hit = _cache.get(clave);
  if (hit !== undefined) return hit;
  let out = rec;
  try {
    if (tipo === 'rear') {
      // Se levanta sobre las patas traseras: se inclina hacia atrás alrededor de
      // los cascos. El signo depende de hacia dónde mira el dibujo.
      const giro = (dir === 'left' ? 1 : -1) * 18 * Math.PI / 180;
      const extra = Math.round(rec.w * 0.34);
      const cv = document.createElement('canvas');
      cv.width = rec.w + 4; cv.height = rec.h + extra;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.translate(cv.width / 2, cv.height);
      c.rotate(giro);
      c.drawImage(rec.canvas, -rec.w / 2, -rec.h);
      out = { canvas: cv, w: cv.width, h: cv.height };
    } else if (tipo === 'lie') {
      // Echado: se aplasta contra el suelo.
      const cv = document.createElement('canvas');
      cv.width = rec.w; cv.height = Math.max(4, Math.round(rec.h * 0.55));
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(rec.canvas, 0, 0, rec.w, rec.h, 0, 0, cv.width, cv.height);
      out = { canvas: cv, w: cv.width, h: cv.height };
    } else if (tipo === 'shake') {
      // Sacudirse: dos fotogramas con el cuerpo un píxel a cada lado.
      const cv = document.createElement('canvas');
      cv.width = rec.w + 2; cv.height = rec.h;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(rec.canvas, 1, 0);
      out = { canvas: cv, w: cv.width, h: cv.height };
    }
  } catch (e) { out = rec; }
  _cache.set(clave, out);
  return out;
}

/**
 * Fotograma listo para dibujar.
 * @param {string} estado 'idle' | 'walk' | 'trot' | 'gallop' | 'rear' | …
 * @param {object} [opts] { dir, phase01, now, forzarFotograma }
 * @returns {{canvas:HTMLCanvasElement, w:number, h:number, noFlip:boolean}|null}
 */
export function horseSheetFrame(estado, opts) {
  if (!_datos || !_lienzo) return null;
  const op = opts || {};
  const dir = _dirDe(op, false);
  const { nombre, def, veces } = _clipDe(estado, dir);
  const clip = (_datos.clips || {})[nombre];
  if (!clip || !clip.cuadros || !clip.cuadros.length) return null;
  const n = clip.cuadros.length;
  let idx;
  if (typeof op.forzarFotograma === 'number') {
    idx = Math.max(0, Math.min(n - 1, op.forzarFotograma | 0));
  } else if (op.phase01 != null) {
    // Acción: avanza UNA vez con la acción, no en bucle.
    idx = Math.max(0, Math.min(n - 1, Math.floor(op.phase01 * n)));
  } else {
    const t = op.now || Date.now();
    const fps = Math.max(1, Math.min(40, (Number(clip.fps) || 8) * veces));
    idx = Math.floor((t / 1000) * fps) % n;
  }
  const clave = nombre + '|' + idx + '|' + (def.pose || '');
  let rec = _cache.get(clave);
  if (!rec) {
    rec = _recorte(clave, clip.cuadros[idx]);
    if (rec && def.pose) rec = _pose(rec, def.pose, dir);
    _cache.set(clave, rec);
  }
  if (!rec) return null;
  // El galope sólo existe mirando a la derecha: al ir a la izquierda se deja que
  // el motor lo voltee. Andar y quieto SÍ están dibujados a izquierda, así que
  // ahí no puede haber volteo (se vería al revés).
  const espejo = (nombre === 'gallop' && dir === 'left');
  return { canvas: rec.canvas, w: rec.w, h: rec.h, noFlip: (dir === 'left' && !espejo) };
}

/**
 * Proveedor para `animal-art.js` (`setAnimalArtProvider`). Devuelve null cuando no
 * es un caballo o cuando no hay hoja: entonces manda el arte procedural.
 */
export function horseSheetProvider(kind, state, bucket, back, opts) {
  if (kind !== 'horse') return null;
  try {
    if (localStorage.getItem('meso.spriteStyle') === 'clasico') return null;
  } catch (e) { /* sin localStorage: se usa la hoja */ }
  const o = opts || {};
  return horseSheetFrame(state, {
    dir: _dirDe(o, back),
    phase01: (o.phase01 != null) ? o.phase01 : null,
    now: o.now || Date.now(),
  });
}

// ── Depuración en la consola del juego ───────────────────────────────────────
// `MESO_HORSESHEET.tira('gallop')` devuelve un canvas con todos los fotogramas de
// una animación en fila (se puede document.body.appendChild(...) para mirarlo).
try {
  window.MESO_HORSESHEET = {
    ready: horseSheetReady,
    info: horseSheetInfo,
    clips: () => Object.keys((_datos && _datos.clips) || {}),
    init: initHorseSheet,
    frame: (estado, dir, i) => horseSheetFrame(estado, { dir: dir || 'right', forzarFotograma: i || 0 }),
    tira: (estado, dir, montado) => {
      if (!_datos || !_lienzo) return null;
      const { nombre } = _clipDe(estado, dir || 'right');
      const n = (((_datos.clips || {})[nombre] || {}).cuadros || []).length;
      const fs = [];
      for (let i = 0; i < n; i++) {
        const f = horseSheetFrame(estado, { dir: dir || 'right', forzarFotograma: i });
        if (f) fs.push(f);
      }
      if (!fs.length) return null;
      const W = fs.reduce((a, f) => a + f.w + 6, 6), H = Math.max(...fs.map((f) => f.h)) + 12;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, 0, W, H);
      let x = 6;
      for (const f of fs) { c.drawImage(f.canvas, x, H - 6 - f.h); x += f.w + 6; }
      return cv;
    },
  };
} catch (e) { /* fuera del navegador */ }
