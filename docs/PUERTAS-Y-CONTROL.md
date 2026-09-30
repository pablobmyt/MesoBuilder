# Puertas de muralla y control de paso — MesoBuilder

> Añadido: 2026-09-29
> Código: `engine/game-engine.js` (§ «PUERTAS DE MURALLA Y CONTROL DE PASO»),
> `engine/character-art.js` (armadura), `engine/game-engine-settlement-utils.js`
> (puertas alineadas con las avenidas), `engine/entities.js` (puesto fijo).
> Doc relacionada: `docs/ESTRUCTURAS.md`, `docs/MODO-DEBUG.md`.

## 1. El problema

La muralla de un asentamiento se levanta **antes** que buena parte del viario:

1. `applySettlementPlan` coloca muros, torres y las puertas del plan (**4** en la
   capital, 1 en la base militar).
2. Después se siguen abriendo caminos: vías entre asentamientos
   (`carveRoadPath`), el ramal del embarcadero y los corredores logísticos
   soviéticos. Esos caminos **sólo pintan bioma** (`tileBiome = 'road'`), no
   miran los edificios que ya hay debajo.

Resultado: el camino sigue a los dos lados de la muralla, pero en medio queda una
celda de `wall_segment` que **se dibuja encima de la calzada** y la bloquea. Se ve
como una columna de muro cruzando un camino.

## 2. Qué hace ahora el motor

Al final de `generateMap` (y también al cargar partida) corre
`openWallGatesForRoads()`:

1. **Busca cruces**: celdas de muralla (`wall_segment`, `wall_tower`) con
   **calzada a los dos lados en perpendicular**. Un camino que corre *paralelo* a
   la muralla no abre nada (es lo que evita agujerear el lienzo entero).
2. **Abre el vano**: dos celdas a lo largo del lienzo (el sprite del arco es 2×1 y
   el de la puerta lateral 1×2). Si el cruce cae en una **torre**, se abre la
   torre entera (su huella 2×2) y queda un vano limpio.
3. **Pone el arco**: entidad **ambiental pasable** (`mesopotamian_arch` o
   `mesopotamian_gate_v`), nunca un edificio: un edificio bloquearía el paso.
   En la URSS no se pone arco mesopotámico (misma regla que las puertas del
   planificador): el vano queda abierto y el control lo marcan garitas y
   soldados.
4. **Monta el control de paso** (`garrisonGate`): dos garitas (`guard_booth`) a
   los lados del camino y **dos soldados con armadura** patrullando a través del
   vano.
5. **Refuerza las puertas que ya existían**: los arcos del planificador estaban
   sin guarnición; ahora también reciben garitas y soldados.

Es **idempotente**: los vanos que ya están abiertos (partida guardada) no se
vuelven a tocar, y una celda ya abierta en la misma pasada hace que los cruces
vecinos no abran vanos pegados (una calzada de 3 celdas generaba 3 arcos
seguidos).

## 3. Soldados: armadura sobre el sprite del personaje

El sprite del personaje es **único por época** (24×24) y la ropa no cambia el
dibujo, así que la armadura no es otra rejilla: se pinta **encima**, en las
mismas coordenadas de arte (`drawSoldierKit`, `engine/character-art.js`).

La silueta se **deduce del propio sprite**: se clasifican sus píxeles en piel,
pelo y ropa y la armadura sólo se pinta donde hay cuerpo.

| Pieza | Regla |
|---|---|
| Casco | desde la primera fila de pelo hasta la fila justo encima de los ojos (`faceTop - 1`), así la cara queda a la vista |
| Guardas de mejilla | dos filas por debajo del borde, sólo en las columnas laterales |
| Penacho/estrella | sobre la frente, en el color de acento |
| Coraza | sobre los píxeles de ROPA del torso (hasta 5 filas), con cinto más oscuro |
| Hombreras | una celda a cada lado, en las dos primeras filas de la coraza |
| Arma | lanza (Mesopotamia) o fusil (URSS) en la columna libre junto al cuerpo |

Material por época (`KIT_COLORS`): bronce `#C08A3E` con penacho rojo en
Mesopotamia; acero `#8A93A0` con estrella roja en la URSS. Los colores de debajo
(piel, pelo, ropa) salen de `GATE_GUARD_PALETTES`.

## 4. Control militar y aduanero

- Los soldados son NPCs con `npcType: 'gate_guard'`, `armored: true` y
  `isGateGuard: true`. Su `_gateId` los ata a la puerta.
- Llevan **ronda** (`setNpcPatrol`, dos puntos) que **cruza la línea del muro**:
  es lo que hace visible el control. `_keepPost` evita que el paseo aleatorio del
  pueblo los mande a otra parte.
- Al acercarse por primera vez, un guardia da el **alto** (texto flotante) y se
  gira hacia el jugador (`updateGateGuards`, cada 700 ms).
- Al hablar con él (**E**), el guardia **registra la carga**: madera, piedra y
  grano del inventario. La primera vez hace el registro completo; después, paso
  franco. El diálogo sale de `gateGuardDialogueLines()`.
- `npcType: 'gate_guard'` no está en la lista de misiones secundarias, así que no
  ofrecen encargos (a diferencia del `guard` normal).

## 5. Puertas alineadas con las avenidas (planificador)

Las puertas de la plantilla llevan una posición «a ojo» (`at: 9`, `at: -10`…). Si
esa columna/fila no es una avenida real, la calle muere contra el lienzo.
`snapGatesToStreets()` (en `game-engine-settlement-utils.js`) desplaza cada
puerta a la **avenida libre más cercana** (columna o fila que cruza todo el
asentamiento) antes de construir la muralla y las garitas.

## 6. Cómo comprobarlo

En consola (o en el panel F9 ▸ Dev):

```js
MESO_DEBUG.testDraw.gates.list();        // vanos abiertos (id, celda, orientación)
MESO_DEBUG.testDraw.gates.guards();      // soldados: armadura, puerta y ronda
MESO_DEBUG.testDraw.gates.open();        // fuerza otra pasada (idempotente)
MESO_DEBUG.testDraw.gates.roadAt(c, r);  // ¿hay calzada en esa celda?
MESO_DEBUG.testDraw.soldierKit('urss');  // dibuja personaje+armadura y cuenta píxeles
```

Comprobaciones útiles tras generar un mapa:

1. `gates.list()` no debe tener dos vanos con celdas repetidas.
2. Ninguna celda de un vano debe seguir teniendo edificio (`getGrid()`).
3. `guards()` debe devolver el doble de soldados que de puertas, todos con
   `armored: true` y `patrol: 2`.

## 7. Trampas aprendidas

- El arco **no puede ser un edificio**: `isFree` de 2×1 sobre un vano de 2 celdas
  falla y la puerta desaparece (ya pasó con las puertas del planificador).
- `carveRoadPath` pinta el bioma **sin mirar el grid**: cualquier camino nuevo
  puede volver a cruzar una muralla, por eso la pasada va al final del mapa.
- `wall_segment` se coloca **celda a celda** (`baseCol = c`), pero una pieza de
  estructura puede tener otra base: para abrir el vano se pone `grid[r][c] = null`
  en vez de fiarse de `clearBuildingCells`.
- La torre 2×2 se cruza con el camino a **dos** celdas de su centro, no a una.
- La pasada debe correr **después** de restaurar las entidades al cargar partida;
  si corre antes, monta guarnición duplicada.
