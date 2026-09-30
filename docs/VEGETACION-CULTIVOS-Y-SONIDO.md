# VEGETACIÓN, CULTIVOS Y SONIDO

## 1. El minimapa no aparecía

`drawMiniMap` tenía **tres candados** que lo dejaban casi siempre fuera:

| Candado | Por qué fallaba |
| --- | --- |
| `hudOn('mapa')` | Sólo se despertaba **9 s** al empezar la partida (`despertarHud('mapa', 9000)`) y mientras la entrada del jugador mantenía despierto el HUD: aparecía y desaparecía |
| `window._hudVisible` | Si aún no se había inicializado (`undefined`), el minimapa no se pintaba |
| `!editMode` | Jugando con el inspector de depuración abierto tampoco salía |

Ahora el minimapa es **fijo**: se pinta siempre que la partida esté en marcha
(no en cines ni con el mapa cenital abierto), con `hudVisibleAhora()` —que trata
`undefined` como visible— y sin depender de `editMode`. Además:

* Usa **los mismos colores que el mapa cenital** (`getWorldMapBiomeColor`): antes
  cada uno tenía su paleta y el mismo mundo parecía otro sitio.
* Las parcelas labradas salen en verde claro en el minimapa.
* Lleva el pie «M · mapa grande» para que se sepa que con **M** se abre el mapa
  cenital a lo grande.

## 2. Más vegetación y más tierra cultivable

* **Bioma nuevo: `grass` (praderas).** El generador no producía hierba verde en
  Mesopotamia: todo lo que no era bosque/humedal caía en `alluvial`, `steppe` o
  `saline`, así que el mundo se veía mustio y había poca tierra buena. Con el
  nuevo escalón (`grassThreshold`) la franja húmeda intermedia es pradera.
* **Más humedad junto al río**: `moistNoiseMix` 0.58 → 0.50 y `rivMoist` 6 → 8.5.
  El valle del río es mucho más ancho.
* **Reparto medido** (180×120, perfil Mesopotamia):

  | | antes | ahora |
  | --- | --- | --- |
  | grass | 0 % | 9-13 % |
  | forest | ~3 % | 9-12 % |
  | marsh | ~1 % | 4-8 % |
  | water (ríos) | — | 5,5-5,8 % |
  | riparian | ~2 % | 2,2 % |
  | steppe+saline+alluvial | ~95 % | 55-63 % |

* **Vegetación más densa**: ripario 0,40 → 0,50; humedal 0,28 → 0,32; pradera
  (nueva) 0,26; aluvial 0,11 → 0,15; estepa 0,07 → 0,10; colinas 0,09 → 0,12.
* **Semillas**: los hierbajos son la única fuente de semillas y **1 semilla = 1
  parcela**, así que con 350 hierbajos el cultivo se agotaba enseguida. Ahora son
  **1.100** (y también nacen en las praderas). Al cosechar se devuelve **siempre**
  una semilla (dos si la parcela está junto al agua), así que el campo es
  sostenible sin depender del azar.

## 3. Parcela sembrada y crecimiento a la vista

* **Fase 0 = «Semillas»**: antes era un brote casi idéntico al hierbajo. Ahora es
  un **terrón de tierra volteada con los granos a la vista** y dos briznas
  asomando (10×7 px: 21 px de tierra en tres tonos, 9 de semilla en dos tonos y 3
  verdes). Se dibuja a 0,92 del ancho de la casilla, así que se ve bien.
* **Las fases crecen solas con el tiempo**: además del avance diario (una fase por
  día, `advanceCrops`), cada parcela lleva su propio reloj: **una fase cada 50 s**
  (**30 s** junto al agua), con un tick de 1 s. Cada avance suena (`grow`) y al
  madurar sale «Trigo maduro» sobre la parcela.
* Fases: `Semillas → Tallos → Espigando → Maduro` (`WHEAT_STAGE_NAMES`).

```js
MESO_DEBUG.testDraw.crops.tick(55)   // avanza 55 s de reloj de cultivo
MESO_DEBUG.testDraw.crops.list()     // fase y segundos de cada parcela
MESO_DEBUG.testDraw.crops.name(0)    // "Semillas"
```

## 4. Sonido: TODO cubierto (y un fallo grave de volumen)

**El juego estaba MUDO de fábrica.** En `index.html`,
`clampPercent(localStorage.getItem('meso.audio.master'), 70)` devolvía **0**,
porque `Number(null) === 0`; al aplicarlo, `masterNorm = 0` y
`SoundManager.setMuted(true)`: **ningún efecto sonaba nunca**, con la barra de
volumen a cero. Arreglado con un guardia de `null`/`''`/`undefined` (ahora
arranca en 70 %).

**Catálogo: 82 efectos sintetizados** en `engine/sound-manager.js` con Web Audio
(osciladores + ruido filtrado + envolventes), sin descargar ni un fichero. Cada
efecto es una receta de pasos:

```js
['t', freq, dur, tipo, vol, glide]        // tono con envolvente y glissando
['n', dur, vol, filtro, q, , tipoFiltro]  // ruido filtrado (golpes, pasos, agua)
```

y un `min` que evita el metralleo cuando un suceso se dispara en cascada.

* **Interfaz**: `click`, `clickSoft`, `hover`, `open`, `close`, `tab`, `toggle`,
  `error`, `deny`, `notify`, `notifyBad`, `log`, `turn`.
* **Mundo**: `build`, `buildComplete`, `demolish`, `hammer`, `door`, `gate`.
* **Agricultura**: `till`, `plant`, `water`, `grow`, `harvest`, `seed`.
* **Objetos**: `pickup`, `coin`, `equip`, `chest`, `drop`.
* **Combate**: `hit`, `hitFlesh`, `hitTree`, `hitStone`, `damage`, `wound`,
  `death`, `heal`, `bandage`, `gunshot`, `gunreload`, `gunjam`.
* **Progreso**: `xp`, `levelUp`, `missionStart`, `missionComplete`, `missionFail`,
  `quest`.
* **Pasos según el suelo**: `step_grass`, `step_sand`, `step_stone`, `step_wood`,
  `footstep` (y `swim` en el agua).
* **Animales**: `mount`, `dismount`, `whinny`, `dogBark`, `dogPet`, `sheep`,
  `chicken`, `bird`.
* **Vida diaria**: `eat`, `drink`, `sleep`, `wake`, `dayChange`, `night`.
* **Mundo**: `chop`, `mine`, `splash`, `swim`, `wind`, `rain`, `fire`.
* **Estado**: `hunger`, `thirst`, `stamina`, `heart`, `save`, `load`, `pause`,
  `unpause`.

### Dónde está enganchado

* **Un único listener delegado** en `document` (fase de captura) cubre **todos los
  botones** del juego, incluidos los que se crean luego (paneles de acciones,
  misiones, diálogos, crafteo): no hay que tocar cada `addEventListener`. Decide
  entre `open`/`close`/`toggle`/`tab`/`click` por id, clase y texto del botón, y
  hay `hover` suave con freno.
* Llamadas explícitas en: `notify` (aviso normal o `notifyBad` si el texto dice
  que algo falla), `addToInventory` (`pickup`/`seed`), `plantCropAt`,
  `harvestCropAt`, `tillFieldRect` (`till`/`deny`), `setBuildingCells` (`build`),
  `clearBuildingCells` (`demolish`), `craftItem`, `gainXP` (subida de nivel),
  `applyPlayerWound`, `healWounds`, `mountHorse`, `dismountHorse`,
  `interactWithPetDog`, `startMission`, `completeMission`, `endTurn` y los pasos
  del jugador.
* Los sonidos de obra **no** suenan al generar el mapa ni dentro de
  `beginBulkBuild()` (cientos de celdas de golpe): sólo con `window._gameStarted`
  y fuera de los bloques masivos.

### Prueba

```js
MESO_DEBUG.testDraw.sounds.catalog()      // los 82 nombres
MESO_DEBUG.testDraw.sounds.play('harvest')
MESO_DEBUG.testDraw.sounds.volume(0.7)    // o sin argumento: consulta
MESO_DEBUG.testDraw.sounds.mute(false)
MESO_DEBUG.testDraw.sounds.enabled(true)
```
