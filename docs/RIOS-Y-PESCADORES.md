# RÍOS Y PESCADORES

## 1. Una sola verdad para el río

**El problema (informado con dos capturas).** En el mapa cenital (tecla **M**) se
veían los dos ríos azules, pero en el mundo no aparecía agua: el cartel vertical
«RÍO DON» salía en mitad del desierto y al pasar el ratón por cualquier celda de
esa banda el tooltip decía «Río Don · +25 % producción». No había forma de
correlacionar lo que se veía con el mapa.

Eran **tres verdades distintas para el mismo río**:

| Sitio | Qué usaba | Consecuencia |
| --- | --- | --- |
| Mapa cenital (`getWorldMapBiomeColor`) | `isRiver(col, fila)` → mapa de meandros real | Correcto |
| Cartel «RÍO DON» del mundo | columna **fija** `RIVER_A_BASE = 42` (y 132), siempre en `H/2` | El cartel aparecía aunque el cauce estuviera a 12 celdas de ahí |
| Tooltip y bonus `+25 %` | `isRiver(col)` / `isNearRiver(col)` (sin fila) | Decía «río» en **toda la banda** del meandro |

### Arreglos

* **El cartel va sobre el agua real**: `riverLabelAnchor(base, …)` recorre las
  filas visibles buscando la franja de celdas de `_RIVER_FULL_MAP` más cercana a
  la columna nominal del cauce, y sólo la rotula si queda a menos de 34 celdas.
  Si ese río no está a la vista, **no se pinta nada** (antes se pintaba siempre).
  La posición se resuelve con `screenTileCenter` (en iso el rombo cuelga del
  vértice, así que el centro está en `y + h/2`).
* **Tooltip y bonus `+25 %` con fila**: `isRiver(col, row)` y
  `isNearRiver(col, row)`, de modo que sólo salen junto al agua. Ojo: el tooltip
  comprueba `grid` antes de pintar el cartel del río, para no tapar un puente.
* **Producción con fila**: `applyDailyProduction` y `updateProduction` usan
  `isNearRiver(c, r)`; antes cualquier edificio de la banda del meandro cobraba
  el bonus del río.
* El nombre del río por época sigue saliendo de `_RIVERS` (los dos cauces
  guardados en la partida), no de las constantes.

### Verificación (partida de prueba)

Cauce tallado a mano en las columnas 38–44 sobre el mapa de arena del editor:

* `#gameCanvas` 968×727 → **240 269 píxeles azules** en una banda vertical
  `x = 345…679` (el agua se pinta bien; el fallo era de «correlación», no de
  render).
* `riverLabel(42)` → `{col: 41, row: 60}` (sobre el agua) y
  `riverLabel(132)` → `null` (ese cauce no está a la vista).
* Captura con zoom 2.5: banda azul, cartel «RÍO DON» encima del agua, un pescador
  sentado en la orilla con la caña y el jugador al lado.

## 2. Pescadores de la orilla

Gente del río repartida por el mundo: `spawnFishermenInBand(r0, r1, c0, c1)` en
`engine/game-engine.js`, llamada al generar el mapa inicial (bloque **10b**) y en
cada banda nueva desde `worldGenerateBand`.

* **Baja frecuencia y estable**: un hash de la fila y del cauce (`fisherRoll`)
  decide si hay pescador; sólo **~8 % de las filas** de río llevan uno. Al ampliar
  el mundo la misma fila toma la misma decisión, así que no salen racimos ni
  duplicados (y no usa `Math.random`, que rompería esa estabilidad).
* Sólo en la **orilla seca** (`isWaterPaintCell` = false): nunca en el agua, ni
  sobre una calzada (`road`, `concrete_road`, `canal_road`), ni a menos de 10
  celdas del jugador.
* Son NPC de verdad (`npcType: 'fisher'`, con frases propias en
  `data/npc-dialogues.json`), **sentados** (`_pose: 'sit'`) y de cara al cauce.
  Con `_keepPost` no se van andando como los aldeanos.
* `drawFisherKit` pinta la caña, el sedal y el corcho (que se mece) **encima** del
  sprite, apuntando al agua.

### Prueba

```js
MESO_DEBUG.testDraw.fishers.list()             // censo (id, nombre, col, fila, dir)
MESO_DEBUG.testDraw.fishers.spawnBand(0,120,0,180)
MESO_DEBUG.testDraw.fishers.spawn(46, 62)      // uno a mano
MESO_DEBUG.testDraw.riverLabel(42)             // dónde se rotularía el cauce A
MESO_DEBUG.testDraw.waterAt(41, 60)            // ¿hay agua en esa celda?
```

Medición real: 9 pescadores en un mundo 180×120 (dos cauces, 120 filas) y todos
en la orilla (columnas 45/46, 29, 119, 129, 134, 145 según el meandro de su fila).
