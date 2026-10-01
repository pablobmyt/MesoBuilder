// scripts/entity-views-api.js
// API para guardar las asignaciones del editor de entidades EN EL PROYECTO.
//
//   GET  /api/estado   -> { ok:true, servidor, fichero }   identifica la API
//   GET  /api/vistas   -> devuelve data/entity-views.json
//   POST /api/vistas   -> escribe data/entity-views.json
//   POST /api/hoja     -> copia el PNG elegido a data/sheets/
//
// Vive aquí, y no dentro de `serve-entity-editor.js`, porque la usan los DOS
// servidores: el del editor (`npm run editor`) y el dev-server (`npm run dev`).
// Antes, si abrías el editor servido por el dev-server, «Guardar en el proyecto»
// no encontraba la API y se limitaba a DESCARGAR el JSON. Ahora escribe el fichero
// desde cualquier servidor que sirva el proyecto.
//
// CORS abierto a propósito: es una herramienta local y el editor puede estar en un
// puerto y la API en otro (página en :4321, API en :4322). El editor sondea los
// puertos habituales y se queda con el que contesta.
const fs = require('fs');
const path = require('path');

const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function crearApiVistas(ROOT, opciones) {
  const etiqueta = (opciones && opciones.etiqueta) || 'servidor';
  const FICHERO_VISTAS = path.join(ROOT, 'data', 'entity-views.json');

  function leerVistas() {
    try {
      return JSON.parse(fs.readFileSync(FICHERO_VISTAS, 'utf-8'));
    } catch (e) {
      return { hoja: 'data/sheets/casa.png', entidades: {} };
    }
  }

  // Hojas referenciadas por el fichero que NO existen en el proyecto, con las
  // entidades que las usan. Sin el detalle de quién las usa, el usuario ve
  // «no encuentro data/sheets/Murallas.png» mientras edita `tree1` y no entiende nada.
  function hojasQueFaltanDe(datos) {
    const faltan = {};
    const anotar = (ruta, quien) => {
      if (!ruta) return;
      if (fs.existsSync(path.join(ROOT, ruta))) return;
      faltan[ruta] = faltan[ruta] || [];
      if (faltan[ruta].indexOf(quien) < 0) faltan[ruta].push(quien);
    };
    if (datos && datos.hoja) anotar(datos.hoja, '(la hoja compartida)');
    Object.keys((datos && datos.entidades) || {}).forEach((k) => {
      anotar(datos.entidades[k] && datos.entidades[k].hoja, k);
    });
    return faltan;
  }

  function textoDeFaltantes(faltan) {
    return Object.keys(faltan).map((h) => {
      const quien = faltan[h].length
        ? (faltan[h].length === 1 ? 'la usa ' + faltan[h][0] : 'las usan: ' + faltan[h].join(', '))
        : 'no la usa ninguna entidad';
      return h + ' (' + quien + ')';
    }).join(' · ');
  }

  function guardarVistas(datos) {
    if (!datos || typeof datos !== 'object' || !datos.entidades || typeof datos.entidades !== 'object') {
      throw new Error('el JSON debe traer { hoja, entidades }');
    }
    fs.mkdirSync(path.dirname(FICHERO_VISTAS), { recursive: true });
    fs.writeFileSync(FICHERO_VISTAS, JSON.stringify(datos, null, 2) + '\n', 'utf-8');
    const claves = Object.keys(datos.entidades);
    const vistas = claves.reduce((n, k) => n + Object.keys(datos.entidades[k].vistas || {}).length, 0);
    const r = { fichero: 'data/entity-views.json', entidades: claves.length, vistas };
    // Comprobación que ahorra un dolor de cabeza: si alguna hoja no está EN EL
    // PROYECTO, el juego no la encontrará (aunque en el editor se vea, si la
    // cargaste de tu disco). Se miran la compartida (la raíz) y la de cada entidad.
    const faltan = hojasQueFaltanDe(datos);
    const rutas = Object.keys(faltan);
    if (rutas.length) {
      // Lista estructurada para que el editor pueda ARREGLARLO solo: si tiene el PNG
      // en memoria (lo acaba de cargar del disco), lo copia al proyecto y reintenta.
      r.hojasQueFaltan = rutas;
      r.aviso = 'no encuentro en el proyecto: ' + textoDeFaltantes(faltan);
    }
    return r;
  }

  // Copia la hoja elegida en el disco a `data/sheets/` del proyecto.
  function guardarHoja(nombre, datosUrl) {
    const limpio = String(nombre || 'hoja.png').replace(/[^\w.\-]+/g, '_').replace(/^\.+/, '');
    const m = /^data:image\/png;base64,(.+)$/i.exec(String(datosUrl || ''));
    if (!m) throw new Error('esperaba un PNG en base64');
    const destino = path.join(ROOT, 'data', 'sheets', limpio);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(m[1], 'base64'));
    return { ruta: 'data/sheets/' + limpio, bytes: fs.statSync(destino).size };
  }

  function responderJson(res, codigo, obj) {
    res.writeHead(codigo, Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, CABECERAS_CORS));
    res.end(JSON.stringify(obj));
  }

  function leerCuerpo(req, res, maximo, fn) {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; if (cuerpo.length > maximo) req.destroy(); });
    req.on('end', () => {
      try { fn(JSON.parse(cuerpo)); }
      catch (e) {
        console.warn('[' + etiqueta + '] JSON inválido: ' + e.message);
        responderJson(res, 400, { ok: false, error: 'JSON inválido: ' + e.message });
      }
    });
  }

  // Devuelve true si la petición era de la API (y ya está contestada).
  function manejar(req, res, urlPath) {
    if (urlPath.indexOf('/api/') !== 0) return false;

    // Preflight: el editor puede estar en otro puerto y el POST lleva JSON.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CABECERAS_CORS);
      res.end();
      return true;
    }

    if (urlPath === '/api/estado') {
      // Se dice también qué hojas del fichero no están en el proyecto: así el editor
      // puede avisar AL ABRIR, antes de guardar nada.
      const faltan = hojasQueFaltanDe(leerVistas());
      responderJson(res, 200, {
        ok: true,
        servidor: etiqueta,
        fichero: 'data/entity-views.json',
        existe: fs.existsSync(FICHERO_VISTAS),
        hojasQueFaltan: Object.keys(faltan),
        faltantesDetalle: textoDeFaltantes(faltan)
      });
      return true;
    }

    if (urlPath === '/api/vistas') {
      if (req.method === 'GET') {
        responderJson(res, 200, leerVistas());
        return true;
      }
      if (req.method === 'POST') {
        leerCuerpo(req, res, 4e6, (datos) => {
          try {
            const r = guardarVistas(datos);
            console.log('[' + etiqueta + '] guardado ' + r.fichero + ': ' + r.entidades +
              ' entidades, ' + r.vistas + ' vistas');
            responderJson(res, 200, Object.assign({ ok: true }, r));
          } catch (e) {
            console.warn('[' + etiqueta + '] no he podido guardar: ' + e.message);
            responderJson(res, 400, { ok: false, error: e.message });
          }
        });
        return true;
      }
      responderJson(res, 405, { ok: false, error: 'método no permitido' });
      return true;
    }

    if (urlPath === '/api/hoja') {
      if (req.method !== 'POST') {
        responderJson(res, 405, { ok: false, error: 'método no permitido' });
        return true;
      }
      leerCuerpo(req, res, 80e6, (cuerpo) => {
        try {
          const r = guardarHoja(cuerpo && cuerpo.nombre, cuerpo && cuerpo.datos);
          console.log('[' + etiqueta + '] hoja copiada al proyecto: ' + r.ruta + ' (' + r.bytes + ' bytes)');
          responderJson(res, 200, Object.assign({ ok: true }, r));
        } catch (e) {
          console.warn('[' + etiqueta + '] no he podido copiar la hoja: ' + e.message);
          responderJson(res, 400, { ok: false, error: e.message });
        }
      });
      return true;
    }

    responderJson(res, 404, { ok: false, error: 'API desconocida: ' + urlPath });
    return true;
  }

  return { manejar, leerVistas, guardarVistas, guardarHoja, fichero: FICHERO_VISTAS };
}

module.exports = { crearApiVistas };
