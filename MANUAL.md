# MesoBuilder — Manual de desarrollo y diseño

> Documento vivo. Se actualiza con cada cambio relevante.
> Última actualización: 2026-09-28

---

## Índice

1. [Visión del proyecto](#1-visión-del-proyecto)
2. [Arquitectura técnica](#2-arquitectura-técnica)
3. [Controles del jugador](#3-controles-del-jugador)
4. [Sistemas de juego](#4-sistemas-de-juego)
5. [Generación del mundo](#5-generación-del-mundo)
6. [Personajes y NPCs](#6-personajes-y-npcs)
7. [Historia principal](#7-historia-principal)
8. [Renderizado y cámara](#8-renderizado-y-cámara)
9. [Changelog de desarrollo](#9-changelog-de-desarrollo)

### Documentación relacionada

* [`docs/MODO-DEBUG.md`](docs/MODO-DEBUG.md) — inspector visual (F9): mover sprites, ajustar escalas/offsets en vivo, colocar sprites de prueba, exportar ajustes.
* [`docs/ESTRUCTURAS.md`](docs/ESTRUCTURAS.md) — conjuntos de edificios preparados: formato, catálogo incluido, editor visual y cómo crear los tuyos.
* [`docs/AUDITORIA.md`](docs/AUDITORIA.md) — auditoría técnica del 2026-09-25: averías corregidas y problemas pendientes con evidencia.
* [`docs/RENDERIZADO-PIXEL.md`](docs/RENDERIZADO-PIXEL.md) — notas de renderizado pixel-art.

---

## 1. Visión del proyecto

**MesoBuilder** es un juego de exploración y supervivencia ambientado en la Mesopotamia (~2350 a.C.), con elementos de rol y narrativa sencilla. El jugador encarna a **Adapa**, un superviviente cuya aldea fue destruida, que debe cruzar el mundo antiguo para llevar un aviso urgente: el gran diluvio se acerca.

### Pilares de diseño

| Pilar | Descripción |
|---|---|
| **Exploración** | Mundo generado proceduralmente con biomas, ríos y ciudades |
| **Supervivencia** | Hambre, sed, stamina, HP con regen pasivo |
| **Narrativa** | Historia principal con NPCs de historia y diálogos cinemáticos |
| **Ambiente** | Ciclo día/noche, clima, iluminación con torch vignette |

---

## 2. Arquitectura técnica

### Ficheros principales

| Fichero | Responsabilidad |
|---|---|
| `engine/game-engine.js` | Motor principal: renderizado, input, lógica de juego, generación de mapa, UI (18,5 k líneas) |
| `engine/entities.js` | Definición y helpers de entidades: árboles, recursos, conejos, zorros, NPCs. Publica las colecciones en `window.entities/rabbits/foxes/graves` |
| `engine/game-engine-debug-utils.js` | **Modo Debug / Inspector visual (F9)**: seleccionar, mover y ajustar sprites y edificios en vivo, colocar sprites de prueba y **auditar el mapa** (`auditMap`, `mapSnapshot`) |
| `engine/game-engine-settlement-utils.js` | **Planificador de asentamientos**: genera el trazado (manzanas por distrito, viario, muralla, puertas y mobiliario) de capitales, bases y aldeas como datos; `spawnVillage` los aplica |
| `engine/game-engine-*-utils.js` | Subsistemas ya extraídos del motor: `bootstrap`, `entity-def`, `map-editor-core`, `preload`, `selection`, `sprite-runtime`, `standalone-editor`, `debug` |
| `engine/scene-manager.js` | Índice espacial (usa `window.entities`, no una copia propia) |
| `engine/sound-manager.js` | Audio (Web Audio API) con beeps de reserva |
| `engine/atlas-builder.js`, `engine/event-manager.js` | Atlas de árboles y eventos de juego |
| `engine/renderer.js`, `engine/map.js`, `engine/ui.js`, `engine/input.js`, `engine/death-system.js` | ⚠️ **Placeholders vacíos / stubs que sólo hacen `console.warn`** (nadie los importa; la implementación real está en `game-engine.js`). No los uses como si existieran |
| `data/entities-defs.json` | Definiciones de entidades (tipos, costes de construcción) |
| `data/entity-pixels.json` | Sprites pixel-art (79 claves: naturaleza, edificios, objetos, mobiliario interior) |
| `data/npc-dialogues.json` | Frases genéricas por tipo de NPC |
| `data/interiors/` | Mapas de interior por tipo de edificio |
| `data/sprite-adjustments.json` | *(opcional)* Ajustes visuales exportados desde el modo debug |
| `scripts/dev-server.js` | Servidor estático para probar en navegador (`?debug=1`, `?editor=1`) |

### Constantes importantes

```js
TILE = 32          // px base por celda
COLS = ?           // número de columnas del mapa (dinámico)
ROWS = ?           // número de filas
ZOOM_MIN = 0.08    // zoom mínimo (vista cenital)
ZOOM_MAX = 2.5     // zoom máximo (muy cerca)
DAY_SECONDS = 120  // 1 día de juego = 2 minutos reales
```

### Modos de vista

- **`ortho`** (por defecto): proyección ortogonal top-down
- **`iso`**: proyección isométrica diamante (`projectIso`)

---

## 3. Controles del jugador

### Movimiento

| Tecla | Acción |
|---|---|
| `W / ↑` | Mover arriba |
| `S / ↓` | Mover abajo |
| `A / ←` | Mover izquierda |
| `D / →` | Mover derecha |
| `Shift` (mantener) | Sprint (consume stamina) |

### Cámara y mapa

| Tecla | Acción |
|---|---|
| `T` (o `L`) | Alternar **cámara libre** / **cámara de seguimiento del jugador** |
| `M` | Abrir/cerrar mapa cenital (world map overlay) |
| `Scroll ratón` | Zoom in/out |
| `Espacio` | Pausar / reanudar el tiempo de juego |

El botón **Ir a jugador** del panel lateral hace lo mismo (centra y alterna el
seguimiento) y su etiqueta indica el estado: *Seguir: ON*.

### Construir (sólo en modo edición)

| Tecla | Edificio |
|---|---|
| `H` | Casa |
| `V` | Villa mesopotámica |
| `F` | Granja |
| `Y` | Templo |
| `K` | Mercado |
| `G` | Granero |
| `Z` | Zigurat |
| `D` | Demoler |

> La `T` está reservada para la cámara desde 2026-09-25; el Templo pasó a `Y`.
> El resumen de atajos que se registra en el diario al empezar partida se genera
> automáticamente a partir de esta tabla.

### Control de velocidad de tiempo

Widget permanente en la esquina inferior derecha (encima del mini-mapa):

| Botón | Efecto |
|---|---|
| ⏸ | Pausa completa (tiempo detenido, jugador inmóvil) |
| ½× | Cámara lenta |
| 1× | Velocidad normal |
| 2× | Tiempo × 2 |
| 4× | Tiempo × 4 |

Atajo de teclado: **Espacio** alterna entre pausa y velocidad actual. El botón activo se resalta en dorado. Cuando el juego está en pausa aparece un indicador parpadeante "⏸ PAUSA" en el centro superior de la pantalla; con velocidades distintas de 1× se muestra "N×".

### Menú superior (Ver / Ventanas / Partida / Dev / Ajustes)

La barra de menús está **oculta por defecto** (para no tapar la barra de estadísticas) y tiene tres formas de abrirse:

| Vía | Cómo |
|---|---|
| Pestaña | **☰ MENÚ** en el centro del borde superior: se abre al pasar el ratón y se **fija** con un clic |
| Borde superior | Llevar el ratón a los primeros 8 px de la ventana |
| Teclado | **F10** abre y cierra (fija/suelta) |

Con la barra abierta:

| Control | Acción |
|---|---|
| 📌 Fijar / 📌 Fijado | Mantiene la barra visible (no se oculta al bajar el ratón) |
| ▴ Ocultar | Cierra la barra y suelta el fijado |
| `Esc` | Cierra los menús, suelta el fijado y oculta la barra |

> Mientras la barra está **fijada** tapa la barra de estadísticas superior (Turno / Siguiente Turno). Púlsala de nuevo, `F10` o `Esc` para soltarla.

### Interacción

| Tecla | Acción |
|---|---|
| `E` | Interactuar (recoger, entrar, hablar con NPC, avanzar diálogo) |
| `I` | Abrir/cerrar inventario |
| `G` | Enviar NPCs seleccionados a recoger |
| `H` | Mantener posición (NPCs seleccionados) |
| `R` | Reagrupar NPCs cerca del jugador |
| `Escape` | Limpiar selección / cerrar mapa cenital / **cancelar el trazo en curso** |
| `Enter` | Abrir/cerrar guía de juego |
| `Ctrl` (mantenido) | **Modo sigilo**: agachado y, junto a una tapia o caja, arrimado a la cobertura |
| `Ctrl` + clic | Ir a la cobertura más cercana al punto pulsado (si no hay tapia, sigues seleccionando) |
| `U` | **Visión de enemigos**: 2 s con el juego en blanco y negro (a 0,25 de tiempo, con difuminado) y los conos de visión de los enemigos en rojo. Cooldown de 10 s. *Es la única forma de ver el rango de visión: en partida normal no se dibuja.* |
| `F1` | **Guía del juego**: el manual y TODOS los documentos del proyecto dentro del juego, con buscador (también está en el botón **Guía (F1)** del menú de arriba). `Esc` la cierra. Ver `docs/GUIA-EN-EL-JUEGO.md` |
| Clic + arrastrar | **Trazar**: lanzas lo que lleves en la mano; con `Alt`, la ruta del perro (modo ataque) |

> El detalle del sigilo (conos de visión —tecla `U`—, medidor de sospecha,
> alarma, la zona y su misión) está en `docs/SIGILO.md`.
>
> **Sólo te atacan si haces algo.** Que un guardia te vea no basta: sólo se gira
> hacia ti. Se te echan encima si estás buscado (has disparado o agredido a
> alguien), si ese PNJ ya era hostil o si es un enemigo de la historia. La ciudad
> se calma sola unos segundos después del último aviso. La zona vigilada del
> almacén sólo da alarma **mientras la misión de sigilo está aceptada**.

### Muerte, cadáveres y esqueletos

Cuando alguien muere deja un **cuerpo que se descompone** (fresco →
descomponiéndose → huesos → esqueleto) y al final se queda un **esqueleto** que
permanece en el mundo. Si la muerte ocurre **dentro de una estructura** no hay
descomposición: se levanta la **tumba**. Detalle en `docs/CADAVERES.md`.

Los cuerpos se pueden **saquear** con `E` cuando estás a su lado (el aviso dice
`Saquear`; no pone «Hablar», porque un muerto no habla). El botín depende de
quién era, y cuanto más podrido esté el cuerpo más riesgo hay de **contagiarte**:
la infección te quita vida durante 45 s y se corta con la habilidad **Curar**
(tecla 3) — mientras dura, el HUD de supervivencia enseña una cuarta fila con los
segundos que quedan.

---

## 4. Sistemas de juego

### 4.1 Estadísticas de supervivencia

Todas las stats están en el objeto `char` (alias del `player`).

| Stat | Rango | Comportamiento |
|---|---|---|
| `char.hp` | 0–`char.maxHp` | Regen pasivo ~4 min después de 5s sin recibir daño |
| `char.hunger` | 0–100 | Decrece con el tiempo; ≤0 causa daño |
| `char.thirst` | 0–100 | Decrece más rápido que el hambre |
| `player.stamina` | 0–100 | Se consume con sprint (22/s); regen en reposo (12/s) |

**`player._staminaCooldown`**: cuando la stamina llega a 0, se activa este flag hasta que alcanza el 20% de nuevo.

**`char._lastHitTime`**: timestamp del último daño recibido. Se usa para el timer de regen de HP y para el flash de pantalla.

**`char._flashUntil`**: timestamp hasta el cual se dibuja el overlay rojo de daño recibido en `drawPlayerHealth()`.

### 4.2 Sprint

El sprint requiere `keyState['Shift']`, `player.stamina > 0` y `!player._staminaCooldown`. Aplica un multiplicador `×1.6` a la velocidad de movimiento en los tres ejes (X, Y diagonal, Y recto).

### 4.3 Combate con enemigos

Los enemigos persiguen al jugador. Cuando están a ≤0.9 tiles hacen daño con cooldown de 1200 ms:

```
char.hp -= dmg
char._lastHitTime = now
char._flashUntil = now + 280
spawnFloatingText('-N', rojo, force:true)
```

---

## 5. Generación del mundo

### 5.1 Biomas

Los biomas se asignan por celda en `tileBiome[row][col]`:

| Bioma | Visual | Flora típica |
|---|---|---|
| `alluvial` | tierra fértil | barley, typha |
| `steppe` | tierra seca | steppe_shrub |
| `forest` | verde oscuro | gallery_tree |
| `water` | azul | — |
| `mountain` | gris oscuro | — |
| `road` | ocre | — |

### 5.2 Tipos de pueblos

La función `spawnVillage(baseCol, baseRow, opts)` genera pueblos según `opts.villageType`:

| Tipo | Descripción | Estructura | NPCs |
|---|---|---|---|
| `origin` | Aldea inicial destruida | Racimo pequeño (trazado clásico) | Elder (story), 1-2 supervivientes |
| `village` | Pueblo común | Rejilla 13×13: plaza con pozo + 8 manzanas (viviendas al norte, huertas al sur) | Aldeanos, granjeros, pastores |
| `trading_post` | Puesto de comercio | Rejilla 15×15 con el mercado en la plaza | Mercaderes |
| `military_base` | Guarnición | Recinto amurallado 23×21: patio de armas central, 8 manzanas (mando, barracones, almacenes, caballerizas), una puerta al sur | Guardias |
| `capital` | Nínagara / Novozarya | Recinto 33×33: núcleo monumental 17×17, 16 manzanas en anillo (cívico, residencial, industrial, campos), muralla con 4 puertas y torres | Sacerdotisa, Escriba, Guardias, Mercaderes |

Los tres últimos salen del **planificador de asentamientos** (ver §5.6).

### 5.3 Tamaños de edificios (`BUILDING_SCALE = 1.0`)

| Tipo | Tiles (w×h) |
|---|---|
| `hut` | 2×2 |
| `house_small` | 2×2 |
| `house` | 3×3 |
| `house_large` | 4×4 |
| `stone_house` | 3×3 |
| `longhouse` | 5×2 |
| `temple` | 4×4 |
| `market` | 4×3 |
| `granary` | 3×3 |
| `factory` | 5×4 |
| `state_warehouse` | 4×3 |
| `ziggurat` | 11×11 |
| `house_garden` | 3×3 |
| `mesopotamian_villa_detailed` | 5×5 |

> `temple`, `market`, `granary`, `factory` y `state_warehouse` no tenían huella
definida y ocupaban **una sola celda** (el sprite se dibujaba minúsculo y los
edificios cabían dentro de otros). Ya están corregidos.

**`BUILDING_SCALE = 1.0`**: el sprite se dibuja exactamente en el footprint de colisión. Cambiar a > 1.0 hará que el sprite sobresalga visualmente de la hitbox.

### 5.4 Profundidad (depth sort)

Los edificios se dibujan en dos pasadas para que el jugador quede detrás o delante correctamente:

1. Edificios con `depthKey < playerDepthKey` → se dibujan antes que el jugador
2. Edificios restantes se guardan en `window._deferredBuildings[]`
3. Después de `drawPlayer()`, se dibujan los diferidos

En modo ortho: `depthKey = row`. En modo iso: `depthKey = col + row`.

### 5.5 Estructuras (conjuntos de edificios)

Los edificios singulares (zigurat, templo, mercado, granero, fábrica…) no se
colocan sueltos: se levantan como **conjuntos plantilla** con una forma preparada
(plaza, caminos, decoración y NPCs incluidos). Definición en
`engine/game-engine-structures.js` + `data/structures.json`, y editor visual en el
**modo debug (F9) → sección «Estructuras»**.

Pasos del reparto (paso **8b** de `generateMap`):

1. Ordena los conjuntos por `weight`.
2. Busca posición válida: sin agua en la huella (salvo `allowWater`), sin
   construcciones, bioma permitido, a `nearRiver` del agua y a `minSpacing` de
   villas, del jugador y de otros conjuntos.
3. Coloca las piezas con `transform` aleatorio (`none`, `mirrorX/Y`, `rot90/180/270`),
   pinta el terreno de las calles, añade decoración y NPCs.
4. Tiende una carretera de acceso a la villa más cercana (`roadToNearest`).
5. Guarda el conjunto en `window._STRUCTURES` (se persiste con la partida).

El **núcleo cívico del capital** sale de la plantilla `nucleo_capital` (zigurat +
explanada + vía procesional), dimensionada para el rectángulo de 17×17 que
reserva el planificador urbano. Si no cupiera, se usa el trazado clásico de
respaldo.

Guía completa y formato del JSON: [`docs/ESTRUCTURAS.md`](docs/ESTRUCTURAS.md).

### 5.6 Ciudades, bases y aldeas: planificador de asentamientos

`engine/game-engine-settlement-utils.js` genera el trazado completo de los
asentamientos como **datos** (un objeto `plan`), y `spawnVillage` lo aplica. El
motor es puro: no toca el mundo, así que un plano se puede revisar, volcar a
JSON o dibujar antes de colocarlo.

Modelo del trazado:

1. **Rejilla uniforme**: celdas de manzana del mismo tamaño separadas siempre por
   calles de 1 celda. En el centro se reserva el **núcleo** (recinto monumental,
   patio de armas o plaza) y las manzanas forman un anillo completo alrededor,
   por lo que no quedan brazos de terreno vacío y el viario sale conexo.
2. **Distritos**: cada manzana recibe un uso (cívico, residencial, industrial,
   agrícola, militar, almacenes, caballerizas, mando) y se llena por **bandas
   horizontales**: cada banda es una fila de edificios que da a la calle de
   arriba o a la de abajo, empaquetados según su huella real. Si una pieza
   grande no cabe en media manzana, ocupa la manzana entera y queda centrada
   (templos, superbloques, fábricas).
3. **Muralla** por el perímetro, con las puertas siempre sobre una avenida de la
   rejilla (nunca sobre una manzana) y torres esquinera y flanqueando los
   accesos. La capital soviética no lleva muralla: usa bulevares y puestos de
   control.
4. **Mobiliario** a espaciado fijo sobre las intersecciones (farolas, palmeras,
   garitas, cajas), no esparcido al azar.

Parámetros de cada tipo en `TEMPLATES` (`block`, `street`, `coreRings`, `rings`,
`perimeter`, `wall`, `gates`, `roles`), y catálogo de distritos y épocas en
`DISTRICTS`. Para revisar un plano desde la consola:

```js
// Resumen numérico (huella, edificios por distrito, densidad, calles, muros)
MESO_SETTLEMENTS.planSettlement({ type: 'capital', cx: 0, cy: 0, epoch: 'mesopotamia', seed: 99 }).summary
// Auditoría del mundo real: tipos desconocidos, solapes, edificios sobre agua
MESO_DEBUG.auditMap()
```

Ejemplo de salida del reparto durante la generación:

```
[asentamiento] capital planificado: {"type":"capital","footprint":"33×33","buildings":51,
  "byDistrict":{"residential":16,"industrial":20,"agricultural":8,"civic":7},
  "density":0.256,"streetCoverage":0.25,"wallSegments":8,"towers":12,"gates":4,"props":28}
```

### 5.7 Pixel-art de los edificios (sprites)

El arte vive en `data/entity-pixels.json` (`icons[nombre] = { grid, gridW, gridH, pixels }`,
donde `pixels` es una lista `[x, y, color]`). El arte de los edificios
mesopotámicos se escribe en texto y se genera con:

```
node tools/build-mesopotamia-sprites.js          # escribe el JSON
node tools/build-mesopotamia-sprites.js --dry    # valida sin escribir
node tools/build-mesopotamia-sprites.js --dump house temple
```

Reglas del arte (las aplica `drawEntitySpriteAt`):

| Regla | Detalle |
|---|---|
| Densidad | **4 píxeles de arte por celda de mapa**, igual en todos los edificios |
| Rejilla | Misma **proporción que la huella**: casa 3×3 → 12×12 · casa comunal 5×2 → 20×8 · arco 2×1 → 8×4 |
| Escala | Entera y **manda el ancho** (`escala = ancho_huella / gridW`), así nada se deforma |
| Apoyo | El arte ocupa toda la rejilla: la última fila es el contacto con el suelo |
| Sobresalir | Un sprite puede ser más alto que su huella (pozo 4×6, atalaya 4×10, torre) sin deformarse |

Para revisar el arte sin depender del zoom: **F9 → «Colocar sprite» → 🔍 Ver
biblioteca de sprites**, que dibuja la biblioteca completa con las reglas reales
del render, cada sprite dentro de la caja de su huella, con buscador.

Auditoría automática del arte:

```
node tools/audit-sprites.js            # informa
node tools/audit-sprites.js --strict   # falla si hay defectos (para CI/antes de commit)
```

Comprueba los dos defectos que se ven al jugar:

| Defecto | Qué es | Síntoma en pantalla |
|---|---|---|
| Huecos internos | píxeles transparentes **encerrados** en la silueta | el fondo asoma y el edificio parece agujereado (zigurat, redil) |
| Densidad | píxeles de arte por celda de mapa (lo correcto es **4**) | si es baja, cada píxel se vuelve un bloque enorme (mosaico); si es alta, el sprite sale diminuto y deja ver el fondo |

> Corregido en esta pasada: los sprites estaban dibujados en la parte de arriba
> de su rejilla (6 filas de 9) y **todos los edificios flotaban una celda** sobre
> su huella, con la sombra por debajo; `house_small` era idéntico a `house` y
> `mesopotamian_house` idéntico a `longhouse`; y once tipos (pozo, torre,
> alfarería, redil, embarcadero, atalaya, farola, fuente, choza de caña,
> superbloque soviético) **no se dibujaban en absoluto** — sólo su sombra.

### 5.8 Caminos: texturas de suelo y autotiling

Los caminos **no llevan sprite**: son suelo. Dibujarlos con la misma rejilla de
4 px por celda que una casa los dejaba como un damero de cuadros planos, así
que se generan texturas de píxel a la **resolución real de la celda** (el zoom
manda) y se cachean (`engine/game-engine-textures.js`, `window.MESO_TEXTURES`):

| Tipo | Uso |
|---|---|
| `stone` | calles de Mesopotamia: losas de caliza cálida |
| `concrete` | época URSS: firme de hormigón con juntas y grietas |
| `dirt` | tierra apisonada (disponible como variante de paleta) |

Detalles que marcan la diferencia:

- **6 variantes por tipo y tamaño**, elegidas con un hash de `(col, fila)`:
  determinista (nada “hierve” al mover la cámara) y sin repetición evidente.
- **Empedrado continuo (tiling toroidal)**: una losa que cae a medias en el
  borde se dibuja también por el lado contrario, así **no se ve la costura**
  entre celdas.
- **Autotiling de bordillos**: cada celda mira a sus vecinas (`isPathCell`) y
  sólo pinta bordillo donde el camino **no** continúa. Un tramo recto sale con
  dos bordillos continuos y un cruce sale abierto, sin costuras.
- **Roderas** en los tramos rectos (dos bandas oscuras en el sentido de la
  marcha), que además orientan visualmente la calle.
- La celda se pinta con `drawImage` de una textura cacheada: coste por celda
  = una llamada, sin geometría fraccionaria ni dameros de subcuadros.

### 5.9 Murallas, puertas y torres

Murallas y torres llevan sprite (`wall_segment_h`, `wall_segment_v`,
`wall_tower`), dibujado a densidad 4 como el resto del arte:

| Sprite | Rejilla | Detalle |
|---|---|---|
| `wall_segment_h` | 4×10 (huella 1×1) | muro que corre de izquierda a derecha: parapeto macizo, aspilleras oscuras, hiladas y zócalo |
| `wall_segment_v` | 4×12 (huella 1×1) | muro que corre en profundidad: remate, costado iluminado por la izquierda, aspilleras y juntas |
| `wall_tower` | 8×14 (huella 2×2) | cuatro almenas, adarve, tronera y zócalo; sobresale 3,5 celdas |

`drawBuilding` lee la orientación guardada en la celda (`grid[fila][col].orient`,
`'h'` o `'v'`) y usa el sprite correspondiente; si el sprite no existe, cae al
dibujo procedural anterior.

> **La silueta de un muro no puede tener transparencias.** Con almenas separadas
> por huecos transparentes, dos celdas seguidas parecían bloques sueltos («hay
> separación entre las murallas»). Ahora el parapeto es continuo y los vanos son
> aspilleras **oscuras dentro** del muro.

**Puertas de ciudad.** Cada asentamiento amurallado tiene puertas de 2 celdas de
ancho (una por lado, sobre las avenidas) con dos torres flanqueándolas:

| Sprite | Huella | Uso |
|---|---|---|
| `mesopotamian_arch` | 2×1 | puerta de los lados norte/sur: dos torreones, dintel de piedra y vano oscuro |
| `mesopotamian_gate_v` | 1×2 | puerta de los lados este/oeste (vista de lado) |

La puerta **no es un edificio**: se coloca como entidad ambiental con
`passable: true`, así que el vano se puede atravesar (un edificio bloquearía la
ciudad por completo; antes el arco ni siquiera cabía en un hueco de 1 celda y no
aparecía ninguna puerta). La capital soviética no lleva muralla, así que el
control de acceso es el propio bulevar y no se pone arco mesopotámico.

### 5.10 Coherencia del agua (ríos, canales y calzada)

El agua se define en **un solo sitio**, `window._RIVER_FULL_MAP` (celda a celda)
con `window._RIVER_COLS` (qué columnas tienen agua, para las comprobaciones que
sólo reciben la columna). Reglas que el motor garantiza ahora:

- **Lo que se dibuja como agua es agua en los datos.** El render usa el bioma
  (`tileBiome === 'water'`) y `isRiver()` sale del mismo mapa. Antes, al cargar
  una partida guardada llegaban los biomas pero no el mapa de meandros, así que
  `isRiver()` caía a un rango de columnas fijo y **pintaba una banda de agua
  sobre tierra**: los caminos y los árboles de esa banda aparecían dentro del
  río. Al cargar se reconstruye el mapa desde los biomas.
- **Ninguna calzada cruza el agua.** `isRiver(col)` sin fila ya no usa el rango
  de columnas fijo (que no coincide con los meandros generados) sino el mapa
  real: las vías de acceso y los corredores ya no pintan asfalto sobre el río.
- **Pasada final de coherencia**: donde el mapa de río dice agua, el bioma se
  fuerza a agua y se retira la calzada (edificio `road`/`concrete_road`) que
  hubiera encima; después se recalcula el índice de columnas.
- **Nada verde en la calzada ni en el agua**: la siembra de recursos y de
  hierbajos excluye `road`, `concrete_road`, `canal_road` y agua, y una última
  pasada retira árboles, hierbajos y recursos que hayan quedado sobre calzada,
  agua o dentro de un edificio (el orden de fases — calles después de sembrar —
  dejaba matas y trigo en medio de las avenidas).
- Los **corredores logísticos** (`canal_road`) son tierra apisonada transitable:
  se dibujan con su color de bioma, no con la textura de empedrado (pintarlos
  como calzada parecía una carretera en el río).

#### Los puentes se cruzan de verdad

Un puente está *encima* del río: sus celdas son agua para el mapa de meandros y
calzada para el bioma. Toda la lógica de agua pasa por un único predicado,
`isWaterCell(c, r)`, que **excluye las celdas de puente**:

- `movementMultiplier()` devuelve velocidad de calzada (1) en un puente: antes
  devolvía 0.35 y el personaje **cruzaba nadando** por encima de los tablones
  (sólo se le veía la cabeza, lentísimo y sin poder saltar: parecía que el
  puente no se podía cruzar).
- `canWalkTo()` deja pasar por el puente antes de mirar el agua.
- Los dibujos del jugador usan `isWaterCell` para decidir la postura de nado, y
  el salto se bloquea en agua — pero no en un puente.
- `buildBridges()` ya no se detiene ante una vía anotada como *edificio* sobre
  el agua (calzada flotante): la retira y el puente ocupa su sitio, así que el
  tramo llega de orilla a orilla.
- El mapa de puentes **viaja con la partida** (`serializeBridgeMap` /
  `restoreBridgeMap`, una fila por tramo y un dígito por celda). Sin él, al
  recargar se perdía el dibujo del puente (quedaba como calzada normal).

Comprobado con `MESO_DEBUG.testDraw`: `bridgeAt` / `waterAt` / `speedAt` /
`canWalk` dan, en las 57 celdas de puente de un mapa de pruebas, 0 celdas
tratadas como agua, velocidad 1 en todas y 23 de 23 tramos con los dos extremos
en tierra transitable.

### 5.11 El Zigurat mayor (arte procedural)

El zigurat es la **maravilla** del mapa y el edificio más grande del juego. Su
arte no es un dibujo a mano: lo genera `buildZigguratArt()` en
`tools/build-mesopotamia-sprites.js`, que construye una pirámide escalonada
**vista desde arriba** con cinco terrazas concéntricas (insets 0, 4, 9, 14 y 19
px; cada anillo son 4 px = 1 celda).

| Detalle | Cómo se genera |
|---|---|
| Terrazas | Anillos concéntricos: azotea al norte, fachada en el sur y costados en sombra; el recinto base va en piedra (10×10) y el resto en adobe |
| Fábrica | Hiladas alternas, juntas de ladrillo cada 4 filas, filo exterior oscuro y moldura iluminada donde arranca la terraza de dentro |
| Hornacinas | Vanos ciegos de 3 px repartidos cada 8 px por cada fachada |
| Jardines colgantes | Franja verde (tres tonos) sobre la azotea de las dos terrazas intermedias, con raíces en sombra en los bordes |
| Escalinata | Escalera procesional de 6 px con peldaños alternos, rellano cada 4 y balaustradas con pilares de capitel dorado |
| Santuario | Templete encalado con techo de oro, vano, hornacina lateral, cuernos de oro en las esquinas y estandartes |
| Recinto | Almenas en el perímetro, contrafuertes en las esquinas de cada terraza, puerta monumental y estatuas guardianas |
| Accesos | Escaleras laterales en los costados del recinto |
| Remate | Orla dorada en las terrazas altas |

Resultado: **48×52 px para una huella de 12×12 celdas** (48 px = 4 px por celda,
la misma densidad que las casas). En pantalla se dibuja a 384×416 px: doce veces
el ancho de una choza.

**Regla de oro (y comprobada por la auditoría):** el recinto base ocupa *todo* el
rectángulo del sprite, así que **no hay un solo píxel transparente dentro de la
huella**. El arte anterior repartía las terrazas en bandas horizontales y dejaba
transparentes los laterales de las terrazas altas: al jugar se veía el suelo a
través del monumento y el zigurat parecía translúcido. `audit-sprites.js`
comprueba ahora, para los edificios con `MUST_BE_SOLID`, que la caja de la huella
esté maciza (0 huecos).

**La huella y el arte van juntos:** `BUILDINGS.ziggurat.size = { w: 12, h: 12 }`.
Si se deja una huella menor, el sprite se reescala a la baja y el monumento se ve
como un mosaico. Los conjuntos que lo rodean (`nucleo_capital` y
`zigurat_complejo`) están ajustados a 12×12: sus calles, palmeras y piezas
vecinas quedan **fuera** del cuadrado que ocupa (verificado: 0 solapes y 0 celdas
de camino dentro de la huella).

### 5.12 Interiores de los edificios

Los interiores (casa, casa grande, casa con huerto, torre de viviendas, casa del
jugador) se **generan por código** desde arte ASCII, igual que los sprites:
`tools/build-interiors.js` los escribe en `data/interiors/*.json`.

```
#  muro      .  suelo     r  alfombra   D  puerta (vano)
P  cuadro    W  ventana   T  antorcha   b  cama      t  mesa
c  silla     s  estantería  k  cofre    p  ornamento  l  planta
o  mostrador f  hogar (fogón)
```

Convenio que espera el motor (el generador lo **valida** y falla si no se cumple):

- **Anillo de muros** de una celda en todo el perímetro.
- El **vano** va en el muro sur (última fila) **y** en la fila de justo encima,
  que es la que mira el motor para el cartel «Salir [E]».
- `entryCol` / `entryRow` van en la **raíz** del JSON (y también en cada planta);
  el jugador aparece en la fila de dentro, delante del vano.

**Se dibujan con la misma tubería que el exterior**: celda de `getTileSize()` y
`worldToScreen()`, que es lo que usan el jugador, los NPCs y las entidades. Antes
había una proyección en falso 3D y los muebles se pintaban donde no era su celda,
así que lo que se veía y lo que chocaba no coincidían (de ahí que las hitboxes
pareciesen rotas). Ahora los muros son bloques (cara superior iluminada, cara
frontal, hiladas de ladrillo y la decoración colgada encima) y los muebles se
anclan al pie de su celda.

**Colisión** (`canWalkTo` en interior): sólo bloquean `INTERIOR_SOLID_TILES`
(muros, cuadros, ventanas, antorchas y muebles). El suelo, la alfombra y el vano
se pisan; antes sólo bloqueaba `wall`, así que se atravesaban camas y mesas.

### 5.13 Hitboxes de los sprites

Las entidades del exterior bloquean la celda que ocupan, pero **sólo** si el
sprite lo justifica: los árboles y los recursos grandes (piedra, ladrillo, trigo,
leña) bloquean; los **hierbajos, la hierba alta, las flores y los arbustos se
pisan**. Antes cualquier `resource` bloqueaba su celda entera y el personaje
parecía chocar con el aire. Los vanos de puerta y las piezas marcadas con
`passable` tampoco bloquean.

---

## 6. Personajes y NPCs

### 6.1 Sprite del jugador

El sprite se genera con `drawCharacterPixels(ctx, palette, x, y, scale, opts)`. La paleta de colores es `player.palette = { skin, hair, cloth, trim }`.

**Escala proporcional al zoom** (corregido 2026-03-16):
```js
const scale = Math.max(1, Math.round(tileSize / 10));
```
Esto garantiza que el personaje ocupe ~80% de una celda a cualquier nivel de zoom. Antes de este fix, la escala estaba congelada en 3× para cualquier zoom ≥ 1 debido al clamp `Math.min(tileSize, 32)`.

### 6.2 Apariencia de NPCs

Cada NPC recibe una paleta y preset aleatorios en `randomizeNpcAppearance(npc)` al ser creado. Tipos de outfit: `villager`, `villager2`, `merchant`, `guard`.

### 6.3 NPCs de día/noche

Entre las 22:00 y las 05:00 (hora de juego), los NPCs desaparecen del overworld (`col = -999`) y se restauran al amanecer con sus posiciones guardadas en `npc._prevCol/_prevRow`.

### 6.4 Sistema de diálogo cinemático

Al presionar **E** cerca de un NPC, se abre el panel de diálogo:

- Si `npc._storyLines[]` existe → muestra las líneas en orden, el índice se guarda en `npc._dialogueLine`
- Si no → usa una frase aleatoria de `NPC_DIALOGUES[npc.npcType]`
- Presionar **E** avanza la conversación; al cerrar, el índice queda guardado para la próxima vez

**Opciones y encargos sorpresa.** Los vecinos (no los NPCs de guion) pueden
terminar la charla con **2-3 respuestas para elegir lo que dice el jugador**, y
de vez en cuando te **encargan una misión a mitad de la conversación sin aviso
previo** (no hay «!» sobre el NPC ni panel antes de hablar). Detalle completo en
[`docs/DIALOGOS-Y-ENCARGOS.md`](docs/DIALOGOS-Y-ENCARGOS.md); para probarlo sin
jugar: `MESO_DEBUG.testDraw.dialogo.*`.

**Funciones clave**: `openNpcDialogue(npc)`, `advanceDialogue()`, `drawDialoguePanel(ctx, W, H)`, `prepararConversacionConOpciones(npc, dlg)`, `colarMisionEnDialogo(npc, dlg)`

---

## 7. Historia principal

### Sinopsis

Mesopotamia, 2350 a.C. La aldea de **Kidu-Lam** fue arrasada por raiders de Gutium al amanecer. Adapa, cazador superviviente, recibe el encargo del anciano Kishdu: llevar el aviso del gran diluvio a Nínagara antes de que sea tarde.

### Arco narrativo (implementado)

```
[INICIO] Aldea destrozada (tipo: origin)
    └── NPC: Kishdu el Anciano  ── _storyLines[8]
           Misión: "Viaja a Nínagara y habla con la Sacerdotisa"
           
[NÍNAGARA] Capital al norte (tipo: capital)
    ├── NPC: Sacerdotisa Enlil-Ama  ── _storyLines[8]
    │       Misión: "Reúne 5 cebada + 3 piedra para el ritual"
    └── NPC: Escriba Imitti  ── _storyLines[5]
            Lore sobre los presagios y las tablillas
```

### Guion narrativo

El guion completo, revisado y unificado (con el estado de cada cosa: implementado
/ escrito / propuesta), vive en [`docs/GUION-NARRATIVO.md`](docs/GUION-NARRATIVO.md).
Sustituye a la sinopsis suelta que había antes en este manual.

Las ideas que aún no son canon (bocetos de escena, el puente entre capítulos y
la aparición de **Kidu, el perro**, que **no se cruza con Adapa hasta el capítulo
2**) están en [`docs/IDEAS-Y-BOCETOS.md`](docs/IDEAS-Y-BOCETOS.md).

### Objetivos elegibles

El panel «Objetivo activo» **no impone** un único objetivo. Cada uno se registra
en una lista (`window._objectives`) con su fuente: `mission` (historia) o `free`
(sugerencia del mundo). El jugador decide qué sigue:

| Acción | Cómo |
|---|---|
| Cambiar de objetivo | **O** o el botón *Cambiar* del panel |
| Objetivo anterior | **Alt+O** |
| Apartarlo (no verlo más) | **Shift+O** o el botón *Ocultar* |
| Recuperar los apartados | Botón *Mostrar* del panel |
| Elegir uno concreto | `MESO_OBJECTIVES.track('id')`, `list()` para verlos |

- Los **objetivos libres se completan solos** al cumplirse su condición
  (`updateFreeObjectives()`: alejarse N celdas, reunir materiales, acercarse a un
  sitio), así que hacer otra cosa también avanza el juego.
- La misión de historia nunca se pierde: sigue en la lista aunque se aparte.
- El prólogo registra desde el principio «Preparar cultivo» (historia) más
  «Reconocer los alrededores», «Hacer acopio» y «Hablar con tu familia» (libres):
  antes el panel repetía «plantar» hasta que se plantara, sin alternativa.

### Modo edición: botón visible

El menú superior lleva un botón claro **✏️ Editar / 🎮 Jugar** que entra y sale
del modo edición, más una insignia fija en pantalla («✏️ MODO EDICIÓN · pulsa
«Jugar» para salir») mientras el editor está activo. Antes sólo se podía cambiar
desde *Dev ▸ Modo* o con atajos, y no había forma evidente de volver a jugar.
El estado se mantiene sincronizado con los botones antiguos (`setEditMode()` llama
a `updateEditModeButton()`).

### Intro cinemática

Al iniciar nueva partida se reproduce la intro (`startIntroSequence()`):

| Fase | Duración | Contenido |
|---|---|---|
| 0 | 3.4 s | Texto de localización ("Mesopotamia, 2350 a.C.") |
| 1 | 5.2 s | Trasfondo narrativo (aldea destruida, misión) |
| 2 | 3.2 s | Título: "ADAPA Y EL DILUVIO" con glow dorado |
| 3 | 0.9 s | Fade-out al juego |

Cualquier tecla salta la intro. Las fases tienen fade in/out suave.

---

## 8. Renderizado y cámara

### 8.1 Ciclo día/noche

`dayHour` va de 0 a 24 en `DAY_SECONDS = 120` segundos reales. Las fases del cielo (`_skyPhases[]`) son 9 colores interpolados con `_lerpSkyColor()`.

`nightAlpha` controla la oscuridad ambiente (0 = mediodía, 0.88 = medianoche). Se usa en:
- Overlay de cielo nocturno (capa azul/índigo)
- Torch vignette (radial gradient oscuro con glow ámbar)
- Radio de visión para el vignette

### 8.2 Overlay de daño

Cuando el jugador recibe daño, `char._flashUntil = now + 280` activa un fill rojo de `rgba(220,20,20, 0–0.35)` que decae en 280 ms. Se dibuja en `drawPlayerHealth()`.

### 8.3 Mini-mapa

`drawMiniMap(ctx, W, H)` dibuja un panel 140×90 px en la esquina inferior derecha mostrando: biomas (color codificado), edificios (puntos blancos), posición del jugador (punto amarillo), hora de juego.

### 8.4 HUD de supervivencia

Panel 170×70 en esquina superior derecha con borde dorado:
- ☀/☾ + HH:MM (hora de juego)
- Barra de HP (verde → amarillo → rojo)
- Barra de stamina (amarillo, se vuelve naranja al agotarse)
- Hambre y sed

### 8.5 Partículas, sacudidas y polvo de pisadas

`engine/game-engine-fx-utils.js` (`createFx`, publicado como `window.MESO_FX`)
centraliza el “jugo” visual. Las partículas se guardan en **coordenadas de
mundo** y se proyectan al dibujar, así no se descolocan al mover la cámara.

| Suceso | Efecto |
|---|---|
| Talar un árbol | virutas de madera + sacudida del árbol (`onChopStart`, `onChopped`) |
| Romper un hierbajo / recolectar | briznas del color del recurso (`onPickup`) |
| Golpear a un enemigo | chispas + **sacudida** de la entidad golpeada (`onWeaponHit`) |
| Caminar / esprintar | nube de polvo del color del bioma bajo los pies (`onFootstep`) |

- `MAX_PARTICLES = 420` (se descarta la más antigua), vida 380–520 ms.
- Dos familias: `dust` (círculos) y virutas/hojas (rectángulos que giran con
  `wobble`). Gravedad 0.055 y rozamiento por partícula.
- **Sacudida**: `ent._fxShake = { born, ms, amp }`; el desplazamiento es
  `sin(t·π·6.5) · amp · decaimiento²` y se suma en `entityScreenPos(ref)`, que
  usan el bucle de entidades, conejos y el overlay de copas de árboles.
- El polvo de pisadas se emite cada 0,24 s de avance (0,15 s esprintando),
  alternando el pie (`offsetX = ±0,17`), desde el bucle de movimiento.
- `MESO_FX.spawnedTotal` es un contador acumulativo pensado para pruebas: no
  depende de que las partículas sigan vivas al leer el estado.

### 8.6 Animación: viento y personajes

#### Viento sobre la vegetación

- `windStrength()` devuelve la fuerza del viento en el instante actual (rachas
  lentas, 0,35–1,0): todo lo que se mueve con el aire usa la misma fuente, así
  que el viento «se nota» a la vez en todas las matas de la pantalla.
- `swayPhaseOf(ent)` deriva una fase estable de la identidad de la entidad: dos
  matas distintas no se mecen sincronizadas, y la misma mata no salta de fase
  entre fotogramas.
- `drawEntitySpriteAt(nombre, x, y, w, h, { ent, sway, phase })` aplica el
  vaivén **fila a fila**: `sway` es la amplitud en píxeles del extremo superior y
  `swaySpan` reparte el desplazamiento en proporción a la altura del píxel, de
  modo que la base queda clavada y la punta oscila (es lo que da la sensación de
  hierba doblada y no de un bloque que se desliza).
- Los hierbajos llevan `{ sway: 2.2, phase: swayPhaseOf(ent) }`; la vegetación
  baja (matas, arbustos) también. Es aditivo: sin `sway` el dibujo es idéntico al
  de antes.

#### Personajes

`characterAnimState(ent, now)` calcula el estado de animación de cualquier
personaje (jugador o NPC) y devuelve `{ frame, bob, lean, swing, squash }`:

| Señal | Regla |
|---|---|
| `frame` | Ciclo de **4 pasos**. Se detecta el avance comparando el `_walkTime` con el del fotograma anterior (delta de zancada), no con un booleano de «me estoy moviendo»: así se anima aunque el personaje empuje contra una pared o lo mueva un empujón |
| `bob` | ±1 por zancada (respiración vertical unida al paso) y **±2 esprintando** |
| `lean` | 1 al esprintar: el tronco y la cabeza se inclinan hacia delante, las piernas no |
| `swing` | Brazos: `sin(p·π)·power` durante 300 ms tras `triggerCharacterSwing(ent, power)`, que se dispara al golpear (arma) y al empezar a talar |
| `squash` | 1 mientras dura la sacudida de daño (`_fxShake`): el cuerpo se aplasta un píxel |
| Parado | Respiración lenta (`bob` ±1 de forma intermitente), sin `frame` |

En reposo y en movimiento se usan **las mismas 4 fases**: `frame 1` y `frame 3`
son las dos zancadas (la pierna adelantada cambia de lado), `frame 0` y `frame 2`
el apoyo. El tronco y la cabeza reciben `bob`/`lean`; las piernas se quedan
apoyadas en el suelo para que el personaje no «flote» al dar el paso.

`MESO_DEBUG.testDraw.animState(ent, t)` permite probarlo sin mover a nadie:
pasándole una entidad con `_walkTime` creciente devuelve el ciclo completo
(comprobado: frames 0-1-2-3 con `bob` ∈ {-1,0,1}; esprintando, `lean` = 1).

### 8.7 Rendimiento: las tres cachés

El motor dibuja por fotograma tres cosas que son **estáticas** y que antes se
recalculaban enteras cada vez. Están cacheadas y son la diferencia entre un
juego fluido y uno que va a tirones:

| Caché | Qué evita por fotograma | Cuándo se reconstruye |
|---|---|---|
| **Terreno** (`mapCacheOrtho` / `mapCacheIso`) | Recorrer las celdas visibles con `fillRect`, textura de camino, bordillos, puentes y detalle del bioma (decenas de miles de operaciones) | Al cambiar el mapa (`mapCacheDirty`) o el bioma, en trozos asíncronos |
| **Sprites** (`_spriteBitmaps`) | Dibujar cada edificio y entidad píxel a píxel (una casa son 144 `fillRect`, el zigurat 2.496) | La primera vez que se dibuja cada sprite a cada escala |
| **Minimapa** (`_miniMapCache`) | Recorrer las 21.600 celdas del grid y 2.400 de terreno | Como mucho cada 1,5 s (el mapa cambia poco) |

Consecuencias de diseño que hay que respetar al tocar el render:

- **El terreno sale de la caché**: si añades un efecto de terreno, píntalo
también en `rebuildMapCachesAsync` (con el contexto de la caché), o no se verá.
- El único terreno animado es el **agua**: la caché pone el color base y encima
`drawWaterAnimCell()` dibuja 3 trazos por celda de agua **visible**.
- Los sprites con `sway` (hierbajos, copas de árboles) siguen por el camino de
píxeles, porque se doblan por filas; son matas diminutas y sale más barato.
- La caché de sprites se limita a 64 MB (`SPRITE_BITMAP_MAX_BYTES`) y se puede
vaciar con `window.clearSpriteBitmaps()`.

**Carga inicial**: `generateSpriteImages()` rasteriza los ~96 sprites de una vez.
La caché de sprites en `localStorage` es **opcional**
(`window.ENABLE_SPRITE_PERSIST_CACHE = true`) y, cuando se usa, se escribe una
sola vez al final: antes se escribía **entera por sprite** y cada sprite se
codificaba a PNG con `toDataURL`, con lo que el arranque era O(n²) y tardaba
minutos (96 × ~1,5 s). Ahora cede el hilo cada 8 sprites para que el indicador
de carga no se congele.

**Para medirlo**: menú **Dev ▸ Rendimiento (HUD)** (o
`MESO_DEBUG.perf.toggle()`). Muestra FPS, ms por fotograma (mediana y p95),
llamadas de dibujo, si el terreno viene de la caché (1 `drawImage`) o se está
pintando **en vivo** (aviso en rojo) y cuántos sprites hay rasterizados.
`MESO_DEBUG.perf.info()` devuelve lo mismo como objeto para las pruebas.

### 8.8 Niebla de guerra (mapa sin explorar)

Todo lo que el jugador no ha visitado se dibuja **negro**: no se ve el terreno,
ni los edificios, ni las entidades. Está encendida por defecto.

- La exploración se guarda por celda en `window._explored` (1 byte por celda,
  `Uint8Array` de `COLS*ROWS`). `markExplored(col, row, radio)` enciende un
  círculo y lo llama `markExploredNow()` cada 500 ms alrededor del jugador; al
  empezar también se revelan los núcleos urbanos ya conocidos.
- Se pinta con un lienzo de **1 px por celda** (`_fogCanvas`, 180×120) que se
  escala al mapa: en ortogonal es un solo `drawImage` (con suavizado, para que el
  borde no salga a cuadros); en isométrico se pintan rombos por celda visible.
- La niebla se dibuja **después** del terreno, los edificios y las entidades
  (los tapa de verdad) y **antes** del HUD y el minimapa. El minimapa también
  lleva su capa de niebla, y el **mapa cenital** (tecla **M**) usa el mismo
  lienzo escalado a su rejilla, así que lo no explorado sale negro ahí también.
- Para probarla: menú **Dev ▸ Niebla de guerra** (casilla), más los botones
  *Revelar todo el mapa* y *Ocultar todo otra vez*. API: `MESO_FOG`
  (`enable/toggle/clear/revealAll/stats`).
- `MESO_FOG.stats()` devuelve `{ activa, exploradas, total, pct }` — comprobado:
  441 celdas exploradas al empezar (2 %), 0 tras `clear()`, 21600 (100 %) tras
  `revealAll()`.

### 8.9 Bordes entre biomas (transiciones)

El terreno se pinta por celdas, así que los cambios de bioma se cortaban en seco
(cuadros de arena contra cuadros de hierba, agua contra tierra). Ahora cada celda
pinta además su **transición de borde** con `MESO_TEXTURES.drawTransition()`:

- **Agua ↔ tierra**: orilla de agua somera (banda clara dentro del agua) con
espuma punteada justo en el borde, y en la tierra una banda de arena mojada con
guijarros; si la tierra es verde, además hierba colgando sobre la orilla.
- **Tierra ↔ tierra** (arena↔hierba, estepa↔bosque, colinas…): dither de píxeles
alternos con los colores del bioma vecino y del propio, para que la frontera se
desdibuje en vez de saltar.
- **Esquinas**: si el agua o el bosque giran en diagonal, el pico se difumina
también (sin esto quedaba un cuadro duro de una celda).
- Los caminos y canales se dejan fuera: ya tienen bordillo propio (`drawCurbs`).

Detalles de implementación:

- Se dibuja en **la caché de terreno** (`rebuildMapCachesAsync`), en las dos
pases (ortogonal e isométrico, con `{ iso: true }` y recorte al rombo), antes de
las texturas de camino. Se dibuja directo, sin cachear por variante, porque sólo
corre al reconstruir el mapa.
- Las categorías gruesas las calcula `biomeEdgeKind()`: `water · grass · sand ·
forest · hills · marsh · road` (arena, estepa, aluvial y salinas comparten
`sand`). `biomeEdgeNeighbours(r, c)` devuelve las 8 direcciones.
- El azar del dither sale de la semilla de la celda, así que el borde es estable
entre reconstrucciones.

---

## 9. Changelog de desarrollo

### 2026-09-28 (13) — Modos de juego (historia / libre) y el personaje del menú es el del juego

#### El editor de personaje ya no enseña «otro» personaje
- La vista previa del menú usaba **su propio arte**: unas rejillas ASCII de 8×8
  escritas en `index.html`, sin relación con el sprite del juego (el humanoide
  detallado de 24×24 por época). De ahí que «el personaje que sale para editar no
  sea el del juego».
- Nuevo módulo **`engine/character-art.js`**: única fuente de verdad del aspecto
  del personaje (paleta por defecto, opciones de color, presets, ropas, los dos
  sprites detallados, `shadeHexColor`, `mapDetailedHumanoidColor` y
  `drawHumanoid`). El MOTOR lo importa (los bloques antiguos quedan comentados,
  fuera de compilación) y el MENÚ lo importa con un `<script type="module">` que
  publica `window.MesoCharacterArt`.
- La vista previa llama a `drawHumanoid(...)` con la **misma rejilla y el mismo
  recoloreo** que el mundo, espejando el sprite de Mesopotamia igual que el motor
  al mirar al frente. Los presets del menú son ya los del juego
  (`CHARACTER_PRESETS`: Ninsun, Kishar, Urim, Enhedu, Tamar), con los nombres
  soviéticos superpuestos en esa época.
- Como el sprite detallado es único, se ocultan los controles que no cambian
  nada (ropa y flechas de dirección): la paleta sí se ve y el oficio da el título.

#### Modos de juego: historia y libre
- **Modo historia** (por defecto): protagonista fijo **Adapa** (`PRESET_ADAPA`,
  cazador de Kidu-Lam según el guion), **época fija** (Mesopotamia en el Acto I) y
  sin editor de personaje: en su lugar, el modal muestra una ficha con el resumen
  del guion.
- **Modo libre**: editor completo (preset, colores y nombre) más época y
  densidades a medida, que es lo que había.
- El modo se guarda en `localStorage['meso.gameMode']`; el motor lo lee al
  arrancar, marca `window._storyMode` y fuerza la época a Mesopotamia en historia.
  La elección se hace en dos tarjetas dentro del modal «Nueva partida».
- La ficha enlaza con `docs/GUION-NARRATIVO.md`: Adapa, el aviso de Kishdu, el
  viaje a Nínagara y los cambios de época de los actos siguientes.

#### Estética del modal
- `styles.css` reestiliza el modal (que traía todos los estilos en línea): fondo
  oscuro con cristal, esquinas redondeadas, pestañas tipo píldora y las dos
  tarjetas de modo con filete dorado al activarse, en la línea del menú nuevo.

### 2026-09-28 (12) — Edificios en alta resolución (que el motor reduce) y menú tipo Mafia

#### Arte: del esquema a densidad 32 y remuestreo al solar
- El arte escrito a mano sigue siendo el «esquema» a densidad 4 (4 px por celda),
  pero ahora TODO el repertorio se refina ×8 (`REFINE_FAC`) añadiendo fábrica de
  verdad: hiladas, llagas alternas, **remates claros** en los bordes de material
  (coping, dintel, alféizar) y **bases en sombra**. Para detectar esos bordes se
  añade un grupo de material por carácter (`MAT`).
- Tamaños resultantes: `house 96×96`, `house_isolated 128×96`, `temple 128×128`,
  `villa 160×160`, `wall_tower 64×112`, `ziggurat 384×416`; el zigurat va con las
  juntas cada 16 px (una hilada cada 2 px del arte original) porque su dibujo ya
  trae escalinatas y hornacinas de 1 px.
- El motor ahora **reduce** ese arte al tamaño de la huella:
  - `getSpriteSourceBitmap()` guarda el arte original en un lienzo fuente (1 px
    por píxel de arte), con el lienzo ajustado a la extensión REAL de los píxeles
    —un icono heredado (`typha`) tenía el último píxel fuera de su rejilla y se
    habría recortado—.
  - `getSpriteBitmap()` acepta **escalas fraccionarias**: rasteriza con un solo
    `drawImage` de la fuente y, si está reduciendo, con
    `imageSmoothingQuality = 'high'` (al ampliar sigue nítido, que es lo que pide
    el pixel art).
  - `drawEntitySpriteAt()` ya no redondea la escala a entero en los sprites con
    rejilla: el edificio **siempre ocupa su solar** (antes, con un zoom que no
    fuera múltiplo exacto, quedaba más pequeño que su huella).
- Auditoría: 93 iconos, 0 huecos, 0 densidades fuera de rango, 0 siluetas huecas
  (el rango de densidad acepta ahora hasta 9 = tope del refinado).
- Comprobado en el juego: el HUD de rendimiento da `terreno:caché`, `sprites:14`
  y `drawImage:116` con 106 entidades por fotograma → los edificios van por el
  atajo del `drawImage`, no se pinta un `fillRect` por píxel.

#### Menú: composición tipo «Mafia: The Old Country»
- Fondo a sangre con elementos del propio juego: un `#mm-backdrop` (640×360,
  estirado por CSS) que pinta el JS con la sala en penumbra, la mesa con la
  tablilla de barro escritura, el cuenco de bronce, el haz de trigo, la vasija y
  la lámpara de aceite encendida (resplandor cálido a la derecha, polvo en
  suspensión y viñeta), más una «ventana al mundo» difuminada con `#menu-scene`.
- Encima, un menú limpio: título y lema, lista de acciones en texto con filete
  dorado al pasar el ratón (la descripción aparece sólo con el foco), la partida
  guardada en una línea discreta y los atajos abajo a la derecha
  (`↑↓ Navegar`, `Intro Seleccionar`, `Esc Salir`). `Esc` cierra el juego.
- Detalle que costó: las reglas antiguas de `#menu-*` (con `!important` y
  selectores de ID) anulaban `text-transform` y `letter-spacing` de las clases
  nuevas; hay que forzarlos en el bloque nuevo.

### 2026-09-28 (11) — Spawn en la casa aislada, arte del resto de edificios y menú moderno

#### Fix: el prólogo ya no empieza dentro del recinto del zigurat
- Al crear partida nueva el jugador aparecía **siempre al lado del zigurat**: el
  spawn se calculaba en el **centro del primer asentamiento**
  (`(v.minC+v.maxC)/2`) y ese centro es exactamente donde el planificador reserva
  el núcleo monumental (`nucleo_capital`, con el zigurat de 12×12 centrado en el
  ancla). La casa del prólogo se plantaba encima del monumento.
- Nuevo `findHomeSpotForPrologue(village, fallbackC, fallbackR)`: busca un claro
  en el campo a **14–30 celdas** del centro del pueblo comprobando que quepa la
  huella completa de `house_isolated` (4×3) más un borde, que el terreno esté seco
  y fuera del río y que no haya edificios alrededor (`npcIsOutsideSettlements`).
  Si no encuentra claro, el spawn se queda como estaba.
- El rectángulo de la casa se añade a los `extraBoxes` del pase de estructuras
  (8b), así que **ninguna estructura puede caer encima** («casa del prólogo»).
- Verificado en partida nueva: casa en (33,102) y jugador en (34,105) —la puerta—,
  a **78,5 celdas** del zigurat más cercano y con **sólo 12 celdas edificadas en un
  radio de 5** (las de la propia casa). Antes, el jugador estaba dentro del
  recinto del monumento.
- Trampa al escribir helpers en el motor: `num()` es de los submódulos de
  asentamientos y `rFullMap` es local de `generateMap`; en un helper nuevo del
  motor no existen (fallaron exactamente así: `num is not defined` y
  `rFullMap is not defined`, y el `try/catch` se lo tragaba en silencio).

#### Arte: el resto de edificios al mismo grano que las casas
- Las casas se habían afinado ×4 y los demás edificios se quedaron a densidad 4:
  al lado de una casa, un templo, un mercado o un granero parecían de otro juego.
  Ahora `refineArt()` se aplica a **todo el repertorio** (viviendas, cívicos,
  servicios, murallas y también los soviéticos), con la frecuencia de juntas
  parametrizable: `refineArt(art, 4, { coursing: 8, llaga: 8 })` para el zigurat,
  que ya trae escalinatas y hornacinas de 1 px y no admite trama fina encima.
- **`ART.house_isolated` es nuevo y tapaba el hueco más cantoso**:
  `house_isolated` apuntaba por alias a `pixel_building_isolated`, un icono que
  **no existe** en `data/entity-pixels.json`, así que el motor caía a su dibujo de
  reserva y la casa del jugador —¡la primera que se ve en la partida!— salía como
  una caja plana. Ahora es una casa de dos crujías con pretil, esteras de caña,
  vigas a la vista, ventanas con marco y arco de entrada con umbral (64×48 px).
- Tamaños tras el refinado: `temple 64×64`, `market 64×48`, `granero 48×48`,
  `villa 80×80`, `wall_tower 32×56`, `zigurat 192×208`. Auditoría: 93 iconos,
  43 edificios, **0 huecos, 0 densidades fuera de rango, 0 siluetas huecas**.

#### Menú principal modernizado
- Todo el menú lleva ya sus estilos en `styles.css` (bloque `.mm-*`) en lugar de
  estilos en línea dentro del HTML. La sección «EXTERNAL MAIN MENU» que había más
  arriba (esquinas rectas, bordes dorados de 2 px y MAYÚSCULAS, todo con
  `!important`) era la que impedía redondear nada: se ha adaptado para que sólo
  conserve los colores del tema y el filete dorado superior.
- Estructura nueva: marca + lema, acciones con icono/título/descripción (la
  principal en azul «río»), vista previa del mundo enmarcada, tarjeta de partidas
  guardadas con botón dorado y pie con los atajos.
- **Navegación por teclado** (↑/↓, Inicio/Fin y Enter), foco visible, y una sola
  columna por debajo de 860 px. Se conservan todos los `id` que usa el JS
  (comprobado con un chequeo automático de los 15 identificadores del menú).

### 2026-09-28 (10) — Menos casas y al mismo nivel de detalle que el camino

#### Dos problemas, una misma causa: el grano del píxel

1. **Densidad de viviendas.** El planificador de asentamientos colocaba las casas
   pegadas unas a otras (`gap = 0`) y la manzana residencial era sólo vivienda:
   el punto de aparición parecía un hormiguero de adobes iguales.

   - `fillBlock()` (`engine/game-engine-settlement-utils.js`) usa ahora `gap = 1`
     (callejones de una celda entre casas) y, en un **34 %** de las manzanas
     residenciales, sortea un edificio del **pool cívico** en vez de otra casa.
   - Los pools de Mesopotamia ganan variedad: pozos y graneros entran en el
     residencial; el cívico mezcla villa, casa encalada, templo, baños y granero.
   - Medido en un mapa nuevo (semilla 1234): **149 viviendas frente a 732
     edificios no residenciales** (graneros, mercados, templos, alfarerías,
     granjas, rediles, pozos, baños y villas); en el plan del capital,
     **16 viviendas / 34 edificios**.
   - Aviso para futuros parches: `DISTRICTS.mesopotamia` quedó anidado dentro de
     sí mismo al editarlo y el planificador devolvía **0 piezas** en silencio.
     Arreglado (verificado con `node --check` y con un plan de 50 piezas).

2. **Nivel de detalle.** El camino es arte generado a resolución de celda
   (1 píxel por detalle), mientras que las casas venían de un ASCII de densidad 4
   que, escalado a su huella, medía **4 píxeles de arte por píxel de pantalla**:
   parecían de juegos distintos.

   - Nuevo `refineArt(art, F)` en `tools/build-mesopotamia-sprites.js`: refina el
     ASCII ×4 añadiendo **hiladas** (cada 4 filas), **llagas alternas** (ladrillo a
     soga y tizón) y un **dither claro** en las esquinas interiores.
   - `gridOf()` multiplica por `spec.refined`, así que la familia de viviendas
     mesopotámicas se genera a **densidad 16**: el píxel de arte mide
     `(tileSize × huella) / ancho_arte` = **2 px** en pantalla (antes 4), a la par
     que el grano del empedrado.
   - La auditoría de arte acepta ese detalle (`factor <= 5.0`): 92 iconos,
     43 edificios, 0 huecos, 0 siluetas huecas → «Arte correcto».
   - Comprobación lado a lado (canvas `#detailDebug`): 3×3 celdas de camino (arte
     de 1 píxel) junto a `house` dibujada como la pinta el motor → 48×48 de
     rejilla y escala de 2,00 px por píxel de arte, con hiladas y juntas visibles.

> Regla para futuros sprites: si un edificio cubre *N* celdas y su arte mide *W*
> píxeles, el detalle en pantalla es `(tileSize × N) / W`. Para igualar el grano
> del terreno (1 px) hay que subir la densidad del ASCII, **no** el
> `BUILDING_VISUAL_SCALE`.

### 2026-09-28 (9) — Casas mesopotámicas reconstruidas

#### Arte: las viviendas no estaban a la altura del terreno
- El suelo tenía transiciones, guijarros y matas, pero las casas eran bloques
  planos de dos tonos con una fila de ventanas: de ahí que «se sintieran
  extrañas» al lado del resto.
- Se rehace el arte de la familia mesopotámica en
  `tools/build-mesopotamia-sprites.js`, con la misma construcción para todas:

  | Capa (de arriba abajo) | Detalle |
  |---|---|
  | Albardilla del pretil | tono claro con remates oscuros en las esquinas |
  | Cara del pretil | sombra del alero debajo |
  | Tejado | yeso con **esteras de caña** tendidas y **escalera de tejado** al centro |
  | Alero | **vigas de palma a la vista** (alternancia claro/oscuro) |
  | Muro | adobe con hiladas y costados en sombra |
  | Ventanas | altas, con **marco oscuro** y parteluz |
  | Entrada | **arco** con vano oscuro, jambas y **umbral** al pie |

- Afecta a `house`, `house_small`, `house_large`, `longhouse` (con dos puertas y
  ventanas repartidas), `hut` y `reed_hut` (cúpula de juncos tejida, con el
  hogar exterior bien visible) y `mesopotamian_house` (la variante encalada) y
  `house_garden` (vivienda + parcela con valla y verduras).
- Auditoría de arte en verde: 0 huecos internos y densidad correcta.

### 2026-09-28 (8) — Interiores rehechos de cero y hitboxes arregladas

#### Fix: los interiores estaban rotos
- **Se dibujaban en falso 3D** (proyección en perspectiva): los muebles se
  pintaban en posiciones que no eran las de su celda, así que la imagen y la
  colisión no coincidían. Ahora la sala se pinta en **rejilla**, con la misma
  tubería que el exterior (`getTileSize()` + `worldToScreen()`), que es la que
  usan el jugador, los NPCs y las entidades.
- **La colisión sólo bloqueaba `wall`**: se atravesaban camas, mesas y
  estanterías. Nuevo `INTERIOR_SOLID_TILES` con muros y muebles; el suelo, la
  alfombra y el vano se pisan.
- **El jugador aparecía en (1,1)** (dentro del muro) porque `entryCol/entryRow`
  estaban dentro de la planta y el motor los lee en la raíz. Ahora van en los dos
  sitios.
- **Los ficheros de interiores se rehacen de cero** desde arte ASCII con
  `tools/build-interiors.js`, que **valida** el perímetro de muros, las filas de
  distinto ancho y que el vano esté en las dos filas que espera el motor. Los 6
  interiores (casa, casa grande, casa con huerto, torre de 3 plantas y casa del
  jugador con su familia) pasan la validación.

#### Fix: hitboxes de los sprites
- Sólo bloquean los árboles y los recursos grandes: la vegetación menuda
  (hierbajos, hierba alta, flores, arbustos) se pisa. Antes cualquier recurso
  bloqueaba su celda entera y el personaje chocaba «con el aire».

### 2026-09-28 (7) — Bordes de bioma detallados y niebla en el mapa de la M

#### Feature: transiciones entre biomas (bordes de 16 bits)
- Nuevo `MESO_TEXTURES.drawTransition()`: orilla de agua somera con espuma y
  arena mojada en el lado de tierra, y dither de píxeles alternos entre tierras
  (arena↔hierba, bosque↔estepa…) más difuminado de **esquinas** en diagonal.
- Se pinta en las dos cachés de terreno (ortogonal e isométrica), antes de las
  texturas de camino; los caminos quedan fuera porque ya tienen bordillo.
- Categorías con `biomeEdgeKind()` y 8 direcciones con `biomeEdgeNeighbours()`.
  Ver §8.9.

#### Feature: la niebla también en el mapa cenital (M)
- `drawWorldMapOverlay()` dibuja la misma capa de niebla escalada a su rejilla:
  lo no explorado sale negro en el mapa grande, no sólo en el juego y el minimapa.

### 2026-09-28 (6) — Niebla de guerra, botón de edición visible y ajustes de control

#### Feature: niebla de guerra (lo no explorado, en negro)
- Nueva capa `drawFogOfWar()` con exploración por celda (`window._explored`) y
  lienzo de 1 px por celda escalado al mapa. Encendida por defecto; se prueba en
  **Dev ▸ Niebla de guerra** (casilla) + botones *Revelar todo* y *Ocultar todo*.
  API `MESO_FOG` (`enable/toggle/clear/revealAll/stats`). Ver §8.8.
- Se dibuja después del mundo (tapa terreno, edificios y entidades) y antes del
  HUD; el minimapa lleva su propia capa de niebla.

#### Fix: el botón de modo edición no se veía
- Estaba dentro del menú superior, que arranca **oculto**: ahora es un botón
  fijo en la **esquina superior izquierda** (`left:10px; top:8px`, z-index 4400),
  con texto ✏️ Editar / 🎮 Jugar y su insignia de «MODO EDICIÓN» arriba.

#### Fix: el sprite del personaje se veía invertido respecto al movimiento
- El arte detallado de Mesopotamia está dibujado al revés que el soviético, así
  que se espeja solo para esa época (`artMirrored` en `drawCharacterPixels`).

#### Tuning: caminar más lento y zoom inicial más cercano
- Velocidad al caminar: `6/TILE` → **`4.3/TILE`** (≈ 4,3 celdas/s en vez de 6).
- Zoom inicial: `1` → **`1.5`**, para que al empezar se vea el terreno con
  detalle en vez del mapa entero.

### 2026-09-28 (5) — Guion unificado, objetivos elegibles y botón de modo edición

#### Guion: `docs/GUION-NARRATIVO.md` reescrito como canon único
- Había **dos borradores enfrentados** (el de «Operación Zigurat»: pulso
  geomagnético de 1926 en Novozarya; y la sinopsis del manual: diluvio anunciado
  en Kidu-Lam) y el borrador largo describía sistemas que no existen en el motor.
- El documento se ha reescrito con: estado de cada cosa (✅ implementado ·
  🟡 escrito, pendiente · ◇ propuesta · ❌ contradicción resuelta), **Acto I
  escena a escena con los diálogos que ya están en el juego**, Actos II–IV con la
  crisis de tres botones y las tres rutas, los sistemas narrativos marcados con
  lo que les falta, y una lista de **pendientes por rentabilidad**.
- Se resuelve la contradicción de los dos borradores: es la misma anomalía vista
  desde las dos épocas, y el prólogo en casa es uno de los cruces de Adapa.

#### Feature: objetivos elegibles (el «plantar» ya no es obligatorio)
- El panel «Objetivo activo» mostraba siempre el último objetivo puesto; en el
  prólogo eso significaba ver «preparar cultivo» una y otra vez.
- Ahora hay un registro (`window._objectives`, API `MESO_OBJECTIVES`) con
  objetivos `mission` y `free`, y el jugador elige: **O** cambia, **Alt+O**
  vuelve, **Shift+O** lo aparta, y el panel trae los botones *Cambiar*,
  *Ocultar* y *Mostrar* con el contador «Objetivo 2 de 4».
- El prólogo registra tres objetivos libres («Reconocer los alrededores»,
  «Hacer acopio», «Hablar con tu familia») que **se completan solos** al cumplir
  su condición (`updateFreeObjectives()`, revisado cada 700 ms).
- La misión de historia nunca se pierde: sigue en la lista aunque se aparte.

#### Feature: botón para entrar y salir del modo edición
- Botón **✏️ Editar / 🎮 Jugar** en el menú superior, junto a «Ver» y la cámara,
  con color de estado y tooltip; más una insignia fija arriba mientras el editor
  está activo. `setEditMode()` refresca ambos (`updateEditModeButton()`).

### 2026-09-28 (4) — Rendimiento: tres cachés y un arranque 30× más rápido

#### Fix: el terreno se redibujaba entero en cada fotograma
- El render tenía la caché **desactivada a propósito**
  (`const _useCache = false; // Disabled: always render live…`) y pagaba el
  precio: decenas de miles de `fillRect` por fotograma (bioma + textura de
  camino + bordillos + puentes + detalle del bioma) más el trabajo duplicado de
  construir la caché para no usarla.
- Ahora el terreno se vuelca con **un solo `drawImage`** y encima sólo se anima
  el agua **visible** (`drawWaterAnimCell`, 3 trazos por celda).
- La caché isométrica se completa con caminos, puentes y detalle del bioma
  (antes sólo tenía colores planos, por eso en isométrico se perdían las calles).
- Efecto lateral buscado: al no suavizar la caché (`imageSmoothingEnabled =
  false`) el pixel-art se ve más nítido, como el resto del juego.

#### Fix: los sprites se dibujaban píxel a píxel
- `drawEntitySpriteAt` hacía un `fillRect` por píxel: 144 en una casa, 2.496 en
  el zigurat, y el mapa tiene cientos de edificios y entidades.
- Nuevo `getSpriteBitmap()`: cada sprite se rasteriza **una vez** en un lienzo
  offscreen (clave: nombre + escala) y se pega con un `drawImage`. Límite de 64
  MB y `window.clearSpriteBitmaps()` para vaciarla. Los sprites con viento
  (`sway`) siguen por píxeles: son matas de 14 px y necesitan doblarse por filas.

#### Fix: el minimapa recorría el mapa entero cada fotograma
- `drawMiniMap` escaneaba 21.600 celdas del grid (edificios) + 2.400 de terreno
  **por fotograma**. Ahora su capa estática es una caché que se refresca como
  mucho cada 1,5 s; por fotograma sólo quedan el punto del jugador y la guía de
  la misión.

#### Fix: el arranque tardaba minutos (carga de sprites O(n²))
- `generateSpriteImages()` escribía la caché de sprites **completa** en
  `localStorage` dentro del bucle, una vez por sprite, y codificaba cada sprite a
  PNG con `toDataURL` (96 sprites × ~1,5 s).
- La persistencia pasa a ser opcional (`ENABLE_SPRITE_PERSIST_CACHE`) y se hace
  **una sola escritura al final**; el bucle cede el hilo cada 8 sprites para que
  el indicador de carga se mueva.

#### Feature: HUD de rendimiento
- Menú **Dev ▸ Rendimiento (HUD)** (o `MESO_DEBUG.perf.toggle()`): FPS, ms por
  fotograma (mediana y p95), llamadas de dibujo, estado de la caché de terreno
  (avisa en rojo si está **en vivo**), sprites rasterizados y MB que ocupan.
- El diagnóstico `#engine-status` incorpora el mismo resumen.

### 2026-09-28 (3) — Zigurat macizo, escalas y puentes transitables

#### Fix: el zigurat ya no se ve transparente (y es mucho más grande)
- Arte rehecho por completo: **48×52 px para una huella de 12×12** (antes 36×41
  para 9×9). Ahora es una pirámide escalonada **vista desde arriba**, con cinco
  terrazas concéntricas, y el recinto base ocupa TODO el rectángulo del sprite:
  **0 píxeles transparentes** dentro de la huella (2.496 de 2.496 escritos).
- Más detalle: hiladas y juntas de ladrillo, hornacinas cada 8 px, jardines
  colgantes en dos terrazas, escalinata con rellanos y balaustradas con capitel
  dorado, santuario con techo de oro, cuernos y estandartes, almenas,
  contrafuertes, puerta monumental, estatuas, escaleras laterales y orla dorada.
- `tools/audit-sprites.js` incorpora la comprobación **«silueta maciza dentro
  de la huella»** (`MUST_BE_SOLID`): si un edificio monumental deja ver el suelo
  dentro de su caja, la auditoría falla. También lee ya el catálogo literal
  `BUILDINGS = {…}` (antes sólo auditaba los tipos asignados con `BUILDINGS.x =`,
  así que casa, templo o zigurat se libraban del control de densidad).
- Conjuntos ajustados a la huella nueva: `nucleo_capital` y `zigurat_complejo`
  mueven calles, palmeras, mercado, pozo y casa fuera del cuadrado de 12×12
  (verificado: 0 solapes y 0 celdas de camino dentro de la huella).
- Las partidas guardadas completan la huella del zigurat al cargar
  (`growLegacyZiggurats`), **rellenando sólo celdas libres**: nunca pisa otro
  edificio, así que no puede crear solapes.

#### Tuning: vegetación mucho más pequeña y edificios más grandes
- `VEGETATION_SIZE_SCALE = 0.34`: los hierbajos pasan de 42 px (1,31 celdas,
  ¡más altos que el personaje!) a ~14 px (0,44 celdas). Los árboles bajan un 15 %
  (`TREE_SIZE_SCALE = 0.85`).
- `BUILDING_VISUAL_SCALE = 1.25`: todos los edificios se dibujan un 25 % más
  grandes que su huella (volumen y aleros). Se excluye la infraestructura que
  tiene que encajar celda a celda —caminos, murallas, torres, arcos y puertas,
  parcelas, complejo metalúrgico y farolas— para no romper el tiling.
- Las dos escalas son **sólo visuales**: la huella y las colisiones no cambian.

#### Fix: no se podía cruzar por los puentes
- Nuevo predicado único `isWaterCell()` (agua = ni puente) usado por
  `movementMultiplier`, `canWalkTo`, la postura de nado del jugador y el salto.
  Antes el puente era agua a efectos de movimiento: se cruzaba **nadando**
  (velocidad 0.35, cuerpo hundido y sin salto).
- `buildBridges()` retira la calzada anotada como edificio sobre el agua en vez
  de detenerse, de modo que el tramo llega a la otra orilla.
- El mapa de puentes se guarda con la partida (`serializeBridgeMap` y
  `restoreBridgeMap`) para no perder el dibujo al recargar.
- Comprobado: 57 celdas de puente, **0 tratadas como agua**, velocidad 1 en
  todas, transitables todas, y 23 de 23 tramos con los dos extremos en tierra.

### 2026-09-28 (2) — Zigurat gigante y mundo animado

#### Feature: el zigurat es ahora la maravilla del mapa
- Arte **procedural** de 36×41 px para una huella de **9×9 celdas** (antes 5×5
  con 20×22 px): cinco terrazas escalonadas, hiladas alternas, nichos cada 4 px,
  jardines colgantes en los bordes, escalinata central con peldaños y muros de
  acompañamiento, santuario con puerta y estandartes, recinto con bastiones y
  puerta monumental, y sombra de contacto. En pantalla mide 216×246 px, siete
  veces una casa.
- La huella y el arte van juntos: `BUILDINGS.ziggurat` pasa a 9×9. Verificado
  en el mundo con `auditMap()`: **2 zigurats × 81 celdas = 162 celdas**, 0
  solapes, 0 celdas fuera del mapa, 0 desconocidos y 0 sobre el agua.
- Sección de manual: **§5.11 El Zigurat mayor (arte procedural)**.

#### Feature: los hierbajos se mueven con el viento
- `windStrength()` (rachas globales) + `swayPhaseOf(ent)` (fase estable por
  entidad) + `sway`/`phase` en `drawEntitySpriteAt`. El vaivén se reparte fila a
  fila: la base queda clavada y la punta oscila. Aplicado a los cuatro puntos de
  dibujo de hierbajos (suelo y overlay de copas). Verificado en pantalla: 5 de 6
  instantáneas del lienzo difieren al dejar pasar el tiempo.
- Sección de manual: **§8.6 Animación: viento y personajes**.

#### Feature: animación de personajes
- `characterAnimState(ent, now)` → `{ frame, bob, lean, swing, squash }`:
  **ciclo de 4 pasos** (antes 3), detección del avance por delta de `_walkTime`,
  respiración en reposo, inclinación al esprintar, aplastamiento al recibir
  daño y brazos que acompañan el golpe.
- `triggerCharacterSwing(ent, power)` se dispara al golpear con el arma y al
  empezar a talar; dura 300 ms.
- Comprobado con `MESO_DEBUG.testDraw.animState`: frames 0-1-2-3, `bob` −1/0/1
  andando, `bob` −2 e `lean` 1 esprintando.
- Nota de rendimiento: todo el estado se calcula por personaje y fotograma a
  partir de datos que ya existían (`_walkTime`, `_isSprinting`, `_fxShake`), sin
  asignaciones nuevas en el bucle de dibujo.

### 2026-09-28 — Caminos, murallas, puentes, misiones del yermo y detalle del terreno

#### Fix: el zigurat (y cualquier edificio grande) era invisible
- El recorte de dibujo usaba un margen fijo de 4 celdas sobre la vista, pero un
  edificio se dibuja desde su celda ANCLA: con el zigurat (huella 11×11) el ancla
  quedaba fuera del encuadre y **no se dibujaba nunca**. Ahora el margen es el del
  edificio más grande del catálogo (`getMaxBuildingTiles()`).
- El zigurat pasa de huella 11×11 con arte heredado (64×64 px) a huella 5×5 con
  arte propio a densidad 4 (20×22: cuatro terrazas, jardines y escalera central)
  *(superado en 2026-09-28 (2): ahora 9×9 con arte de 36×41 px, ver §5.11)*.

#### Fix: la caché de terreno tapaba el trabajo de texturas
- `rebuildMapCachesAsync` pinta el terreno por biomas con colores PLANOS y el
  juego usa esa caché: las texturas de camino, los puentes y el detalle del bioma
  no se veían nunca (sólo en el fotograma previo a tener caché). Ahora la caché
  pinta también camino (empedrado + bordillos), puentes y detalle, pasándole su
  propio contexto a `MESO_TEXTURES`.

#### Feature: puentes
- Donde una vía toca el agua y llega a la otra orilla se construye un **puente**
  de tablones con barandilla y travesaños, y la celda queda transitable
  (`window._BRIDGE_MAP`: 1 = horizontal, 2 = vertical). Donde no llega a la otra
  orilla, la calzada sobre el río se sigue retirando.

#### Feature: detalle del terreno
- Capa fina por bioma (dunas y guijarros en la arena, matas y flores en el césped,
  grietas secas, costras de sal, juncos en el marjal, rocas en las colinas…) con
  `MESO_TEXTURES.drawDetailTile`, cacheada por bioma y tamaño. Sustituye a los dos
  rectángulos verdes que se dibujaban a mano en los biomas fértiles.

#### Feature: misiones aleatorias de los NPCs del yermo
- `npcIsOutsideSettlements()` + `createWildMissionForNpc()`: los NPCs lejos de un
  núcleo urbano encargan cosas concretas con un SITIO al que ir («¿Qué hace mi
  hijo en la cueva?», «la cabra perdida», «ruinas al horizonte», «el pozo seco»)
  el 55 % de las veces; el resto sigue siendo la rutina de recolectar/craftear.
- La misión de la cueva **levanta la cueva** (sprite `cueva`) y un NPC niño al
  lado: se puede ver, encontrar y completar. Se completan al llegar
  (`watch: 'reach'` + `updateReachMissions()`), con recompensa y aviso.
- Nuevos **caminantes del yermo** (paso 8c de `generateMap`): NPCs sueltos por el
  campo, lejos de los pueblos, que reparten estos encargos.

#### Fix: nada de caminos ni vegetación en el río
- El agua se dibujaba con `isRiver()`, que al cargar una partida guardada caía a
  un rango de columnas fijo (el mapa de meandros no se guarda) → banda de agua
  pintada sobre tierra, con árboles y caminos «dentro del río». Ahora el agua se
  dibuja por bioma y al cargar se reconstruye `_RIVER_FULL_MAP` desde los biomas.
- `isRiver(col)` sin fila usa el índice real de columnas con agua
  (`_RIVER_COLS`), no el rango fijo: se acabaron las vías de acceso y los
  corredores soviéticos pintados encima del río.
- Pasada final de coherencia: si el mapa de río dice agua, el bioma pasa a agua y
  se retira la calzada que hubiera encima.
- Siembra de recursos/hierbajos excluye calzada y agua, y una limpieza final
  retira vegetación y recursos de calzada, agua y edificios.
- `canal_road` (corredor logístico) vuelve a dibujarse como tierra apisonada, no
  con textura de calzada.

#### Fix: las murallas no se ven separadas
- El parapeto de `wall_segment_h`/`_v` es continuo y las aspilleras son píxeles
  oscuros: antes eran huecos transparentes y dos celdas seguidas parecían
  bloques sueltos.

#### Feature: puertas de ciudad
- Hueco de 2 celdas por lado con torres flanqueándolas y arco monumental
  (`mesopotamian_arch` 2×1 en norte/sur, `mesopotamian_gate_v` 1×2 en este/oeste).
- La puerta se coloca como entidad ambiental **pasable**: el vano se atraviesa
  (antes se intentaba como edificio de 2×1 en un hueco de 1 celda y no aparecía
  ninguna). La capital soviética, sin muralla, deja el bulevar abierto.

#### Fix: edificios con transparencias
- `ziggurat` usaba el icono heredado de 64×64 px para una huella de 96 px: se
  dibujaba pequeño y con agujeros. Ahora tiene arte propio a densidad 4 *(y
  desde 2026-09-28 (2) arte procedural de 36×41 px, ver §5.11)*.
- Auditoría de **huecos internos** en toda la biblioteca: corregidos el redil
  (corral de tierra, no transparente), la atalaya y la torre (troneras oscuras)
  y la casa con huerto. Quedan 0 huecos en edificios.
- Auditoría de **densidad de arte**: fábrica, almacén estatal, sede del partido
  y bloque soviético tenían arte a 2-3 px por celda (mosaicos) y ahora están a
  densidad 4. El **complejo metalúrgico** (10×10) se dibuja como una retícula de
  módulos industriales de 2×2 en vez de un sprite gigante.
- Nueva herramienta: `node tools/audit-sprites.js [--strict]`.

#### Feature: sistema de partículas y sacudidas (`engine/game-engine-fx-utils.js`)
- Polvo al andar (color del bioma), virutas al talar, chispas al golpear y un
  pequeño vaivén en la entidad golpeada o talada.
- `entityScreenPos(ref)` aplica la sacudida; `window.MESO_FX` expone la API
  completa (`spawn`, `burst`, `onWeaponHit`, `onFootstep`, `shake`, …).

#### Feature: texturas de camino con autotiling (`engine/game-engine-textures.js`)
- Los caminos ya no se dibujan con cuadros planos: empedrado/hormigón generado a
  la resolución de la celda, 6 variantes deterministas, tiling continuo y
  bordillos que sólo cierran donde la calzada no continúa.
- Roderas en los tramos rectos.

#### Feature: murallas con sprite propio
- `wall_segment_h`, `wall_segment_v` y `wall_tower` nuevos en
  `tools/build-mesopotamia-sprites.js`; `drawBuilding` elige el sprite según la
  orientación guardada en la celda (`orient`) y deja el dibujo procedural como
  respaldo.

#### Fix: los caminos se saltaban su rama de dibujo
- `concrete_road` (alias de `road`) caía en la rama genérica de sprites y
  `road` estaba excluido a mano; ahora los tipos de suelo se dibujan con
  `drawPathCell` y nunca con sprite.

### 2026-09-25 (3) — Estructuras (conjuntos) y atajo de cámara

#### Feature: sistema de estructuras (conjuntos preparados)
- Nuevo `engine/game-engine-structures.js`: cada conjunto es una plantilla con desplazamientos relativos (`dc`/`dr`) respecto a un ancla, con piezas obligatorias u opcionales (`required`, `chance`), caminos (`terrain`), decoración (`entities`) y habitantes (`npcs`).
- Nueva pasada **8b** en `generateMap`: reparte los conjuntos por el mapa respetando bioma, distancia al agua, separación con villas/jugador/otros conjuntos y `maxPerMap`, con giros y espejados aleatorios y carretera de acceso a la villa más cercana.
- 10 conjuntos incluidos de serie: complejo del zigurat, recinto del templo, plaza de mercado, granja compleja, embarcadero, atalaya de frontera, bloque vecinal, puesto de control, granja colectiva y núcleo industrial (los cuatro últimos, exclusivos de URSS).
- El **núcleo cívico del capital** ahora se levanta con la plantilla `zigurat_complejo` (con el trazado clásico como respaldo si no cabe).
- Los conjuntos colocados se guardan en `window._STRUCTURES` y se persisten con la partida.
- Opcional: `data/structures.json` (lee por preload en Electron y por `fetch` en navegador).
- Editor visual en el panel del modo debug (F9) → sección **«Estructuras»**: colocar en el cursor, borrar, generar en el mapa, **capturar zona** (convierte lo que haya alrededor en plantilla), guardar/importar/exportar catálogo.
- Guía: [`docs/ESTRUCTURAS.md`](docs/ESTRUCTURAS.md).

#### Fix/Feature: `T` cambia entre cámara libre y de seguimiento
- **T** alterna cámara libre / seguimiento del jugador (y `L` se mantiene por compatibilidad). El botón «Ir a jugador» sigue funcionando y ahora su etiqueta indica el estado (`Seguir: ON (T)`).
- Para liberar la tecla, el **Templo** pasa de `T` a **`Y`** en el mapa de atajos de construcción (el resumen del diario se genera solo).
- La `T` no se pisa si va con `Ctrl`/`Alt`/`Meta`.

### 2026-09-25 (2) — Barra de menú superior inaccesible

#### Fix: no se podía clicar ningún elemento del menú superior
- **Causa**: `createMenuBar()` arranca la barra oculta (`top: -44px; opacity: 0; pointer-events: none`) y solo la revelaba si el ratón entraba en los **primeros 8 px** de la ventana (`ev.clientY <= 8`). Sin ninguna pista visual, y en Electron (ventana sin marco, `thickFrame` por defecto) esa franja coincide con el área de redimensionado, así que el `mousemove` podía no llegar nunca al renderer. Resultado: el menú era inalcanzable.
- **Fix**: pestaña **☰ MENÚ** siempre visible en el centro del borde superior (se abre al pasar el ratón, se fija con un clic), atajo **F10**, y controles **📌 Fijar / ▴ Ocultar** dentro de la barra.
- Se elimina el ✕ "Cerrar Menú superior": era un botón que **no hacía nada**, porque `styles.css` fuerza `display: flex !important` en `#top-menubar` y anulaba el `display:none`.
- `top-menubar` ya no se registra como panel flotante: guardaba y restauraba su propia posición de oculto (`top: -44px`) en `meso.appState`.
- El pin mantiene la barra visible aunque el ratón se aleje; `Esc` la suelta.

### 2026-09-25 — Auditoría + Modo Debug / Inspector

#### Feature: Modo Debug / Inspector visual (F9)
- Nuevo `engine/game-engine-debug-utils.js` (`createDebugTools(deps)`, mismo patrón que el resto de `*-utils.js`).
- **F9** (o botón `🔧 Debug (F9)` en la barra Dev) activa rejilla, cajas de colisión reales, etiquetas de sprite, lectura de casilla y **pausa del mundo** para ajustar quieto.
- Clic = seleccionar · Arrastrar = **mover en vivo** · Flechas = ajuste fino · `[` `]` escala · `,` `.` `;` `'` offsets · `Ctrl+Z` deshacer · `Supr` borrar.
- Ajustes **por clave de sprite** (todas las copias), **por tipo de edificio** y **por entidad** (escala, offset X/Y, alfa).
- **Colocar sprite**: escribe una clave y colócala en el mundo para inspeccionarla (caja roja = clave no registrada).
- **Exportar JSON** → `data/sprite-adjustments.json`; el motor los aplica siempre (también empaquetado, vía `electron/preload.js`).
- `drawEntitySpriteAt(name, x, y, w, h, { ent })` aplica los ajustes y registra el rectángulo realmente dibujado para que el overlay sea exacto.
- Manual completo: [`docs/MODO-DEBUG.md`](docs/MODO-DEBUG.md).

#### Fix: colecciones de entidades no publicadas en `window`
- `window.entities` / `rabbits` / `foxes` / `graves` **nunca se asignaban**, pero `SceneManager.ensureBuilt()`, las utilidades de selección RTS y la precarga de sprites los leían.
- Consecuencia: índice espacial siempre vacío, selección por caja y "enviar a recolectar" sin efecto, `totalEntities: 0` en el HUD.
- Arreglado en `engine/entities.js`.

#### Fix: `window.player` no existía
- `shouldRenderDetailsForEntity()` / `shouldUpdateEntity()` medían la distancia desde (0,0) en vez de desde el jugador (LOD y throttling erróneos).
- Las cinemáticas llamaban al protagonista siempre "el camarada" en vez de usar su nombre.
- Arreglado publicando `player` en `window`.

#### Fix: protocolo `meso-local://` nunca registrado
- `registerLocalProtocol()` se llamaba antes de `app.whenReady()` → *"Session can only be received when app is ready"*.
- El fallback de lectura de datos JSON en Electron no existía. Arreglado en `electron/main.js`.
- Además faltaban los **privilegios del esquema**: `protocol.registerSchemesAsPrivileged([... supportFetchAPI: true ...])` antes de `whenReady` (si no, `fetch('meso-local://…')` da *"URL scheme is not supported"*), y la ruta se construye como `url.host + url.pathname`.

#### Fix (sólo Electron): `GLOBAL_TREE_TEMPLATES` antes de inicializarse
- Si los datos vienen del preload, `loadLibrary()` era 100 % **síncrona** y se ejecutaba durante la evaluación del módulo → `ReferenceError: Cannot access 'GLOBAL_TREE_TEMPLATES' before initialization` (TDZ).
- Consecuencia: en el `.exe` los árboles perdían las plantillas pixel-art del JSON — el ejecutable se veía distinto que el modo desarrollo. En navegador quedaba enmascarado por el `await fetch(...)`.
- Arreglado con un `await Promise.resolve()` al inicio de `loadLibrary()`.

#### Fix (sólo Electron): datos del preload congelados por `contextBridge`
- `contextBridge` congela en profundidad lo que expone → `TypeError: Cannot add property soviet_block_warm, object is not extensible`, y se perdían las variantes derivadas de sprites (75 claves en Electron vs 79 en navegador).
- Arreglado con `clonePixelLibrary()`, que hace una copia editable de `{grid, pixels}`.

#### Fix: música MIDI de intro (404)
- Se pedía `data/Sounds/ussr.mid`; el archivo está en `data/Music/ussr.mid`.
- Ahora hay lista de candidatos y no se pide el archivo si el parser del CDN no cargó.

#### Fix: guardado limpio
- Los sprites de prueba del modo debug y los campos `_dbgRect` ya no se serializan en `meso.appState` (`stripTransientDebugFields`).

#### Feature: arte nuevo de los edificios mesopotámicos (`tools/build-mesopotamia-sprites.js`)
- El pixel-art se escribe como rejillas de texto y un script lo vuelca en `data/entity-pixels.json` (validando tamaño, proporción y línea de suelo). 25 sprites de arte propio + variantes.
- **Densidad uniforme de 4 px por celda** y rejilla con la proporción de la huella: casa 3×3 → 12×12; casa comunal 5×2 → 20×8; arco 2×1 → 8×4; pozo 4×6 y atalaya 4×10 (sobresalen hacia arriba). Todo el pixel-art queda al mismo tamaño de píxel en pantalla.
- `drawEntitySpriteAt` ahora soporta rejillas no cuadradas (`gridW`/`gridH`): manda el ancho, sin deformar y sin desbordar, y `clonePixelLibrary` conserva esos campos (si no, se perdían al cargar).
- Redibujados: casa, casa pequeña, casa grande, casa con huerto, casa de piedra, casa mesopotámica (+variante sombreada), casa comunal, choza, choza de caña, campo, parcela, templo, mercado, granero (silos de cúpula), baños, arco, villa noble, pozo, fuente, alfarería, redil, embarcadero, atalaya, torre y farola.
- Sprite nuevo para `soviet_superblock` (era invisible) y **alineado de los 26 sprites que flotaban** (bloque soviético, casa del Soviet, clínica, fábrica, almacén, granja colectiva, puerta de control, complejo metalúrgico, pozo… todos +2 a +5 filas hacia abajo).

#### Fix: la mitad de los edificios no se dibujaban
- La rama que dibuja el sprite estaba limitada a las casas (`houseTypes`), así que todo lo demás caía al dibujo procedural… y lo que no tenía rama ahí (fábrica, clínica estatal, almacén estatal, casa del Soviet, granja colectiva, puerta de control, complejo metalúrgico, superbloques, pozo, alfarería, redil, embarcadero, atalaya, torre, farola) se dibujaba como **nada**: sólo una sombra oscura en el suelo.
- Ahora cualquier edificio con sprite registrado usa su sprite; el dibujo procedural queda como respaldo.
- La sombra del edificio pasa de rectángulo oscuro a elipse de contacto (el rectángulo era lo único que se veía de los edificios sin sprite).
- `soviet_block` se dibujaba a 4,5× su huella (13,5 celdas de ancho, se comía las manzanas vecinas): ahora 1,5× (≈4 celdas).

#### Feature: galería de sprites en el panel de debug (F9)
- F9 → «Colocar sprite» → **🔍 Ver biblioteca de sprites**: los 90 sprites en grande, con las reglas reales del render, cada uno dentro de la caja de su huella, con buscador y el dato de rejilla/huella.

#### Limpieza y documentación
- Borrados los restos de redirecciones rotas en la raíz: `0`, `button`, `x.type`, `{` y `setJsonTextModalOpen(false)` (este último estaba **versionado en git**).
- `guión` (guion narrativo sin extensión) → **`docs/GUION-NARRATIVO.md`**.
- `engine/death-system.js` (0 bytes), `engine/input.js`, `engine/map.js`, `engine/renderer.js`, `engine/ui.js` y `game.js`: marcados con cabecera `⚠️ PLACEHOLDER — NO IMPLEMENTADO` (seguían pareciendo módulos reales, y el manual los describía como si tuvieran contenido).
- `docs/AUDITORIA.md`: informe de la sesión (averías corregidas + pendientes con evidencia).

#### Herramientas
- `scripts/dev-server.js`: servidor estático para probar en navegador (`?debug=1`, `?editor=1`).
- `docs/AUDITORIA.md`: informe completo con hallazgos pendientes (variantes de árbol sin sprite, colisiones de atajos H/K/G/P/Espacio, dependencias CDN de audio, archivos basura, stubs).

#### Feature: planificador de asentamientos (`engine/game-engine-settlement-utils.js`)
- Las ciudades, bases militares y aldeas se generan con una **rejilla de manzanas por distritos** en vez de listas de posiciones sueltas con saltos aleatorios del 18 %/35 %. Ver §5.6.
- `spawnVillage` pasa a ser el *aplicador* del plano: aplana el recinto, pinta el viario, coloca edificios, muralla, puertas y mobiliario, y registra las piezas como viviendas de la villa. El trazado clásico queda como respaldo (presets de zona).
- Saliencia antes → después en un mapa nuevo:
  | asentamiento | densidad | cobertura de calles |
  |---|---|---|
  | capital | 0,21 → **0,33** | 0,18 → 0,18 (pero con retícula real en vez de una calle y caminos en estrella) |
  | base militar | 0,12 → **0,27** | **0,51 → 0,17** (media ciudad sin querer era asfalto fuera del muro) |
  | aldea | 0,21 → 0,15-0,20 | 0,13 con viario coherente |
- Nuevo conjunto `nucleo_capital` para el núcleo monumental (zigurat + explanada + vía procesional), dimensionado para el hueco reservado de 17×17.
- La capital soviética no lleva muralla de adobe: usa bulevares y `checkpoint_gate` en las avenidas.

#### Fix: edificios sin huella definida
- `temple`, `market`, `granary`, `factory` y `state_warehouse` no tenían `size` y ocupaban **1 sola celda**: el sprite se dibujaba diminuto y otros edificios cabían literalmente dentro. Ahora tienen 4×4, 4×3, 3×3, 5×4 y 4×3.

#### Fix: `Cannot read properties of undefined (reading 'prodWheat')`
- El grid se restaura tal cual desde la partida guardada, así que puede contener **tipos de edificio antiguos o ya inexistentes** (p. ej. `guard_booth`, que estaba declarado como pieza de una estructura en vez de como mobiliario). `applyDailyProduction` hacía `BUILDINGS[info.type].prodWheat` sin comprobar y **abortaba el fotograma entero cada cambio de día** (visible en la consola del usuario el 26 y 27 de septiembre).
- Ahora hay un resolutor seguro `getBuildingDef(type)` (tabla del motor → `data/entities-defs.json` → respaldo con producción 0) que **nunca** devuelve `undefined`, se usa en producción, demolición, dibujado, nombres y construcción, y se avisa una sola vez por consola del tipo desconocido.
- Además, al cargar una partida `normalizeRestoredGrid()` convierte las celdas guardadas como texto (formato antiguo) en objetos y avisa de los tipos que ya no existen.
- `guard_booth` ya no se escribe en la rejilla: `puesto_de_control` lo declara como entidad.

#### Feature: auditoría y planos desde el modo debug
- `MESO_DEBUG.auditMap()`: cuenta los edificios por tipo, detecta tipos desconocidos, **huellas solapadas**, edificios sobre agua y huellas fuera del mapa (todo lo que hacía que las ciudades pareciesen rotas).
- `MESO_DEBUG.mapSnapshot(col0, row0, w, h)` + `MESO_DEBUG.legend()`: vuelcan una ventana del mapa lista para dibujar un plano fuera del canvas del juego (útil con la ventana oculta o para revisar a vista de pájaro).
- `MESO_SETTLEMENTS.planSettlement({type, cx, cy, epoch, seed})`: genera un plano sin tocar el mundo (revisable, reproducible por semilla).

### 2026-03-16

#### Feature: Control de velocidad de tiempo
- `window._timeScale` (0 = pausa, 0.5, 1, 2, 4) controla la velocidad de todo el juego.
- `gdt = dt * timeScale` sustituye a `dt` en toda la simulación: movimiento del jugador, animación de andar, dayHour, survival tick.
- Widget DOM flotante (⏸ ½× 1× 2× 4×) en la esquina inferior derecha, con botón activo resaltado en dorado.
- **Espacio** pausa / reanuda desde cualquier velocidad.
- Indicador de canvas: "⏸ PAUSA" parpadeante en el centro al pausar; "N×" semitransparente en otras velocidades.

#### Fix: Proporción del jugador con zoom
- **Problema**: la escala del sprite del jugador usaba `Math.floor(Math.min(tileSize, 32) / 10)`, que congelaba el multiplicador en `3` para cualquier zoom ≥ 1. El personaje se veía minúsculo al hacer zoom in y enorme al hacer zoom out.
- **Solución**: `Math.max(1, Math.round(tileSize / 10))` — proporcional al tamaño de celda a cualquier zoom.
- **Afecta**: función `drawPlayer()`, rama `ortho` y rama `iso`.

#### Feature: Sistema de historia y narrativa
- Intro cinemática de 4 fases con texto de trasfondo y título del juego.
- Panel de diálogo cinemático (borde dorado, nombre del NPC, word-wrap, contador de líneas).
- NPCs de historia con `_storyLines[]`: Kishdu el Anciano, Sacerdotisa Enlil-Ama, Escriba Imitti.
- Escáner de proximidad del overworld ampliado: detecta NPCs a ≤1.5 tiles.
- E-key unificado: adelanta diálogos abiertos antes de cualquier otra acción; también salta la intro.

#### Feature: Generación de pueblos mejorada
- `spawnVillage()` con tipos: `origin`, `village`, `capital`, `trading_post`.
- Cada tipo tiene su propia cantidad y variedad de edificios + NPCs con roles apropiados.
- Flora contextual: cedada cerca de pueblos, palmeras datileras en la capital.

### Sesión anterior (antes de 2026-03-16)

- Depth sort de edificios vs jugador (dos pasadas: `_deferredBuildings[]`)
- `BUILDING_SCALE = 1.0` — sprite = footprint de colisión exacto
- Ciclo día/noche suave (9 fases de cielo, estrellas, torch vignette)
- Sistema de stamina (sprint con Shift, drain/regen, cooldown)
- HP regen pasivo (5s tras recibir daño, ~4 min para regeneración completa)
- Enemigos atacan al jugador (daño, `_flashUntil`, floating text)
- Mini-mapa (140×90 px, bottom-right)
- HUD de supervivencia mejorado (HP + tiempo de juego)
- NPCs duermen de 22:00 a 05:00
- Diálogos de amanecer/atardecer
- Sprites de mobiliario interior (6 iconos en `entity-pixels.json`)
- 6 tipos de flora mesopotamia en `entities.js`
