# Partir el monolito — MesoBuilder

> Estado: **en marcha** (2 módulos extraídos, ~490 líneas). Herramienta:
> `tools/refactor-deps.mjs`. Empezar por `## 1. Lo primero: qué NO hay que esperar`.

## 1. Lo primero: qué NO hay que esperar

Partir `engine/game-engine.js` en varios ficheros **no mejora los FPS**. Lo que
hace un fichero más grande es:

| Coste | ¿Por fotograma? | ¿Cuánto? |
| --- | --- | --- |
| Descargar el fichero | No (una vez) | 1,4 MB la primera vez; después caché |
| Parsearlo y compilarlo | No (una vez) | decenas de ms al arrancar |
| Ejecutarlo | **Sí, y es lo que cuenta** | sin cambios |

Lo único que cambia el rendimiento es **qué trabajo se hace en cada fotograma** (ver
`docs/RENDIMIENTO.md`). La razón para partir el fichero es otra: poder **leerlo,
cambiarlo y no romperlo**. Hoy `game-engine.js` son ~28.800 líneas con `render()`
de 4.100 y `createMenuBar()` de 1.015, y ahí es donde se cuelan los fallos que sólo
aparecen al jugar.

## 2. Por qué no se puede partir «de golpe»

Casi todo el fichero tiene funciones enormes que **leen y ESCRIBEN el estado del
módulo**: `viewMode`, `editMode`, `COLS`, `ROWS`, `player`, `entities`, `inventory`,
`mapCacheDirty`, `camX/camY`, `zoom`… Un `let` sacado a otro fichero se queda
desactualizado (o se escribe en una copia y el motor no se entera), y un error de
ámbito dentro de `render()` **no da error de sintaxis**: revienta al recargar y deja
el juego sin mundo (pasó el 2026-09-30, ver `docs/AUDITORIA.md`). Por eso se va
subsistema a subsistema, verificando cada paso.

## 3. Herramienta: `tools/refactor-deps.mjs`

Antes de mover nada, mide **qué habría que inyectar**. Enumera las variables libres
de una función (las que no declara ella misma) saltando comentarios, cadenas y
plantillas:

```bash
# Una función: lista exacta de dependencias
node tools/refactor-deps.mjs engine/game-engine.js createMenuBar
#   → 42 variables libres: notify(62), player(28), GRAPHICS_CONFIG(23), …

# Ranking de lo fácil de sacar (pocas deps) y de lo grande
node tools/refactor-deps.mjs engine/game-engine.js --faciles 4
node tools/refactor-deps.mjs engine/game-engine.js --todas

# Un bloque (para saber el total del módulo que se piensa crear)
node tools/refactor-deps.mjs engine/game-engine.js --rango 25000 26500
```

Regla práctica: **0 dependencias → movimiento directo** (copiar, `export`,
`import`, borrar). De 1 a 6 → se pasan como parámetros o en un objeto `deps`.
Más de 10 → no merece la pena: primero hay que separar el estado.

## 4. Lo que ya está fuera (2026-10-09)

| Módulo | Líneas | Contenido | Deps |
| --- | --- | --- | --- |
| `engine/game-engine-icons.js` | ~190 | `drawRegisteredIcon`, `drawItemIcon` (iconos de inventario y de la biblioteca de sprites, dibujados a mano) | **0** |
| `engine/game-engine-story-utils.js` | ~300 | `buildStoryQuestsForEpoch`, `introWorldBriefing`, `getMapSceneScript`, `drawAnimatedUSSRFlagSequence` (textos por época y guion del mapa) | **0** |

`game-engine.js`: 29.267 → **28.828 líneas**.

Comprobado: `node --check` de los tres ficheros, arranque real en el navegador
(1.534 entidades, sin errores en consola), y los cuatro movimientos funcionando
desde su módulo (`node tools/_check_extraidos.mjs` en su momento: misiones,
briefing, escenas y 38 iconos pintados en el HUD).

## 5. Siguiente paso recomendado (por orden de relación beneficio/riesgo)

Números sacados con la herramienta, para no elegir a ojo:

1. **Lo que es `0 deps` y aún está dentro** (~600 líneas más):
   `drawPortrait`, `drawFisherKit`, `getBiomeFillColor`, `makeDraggable`,
   `mesoUiCssExtra`, `createBuildPanelControls`, `assignSovietVillagerProfile`,
   `worldShiftEntityLike`. Mismo movimiento que los iconos: sin riesgo.
2. **HUD de lienzo** (~900 líneas, deps 3-6): `drawObjectiveArrow` (`player`,
   `getTileSize`, `worldToScreen`), `drawStoryTargetGuidance`, `drawCompactGuideOverlay`,
   `drawStoryObjectiveHUD`, `syncCinematicUiVisibility`, `drawMissionMarker`,
   `drawDialoguePanel`. Se le pasa un objeto `deps` con **getters** para el estado
   vivo (`get player() { return player; }`) y las funciones que necesita.
3. **Cinemáticas** (~800 líneas de estado propio: `_introSeq`, `_cartScene`): el
   bloque completo (`drawIntroSequence`, `advanceIntroSequence`, `startIntroSequence`,
   `drawCartWelcomeScene`, `endCartWelcomeScene`, `cartSceneLines`,
   `dibujarBriefingDelMundo`, `iniciarIntroDeTextoCuandoToca`). Al llevarse su
   estado entero es una extracción limpia, pero tiene más entradas/salidas
   (música, cámara, `cinematicActive`, guardado).
4. **`createMenuBar`** (1.015 líneas, **42 deps**): es el trozo más grande que se
   puede sacar de una vez, pero necesita un `deps` completo y **getters** para
   `viewMode`, `editMode`, `COLS`, `ROWS`, `mapCacheDirty`, `player`… Se puede
   hacer con la lista que da la herramienta, en su propio paso.
5. **`render()`** (4.100 líneas): NO se mueve. Es el orquestador. Lo que sí se puede
   hacer es sacar **tramos enteros a funciones** (la simulación de NPC ya se hizo
   así: ahora es un bloque con su freno de tiempo, no código suelto).

## 6. Cómo verificar cada extracción (sin romper el juego)

1. `node --check` de los ficheros tocados (copiados a `.mjs`; el `package.json` es
   CommonJS).
2. `window.MESO_DEBUG.testDraw.perf.sections()` antes y después: el fotograma no
   puede cambiar.
3. Arrancar el juego y mirar la consola: si sale `render: bucle reanudado por el
   vigilante`, o el mundo no aparece, hay un `ReferenceError` en algún sitio.
4. `node tools/check-module-scope.mjs` detecta el caso peligroso (código de módulo
   atrapado dentro de `render()`).
