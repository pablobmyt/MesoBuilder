# MesoBuilder — Manual de desarrollo y diseño

> Documento vivo. Se actualiza con cada cambio relevante.
> Última actualización: 2026-03-16

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
| `engine/game-engine.js` | Motor principal: renderizado, input, lógica de juego, generación de mapa, UI |
| `engine/entities.js` | Definición y helpers de entidades: árboles, recursos, conejos, zorros, NPCs |
| `engine/renderer.js` | Helpers de render auxiliares (sprites de entidad, interiores) |
| `engine/map.js` | Funciones de mapa adicionales |
| `engine/ui.js` | Paneles UI de alto nivel |
| `engine/input.js` | Input binding adicional |
| `data/entities-defs.json` | Definiciones de entidades (tipos, costes de construcción) |
| `data/entity-pixels.json` | Sprites pixel-art (42 iconos: naturaleza, edificios, objetos, mobiliario interior) |
| `data/npc-dialogues.json` | Frases genéricas por tipo de NPC |
| `data/interiors/` | Mapas de interior por tipo de edificio |

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
| `F` | Activar/desactivar seguimiento de cámara |
| `M` | Abrir/cerrar mapa cenital (world map overlay) |
| `Scroll ratón` | Zoom in/out |
| `Espacio` | Pausar / reanudar el tiempo de juego |

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

### Interacción

| Tecla | Acción |
|---|---|
| `E` | Interactuar (recoger, entrar, hablar con NPC, avanzar diálogo) |
| `I` | Abrir/cerrar inventario |
| `G` | Enviar NPCs seleccionados a recoger |
| `H` | Mantener posición (NPCs seleccionados) |
| `R` | Reagrupar NPCs cerca del jugador |
| `Escape` | Limpiar selección / cerrar mapa cenital |
| `Enter` | Abrir/cerrar guía de juego |

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

| Tipo | Descripción | Edificios | NPCs |
|---|---|---|---|
| `origin` | Aldea inicial destruida | 2 huts | Elder (story), 1-2 supervivientes |
| `village` | Pueblo común | 2-5 casas variadas | Aldeanos, granjeros, pastores |
| `capital` | Nínagara | 3-4 × 2-3 edificios + templo + mercado | Sacerdotisa, Escriba, Guardias, Mercaderes |
| `trading_post` | Puesto de comercio | 3 (market + huts) | Mercaderes |

### 5.3 Tamaños de edificios (`BUILDING_SCALE = 1.0`)

| Tipo | Tiles (w×h) |
|---|---|
| `hut` | 2×2 |
| `house_small` | 2×2 |
| `house` | 3×3 |
| `house_large` | 4×4 |
| `stone_house` | 3×3 |
| `longhouse` | 5×2 |
| `ziggurat` | 5×5 |
| `house_garden` | 3×3 |
| `mesopotamian_villa` | 5×5 |

**`BUILDING_SCALE = 1.0`**: el sprite se dibuja exactamente en el footprint de colisión. Cambiar a > 1.0 hará que el sprite sobresalga visualmente de la hitbox.

### 5.4 Profundidad (depth sort)

Los edificios se dibujan en dos pasadas para que el jugador quede detrás o delante correctamente:

1. Edificios con `depthKey < playerDepthKey` → se dibujan antes que el jugador
2. Edificios restantes se guardan en `window._deferredBuildings[]`
3. Después de `drawPlayer()`, se dibujan los diferidos

En modo ortho: `depthKey = row`. En modo iso: `depthKey = col + row`.

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

**Funciones clave**: `openNpcDialogue(npc)`, `advanceDialogue()`, `drawDialoguePanel(ctx, W, H)`

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

---

## 9. Changelog de desarrollo

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
