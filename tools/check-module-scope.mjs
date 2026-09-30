// check-module-scope.mjs — ¿Hay funciones de ámbito de MÓDULO que se quedaron
// dentro de otra función (por un bloque mal cerrado)?
//
// POR QUÉ EXISTE
// Un `{` de más (o de menos) en `engine/game-engine.js` hace que un trozo de
// código de nivel de módulo acabe DENTRO de una función. El fichero sigue siendo
// válido (`node --check` no se queja) y el editor tampoco avisa, pero en tiempo de
// ejecución esas funciones dejan de existir en el ámbito del módulo: cualquier
// llamada desde fuera lanza `ReferenceError: X is not defined`.
//
// Así se rompió el arranque una vez: el bloque del «director del HUD»
// (`despertarHud`, `fijarHud`, `hudOn`, `actualizarEstadoHudDom`, `hudInputWake`)
// quedó dentro de `render()`. `notify()` llama a `despertarHud()`, así que
// `init()` → `setEditMode()` → `notify()` lanzaba ReferenceError y **abortaba el
// arranque**: el juego se quedaba sin mundo (rejilla de arena), sin guardado y sin
// interfaz. Síntomas: «se pierde el renderizado del terreno», «no se guardan las
// partidas».
//
// CÓMO SE USA
//   1) node tools/check-module-scope.mjs            (crea engine/_probe.mjs)
//   2) Abre el juego (index.html) y en la consola del navegador:
//        await import('file:///C:/Proyectos/Personal/MesoBuilder/engine/_probe.mjs?t=' + Date.now()).catch(() => {});
//        window.__mesoProbe
//   3) Toda clave cuyo valor NO sea 'function' está fuera del ámbito de módulo.
//   4) node tools/check-module-scope.mjs --clean    (borra engine/_probe.mjs)
//
// El sondeo se apoya en el hoisting: `typeof nombre` responde 'function' si la
// declaración está en el ámbito del módulo y 'undefined' si quedó anidada (con
// `typeof` no hay ReferenceError, así que el sondeo nunca revienta).

import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const MOTOR = path.join(RAIZ, 'engine', 'game-engine.js');
const COPIA = path.join(RAIZ, 'engine', '_probe.mjs');

// Nombres que DEBEN estar en el ámbito de módulo (se les llama desde fuera de su
// bloque: `notify`, `render`, la API de depuración, los eventos...).
const NOMBRES = [
  'despertarHud', 'fijarHud', 'hudOn', 'actualizarEstadoHudDom', 'hudInputWake', 'hudVisibleAhora',
  'render', 'drawSurvivalHud', 'drawMiniMap', 'drawPlayer', 'drawBuilding', 'vigilanteTerreno',
  'startCartWelcomeScene', 'programarEscenaBienvenida', 'endCartWelcomeScene', 'drawCartWelcomeScene',
  'notify', 'showInstruction', 'saveAppState', 'loadAppState', 'asegurarMundoCargado',
  'applyPlayerMoveTiles', 'repaintTerrainRegion', 'paintTerrainCellInCache', 'isoTerrainCacheGeometry',
  'rebuildMapCachesAsync', 'rebuildMapCache', 'ensureResourceFloatPanel', 'ensurePauseMenu', 'togglePauseMenu',
  'startMission', 'completeMission', 'trackObjective', 'cycleObjective', 'plantCropAt', 'advanceCrops'
];

if (process.argv.includes('--clean')) {
  try { fs.unlinkSync(COPIA); console.log('borrado ' + path.relative(RAIZ, COPIA)); } catch (e) { /* ya no estaba */ }
  process.exit(0);
}

const src = fs.readFileSync(MOTOR, 'utf8');
const lineas = src.split(/\r?\n/);
const sondeo = '\nwindow.__mesoProbe = { ' + NOMBRES.map(n => n + ': typeof ' + n).join(', ') + ' };\n';
let idx = 0;
for (let i = 0; i < lineas.length; i++) if (/^import\s/.test(lineas[i])) idx = i + 1;
lineas.splice(idx, 0, sondeo);
fs.writeFileSync(COPIA, lineas.join('\n'));
console.log('creado ' + path.relative(RAIZ, COPIA) + ' (sondeo en la linea ' + (idx + 1) + ')');
console.log('Ahora, en la consola del juego:');
console.log("  await import(location.href.replace('index.html','engine/_probe.mjs') + '?t=' + Date.now()).catch(() => {});");
console.log('  window.__mesoProbe   // toda clave != "function" está FUERA del ámbito de módulo');
