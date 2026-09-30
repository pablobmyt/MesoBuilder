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
