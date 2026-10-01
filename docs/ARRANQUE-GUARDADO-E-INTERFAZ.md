# Arranque, guardado y interfaz flotante

Notas de la tanda que arregla los tres síntomas que reportó el jugador:

> «El rendimiento de este juego es terrible, tarda un montón en cargar el terreno
> y además muestra durante instantes una versión antigua… no se guardan las
> partidas en memoria, no hay un menú al darle al escape y los 3 elementos de la
> foto deberían ser flotantes. Y no sé qué puedo hacer para pasar de una misión a
> otra.»

## 1. LA CAUSA RAÍZ: código de módulo atrapado dentro de `render()`

`engine/game-engine.js` es un módulo ES. Un `{` de más hizo que un bloque de nivel
de módulo quedara **dentro de la función `render()`**:

- `const HUD_DIR`, `despertarHud()`, `fijarHud()`, `hudOn()`,
  `actualizarEstadoHudDom()`, `hudInputWake()` y las asignaciones a `window`
  vivían dentro de `render()` (se veían a columna 0, pero el escáner de ámbitos
  demostró que estaban 2 niveles dentro).

Consecuencia en cadena, y explica **todos** los síntomas:

1. `notify()` (nivel de módulo) llama a `despertarHud('aviso', 5000)`.
2. `notify` no ve `despertarHud` (está en el ámbito de `render`) →
   `ReferenceError: despertarHud is not defined`.
3. `init()` → `setEditMode()` → `notify()` → la excepción **aborta `init()`**:
   ni mundo, ni guardado, ni interfaz. El juego se veía sobre la rejilla de
   arranque (todo arena, «Debug HUD: initializing…»).
4. Como el mundo estaba vacío, el guardado lo pisaba o se bloqueaba → «no se
   guardan las partidas». Y sin `init()` completo no había menús nuevos.

Lo peor: **no da error de sintaxis**. `node --check` dice OK y el editor no avisa.
Sólo revienta en tiempo de ejecución, y sólo al recargar la página (una pestaña
abierta sigue con el código viejo en memoria y «parece» funcionar).

### Cómo detectarlo

```bash
node tools/check-module-scope.mjs          # crea engine/_probe.mjs con un sondeo
# en la consola del juego:
await import(location.href.replace('index.html','engine/_probe.mjs') + '?t=' + Date.now()).catch(() => {});
window.__mesoProbe                         # toda clave != 'function' está fuera del módulo
node tools/check-module-scope.mjs --clean  # borra la copia
```

El sondeo usa el *hoisting*: `typeof nombre` devuelve `'function'` si la
declaración está en el ámbito del módulo y `'undefined'` si quedó anidada (con
`typeof` nunca lanza, así que el sondeo es seguro).

Arreglo aplicado: el bloque del director del HUD se movió al nivel de módulo,
justo antes de `function render()`.

## 2. Rendimiento del terreno (y la «versión antigua»)

- **Al arrancar sólo se pinta la caché de la vista activa.** Antes
  `rebuildMapCachesAsync()` construía la ortogonal (5760×3840 = 22 Mpx) **y** la
  isométrica (4800×2881 = 13,8 Mpx) aunque sólo se usara una: la mitad del tiempo
  de carga del terreno. Ahora la otra se marca pendiente y se construye **al
  cambiar de vista** (`setViewMode()` la lanza en segundo plano; mientras, el
  dibujado cae al modo «celda a celda» de siempre).
  Medido en esta máquina: **~1,0–1,5 s** la caché ortogonal (antes ~2,5–3 s).
- **No se enseña medio mundo.** Mientras la primera caché se está pintando, el
  bucle de dibujado muestra un cartel («Generando mundo…») en vez de dibujar el
  terreno celda a celda y, cuando la caché termina, cambiarlo de golpe: eso era
  la «versión antigua durante unos instantes». Banderas: `window._terrCacheBusy`,
  `window._terrainCacheShownOnce`, con límite de 25 s de cortesía por si la caché
  no llegara nunca.
- **Chequeo de color barato**: `vigilanteTerreno()` leía los 968×727 px del
  lienzo para comprobar que el terreno no está plano; ahora lee una muestra de
  160×120 (y deja de avisar del `willReadFrequently`).
- El vigilante sigue existiendo: si el lienzo sale plano, repinta la caché y, como
  último recurso, activa `window._noTerrainCacheBlit`. `MESO_DEBUG.testDraw.world.diag()`
  dice en un vistazo qué está pasando (semilla, biomas, entidades, cachés, vigilante).

## 2.b «Se queda así para siempre» en el cartel de carga (2026-10-01)

Síntoma: la partida se quedaba **para siempre** en el cartel «Generando mundo… /
Preparando terreno…», con `FPS: 0.0`, `ms/frame: 8000`, `frames: 0` y el contador
de `drawImg` subiendo (o sea: el hilo trabajando y la pantalla congelada).

Eran **tres fallos encadenados**, todos del arranque de la caché de terreno:

1. **El vigilante del terreno reiniciaba la construcción una y otra vez.** Mientras
   la caché se pinta por partes, `mapCacheDirty` sigue a `true`; `vigilanteTerreno()`
   lo interpretaba como «la caché está rota» y lanzaba **otra reconstrucción entera
   cada 5 s** (con `rebuildMapCache()` SÍNCRONO, que bloquea el hilo varios segundos
   en un mundo grande). La primera construcción se reiniciaba siempre y el mundo no
   terminaba de pintarse **nunca**. Ahora el vigilante **no toca nada** si hay una
   construcción en marcha o si la zona visible ya está pintada, y sólo usa la vía
   asíncrona.
2. **La cesión del hilo dependía de `setTimeout`.** En ventanas ocultas o sin foco
   el navegador estrangula los temporizadores (1 s o más por turno) y la caché
   tardaba minutos. Ahora la cesión va por **`MessageChannel`** (`cederHilo()`), que
   entrega la tarea en cuanto el hilo queda libre.
3. **El bucle de dibujado podía morir.** Una excepción dentro de `render()` saltaba
   el `requestAnimationFrame` final y la pantalla se quedaba con el último fotograma
   (justo el cartel). Ahora, además de **rearmarse tras un error**, hay un
   **vigilante del bucle** (cada 1,5 s) que lo vuelve a armar si detecta que no hay
   fotogramas ni una petición de `requestAnimationFrame` pendiente.

Y para que nunca vuelva a «quedarse así»:

- El cartel **ya no es lo último** que se pinta: el terreno se pinta **primero en la
  zona visible** (con el mismo presupuesto de ~12 ms por turno) y en cuanto está,
  el volcado recortado a la ventana ya es correcto y **el cartel se retira**,
  aunque el resto del mundo siga pintándose por detrás (de la zona visible hacia
  fuera). El jugador puede jugar mientras se completa.
- El cartel muestra el **avance real** («Pintando el terreno… 43 %», celdas
  pintadas / total) y tiene un **plazo fijo de 15 s** contado desde que el mundo
  está listo (antes el plazo se medía desde el último intento y una reconstrucción
  reiniciada lo dejaba pegado para siempre).
- Si el jugador camina hacia terreno aún sin pintar, `_terrainRematarZonaVisible()`
  pinta esas celdas antes del volcado (una vez por celda: hay un registro), así que
  el recorte **nunca deja un agujero**.

Diagnóstico: `MESO_DEBUG.testDraw.world.diag()` (`cache.dirty`, vigilante) y las
banderas `window._terrainPaintPct`, `window._terrainCachePartial`,
`window._terrainVisPaintMs`, `window._renderLoopReanudado`, `window._renderLoopErrors`.

## 3. Guardado
- **Los cultivos ahora viajan**: `state.crops = [[clave, fase, seg, familia, mojado], …]`
  y `loadAppState()` los restaura con su fase, su familia y su reloj. Verificado
  ida y vuelta: dos cultivos (`bush` fase 3, `vine` fase 1 con `sec` 13,1) vuelven
  intactos tras recargar.
- **El guardado nunca se pierde en silencio**: si `localStorage` se queda sin
  cuota, se reintenta una vez sin los detalles secundarios (pueblos, estructuras,
  cultivos) y, si vuelve a fallar, avisa en pantalla y suena el error. Además
  `saveAppState()` devuelve `true`/`false`.
- **Guarda un mundo vacío como mínimo**: el autoguardado omite mundos sin
  contenido (≤ 2 biomas y < 12 entidades) para no pisar la partida buena, pero
  cualquier mundo real se guarda.
- Se guarda al terminar una misión (antes había que esperar al siguiente
  autoguardado) y desde el menú de pausa («💾 Guardar ahora»).
- API de pruebas: `MESO_DEBUG.testDraw.save.now() | .info() | .wipe()`.

## 4. Menú de pausa (Escape) y recursos flotantes

- **Escape** abre/cierra un menú de pausa (antes sólo limpiaba la selección).
  Al abrirlo se detiene el tiempo (`window._timeScale = 0`, con el valor anterior
  recordado) y se restaura al cerrar. Contiene: Continuar · Guardar ahora ·
  Siguiente objetivo (O) · Cómo jugar · Volumen −/+ · Silencio · Velocidad del
  tiempo · Salir al menú. `window.ensurePauseMenu()` / `window.togglePauseMenu(v)`.
- **Los tres contadores (trigo, ladrillos, población) son flotantes**: se mueve el
  nodo `#topbar .res-group` a un panel `#res-float` arrastrable, con la posición
  recordada en `localStorage['meso.resFloatPos']`. Los ids `#res-wheat`,
  `#res-brick`, `#res-pop` no cambian: `updateUI()` sigue actualizándolos igual.
- La interfaz flotante no la oculta `body.hud-idle` (los recursos son información
  permanente).

## 5. Saber qué misión sigue

- El menú de pausa lista el objetivo activo y los demás, y avisa de que se cambia
  con **O**; el HUD de objetivos ya trae el botón «🔄 Cambiar (O)».
- Al completar una misión se avisa, suena `missionComplete` y **se guarda**.
- Otros avisos que ayudan: «Trigo maduro en N parcela(s): písala para cosechar» y
  el aviso del siguiente día.

## 6. Trampas al probar esto (apuntadas para no repetirlas)

- **La propia página pisa tus pruebas**: al recargar, `visibilitychange` →
  `saveAppState()` reescribe `localStorage` con el estado *vivo*. Si inyectas algo
  en el guardado y recargas, tu inyección desaparece. Bloquea antes el `setItem`:

  ```js
  const native = Object.getPrototypeOf(localStorage).setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { if (k === 'meso.appState') return; return native(k, v); };
  native('meso.appState', JSON.stringify(estadoModificado));
  ```

  (Ese `localStorage.setItem` sí es sobreescribible: si te lo dejas puesto,
  `delete localStorage.setItem` lo devuelve al nativo.)
- En pestaña oculta el `requestAnimationFrame` va a 2 fps: usa
  `MESO_DEBUG.testDraw.perf.frame(n)` para forzar fotogramas síncronos antes de
  medir `world.diag()` o los píxeles del lienzo.
- `document.querySelector('canvas')` devuelve un icono; el lienzo del juego es
  `#gameCanvas`.
- Recargar es obligatorio para probar cambios del motor: una pestaña abierta
  sigue ejecutando el código anterior (por eso estos fallos «no se veían»).
