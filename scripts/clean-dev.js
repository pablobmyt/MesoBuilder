// scripts/clean-dev.js — Limpieza antes de lanzar en desarrollo.
//
//   node scripts/clean-dev.js           → SÓLO temporales del proyecto (inofensivo)
//   node scripts/clean-dev.js --hard    → + datos de usuario de Electron (partidas
//                                         guardadas, localStorage, cachés) y `dist/`
//   node scripts/clean-dev.js --dist    → + sólo `dist/` (para empaquetar de cero)
//
// IMPORTANTE: antes esto se ejecutaba SIEMPRE al arrancar `start-electron-dev` y
// además el script ponía `MESOBUILDER_CLEAR_CACHE=1`, que hace que el juego borre
// todas las claves `meso.*` del localStorage al arrancar: en cada lanzamiento en
// desarrollo te quedabas sin partida guardada, sin ajustes y sin caché. Ahora eso
// es una decisión explícita (`npm run start-electron-dev-limpio`).
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const duro = args.includes('--hard');
const soloDist = args.includes('--dist');
let cleaned = 0;

// ── 1. Temporales de depuración en la raíz del proyecto (siempre) ──────────
try {
  const files = fs.readdirSync(ROOT).filter((f) => /^temp_.*\.txt$/i.test(f));
  for (const f of files) {
    try { fs.unlinkSync(path.join(ROOT, f)); cleaned++; } catch (e) {}
  }
} catch (e) {}

// ── 2. Datos de usuario de Electron (partidas, localStorage, cachés) ──────
// SÓLO con --hard: aquí viven las partidas guardadas.
if (duro) {
  try {
    const datos = path.join(os.homedir(), 'AppData', 'Roaming', 'mesobuilder');
    if (fs.existsSync(datos)) {
      try {
        fs.rmSync(datos, { recursive: true, force: true });
        cleaned++;
        console.log('[clean-dev] Borrados los datos de Electron: ' + datos);
      } catch (e) {
        console.warn('[clean-dev] No he podido borrar todo: ' + e.message);
        const subdirs = ['Cache', 'Code Cache', 'GPUCache', 'Local Storage', 'Session Storage', 'IndexedDB', 'blob_storage'];
        for (const sub of subdirs) {
          try {
            const p = path.join(datos, sub);
            if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); cleaned++; }
          } catch (e2) {}
        }
      }
    }
  } catch (e) {}
}

// ── 3. Artefactos de empaquetado (`dist/`) ────────────────────────────────
if (duro || soloDist) {
  try {
    const dist = path.join(ROOT, 'dist');
    if (fs.existsSync(dist)) {
      try {
        fs.rmSync(dist, { recursive: true, force: true });
        cleaned++;
        console.log('[clean-dev] Borrado dist/');
      } catch (e) { console.warn('[clean-dev] No he podido borrar dist: ' + e.message); }
    }
  } catch (e) {}
}

console.log('[clean-dev] ' + cleaned + ' cosas borradas' +
  (duro ? ' (incluidos datos de Electron)' : soloDist ? ' (incluido dist/)' : '') +
  '. Listo para lanzar.');
if (!duro) {
  console.log('[clean-dev] Las partidas guardadas y la caché NO se han tocado ' +
    '(para eso: `npm run start-electron-dev-limpio`).');
}
