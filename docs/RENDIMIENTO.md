# Rendimiento — MesoBuilder

> Añadido: 2026-09-30
> Código: `engine/game-engine.js` (§ «COLOCACIÓN MASIVA DE EDIFICIOS»,
> `buildingAffectsTerrainCache`, `markTerrainRegionForBuilding`, `endBulkBuild`,
> `tillFieldRect`), ayudas de medida en `MESO_DEBUG.testDraw`
> (`perf.info`, `perf.frame`, `till`, `place`, `erase`, `perf.cacheHash`,
> `world.repaintRegion`).
> Docs relacionadas: `docs/TERRENO-Y-MUNDO.md`, `docs/INTERIORES.md`.

## 1. El síntoma

«Cuando pongo un cultivo con la azada, el juego pega un bajón de FPS brutal.»

## 2. La causa (medida, no supuesta)

`tillFieldRect` llamaba a `setBuildingCells()` **por celda**, y cada llamada
hacía trabajo de escala mundial:

1. `rebuildInteriorDoorsFromGrid()` → **escaneo completo de la rejilla**
   (180×120 = 21.600 celdas), ~0,3 ms.
2. `saveAppStateDebounced()` → guardado de toda la partida.
3. `mapCacheDirty = true` + `rebuildMapCacheDebounced()` → **reconstrucción
   completa de las dos cachés de terreno** (orto + iso). Repintar el mundo entero
   (`repaintRegion(0, 0, 179, 119)`, el mismo trabajo que
   `rebuildMapCachesAsync`) cuesta **906 ms** en el lienzo de pruebas.

Y mientras `mapCacheDirty` está en `true`, el bucle de dibujado **deja de usar la
caché** y repinta el terreno celda a celda en cada fotograma. De ahí el tirón:
arrancar 900 ms de trabajo por trozos justo al soltar el arrastre de la azada,
mientras el render pierde la caché.

Dato clave: la caché de terreno pinta **bioma** (color, transiciones, calzada),
**no edificios** — los edificios se dibujan encima. Una parcela de cultivo no
cambia nada del terreno.

## 3. El arreglo

### 3.1 Invalidación por tipo

```js
function buildingAffectsTerrainCache(type) {
  return PATH_BUILDING_TYPES.has(resolveEpochBuildingType(type));
}
```

Sólo las calzadas (`road`, `concrete_road`) obligan a repintar la caché. Una casa,
un templo o una parcela de cultivo no.

### 3.2 Bloque de construcción masiva

```js
beginBulkBuild();          // abre el bloque
… setBuildingCells() …     // sólo marca _bulkPending { doors, terrain, save }
endBulkBuild();            // resuelve cada cosa UNA vez
```

* `doors` → `rebuildInteriorDoorsFromGrid()` una sola vez (y sólo si algún
  edificio colocado tenía interior).
* `terrain` → `mapCacheDirty = true` + reconstrucción aplazada **sólo** si se
  colocó una calzada; durante la generación del mapa la caché aún no existe, así
  que ni se programa.
* `save` → un único `saveAppStateDebounced()`.
* `window._miniMapCache = null` una vez.

`endBulkBuild()` es anidable (`_bulkBuildDepth`), así que se puede envolver
cualquier función que ya use bloques.

### 3.3 Usuarios del bloque

`tillFieldRect`, `generateMap`, `spawnVillage` y cualquier colocación en lote.
`moveBuildingTo` y `setBuildingCells` fuera de un bloque conservan el
comportamiento anterior, pero con las invalidaciones ya condicionadas por tipo.
### 3.3 Calzadas: repintado por región en vez de reconstrucción total

Los únicos edificios que cambian la caché son las calzadas (`road`,
`concrete_road`), porque `paintTerrainCellInCache` pinta el terreno a partir de
`tileBiome` y de `isPathCell` (que mira la rejilla de las celdas vecinas para los
bordillos y el autotiling).

`markTerrainRegionForBuilding()` marca **sólo la huella más dos celdas de margen**
y llama a `repaintTerrainRegion()` (que a su vez añade otro ±1), en vez de dejar
`mapCacheDirty = true` y reconstruir las dos cachés enteras:

* Un anillo de margen no basta: una celda de calzada pinta unos píxeles fuera de
  su casilla, así que la celda vecina (que en una reconstrucción total se pinta
  después y lo tapa) también tiene que repintarse. Comprobado comparando la
  huella (`cacheHash`) tras un repintado por región y tras una reconstrucción
  completa: con ±1 no coincidían; con ±2 sí.
* `repaintTerrainRegion` es **idempotente** (repintar 3 veces la misma zona da el
  mismo hash), así que no hay acumulación de alfa.

Medido con una calzada colocada junto a terreno de camino: **36–75 ms** de
repintado por región frente a **~900 ms** de reconstrucción completa, y el
fotograma no pierde la caché.

## 4. Medidas (navegador, `?debug=1`, mundo de 180×120 con ~1.550 entidades)

Metodología: con la pestaña oculta el navegador no sirve fotogramas (`rAF` se
congela), así que las cifras salen de cronometrar el dibujado a mano con
`MESO_DEBUG.testDraw.perf.frame(n)` y de medir las funciones por dentro con
`MESO_DEBUG.testDraw.till(...)` y `testDraw.place(...)`.

| Medida | Antes | Ahora |
| --- | --- | --- |
| Labrar 39 parcelas (camino real de la azada) | ~900 ms de reconstrucción de caché, más guardado y escaneo de puertas por celda | **19–32 ms** (~0,5 ms/celda) |
| `mapCacheDirty` tras labrar | `true` en cada celda → render sin caché | **`false`** (no se toca el terreno) |
| Coste de fotograma antes/después de labrar | — | **19,0 ms → 19,4 ms** (sin cambio) |
| Colocar una calzada | ~900 ms de reconstrucción total | **36–75 ms** de repintado por región |
| Colocar/borrar una parcela o una casa | escaneo de puertas + guardado + caché | escaneo y guardado (sólo si tiene interior), **0 trabajo de terreno** |
| Repintar el mundo completo (`world.repaintRegion` 0,0→179,119) | 906 ms | 725–906 ms (ya sólo pasa al generar el mapa o al crecer el mundo) |
| Escaneo de puertas de interior | ~0,3 ms por celda colocada | 1 vez por bloque |

## 5. Cómo volver a medirlo

```js
const P = window.MESO_DEBUG.testDraw.perf;
P.info();          // cacheTerrenoLista, mapCacheDirty, entidades, ultimoRepintadoTerreno…
P.frame(21);       // { mediana, min, max, cacheDirty } de 21 fotogramas completos

// Camino real de la azada (incluye beginBulkBuild/endBulkBuild)
window.inventory.seed = 500;
window.player.equipped = 'stone-hoe';
window.MESO_DEBUG.testDraw.till(98, 49, 110, 51);   // minC, minR, maxC, maxR

// Colocar/borrar un edificio y ver por dónde se resolvió el terreno
window.MESO_DEBUG.testDraw.place('road', 104, 40);  // { ms, cacheDirty, via: 'region' }
window.MESO_DEBUG.testDraw.erase('road', 104, 40);

// Huella de una zona de la caché de terreno (para comparar repintado por región
// con reconstrucción completa) y coste de repintar una región o el mundo
P.cacheHash(100, 38, 108, 42);
window.MESO_DEBUG.testDraw.world.repaintRegion(0, 0, 179, 119);
```

Regla práctica: si algún día hay que tocar `setBuildingCells`, comprobar que
`siguen` sin ejecutarse por celda el escaneo de puertas, el guardado y la
invalidación de la caché de terreno.

## 6. Segunda campaña (2026-09-30)

### 6.1 El arranque se quedaba colgado minutos

`engine/game-engine-sprite-runtime-utils.js` codificaba **un PNG por sprite**
(93 sprites) con `canvas.toBlob` + `URL.createObjectURL` en cada arranque. En una
pestaña con el `requestAnimationFrame` frenado eso se convierte en minutos de
«Cargando partida…». El camino de `toBlob` sólo se usa ahora si alguien pone
`window.ENABLE_SPRITE_OBJECT_URLS = true`; el resto del juego ya usaba
`createImageBitmap` (que se mantiene).

Arranque tras el arreglo: **~6,7 s** desde que se pulsa Continuar (1,5 s en el
menú), medido con marca de tiempo en consola.

### 6.2 Medición por secciones

`render()` marca el tiempo de cada bloque (terreno, árboles, edificios,
entidades, animales, efectos, diferido, HUD) y lo acumula en
`window._perfSectionsAcc`. Con `perf.sections()` se lee la media por sección, que
es lo que permitió ver que el problema no estaba repartido sino concentrado.

| Sección | Antes | Después |
| --- | --- | --- |
| Terreno (caché limpia) | 0,3-0,6 ms | igual |
| Árboles del bosque | **5,89 ms** | **1,85-2,13 ms** (y ~0,9 ms con la caché de balanceo) |
| Entidades | **3,03 ms** | **0,94-1,60 ms** (0,5 ms tras recortar antes de ordenar) |
| HUD (lienzo) | **2,36-11,09 ms** (con 147 textos flotantes y paneles despiertos) | **1,36-2,02 ms** con la interfaz dormida |
| Fotograma completo | ~16 ms (asentamiento) | **5,6-5,8 ms**; bosque ~13,2 ms |

Además, si se mide con `mapCacheDirty === true` la sección de terreno se dispara
a 16,5 ms por el camino celda a celda: **comprobar siempre
`perf.info().mapCacheDirty === false` antes de dar por bueno un número.**

### 6.3 Lo que se cambió

1. **Balanceo de árboles pre-renderizado**: cada planta tiene un lienzo por
   «grado» de inclinación (`TREE_SWAY_BUCKETS = [-2,-1,0,1,2]`), así que dibujar
   un árbol es **un `drawImage`** en vez de cientos de rectángulos. El mapa por
   clave `(plantilla, cubo)` se limpia al pasar de 400 entradas.
2. **Los árboles vuelven a ser árboles**: `pickForestTreeTemplateIndex` mandaba
   la mitad del bosque al índice 6 (un matojo de hierba). Ahora reparte por
   especie.
3. **Recorte antes de ordenar**: la lista de entidades se filtra por el rectángulo
   visible (±12 casillas de margen) y *después* se ordena, en vez de ordenar las
   ~25.000 del mundo para dibujar 200.
4. **Directorio del HUD** (ver `docs/HUD-DINAMICO.md`): los bloques caros dejan de
   pintarse cuando no hay nada que contar.
5. **Una sola cola de profundidad** y claves enteras: ver la sección 2 de
   `docs/HUD-DINAMICO.md` (era también la causa del parpadeo de capas).

### 6.4 La causa gorda: la caché de sprites se llenaba y TODO se dibujaba píxel a píxel

Medido en el asentamiento de la capital, mismo sitio, mismo zoom:

| | fotograma | edificios | diferido |
| --- | --- | --- | --- |
| Antes (`spritesEnCache: 2042`, 64 MB) | **97,1 ms** (máx. 355) | **33,1 ms** | **35,1 ms** |
| Después de `perf.limpiarSprites()` | **15,4 ms** | **1,14 ms** | **1,21 ms** |

La caché de sprites rasterizados (`_spriteBitmaps`) tenía dos defectos que se
sumaban:

1. la clave era el **tamaño exacto** de dibujo (`nombre|WxH`), así que el jitter
   de tamaño por instancia y cada nivel de zoom creaban miles de variantes, y
2. era de **64 MB y nunca liberaba nada** (ni desalojaba, ni se vaciaba al cambiar
   el zoom): una vez llena, `getSpriteBitmap` devolvía `null` **para siempre** y
   cada edificio, árbol o cultivo volvía a pintarse con miles de `fillRect`.

Eso es exactamente el síntoma de «pongo un cultivo y el juego se muere»: en cuanto
la caché se llenaba, el coste por fotograma se multiplicaba por seis y además el
navegador iba acumulando decenas de MB de lienzos (tirones por recolección de
basura, con picos de 355 ms).

Arreglado en `getSpriteBitmap`:

* **Tamaño cuantizado** (`snapSpriteSize`): pasos de 1 px hasta 12, de 2 px hasta
  40 y de 4 px a partir de ahí. Dos peticiones casi iguales comparten bitmap (la
  diferencia con el tamaño pedido es de 1-2 px, invisible) y el jitter deja de
  crear entradas. Comprobado: dibujar 6 sprites a 6 tamaños distintos deja **6
  entradas**, no 36.
* **Tope de 400 entradas y 12 MB con desalojo** de lo más antiguo (`evictSpriteBitmaps`)
  y contabilidad correcta de bytes.
* **Se vacía al cambiar el zoom** (con 3 % de tolerancia, porque el zoom se
  interpola): la caché del zoom anterior no sirve para nada.
* Guarda contra tamaños `NaN` (envenenaban el contador de bytes y dejaban el tope
  de memoria inoperante).

### 6.5 Cómo medir esta tanda

```js
const P = window.MESO_DEBUG.testDraw.perf;
P.info();                     // ¿mapCacheDirty === false? ¿spritesEnCache razonable?
P.limpiarSprites();           // A/B: si tras limpiar el fotograma se hunde 6x, la caché estaba llena
window._perfSections = true;
P.frame(60);                  // fotograma completo
P.sections();                 // media por sección
window._perfSections = false;
P.sections(true);             // o window._perfSectionsAcc = {frames:0,sum:{}} para reiniciar
```

## 7. Tercera campaña (2026-10-01): los árboles del PNG se pintaban píxel a píxel

Queja del usuario: «el rendimiento es espantoso», justo después de empezar a usar
el arte recortado del PNG en los árboles.

### 7.1 La medición

Mismo sitio, mismo zoom, mundo 180×120 con ~1.500 entidades, caché de terreno LISTA
(`cacheTerrenoLista: true`), `perf.frame(6)`:

| Sección | Antes | Después |
| --- | --- | --- |
| **fotograma completo** | **192,5 ms** | **19,4 ms** |
| `cola` (cola diferida) | **164,4 ms** | 1,7 ms |
| `arboles` (bosque) | 34,4 ms | 9,9 ms |
| `entidades` | 1,4 ms | 2,6 ms |
| resto (tiles, terreno, edificios, fx, hud…) | < 2 ms | < 1,5 ms |

Para ver esto hacen falta las marcas `cola` y `noche` que se añadieron al desglose:
antes todo eso caía dentro de `deferred` y no se distinguía la cola diferida de la
viñeta nocturna ni del escaneo de interacción.

### 7.2 La causa

`drawEntitySpriteAt` tiene tres caminos: bitmap ya rasterizado (1 `drawImage`),
bitmap con balanceo cacheado, y **bucle de `fillRect` píxel a píxel** como último
recurso. Los dos caminos rápidos tenían condiciones que el arte nuevo NO cumple:

* el de balanceo sólo se usaba si `cellPx === scale` (escala entera) **y**
  `gw * gh <= 2500` (arte pequeño). Un árbol recortado de un PNG son ~161×243 =
  **39.000 píxeles de arte** y una escala fraccionaria, así que caía siempre al
  bucle de píxeles: **~11.000 `fillRect` por árbol y fotograma**.
* los árboles del bosque que quedan delante del jugador van a la cola diferida:
  con ~300 árboles son **3,3 millones de `fillRect` por fotograma**. De ahí los
  164 ms.

### 7.3 El arreglo

Nueva caché `getSwayBitmapFinal(name, def, gw, gh, ancho, alto, bendPx)` en
`engine/game-engine.js`:

* pre-renderiza el sprite **a su tamaño final en pantalla** con el doblez del viento
  ya aplicado, componiendo **una fila de arte por `drawImage`** desde el lienzo de
  origen (`getSpriteSourceBitmap`) en vez de píxel a píxel;
* el tamaño se cuantiza con `snapSpriteSize` (así el jitter de tamaño por celda no
  crea una entrada por árbol) y el doblez se bucketea a ±4 px de pantalla;
* el camino de píxeles se queda como último recurso.

Resultado: cada árbol es **un `drawImage`**. Verificado que el dibujo no cambia
(IoU 0,82 entre el render viejo píxel a píxel y el nuevo por filas; la diferencia es
el redondeo del doblez por fila, que rellena algún hueco de más).

### 7.4 Cómo volver a medirlo

```js
const P = window.MESO_DEBUG.testDraw.perf;
P.info().cacheTerrenoLista;   // false ⇒ cualquier medida es ruido: espera a que esté lista
window._perfSections = true;
P.sections(true);
P.frame(6);                   // mediana del fotograma + desglose por secciones
P.sections();
window._perfSections = false;
```

Ojo: con la pestaña en segundo plano el navegador congela `requestAnimationFrame`
(`frames: 0`, `ms/frame: 50.000` en el HUD). Para medir de verdad, `P.frame(n)`
(llama a `render()` a mano) o trae la pestaña al frente.

## 8. Cuarta campaña (2026-10-01): personajes, árboles y el caso isométrico

Con la tercera campaña el fotograma bajó a ~19 ms, pero el usuario seguía notándolo
«terrible» en isométrico. Medido otra vez, el reparto era otro:

| Sección (isométrico, mundo de 1.935 entidades) | antes | después |
| --- | --- | --- |
| **fotograma** | **31,6 ms** | **5,4 ms** |
| `entidades` (personajes) | 8,2 ms | 1,7 ms |
| `arboles` (bosque) | 8,8-14 ms | 0,35 ms |
| `cola` | 3,2 ms | 0,9 ms |
| `edificios` | 3,0 ms | 0,6 ms |
| `terreno` · `hud` | 2,7 · 2,2 ms | 0,8 · 0,8 ms |

En ortogonal: **19,1 → 6,7 ms**.

### 8.1 Los personajes se pintaban píxel a píxel

`drawCharacterPixels` pinta el muñeco detallado con un `fillRect` por píxel y una
búsqueda de color por píxel: ~400 por personaje. Con 400+ entidades dibujadas eran
**~170.000 fillRect por fotograma** (5-8 ms sólo en `entidades`).

Arreglo: caché `_cuerpoCache` en `firmaCuerpoDetallado()` + `clearCuerpoCache()`.
La firma lleva **todo** lo que cambia el dibujo (dir, frame, pose, paleta, escala,
`headOnly` y la animación cuantizada a píxel entero). En vez de duplicar el bucle de
dibujado, la función se llama a sí misma sobre un lienzo (`_pintandoCuerpoEnCache`
evita repetirse) y luego cada personaje es UN `drawImage`.

### 8.2 El bosque: dibujado directo y balanceo en una sola pasada

Dos cosas:

1. `drawEntitySpriteAt` recalcula por árbol el def, la rejilla, la escala de huella,
   el tope de altura, los ajustes de depuración, el save/restore y los contadores.
   Con ~600 árboles visibles en isométrico eso son milisegundos tirados: ahora hay
   `dibujarArbolArteDirecto()` (caché + un `drawImage`) para el pase del bosque y la
   cola diferida, con `drawEntitySpriteAt` como respaldo.
2. `getSwayBitmapFinal` pre-renderizaba el doblez **fila a fila** (~200 `drawImage`
   por entrada). El doblez es un **cizallado lineal** (base clavada, copa inclinada),
   así que ahora se dibuja el recorte entero en UNA pasada con `setTransform`.
   Llenar una entrada pasa de ~10 ms a ~0,05 ms: antes, cada movimiento de cámara o
   cambio de zoom invalidaba decenas de entradas y se notaban tirones (medido: el
   primer fotograma en isométrico costaba 13 ms; ahora 6 ms).

### 8.3 Lo que se midió y NO se tocó

* **`terreno`** (0,8 ms): un `drawImage` recortado a la ventana. Ya estaba optimizado.
* **Un fotograma suelto de ~50 ms al saltar la cámara a una zona nueva**: es el
  repintado a demanda de las celdas de terreno que aún no estaban en la caché
  (`_terrainRematarZonaVisible`), no el dibujado normal. Es un tirón de un fotograma,
  no un coste sostenido.
* **El tamaño de los árboles en isométrico**: se dejó igual al clásico (es lo que el
  usuario quería). Si algún día molesta el relleno de píxeles, `window._mesoEscalaArboles`
  lo baja en caliente.

### 8.4 Cómo medir esto

```js
const P = window.MESO_DEBUG.testDraw.perf;
P.info();          // cacheTerrenoLista, cuerposEnCache, arbolesEnCache, mbSprites
window._perfSections = true; P.sections(true);
P.frame(15);       // { min, mediana, max }
P.sections();      // { pre, tiles, terreno, arboles, edificios, entidades, animales, fx, cola, noche,
                   //   filtro, deferred, sim, ui, diag, hud }
window._perfSections = false;
// Cambio de vista (reconstruye la caché de terreno de la otra vista):
window.MESO_DEBUG.testDraw.world.view('iso');   // o 'ortho'
```

`cuerposEnCache` y `arbolesEnCache` son los tamaños de las dos cachés nuevas: si
crecen sin parar, hay demasiadas combinaciones (firma demasiado fina).
---

## 9. La caché de terreno se apagaba sola (2026-10-08)

Síntoma del usuario: «hay algo que va muy mal, el juego va ralentizado en todo
momento». **Reproducido y medido**: la partida arranca a ~9 ms por fotograma y, unos
segundos después, cae a 30-50 ms y se queda así para siempre.

### 9.1 La causa: un falso positivo del vigilante del terreno

`vigilanteTerreno()` incluye una comprobación de color para detectar GPUs en las que
el volcado de la caché (`drawImage` de un lienzo enorme) falla en silencio. Si el
lienzo «no tiene color» se activa `window._noTerrainCacheBlit` y el terreno pasa a
pintarse **celda a celda, cada fotograma**.

La muestra era `ctx.getImageData(0, 0, 160, 120)`: **la esquina superior izquierda**,
que es justo donde el motor pinta la tarjeta del objetivo y la guía rápida (y donde
el menú Dev pone sus paneles). Durante los primeros segundos de partida esa zona es
interfaz: 2-3 tonos. La comprobación salía «plana» casi siempre, y con una segunda
confirmación dejaba el juego en el camino caro de forma permanente.

| | terreno / fotograma | fotograma completo | FPS |
| --- | --- | --- | --- |
| Caché activa (lo normal) | **0,6-1,1 ms** (1 `drawImage` recortado) | 9-14 ms | 80-140 |
| `_noTerrainCacheBlit` activado por error | **20,7-50,7 ms** | 31-66 ms | **15-30** |

Consola del caso malo (una sola vez, fácil de pasar por alto):

```
[terreno] el lienzo sale de un solo color (3 tono/s)
[terreno] se desactiva el volcado de caché y se pinta por celdas
```

### 9.2 El arreglo

* `lienzoParecePlano()` muestrea **cinco puntos alrededor del CENTRO** del lienzo
  (siempre mundo, nunca interfaz) y suma los tonos de todos ellos. Sigue siendo
  barato (5 lecturas de 24×24 px) y sólo corre una vez, pasados 7 s del arranque.
* Hacen falta **dos confirmaciones seguidas** (separadas por una reconstrucción de la
  caché) para activar el modo celda a celda. Un fotograma raro (un cartel, una
  cinemática) ya no condena la sesión.
* La caída real (GPU que no puede volcar el lienzo grande) sigue detectándose: en ese
  caso la zona central también sale plana.

### 9.3 Otras cosas que se tocaron

* **Escaneo de interacción** (Entrar / Recoger / Hablar / Talar): recorre las ~1.500
  entidades cada 120 ms calculando `Math.hypot` de todas. Ahora se descarta con una
  caja de ±1,6 celdas (el alcance máximo de todos sus umbrales) antes de la raíz:
  del orden de 1.500 `hypot` a un puñado por escaneo. Comportamiento idéntico
  (verificado: «Recoger stone» junto a una piedra y «Recoger weed» junto a una mata).
* **Marcas de perfilado nuevas**: `sim` (tareas y AI de NPC + eco automático),
  `ui` (enemigos, niebla, minimapa y HUD de lienzo), `diag` (panel de estado DOM y
  HUD de rendimiento) y `filtro` (el pixelado de la sección 10). Todas son no-ops si
  `window._perfSections` está apagado.

### 9.4 Cómo comprobar que no ha vuelto

```js
const P = window.MESO_DEBUG.testDraw.perf;
window._noTerrainCacheBlit;        // debe ser false/undefined
window._terrainPlanoVeces;         // 0 si todo va bien
P.info().terreno;                  // repintados, msUltimo, edadMs
P.stats();                         // { fps, ms, ms95 }
```

---

## 10. Filtro de pixelado del mundo (`PIXELADO`)

El arte mezcla sprites de densidades muy distintas (píxeles de arte de 16, 24, 32…
y edificios a densidad 4 o 16): al lado de una casa dibujada «gorda» el resto parecía
de otra resolución. El mundo entero se baja a un búfer más pequeño y se vuelve a
subir **sin suavizado**, así que cada bloque queda uniforme y todo se lee como un
solo juego.

* **Cuándo**: justo cuando el mundo está terminado (después de la viñeta de noche y
  de la cola de textos diferidos) y **antes** de los textos del mundo y del HUD. Todo
  lo que se pinta después —nombres, bocadillos, avisos «E», marcadores de misión,
  aviso de acción, minimapa, barras de supervivencia, objetivo, diálogos, guía— sale
  nítido: es lo que hay que **leer**.
* **Cómo**: `drawImage` del lienzo a un búfer de `W/bloque × H/bloque` con suavizado
  (cada bloque promedia su zona) y vuelta al lienzo con `imageSmoothingEnabled = false`.
* **Intensidad (`mezcla`)**: si vale `1` se vuelca con `globalCompositeOperation = 'copy'`
  (el fotograma se reemplaza por el búfer). Si es menor (por defecto **0,85**) se vuelca
  con `'source-over'` y `globalAlpha = mezcla`, de modo que el mundo queda pixelado pero
  **conserva un 15 % del detalle original**: el pixelado se nota suave, no «plastificado».
* **Ajuste**: `PIXELADO.bloque = 2` (leve) · 3-4 más marcado. En caliente:
  `MESO_PIXELADO.bloque(3)`, `MESO_PIXELADO.mezcla(0.9)` (más suave, hasta `1` = total),
  o se apaga en **DEV ▸ «Pixelado suave»**. En el menú DEV hay además dos botones,
  **«Pixelado más leve» / «más fuerte»**, que mueven la mezcla en pasos de 0,1.
  La elección se guarda en `localStorage` (`meso.pixelado`, `meso.pixeladoBloque`,
  `meso.pixeladoMezcla`).
* **Coste medido**: **0,4-0,8 ms** por fotograma en un lienzo de 1260×840
  (sección `filtro` del perfilador).
* **Comprobación**: con el filtro, el **100 %** de los bloques 2×2 de la zona central
  del lienzo son de un solo color (sin filtro, el 83,9 %); los cambios horizontales
  de píxel bajan del 12,7 % al 7,6 %.

### 10.1 Los textos no se filtran (cola `textoMundo`)

Un texto pixelado deja de leerse, así que **nada que haya que leer pasa por el filtro**.
Como los nombres se pintan dentro del recorrido de entidades (mucho antes de que el
filtro exista), se **aparcan** en una cola y se ejecutan después:

```js
textoMundo(() => dibujarEtiquetaMundo(ctx, …));   // si el filtro está activo, se aplaza
```

* Se diferencia todo lo que se dibuja en el espacio del mundo con texto:
  **nombres** de jugador, aldeanos, mascotas (conejo, zorro) y lápidas, los **bocadillos
  «E»** del árbol/epitafio y los **textos flotantes** (daños, avisos).
* `render()` vuelca la cola con `dibujarColaTextoMundo()` **después** de
  `aplicarPixeladoMundo()`, junto con `dibujarTextosFlotantes()` (que se sacó del bloque
  de efectos por el mismo motivo), los indicadores de oclusión y los marcadores de misión.
  Todo eso se marca en la sección **`textos`** del perfilador (**0,6 ms** medidos).
* Con el filtro apagado `textoMundo()` ejecuta la función en el acto: el orden de pintado
  es exactamente el de antes, sin cola.
* `window._textosDiferidos` dice cuántos textos se aplazaron en el último fotograma
  (0 si el filtro está apagado). Es la comprobación barata y determinista de que la cola
  funciona, mucho más fiable que comparar píxeles sobre un mundo animado.

```js
MESO_PIXELADO.activar(false);   // ver el mundo sin filtrar (A/B)
MESO_PIXELADO.bloque(3);        // más marcado
MESO_PIXELADO.mezcla(0.95);     // pixelado más leve (1 = total)
window._pixeladoFrames;         // fotogramas filtrados
window._textosDiferidos;        // textos aplazados en el último fotograma
```

---

## 11. Segunda pasada (2026-10-09)

### 11.1 El bosque: se recorría la rejilla de píxeles de cada árbol, cada fotograma

`getRegisteredSpriteAspect(name)` saca la proporción del sprite recorriendo **todos
sus píxeles** para calcular la caja. Los recortes del PNG son enormes (`tree0_sup`:
**12.169 píxeles**) y la función se llamaba **por árbol y por fotograma** en el pase
del bosque: el resultado es siempre el mismo número.

Medido (lienzo 1260×840, zoom 1,5, mismo sitio):

| Zona | `arboles` antes | `arboles` después |
| --- | --- | --- |
| Bosque (mismo encuadre) | **9,02 ms** | **1,20 ms** |
| Zona sin bosque cercano | 3,57 ms | 0,34 ms |
| *Coste extra por estar en bosque* | *5,45 ms* | ***0,86 ms*** |

Arreglado con dos `WeakMap` (uno por imagen y otro por la matriz de píxeles): si el
sprite se vuelve a registrar, la clave es un objeto nuevo y se recalcula solo, así
que no hay que invalidar nada a mano. También se cachea la **caja de cada plantilla
de árbol** (`cajaDePlantilla`), que se recalculaba entera en `alturaArteArbol` y en
`drawTreeTemplateSway` para cada árbol.

### 11.2 La simulación de NPC se ejecutaba 60 veces por segundo

Las tareas y la AI de los NPC (paseo, huida, habla) vivían **dentro de `render()`**:
recorrían las ~1.500 entidades en cada fotograma. Cada NPC ya lleva su propio freno
interno (`shouldUpdateEntity`, 800-1.000 ms), así que el bucle sólo servía para
gastar 1,3-2 ms por fotograma.

Ahora ese bloque va **a ~5 Hz** (`_npcSimAt`, 200 ms). Medido: la sección `sim` baja
de 1,3-2 ms a 0,6-0,8 ms de media. Comprobado que los NPC siguen moviéndose (3/3
visibles cambiaron de posición) y que siguen hablando.

### 11.3 Archivos: `game-engine.js` empieza a adelgazar

Ver `docs/REFACTOR-MONOLITO.md`. En esta pasada salieron ~490 líneas a dos módulos
`game-engine-icons.js` y `game-engine-story-utils.js` (0 dependencias, movimiento
directo) y se añadió `tools/refactor-deps.mjs` para medir las dependencias **antes**
de mover nada. **Partir ficheros no cambia los FPS**; el rendimiento de esta pasada
es 11.1 y 11.2.

---

## 12. Tercera pasada (2026-10-09): el pixelado se afina y los textos se libran

El filtro de la sección 10 hacía su trabajo, pero quedaba **demasiado plano** (todo el
mundo igual de emborronado) y **se comía los textos**: los nombres sobre las cabezas y
los avisos «E» salían tan pixelados como la hierba. Dos cambios, ninguno de los cuales
cuesta rendimiento (al contrario):

| | Antes | Ahora |
| --- | --- | --- |
| Volcado del filtro | `globalCompositeOperation='copy'` (mundo sustituido) | `'source-over'` + `globalAlpha = 0,85` **si `mezcla < 1`** |
| Detalle del mundo tras el filtro | 0 % | **15 %** (mezcla por defecto 0,85) |
| Nombres, bocadillos, «E», daños | pixelados | **nítidos** (se pintan después del filtro) |
| Sección `filtro` del perfil | 0,7-0,8 ms | **0,4-0,8 ms** |
| Sección `textos` del perfil | — | **0,6 ms** |

1. **`mezcla`**: con `1` el volcado reemplaza el fotograma (`'copy'`); con valores
   menores se superpone con alfa, así que el mundo queda uniforme pero conserva
   detalle. Por defecto **0,85**, ajustable en caliente con `MESO_PIXELADO.mezcla(0.9)`
   (más suave) o desde el menú DEV (**«Pixelado más leve» / «más fuerte»**, pasos de
   0,1). Se guarda en `localStorage` (`meso.pixeladoMezcla`).
2. **Cola `textoMundo`**: los textos del mundo se dibujan dentro del recorrido de
   entidades, mucho antes de que exista el filtro, así que se **aparcan** en
   `_colaTextoMundo` y `render()` los vuelca con `dibujarColaTextoMundo()` justo
   después de `aplicarPixeladoMundo()`, junto con `dibujarTextosFlotantes()` (sacado
   del bloque de efectos por el mismo motivo), los indicadores de oclusión y los
   marcadores de misión. Con el filtro apagado el texto se dibuja en el acto, sin cola.
   Detalle en 10.1.

**Cómo comprobarlo sin fiarse de los píxeles**: `window._textosDiferidos` vale **> 0**
con el filtro encendido (2-3 en un fotograma normal) y **0** al apagarlo con
`MESO_PIXELADO.activar(false)`. Comparar recuadros de píxeles sobre un mundo animado
(NPC que caminan, cámara que se recoloca) da números contradictorios: no sirve.

---

## 13. LOS TIRONES: `getImageData` dentro del bucle de dibujado (2026-10-09)

Esta es la causa de los «tirones muy importantes» que se notaban jugando, y no tenía
nada que ver con cuánto costaba dibujar: el fotograma **medio** ya bajaba de 8-12 ms.
El problema era que cada 350 ms el juego se congelaba.

### 13.1 La causa, medida

`pintarAvisoDeAccion()` elige el color del texto del aviso (claro u oscuro) según lo
claro que sea el fondo, y para saberlo **leía los píxeles del lienzo**:

```js
const datos = ctx.getImageData(cx, cy, 75, 20).data;   // ← 350 ms, siempre
```

El lienzo del juego lo tiene la GPU. Leerlo obliga a **sincronizar** con la CPU, y en
este equipo cada lectura costaba entre **40 y 95 ms**. Medido con una sonda sobre
`Canvas2D.getImageData` durante 80 fotogramas:

| | Antes | Ahora |
| --- | --- | --- |
| Lecturas de píxeles por 80 fotogramas | 2 (75×20 cada una) | **0** |
| Tiempo en esas lecturas | **135,5 ms** (39,7 + 95,8) | **0 ms** |
| Peor fotograma de 60 | **97,7 ms** (`deferred` 85,6 ms) | **15,9 ms** (`deferred` 2,2 ms) |
| Segundo peor de 60 | **61,3 ms** (`deferred` 48 ms) | 15,9 ms |

O sea: el juego iba a 8 ms por fotograma y **tres veces por segundo** se paraba casi
un décimo de segundo. Eso es exactamente un tirón.

Chrome además avisaba por consola de que `getImageData` repetido quiere
`willReadFrequently`, pero ese atributo obliga a que TODO el canvas del juego sea
software, y se pinta miles de veces por fotograma: no compensa.

### 13.2 El arreglo

`luminanciaBajoElAviso()` ya no lee nada: calcula la luminancia del suelo **por datos**
(`luminanciaDeCelda()`: color del bioma de la celda del jugador, y un valor oscuro fijo
si hay un edificio, porque muros y tejados son oscuros en todas las épocas). Se sigue
suavizando el cambio de color para que al cruzar de celda no salte de golpe.

De paso, el vigilante del terreno (`lienzoParecePlano`, sección 9) hacía **cinco**
`getImageData` seguidos: ahora hace **una** lectura del rectángulo que cubre las cinco
muestras y mira dentro. Una sola sincronización en vez de cinco (medido: 208 ms → una
vez por partida, a los pocos segundos de cargar; antes eran ~5×).

**Regla que queda para el futuro**: `getImageData` NO se usa en el camino de dibujado.
Sólo lo usan herramientas de diagnóstico que corren una vez o a petición
(`lienzoParecePlano`, `cacheHash`, los editores de hojas).

### 13.3 Foto de cómo quedó

| Sección del perfil | Antes (peor fotograma) | Ahora (peor de 80) |
| --- | --- | --- |
| `deferred` (escaneo + aviso) | **85,6 ms** | 2,2 ms |
| `edificios` | 2,3 ms | 8,5 ms (una vez, caché fría) |
| `entidades` | 9,4 ms | 7,0 ms |
| `cola` | 8,5 ms | 2,2 ms |
| Fotograma | mediana 8,3 ms · peor **97,7 ms** | mediana **8,3 ms** · peor **15,9 ms** |

### 13.4 Lo que queda (medido, pendiente)

Midiendo de forma sintética (muchos `render()` seguidos, sin que el navegador
componga entre medias) siguen apareciendo picos aislados: de 250 fotogramas, 11 pasan
de 25 ms y **uno** llega a ~200-250 ms, casi siempre en la sección `cola` (árboles y
edificios diferidos) o en `ui`. Comprobado que **no son de este arreglo ni del
pixelado**: con el filtro apagado (mis colas no hacen nada) salen igual o peores, y el
montón de memoria se queda plano (177 MB, no es el recolector). Lo más probable es que
sean artefactos de medir en bucle cerrado: al dibujar cientos de fotogramas
seguidos, el compositor acaba bloqueando el hilo principal, y ese bloqueo cae dentro de
la sección que estuviera corriendo. En partida real (con el navegador compaginando a 60
fps) no se ha podido medir porque la pestaña de pruebas está oculta y `rAF` se congela.
Si vuelven a notarse tirones, el siguiente sitio donde mirar es la construcción
perezosa de cachés de `cola` (`drawTreeTemplateSway`, `dibujarArbolArteDirecto`,
`drawBuilding`).

---

## 14. Cuarta pasada (2026-10-09): los personajes tampoco se filtran

El pixelado se quedaba con el jugador, los aldeanos, el perro y los conejos. Son los
sprites de más densidad del juego y el jugador es justo lo que hay que distinguir
siempre, así que ahora van aparte, igual que los textos:

* **`spriteSinFiltro(z, fn)`** — segunda cola (`_colaSpriteSinFiltro`), con la clave de
  **profundidad** de cada sprite, así que al vaciarla se respeta el orden entre ellos
  (un aldeano que va delante del jugador lo sigue tapando).
* **`render()`**: `filtro` → `sprites` (`dibujarColaSpritesSinFiltro()` + re-pintado de
  las tapas) → `textos`. Sección nueva `sprites` en el perfilador: **0,55 ms**.
* Van a la cola: `drawPlayer()` (con el caballo, la ropa y la herramienta), el sprite de
  los aldeanos (con la armadura del guardia y la caña del pescador), el perro y los
  conejos, con sus sombras. Los **cadáveres** y los **zorros** siguen filtrándose.
* Contadores para comprobarlo: `window._spritesDiferidos` y
  `window._tapasRepintadas` (también en `testDraw.perf.info().pixelado`).

### 14.1 La oclusión sigue funcionando: `_ocluirTrasSprites`

Como el jugador se pinta **después** de los árboles que tiene delante, sin más cambios
se le vería **subido a las copas** (flotando sobre el bosque) y el puntero dorado de
oclusión aparecería sin motivo. Mientras se pinta la cola diferida se apunta qué
cacharro de delante toca la caja del jugador y, en cuanto se ha pintado el sprite
nítido, se **vuelven a pintar encima** (`redibujarTapasDelJugador()` →
`redibujarElementoDeCola()`). La oclusión queda exactamente igual que siempre.

Los **edificios NO se re-pintan**: ellos ya tienen su «círculo de rescate»
(`drawOccludedReveals`, translúcido a través del muro) y re-pintar el edificio encima lo
taparía, dejando al jugador invisible otra vez.

### 14.2 Y el pixelado, un poco más leve

`PIXELADO.mezcla` pasa de **0,85 a 0,9**: el mundo conserva un **10 %** del detalle
original en vez de un 15 %. Se ajusta en **DEV ▸ «Pixelado más leve» / «más fuerte»**
(pasos de 0,1) o con `MESO_PIXELADO.mezcla(0.95)`.

