# Auditoría de MesoBuilder — 2026-09-25

> Alcance: estado real de ejecución (arranque, menú, nueva partida, generación de
> mundo, renderizado, entidades, guardado) + revisión de los subsistemas de
> arranque (Electron), audio, entrada y guardado.
> Método: ejecución en Chromium (`scripts/dev-server.js`) y en Electron
> (`npx electron . --enable-logging`), inspección del estado en vivo del motor,
> lectura de los listeners de entrada y comparación con los datos de `data/`.

---

## 0. Resumen

**El juego arranca y funciona.** No había un fallo que lo dejase inutilizable; lo
que había (y hay) son **varias averías silenciosas** que se comen funcionalidad sin
dar error: cosas que "no hacen nada" al pulsarlas, contenido que no se dibuja como
debería y rutas de datos que nunca se ejecutan. Eso produce exactamente la
sensación de "está roto y no sé por qué".

En esta sesión:

* **5 averías silenciosas corregidas** (§1) — ninguna lanzaba error en consola.
* **1 herramienta nueva**: modo debug / inspector visual con F9 (§2).
* **7 problemas pendientes** documentados con evidencia y propuesta (§3).

---

## 1. Corregido en esta sesión

### 1.1 `window.entities` / `rabbits` / `foxes` / `graves` nunca se asignaban ⚠️ grave

**Síntoma**: la selección de unidades con Ctrl+arrastrar, "enviar a recolectar" y el
índice espacial no funcionaban, y el HUD de debug mostraba siempre `totalEntities: 0`.
Sin ningún error en consola.

**Causa**: varios módulos leen las colecciones desde el objeto global:

| Consumidor | Qué espera |
|---|---|
| `engine/game-engine.js` → `window.SceneManager.ensureBuilt(window.entities \|\| [])` | índice espacial de entidades |
| `engine/game-engine-selection-utils.js` (líneas 13-14, 182) | selección RTS, tareas de NPCs, recolección |
| `engine/game-engine-preload-utils.js` (103-104) | precarga de sprites |

…pero **nadie asignaba nunca** `window.entities = entities` (verificado con búsqueda
global: cero coincidencias de `window.entities\s*=`).

**Consecuencia medida**: `Object.keys(SceneManager._grid).length === 0` antes del
arreglo; `window.entities.length === 654` después.

**Arreglo**: en `engine/entities.js` se exponen las cuatro colecciones en `window`
(son las mismas referencias, sin copias).

---

### 1.2 `window.player` nunca se asignaba ⚠️ grave

**Síntoma**: el LOD de entidades usaba la distancia a la coordenada (0,0) en vez de
la distancia al jugador, y las cinemáticas llamaban al protagonista "el camarada"
en lugar de su nombre.

**Causa**: mismo patrón. `shouldRenderDetailsForEntity()` y `shouldUpdateEntity()`
hacían `window.player ? window.player.x : 0`, y `window.player` nunca existía. En la
cinemática: `const protagonistName = (window.player && window.player.name) ? … : 'el camarada'`.

**Arreglo**: `try { window.player = player; } catch (e) {}` junto a la definición de
`player` en `engine/game-engine.js`. Es un objeto mutado en sitio (no se reasigna),
así que basta con publicarlo una vez.

---

### 1.3 El protocolo `meso-local://` no se registraba nunca

**Evidencia** (log de Electron):

```
[meso-local] Failed to register custom protocol: Session can only be received when app is ready
```

**Causa**: `registerLocalProtocol()` se llamaba antes de `app.whenReady()`. El
comentario del código decía "required by Electron", pero eso era cierto para la API
antigua (`registerFileProtocol`), no para `protocol.handle()`, que necesita una
sesión ya creada.

**Impacto**: el fallback de lectura de datos (`meso-local://data/…`) no existía. Si
el preload falla, la app se queda sin `entity-pixels.json`, `entities-defs.json`,
diálogos e interiores. Ahora también lo usa `data/sprite-adjustments.json`.

**Arreglo**: `electron/main.js` — el registro se hace dentro de `app.whenReady()`.

---

### 1.4 La música MIDI de intro daba 404 en todas las partidas

**Evidencia**: `Failed to load MIDI: 404` en cada arranque de partida.

**Causa**: el motor pedía `data/Sounds/ussr.mid`, pero el archivo está en
**`data/Music/ussr.mid`** (`data/Sounds/` sólo tiene `ussr.wav` y
`March_of_the_Vanguard.mp3`).

**Arreglo**: `loadIntroMusicMIDI()` prueba `data/Music/ussr.mid` y luego
`data/Sounds/ussr.mid` (compatibilidad). Además, ya **no se pide el archivo si el
parser MIDI del CDN no está cargado** (evita un 404 inútil por partida).

---

### 1.5 Entidades de previsualización y datos de debug se colaban en el guardado

**Causa**: `saveAppState()` serializa `entities` con `{ ...e }`, así que los sprites
de prueba del modo debug y los campos temporales `_dbgRect` / `_dbgRectAt` acababan
en `localStorage['meso.appState']`.

**Arreglo**: `stripTransientDebugFields()` + filtro de `kind === 'preview'` al
guardar.

---

### 1.6 `GLOBAL_TREE_TEMPLATES` antes de inicializarse — **sólo en Electron** ⚠️ grave

**Evidencia** (log de Electron, al cargar el motor):

```
populate tree templates err ReferenceError: Cannot access 'GLOBAL_TREE_TEMPLATES' before initialization
augmentSovietBlockVariants err TypeError: Cannot add property soviet_block_warm, object is not extensible
```

**Causa (TDZ)**: `loadLibrary()` (`ensureEntityPixelsLibrary`, ~L3545) es `async`,
pero cuando los datos vienen del **preload** su camino es 100 % **síncrono**:
no hay ningún `await` antes de tocar estado del módulo. En ese caso se ejecutaba
*durante* la evaluación del módulo y accedía a `let GLOBAL_TREE_TEMPLATES`
(declarado en la línea ~14138, mucho más abajo) → `ReferenceError`.
En el navegador no ocurría porque el `await fetch(...)` desplazaba la ejecución
a después de la evaluación del módulo. Es decir: **el ejecutable y el modo
desarrollo se comportaban distinto**.

**Consecuencia**: en el `.exe` los árboles del mundo **no** recibían las plantillas
pixel-art del JSON (`GLOBAL_TREE_TEMPLATES` se quedaba con las de reserva).

**Arreglo**: `await Promise.resolve();` al principio de `loadLibrary()` (cede un tick
antes de tocar estado del módulo), con un comentario que explica el porqué.

---

### 1.7 Los datos del preload llegan congelados — **sólo en Electron** ⚠️ grave

**Evidencia**: `TypeError: Cannot add property soviet_block_warm, object is not extensible`.

**Causa**: `contextBridge.exposeInMainWorld` **congela en profundidad** los objetos que
expone. `window.ENTITY_PIXEL_LIBRARY = json.icons` apuntaba por tanto a un objeto
inmutable, y `augmentSovietBlockVariants()` no podía añadir las variantes
derivadas (`soviet_block_warm`, `soviet_block_dark`, …).

**Consecuencia**: en el `.exe` faltaban variantes de sprite respecto a desarrollo
(79 claves en navegador vs 75 en Electron; ahora 79 en ambos).

**Arreglo**: `clonePixelLibrary(src)` (copia editable de `{grid, pixels}`) al asignar
`ENTITY_PIXEL_LIBRARY`. Verificado reproduciendo el entorno Electron en el navegador
(datos congelados inyectados a mano): `hasWarm: true`, `hasDark: true`, 79 iconos.

---

### 1.8 Los permisos del esquema `meso-local://` faltaban

Aunque el protocolo se registrase, `fetch('meso-local://…')` seguía fallando con
`URL scheme "meso-local" is not supported`: para que el renderer pueda usarlo hay que
declarar los privilegios del esquema **antes** de `app.whenReady()`
(`protocol.registerSchemesAsPrivileged`). Hecho, junto con el arreglo de 1.3 y el
cálculo de la ruta (con esquemas *standard* el primer segmento es el `host`, así que
`meso-local://data/x.json` → `host='data'` + `pathname='/x.json'`).

---

### 1.9 El menú superior era inalcanzable ⚠️ (reportado por el usuario)

**Síntoma**: *"no puedo clicar ningún elemento de la barra superior"*.

**Diagnóstico**:

```
#top-menubar → position: fixed; top: -44px; height: 34px;
               opacity: 0; pointer-events: none
botones 'Ver' etc. → rect.top = -35  (fuera de la ventana)
```

La barra está **oculta por diseño** (`createMenuBar()`) y solo se revelaba con
`document.addEventListener('mousemove', ev => { if (ev.clientY <= 8) showTopBar(); … })`,
es decir, acertando en la **franja de 8 px** del borde superior de la ventana, sin
ninguna pista visual de que exista.

Verificado que, una vez visible, **los clics sí funcionan** (el menú "Ver" abre
"Paneles flotantes"), así que el problema era exclusivamente de accesibilidad.

Agravantes:
1. En **Electron** la ventana es `frame: false` con `thickFrame` por defecto: los
   primeros píxeles son el área de redimensionado del sistema, por lo que el
   `mousemove` puede no llegar al renderer → la barra deviene **inalcanzable**.
2. El botón **✕ "Cerrar Menú superior"** no hacía nada: `styles.css` fuerza
   `#top-menubar { display: flex !important }`, que anula el `display:none` que aplica
   el manejador genérico de cierre.
3. `top-menubar` sí se registraba como *panel flotante*, así que `saveAppState()`
   guardaba su `top: -44px` y `registerPanel()` lo restauraba en cada carga.

**Arreglo** (en `createMenuBar()` y `registerClosableUIElements()`):

* Pestaña **☰ MENÚ** siempre visible en el centro del borde superior: abre al pasar el
  ratón y **fija** con un clic (`#menubar-handle`).
* Atajo **F10** (estándar de Windows) para abrir/cerrar y fijar/soltar.
* Controles **📌 Fijar / 📌 Fijado** y **▴ Ocultar** dentro de la barra.
* Estado *fijado*: la barra ya no se oculta sola mientras esté fijada; `Esc` la suelta.
* Se elimina `top-menubar` de la lista de paneles flotantes/cerrables (adiós al ✕ que
  no hacía nada y a la posición de oculto persistida).

**Verificado**: fijado con F10 → permanece visible con el ratón en el otro extremo;
soltado → se oculta al bajar el ratón; pasar el ratón por ☰ → se abre; `F10`/`Esc`
funcionan; los menús abren correctamente.

---

## 2. Herramienta nueva: modo debug / inspector visual (F9)

Ver `docs/MODO-DEBUG.md` para el manual completo.

* **F9** activa el inspector: rejilla, cajas de colisión reales, etiquetas de sprite,
  lectura de casilla y **pausa del mundo** para poder ajustar quieto.
* Clic = seleccionar · Arrastrar = **mover en vivo** · Flechas = ajuste fino ·
  `[` `]` escala · `,` `.` `;` `'` desplazamientos · `Ctrl+Z` deshacer.
* Panel con **ajustes por sprite** (todas las copias), **por tipo de edificio** y
  **por entidad**.
* **Colocar sprite**: escribe una clave (`date_palm`, `tree3`, `house`…) y colócala
  en el mundo para verla de cerca y ajustarla. Caja roja = clave no registrada.
* **Exportar JSON** → `data/sprite-adjustments.json` → el motor los aplica siempre,
  también sin modo debug (y en el ejecutable empaquetado, vía preload).

Implementación: `engine/game-engine-debug-utils.js` + enganches mínimos en
`engine/game-engine.js` (`drawEntitySpriteAt` con `options.ent`, bucle de entidades,
`drawBuilding`, helpers de movimiento/spawn) y `electron/preload.js`.

También se añadió `scripts/dev-server.js` para probar en navegador sin Electron
(`node scripts\dev-server.js` → http://localhost:4321/).

---

## 3. Detectado y NO corregido (pendiente)

### 3.1 Arbolado: variantes sin sprite → mezcla de dos estilos de dibujo 🎨

`placeTree()` (`engine/entities.js`) elige entre
`birch, willow, aspen, pine, fir, steppe_shrub, hay, sedge, scrub, bush, shrub, winter_grass`.

`data/entity-pixels.json` **no contiene ninguna de esas claves**: sólo hay
`tree0…tree6`, `date_palm`, `euphrates_poplar` (79 claves en total, comprobado con
`window.MESO_DEBUG.listSprites()`). Y `resolveTreeSpriteVariant()` sólo remapea
nombres que casan con `/^tree\d+$/`.

Resultado: buena parte del bosque cae al **fallback legacy `GLOBAL_TREE_TEMPLATES`**
(bloques pixel-art hechos a mano en el código) mientras otra parte usa sprites del
JSON. De ahí la sensación de que "el mundo se ve raro/incoherente".

**Propuesta**: mapear cada variante a una clave existente
(`birch→tree0`, `pine→tree2`, `willow→tree1`, `steppe_shrub→tree5`…) o dibujar los
12 sprites que faltan en el editor de píxeles (`tools/Support/pixel-editor-standalone.html`).

**Nota**: el modo debug sirve justo para esto: coloca `tree0…tree6` en el mundo, compáralos
con los que salen proceduralmente y decide el mapeo con referencia visual.

---

### 3.2 Colisiones de atajos de teclado ⌨️

Todos verificados leyendo los listeners de `document.addEventListener('keydown', …)`:

| Tecla | Hace esto | Y también esto |
|---|---|---|
| `H` | Seleccionar **Casa** (mapa de construcción, ~L17944) | "Mantener posición" de unidades (~L17986) |
| `K` | Seleccionar **Mercado** | Abrir el **menú radial del perro** (~L17983) |
| `G` | Seleccionar **Granero** | "Enviar a recolectar" (~L17992) |
| `P` | — | **`applyPlayerDeathConsequences()`** (~L18026): mata al jugador sin confirmación |
| `Espacio` | Pausa / reanuda (~L17967) | **Salto** (~L18061) — dos listeners, se ejecutan los dos |
| `Enter` | Avanzar diálogo | Alternar la guía (~L17971) |

Como el prólogo siempre entrega el perro *Kidu*, pulsar `K` para construir un Mercado
abre el menú del perro: hace que "las teclas no funcionen".

**Propuesta**: las letras de construcción sólo sin modificador **en modo edición**;
mover las órdenes de unidades a `Ctrl+H/J/K`; el suicidio de prueba a `Ctrl+Alt+P`;
y separar pausa (sólo `P` o sólo botón) del salto de `Espacio`.

---

### 3.3 Librerías de audio por CDN sin plan B 🌐

`index.html` carga `tone.js` (cdnjs) y `jsmidparser@0.16.1` (jsdelivr). En esta red
ambos fallan (proxy/ORB). En Electron se ve el motivo real:

```
Refused to execute script from 'https://cdnjs.cloudflare.com/…/tone.js'
because its MIME type ('text/html') is not executable
```

Es decir: el proxy devuelve una página HTML de error y el navegador rechaza el
script. **No hay copia local ni fallback**: la música MIDI queda deshabilitada
(sólo suena `data/Sounds/ussr.wav`, que sí es local, y los beeps de `SoundManager`).

**Propuesta**: vendorizar ambos archivos en `vendor/` y cargarlos desde ahí
(con `onerror` como red de seguridad). Es el único modo de que el audio sea
predecible en un equipo sin salida directa a internet.

---

### 3.4 Basura en la raíz del proyecto (artefactos de redirecciones rotas) 🧹 → **HECHO**

| Archivo | Tamaño | Qué era |
|---|---|---|
| `0` | 0 B | resto de un redirect |
| `button` | 0 B | resto de un redirect |
| `x.type` | 0 B | resto de un redirect |
| `{` | 0 B | resto de un redirect |
| `setJsonTextModalOpen(false)` | 0 B | **versionado en git**; es una línea de `tools/support/sound-editor-standalone.html` que se pegó en el shell |
| `guión` | 9.644 B | guion narrativo (texto) sin extensión ni carpeta |

**Hecho**: los cinco vacíos se han borrado y `guión` se ha movido a
**`docs/GUION-NARRATIVO.md`** (contiene Acto IV, sistema de confianza, memoria de
Adapa y la ficha de la Makarov PM — merece conservarse).

El origen está claro: pegar código con `>` en un shell de Windows. Conviene revisar
`git status` al final de cada sesión para pillar estos restos a tiempo.

---

### 3.5 Módulos que parecen implementaciones y son placeholders 🪨 → **MARCADOS**

| Archivo | Estado |
|---|---|
| `engine/death-system.js` | estaba **vacío (0 bytes)** |
| `engine/input.js` | sólo `console.warn('…stub')` |
| `engine/map.js` | stubs de `generateMap/isRiver/aStar…` que devuelven valores falsos |
| `engine/renderer.js` | stub |
| `engine/ui.js` | stub |
| `game.js` (raíz) | shim legacy que sólo avisa |

El peligro real: alguien (o el propio motor, si alguien los importa) cree que
`engine/map.js#aStar` existe y **devuelve `[]` silenciosamente**. La implementación
real está dentro de `game-engine.js`. Además `MANUAL.md` los describía como si
fueran módulos con contenido (líneas 51-54), lo que reforzaba la confusión.

**Hecho**: cada archivo lleva ahora una cabecera `⚠️ PLACEHOLDER — NO IMPLEMENTADO`
que indica dónde está la implementación real, el manual se ha corregido y
`death-system.js` documenta qué funciones habría que mover si se retoma.
Ninguno se ha borrado (pueden ser intención de futuro), pero ya no engañan.

---

### 3.6 Monolito de 18.546 líneas 📦

`engine/game-engine.js` = 876 KB / 18.546 líneas, con `render()` de ~3.500 líneas y
`generateMap()` de ~350. La extracción a `game-engine-*-utils.js` (el patrón que ya
usáis: `bootstrap`, `entity-def`, `map-editor-core`, `preload`, `selection`,
`sprite-runtime`, `standalone-editor`) es el camino correcto; el modo debug se ha
añadido siguiendo ese mismo patrón.

Duplicación detectada: el dibujado de árboles existe **dos veces** (bucle de
entidades de `render()` y `drawTreeOcclusionOverlay()`); al tocar uno hay que
acordarse del otro.

---

### 3.7 Guardado completo del mapa en `localStorage` 💾

`meso.appState` guarda `grid` (180×120) y `tileBiome` (180×120) completos en cada
autoguardado (cada 20 s y al salir). Es funcional, pero el coste crece con el mapa y
con el número de entidades (`entities.map(e => ({...e}))`). **Propuesta**: medir el
tamaño real y, si molesta, guardar sólo las celdas no vacías + una semilla de
generación.

---

## 4. Verificado y funcionando

* Arranque en Electron y en Chromium sin errores fatales; preload OK
  (`entity-pixels.json` 75 iconos, `entities-defs.json` 26 edificios / 11 árboles,
  `npc-dialogs.json` 11 conjuntos).
* Menú principal, modal de creación de personaje, opciones, carga/importación.
* Nueva partida: generación de mapa 180×120, ~654 entidades, 24 conejos, pueblos,
  ríos, caminos, spawn del jugador junto a la casa del prólogo.
* Prólogo narrativo, HUD de objetivo, tutorial de cultivo.
* Renderizado del mundo (orto e iso), tooltips de casilla, construcción y demolición,
  control de tiempo (0/½/1/2/4×), autoguardado, restauración de sesión.

---

## 5. Cómo reproducir esta auditoría

```bat
:: 1. servidor estático de desarrollo
node scripts\dev-server.js
::    → http://localhost:4321/           (menú normal)
::    → http://localhost:4321/?debug=1   (inspector activo desde el arranque)

:: 2. Electron con log de consola del renderer
npx electron . --enable-logging
```

Comprobaciones rápidas en consola del navegador (F12):

```js
window.MESO_DEBUG.listSprites().length      // claves de sprite realmente registradas
window.entities.length                      // colección de entidades (ya no vacía)
window.SceneManager._grid                   // índice espacial (ya no vacío)
window.player.name                          // nombre del protagonista disponible
window.MESO_DEBUG.getState()                // estado del inspector
window.MESO_DEBUG.snapshot()                // ajustes visuales guardados
```
