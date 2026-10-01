# Terreno coherente y mundo que crece — MesoBuilder

> Añadido: 2026-09-29
> Módulo: `engine/terrain-generator.js` (nuevo) · Motor: `engine/game-engine.js`
> (§ «MUNDO QUE CRECE» y `generateMap`) · Plantillas: `engine/game-engine-structures.js`
> y `engine/game-engine-settlement-utils.js`
> Origen del generador: el que ya usaba el **editor de mapas**
> (`tools/Support/map-editor-standalone.html` → `generateCoherentBiomes`).

## 1. Por qué: dos generadores distintos

Hasta ahora había **dos formas de hacer terreno** en el proyecto:

| | Editor de mapas (`?editor=1`) | Juego (`generateMap`) |
|---|---|---|
| Método | ruido de valor + **fbm** (elevación y humedad) | bandas por columna + ruido blanco |
| Ríos | cauce por senos, continuo | paseo aleatorio por filas |
| Biomas | manchas coherentes con umbrales por época | estepa al oeste/este, aluvial en medio, pantano/salino al sur |
| Repetible | sí (semilla) | no (Math.random por celda) |

El del editor es **mejor** (coherente, reproducible y con transiciones suaves), así
que se ha portado al motor en un módulo compartido y se usa para el mapa inicial
**y** para el terreno nuevo de los bordes.

## 2. El generador coherente (`engine/terrain-generator.js`)

```js
import { createTerrainGenerator } from './terrain-generator.js';
const gen = createTerrainGenerator({ refCols: 180, refRows: 120 }); // referencia FIJA

gen.biomeAt(col, row, { seed, epoch, rivers });   // bioma de una celda
gen.heightAt(col, row, { seed, biome });          // altura 0..1
gen.fillRegion((col, row, biome) => { ... }, { c0, r0, cols, rows, seed, epoch, rivers });
gen.spansAt(row, { seed, epoch, rivers });        // cauce de los ríos en esa fila
```

**La clave para el mundo infinito**: el ruido se evalúa en **coordenadas de
mundo** normalizadas por una *referencia fija* (el tamaño del mapa inicial), no
por el tamaño actual. Todo (elevación, humedad, latitud y el meandro del río) es
una **función pura de (columna, fila) + semilla**, así que:

* dos llamadas a la misma celda dan el mismo bioma (repetible);
* una región generada más tarde **encaja sin costuras** con la anterior: en el
  borde entre la banda vieja y la nueva el bioma continúa.

El río es `center(fila) = base + amp * (0.78·sin(0.045·fila) + 0.22·sin(0.131·fila))`
(antes un paseo aleatorio, que no se podía evaluar en filas que aún no existían).
Los seis biomas de siempre salen de dos campos: elevación → `hills`; humedad →
`forest` / `marsh` / `saline` / `steppe` / `alluvial`, más la franja `riparian`
pegada al agua. Los umbrales son los del editor (`mesopotamia`, `urss`,
`medieval`).

## 3. El mundo que crece

El mapa (180×120) es sólo **el trozo generado hasta ahora**:

* `COLS` y `ROWS` son `let` (antes `const`).
* Cuando el jugador entra en `WORLD_EDGE_MARGIN` (**40** celdas) de un borde, se
  añade una banda de `WORLD_BAND` (24) celdas con el mismo generador
  (`expandWorld`). Tope de seguridad: `WORLD_MAX` 1024.
* **PRECARGA**: antes se crecía a 12 celdas del borde —justo delante del
  jugador, en plena caminata— y el tirón se notaba. Ahora se genera 40 celdas
  antes (≈9 s de caminata) y **no se avisa con ningún mensaje**: el terreno ya
  está listo cuando el jugador llega.
* **Guardas**: no se crece durante la carga (el jugador aún está en su posición
  inicial 14,12 pegada al borde), ni dentro de una casa, ni hasta que el jugador
  ha caminado (`player._walkTime > 0`) o antes de 3 s desde `_worldReadyAt`.

### 3.0 Coste: 16–25 ms por banda (antes 100–720 ms)

Lo caro no era generar la banda (bioma + altura + vegetación, unos pocos ms) sino
**repintar las cachés de terreno** y la niebla:

| Antes | Ahora |
|---|---|
| `mapCacheDirty = true` → reconstrucción completa de las DOS vistas (ortho + iso) en segundo plano, y mientras tanto el render cae a «celda a celda» | `growTerrainCaches` **amplía** el lienzo y pega el viejo desplazado (un `drawImage`) |
| El detalle de la banda se pintaba dentro del mismo fotograma | `queueTerrainBandRepaint`: **relleno plano** inmediato (sin agujeros) y detalle **a 3 filas por fotograma** |
| `buildFogCanvas()` entero (un `fillRect` por celda: decenas de miles) cada vez que se exploraba terreno nuevo | `markExplored` limpia **sólo el píxel** de cada celda nueva (`clearFogPixel`); el lienzo sólo se rehace al cambiar de tamaño, y al crecer se **amplía arrastrando** lo revelado (`growFogCanvas`) |
| La niebla en isométrico recorría **todas** las celdas por fotograma | Sólo las celdas **visibles** (la caja de la cámara + margen) |
| Guardado completo del mapa en cada banda (600 ms después) | Se posterga (2,5 s) y sigue siendo debounced |

Medido con `MESO_DEBUG.testDraw.world.expand('south')`: **~16 ms** por banda de 24
celdas (antes ~700 ms), y la caché queda lista (`mapCacheDirty: false`) en cuanto
termina el repintado por trozos.


### 3.1 Crecer al este/sur es barato; al oeste/norte mueve el mundo

El índice 0 de las rejillas es el borde del mundo, así que **ampliar al oeste o
al norte obliga a desplazar todo lo existente**. Lo hace `worldShiftEverything`:

| Qué | Cómo |
|---|---|
| `tileBiome`, `grid`, `heightMap` | `worldResizeGrids`: desplaza (unshift) y rellena hasta el tamaño nuevo |
| `_RIVER_FULL_MAP`, `_CANAL_MAP`, `_BRIDGE_MAP` | `worldResizeTypedMap` (Uint8Array por fila) |
| Niebla (`_explored`) | recolocada celda a celda (`worldShiftFog`) |
| Entidades, conejos, zorros, enemigos, tumbas, partículas, textos | `col/row/x/y/worldX/worldY` + `patrolRoute`, `moveTarget`, `target`, `_from`, `buildingBase` |
| Jugador y cámara | `col/row/x/y` y **la cámara en píxeles** (`dc * getTileSize()`) |
| Pueblos | caja (`minC/maxC/minR/maxR`) y `houses` |
| Puertas de muralla (`_GATES`), puertas de interior, prólogo, misiones, objetivos | `worldShiftEntityLike` |
| Conjuntos de estructura | `structureSystem.listPlaced()` → desplazar → `restorePlaced()` |

> **Contrato para código nuevo**: si un sistema guarda coordenadas de mundo,
> debe apuntarse a `window._WORLD_SHIFT_HOOKS` (`(dc, dr) => …`) o sus datos se
> quedarán en el sitio viejo al crecer al oeste/norte.

### 3.2 La banda nueva

`worldGenerateBand` genera bioma + cauce + altura y **continúa los elementos
lineales** que atraviesan la banda: los corredores logísticos (`canal_road`, filas
32/64/96) y los corredores industriales soviéticos (filas 26/60/91). Después
siembra vegetación con las MISMAS reglas que el mapa inicial: ribera 40 %
(árboles y juncos), pantano 28 %, colinas 10 % de piedra, salino 3 %, estepa 2 %.

### 3.3 Partidas guardadas

* Se guarda `terrain: { seed, rivers }` junto al mapa: sin la semilla, el terreno
  que creciera tras cargar no continuaría el mismo campo de ruido.
* Al cargar, `resizeWorldTo(cols, rows)` **adopta el tamaño guardado** (el mundo
  pudo crecer) antes de volcar las rejillas, y `rebuildCanalMapFromBiomes()`
  reconstruye los corredores (no viajan en el guardado).

## 4. Núcleo de la capital: espaciado

El zigurat estaba apretado: la reserva del núcleo era 17×17 y el monumento mide
12×12 → 2 celdas de margen. Ahora:

* `TEMPLATES.capital` usa `coreRings: 2` → reserva de **29×29** (-14…+14) y una
  corona de manzanas más lejos (huella 45×45; antes 33×33).
* `blockGap: 2` en la capital: los edificios de una manzana dejan **dos** celdas
  de callejón en vez de una (la ciudad respira; ~62 edificios frente a 96 antes).
* La plantilla `nucleo_capital` llena esa explanada: **corona pavimentada** de 2
  celdas pegada al monumento, **avenidas procesionales** de 2 celdas hasta el
  borde de la reserva, 12 palmeras en rincones y testeros y dos pozos en las
  esquinas. Verificado en partida: dentro de las 15 celdas del centro sólo hay el
  zigurat (144 celdas) y los 2 pozos — ningún edificio pegado al monumento.
* El conjunto silvestre `zigurat_complejo` también se ha separado: el templo pasa
  de 11 a 13 celdas, el granero de 12 a 14 y el mercado de 11 a 13.

Las puertas de la muralla siguen alineándose solas con las avenidas nuevas
(`snapGatesToStreets`, ver `docs/PUERTAS-Y-CONTROL.md`).

## 5. Arranque: el jugador SIEMPRE en su casa

El sitio del prólogo se elige antes que muchas otras pasadas (asentamientos,
conjuntos de estructura, limpieza de vegetación), así que cualquiera de ellas
podía dejar un edificio encima del punto de aparición o empujar al jugador. Al
final de `generateMap` corre `ensurePlayerStartsAtHome()`:

1. Si no hay casa de prólogo, se levanta una donde esté el jugador
   (`setupHomePrologueSpawn`).
2. Si la hay, se comprueba que el jugador esté en la celda de delante de la
   puerta (o a un paso: `doorC±1`, `doorR+1..2`); si no, se le pone ahí.
3. Si esas celdas estuvieran ocupadas, `findNearestWalkable` alrededor de la
   puerta y, si el resultado cae DENTRO de la huella de la casa, se descarta.

Comprobar: `MESO_DEBUG.testDraw.player.home()` → `{ jugador, casa, puerta, enLaPuerta: true }`.

## 6. Cómo comprobarlo

```js
MESO_DEBUG.testDraw.world.stats();          // tamaño, semilla y reparto de biomas
MESO_DEBUG.testDraw.world.expand('west');   // fuerza una banda (idempotente por borde)
MESO_DEBUG.testDraw.world.expand('south');
MESO_DEBUG.testDraw.world.grow();           // como el bucle: sólo si toca
MESO_DEBUG.testDraw.world.biomeAt(c, r);    // bioma que daría el generador ahí
MESO_DEBUG.testDraw.world.heightAt(c, r);
MESO_DEBUG.testDraw.world.repaintPending(); // ¿queda repintado de banda pendiente?
MESO_DEBUG.testDraw.world.repaintRegion(c0, r0, c1, r1);  // repintado síncrono
MESO_DEBUG.testDraw.player.home();          // dónde ha aparecido el jugador
MESO_DEBUG_WORLD = window._WORLD_SHIFT_HOOKS;  // sistemas apuntados al desplazamiento
```

Comprobaciones útiles: tras `expand('west')` el jugador, los pueblos y las
entidades deben haber ganado +24 columnas; tras `expand('south')` **nada** se
desplaza y sólo crecen las filas; `perf.info().cacheTerrenoLista` debe volver a
`true` (la caché de terreno se reconstruye al tamaño nuevo).

## 6.b Coste de pintar el suelo (medido, 2026-10-01)

El suelo **no** se pinta por fotograma: se pinta una vez en la caché y luego se
vuelca con un solo `drawImage` recortado a la pantalla. Medido en una partida real
(2.000 entidades, mundo 204×144):

| Dato | Valor |
| --- | --- |
| Repintados completos de la caché | 3-4 por sesión |
| Coste de un repintado | ~1 s (en trozos de 12 ms, sin bloquear) |
| Repintados por fotograma | 0 |
| `drawImage` del suelo por fotograma | 1 |
| Sección `terreno` (`perf.sections()`) | ~1,2 ms |

Se consulta con `perf.info().terreno` → `{ repintados, msUltimo, edadMs,
repintadosZonaVisible, cacheBusy }`. Si `repintados` sube sin parar mientras se
juega, ahí sí hay un problema (el vigilante del terreno reconstruyendo de más).

Los **repintados** ocurren al arrancar, al **crecer el mundo** (banda nueva), al
cambiar de vista y con el editor de mapas. Los contadores se añadieron justo para
poder descartar esta sospecha con datos en vez de a ojo.

### Suelo con ARTE (baldosas del editor de entidades)

El relleno plano procedural se puede sustituir por baldosas recortadas de la hoja
(`suelo_arena`, `suelo_tierra`, `suelo_arcilla`, `suelo_agua`): ver
`docs/EDITOR-DE-ENTIDADES.md` § «El SUELO también». Se pintan en la misma caché, así
que **no** cuestan nada por fotograma (`perf.info().suelo` dice qué baldosa usa cada
bioma).

## 7. Trampas aprendidas

- Ampliar **al oeste/norte** sin desplazar las rejillas deja el mundo "descolgado"
  (biomas y edificios en coordenadas viejas): el desplazamiento es obligatorio.
- Ampliar **al este/sur** no desplaza nada, pero hay que **rellenar** las filas y
  columnas nuevas antes de generar (`worldResizeGrids` hace las dos cosas).
- `grow()` con `makeCell` como **valor** en vez de función reventaba el
  redimensionado (los rellenos deben ser fábricas: `() => null`).
- El crecimiento disparaba durante la CARGA: el jugador está en (14,12), a 12
  celdas del borde. De ahí las guardas de `_walkTime` y `_worldReadyAt`.
- Los mapas auxiliares con `Uint8Array` por fila no se pueden desplazar con
  `unshift` de columnas: hay que crear la fila nueva y `set()` el contenido.
- La cámara (`camX/camY`) va en **píxeles**, no en celdas: al desplazar hay que
  multiplicar por `getTileSize()`.
- Reconstruir las dos cachés de terreno por cada banda era el tirón de
  rendimiento: hay que **ampliar** el lienzo (drawImage del viejo desplazado) y
  repintar sólo la banda, por trozos, con relleno plano inmediato.
- La niebla de guerra era otra trampa: `_fogDirty` + `buildFogCanvas()` entero
  (un `fillRect` por celda) cada vez que el jugador pisaba terreno nuevo. Ahora
  se limpia el píxel de la celda explorada y nada más.
- El spawn del jugador debe comprobarse **al final** del mapa: entre que se elige
  el sitio y termina la generación hay pasadas que pueden taparlo.

---

## Variedad del terreno, semilla por partida y aparición en casa (2026-09-29)

Cambios pedidos a raíz de «el mapa es raro, no se ven edificios ni entidades,
parece que repite la misma sección, y el jugador no sale en su casa».

### 1. Semilla nueva por partida (`generateMap(mapType, { freshSeed: true })`)

`generateMap` reutilizaba `window._TERRAIN_SEED` en cuanto era un número. Como
la semilla se publica al generar el primer mundo (y se guarda en la partida),
cualquier «Nueva partida» posterior repetía **exactamente** el mismo terreno: de
ahí el «parece que repite la misma sección». Ahora:

- partida nueva (`Nueva partida`, partida forzada) → `{ freshSeed: true }` +
  `window._TERRAIN_SEED = null` → semilla nueva;
- cargar partida o **ampliar el mundo** → semilla antigua, que es lo que exige
  que el terreno sea función pura de (columna, fila) y encaje al crecer.

Comprobado: dos partidas nuevas seguidas dan semillas distintas y repartos de
biomas distintos (antes eran idénticos).

### 2. Frecuencias del ruido y umbrales de bioma (`engine/terrain-generator.js`)

El ruido se evaluaba con frecuencias de **3.1 / 4.4** sobre coordenadas
normalizadas a 180×120: cada mancha de ruido medía 40–60 celdas, así que el mapa
era un puñado de parches enormes y lisos. Y los umbrales «de manual» (0.72–0.78)
no se alcanzaban nunca: **colinas 0 %, bosque 0,5 %**.

Ahora hay, por perfil (mesopotamia / urss / medieval):

- `elevFreq`, `moistFreq` (7 / 9), `detailFreq` (22) y `detailAmp` (0.15): una
  octava de detalle fino que rompe los parches grandes;
- `elevNoiseMix` / `moistNoiseMix` en vez de constantes sueltas;
- umbrales medidos sobre los **cuantiles reales** de los dos campos
  (q35≈0.35, q45≈0.38, q78≈0.42, q92≈0.51), no inventados.

Reparto medio resultante (6 semillas, 180×120): agua 5,5 % · ribera 2,2 % ·
bosque 10 % · colinas 7,5 % · humedal 6,7 % · salino 11 % · estepa 28 % ·
aluvial 29 %, con manchas de ~6 celdas.

> Trampa: el orden de las comprobaciones de bioma importa. El humedal se mira
> **antes** que el bosque; al revés, cualquier celda húmeda caía antes en
> `forest` y `marsh` quedaba a 0 en todo el mapa.

### 3. Ríos con más meandro

`riverAmp` sube de 8 a 12 (10 en URSS, 11 en medieval): con 8 el cauce salía casi
recto de arriba abajo.

### 4. Más vida y asentamientos menos previsibles

- Posiciones del `spawnPlan` con **jitter** (±8 % del mapa) + 2–4 pueblos extra
  (antes 1–2): sin jitter, las cuatro ubicaciones eran idénticas en todos los
  mapas.
- Vegetación dispersa en `alluvial` (11 %) y `steppe` (7 %): antes eran desierto
  liso y el mapa parecía vacío. Se hizo igual en las bandas nuevas del
  crecimiento (`worldGenerateBand`).
- Caminantes 30 → 48 intentos, conejos 28 → 36, zorros 14 → 18, conjuntos de
  estructura `cap` 8 → 11 (URSS 7 → 9).
- Efecto medido: entidades 688 → ~1.450 y edificios 342 → ~350 en mapas de 180×120.

### 5. El jugador sale SIEMPRE en la puerta de su casa

Tres causas, las tres arregladas:

1. `postMapInit` llamaba a `centerCamera()`: la cámara miraba al **centro del
   mundo**, no al jugador, así que la primera pantalla mostraba una zona vacía.
   Ahora llama a `ensurePlayerStartsAtHome()` y a `centerCameraOnPlayer()`.
2. La restauración heredada `loadPlayerPos()` (al final de `init`) devolvía al
   jugador a la posición de la sesión anterior **encima de un mapa recién
   generado**. Ahora se salta si `window._worldReadyAt` es de hace < 8 s.
3. La **auto-restauración de partida** entraba siempre que existía un guardado:
   al abrir el juego nunca se veía el menú y el personaje aparecía donde se dejó.
   Ahora sólo continúa si la sesión anterior es de hace < 10 min
   (`meso.lastActive`); si no, se muestra el menú (y ahí «Nueva partida» sale en
   casa y «Cargar partida» retoma el guardado).

También se quitó el HUD del lienzo de debajo del terreno (ver
`docs/HUD-MINIMALISTA.md`): `_hudVisible` sólo se activaba en el menú interno del
motor, así que en el juego real no se dibujaba nada.

### 6. Asentamientos: ni en el agua ni solapados

Con el río más ancho y más pueblos por mapa aparecieron dos defectos que el
`auditMap()` cantaba:

- **Edificios sobre agua** (`onWater`): graneros y casas dentro del cauce. Ahora
  `spawnVillage` prueba hasta 4 anclajes y se queda con el plan más seco
  (`settlementWaterFraction(plan)` mide el agua en el rectángulo del asentamiento
  y se acepta en cuanto baja del 0,4 %).
- **Huellas solapadas** (2 celdas de un granero con una casa): el pase de
  conjuntos de estructura sólo reservaba la casa del prólogo y la zona del
  jugador. Ahora los pueblos ya levantados también entran en `extraBoxes`, así
  que ningún conjunto cae encima de una manzana.

Verificado en un mapa nuevo: 5 pueblos, 375 edificios, 10 conjuntos,
`solapes: 0`, `enAgua: 0`, sin avisos de «sin sitio».

---

## Arreglo del crecimiento del mundo (2026-09-29, tarde)

Síntomas: «los edificios y estructuras no se dibujan», «cada vez que se expande
se teletransporta el personaje», «la generación de terreno ralentiza el juego» y
«se expande desde muy lejos».

### La causa gorda: las anclas de los edificios no se desplazaban

Cada celda de la rejilla de edificios guarda su ancla **absoluta**
(`baseCol`/`baseRow`) y `getCellInfo()` sólo devuelve `isBase: true` cuando el
ancla coincide con el índice de la celda. Al crecer al **oeste/norte**,
`worldResizeGrids` mueve las celdas de sitio (`unshift`) pero
`worldShiftEverything` **no tocaba esas anclas**: a partir de la primera
expansión, *ningún* edificio era «base» y por tanto no se dibujaba ninguno (ni
se podía seleccionar, ni tenían puerta de interior). Y como el guardado se hacía
después, el fallo viajaba a la partida guardada.

- `worldShiftEverything` ahora desplaza `baseCol/baseRow` (y `col/row`, `base`,
  `door`, `anchor`) de los objetos de la rejilla.
- `repairGridAnchors()` repara anclas ya rotas: agrupa celdas por
  `tipo + ancla`, comprueba que el ancla apunte a una celda del grupo y, si no,
  la recalcula como la esquina superior izquierda real del grupo. Se llama en
  `normalizeRestoredGrid()` (así se arreglan las partidas guardadas viejas) y
  justo después de cada desplazamiento, como red de seguridad.
- Prueba: rompiendo las anclas a mano, `bases` pasa de 353 a 0; tras una
  expansión vuelven a 290+ y el juego vuelve a pintar casas, torres y granjas.

### La cámara en vista isométrica

La compensación de cámara usaba la fórmula ortogonal (`camX += dc·tile`) en
cualquier vista. En isométrica la proyección mueve la pantalla en diagonal
(`x = (col-fila)·w/2`, `y = (col+fila)·h/2`), así que el desplazamiento no se
cancelaba y la imagen pegaba un salto diagonal cada vez que el mundo crecía.
Ahora se usa la fórmula correspondiente a la vista activa.

### Se expande más tarde, más lejos y más barato

| Antes | Ahora |
|---|---|
| `WORLD_EDGE_MARGIN = 40` (crecía a 40 celdas del borde: nada más empezar a andar) | **10** celdas |
| Enfriamiento 1,5 s (encadenaba bandas) | **20 s** (`WORLD_GROW_COOLDOWN_MS`) |
| Crecía durante el prólogo (la casa está junto al borde norte) | Sólo si el prólogo ha terminado (`_homePrologue.slept`) o el jugador lleva **120 s andando** |
| `growTerrainCaches()` en el mismo fotograma (reallocaba **dos** lienzos de decenas de millones de píxeles) | Se **difiere** al hueco siguiente (`_pendingCacheGrow` + `setTimeout 0`) |
| El render usaba la caché sin comprobar el tamaño | Sólo la usa si mide exactamente `COLS·TILE × ROWS·TILE` (o la geometría iso); mientras tanto pinta por celdas la zona visible |
| Guardado nada más crecer (`saveAppStateDebounced(2500)`) | 12 s (lo cubre el autoguardado periódico) |

Coste medido de una expansión (sincrónico): **19–36 ms** (antes 62–144 ms),
y con `mapCacheDirty: false` y `cacheTerrenoLista: true` al terminar.
Comprobado también que **no** se dispara solo: con el prólogo activo y el
jugador a 45 celdas del borde, `testDraw.world.grow()` devuelve `null`.



