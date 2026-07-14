# Sistema de Renderizado Pixel-Art de MesoBuilder — Guía Completa

## Índice
1. [Arquitectura General](#1-arquitectura-general)
2. [Definición de Sprites: entity-pixels.json](#2-definición-de-sprites-entity-pixelsjson)
3. [Función de Renderizado: drawEntitySpriteAt](#3-función-de-renderizado-drawentityspriteat)
4. [Carga de Sprites en Memoria](#4-carga-de-sprites-en-memoria)
5. [Sistema de Coordenadas](#5-sistema-de-coordenadas)
6. [Renderizado de Interiores (estilo Habbo)](#6-renderizado-de-interiores-estilo-habbo)
7. [Entidades del Mundo Exterior](#7-entidades-del-mundo-exterior)
8. [Flujo de Renderizado por Frame](#8-flujo-de-renderizado-por-frame)
9. [Cómo Añadir un Sprite Nuevo](#9-cómo-añadir-un-sprite-nuevo)
10. [Renderizado de Personajes (NPCs/Jugador)](#10-renderizado-de-personajes-npcsjugador)
11. [Sistema de Entidades (entities.js)](#11-sistema-de-entidades-entitiesjs)
12. [Definiciones de Edificios (entities-defs.json)](#12-definiciones-de-edificios-entities-defsjson)
13. [Consejos de Rendimiento](#13-consejos-de-rendimiento)
14. [Formato Alternativo: String + Paleta (buildPixelSprite)](#14-formato-alternativo-string--paleta-buildpixelsprite)
15. [Pixel Editor Standalone](#15-pixel-editor-standalone)
16. [Integración con Football Retro](#16-integración-con-football-retro)
17. [Flujo de Trabajo: Crear/Editar un Sprite](#17-flujo-de-trabajo-creareditar-un-sprite)

---

## 1. Arquitectura General

MesoBuilder usa un **único canvas 2D HTML5** como superficie de dibujo. Todo el renderizado
ocurre en un `<canvas id="gameCanvas">` con contexto `'2d'`.

### Principio fundamental
> **Cada píxel de cada sprite se dibuja individualmente con `ctx.fillRect()`.
> No se usa `ctx.drawImage()` para sprites pixel-art.**

Esto garantiza que el renderizado funcione en cualquier entorno (navegador web, Electron,
dispositivos con GPU problemática) porque `fillRect` es una operación básica del canvas 2D
implementada por software que nunca falla.

### ¿Por qué no drawImage?

`ctx.drawImage()` depende de la aceleración GPU del navegador. En Electron/Chromium,
ciertas combinaciones de drivers GPU causan que `drawImage` falle **silenciosamente**
(sin lanzar errores, pero sin dibujar nada en el canvas). `fillRect` es una operación
CPU pura que siempre produce resultado visible.

---

## 2. Definición de Sprites: `entity-pixels.json`

**Ubicación**: `data/entity-pixels.json`

### Estructura del archivo

```json
{
  "icons": {
    "nombre_sprite": {
      "grid": 9,
      "pixels": [
        [columna, fila, "#colorhex"],
        [columna, fila, "#colorhex"],
        ...
      ]
    }
  }
}
```

### Campos de cada sprite

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `grid` | `number` | Tamaño de la cuadrícula en celdas. Un sprite de grid=9 ocupa 9×9 celdas lógicas. |
| `pixels` | `array` | Array de tripletas `[x, y, color]`. `x` = columna (0 a grid-1), `y` = fila (0 a grid-1), `color` = hexadecimal con `#`. |

### Ejemplo comentado

```json
"house": {
  "grid": 9,
  "pixels": [
    [4,0,"#8B6914"],                                         // Tejado, centro
    [3,1,"#8B6914"], [4,1,"#8B6914"], [5,1,"#8B6914"],      // Tejado, segunda fila
    [2,2,"#8B6914"], [3,2,"#8B6914"], [4,2,"#8B6914"],      // Alero
    [5,2,"#8B6914"], [6,2,"#8B6914"],
    [2,3,"#C8A84B"], [3,3,"#C8A84B"], [4,3,"#C8A84B"],      // Pared (dorado)
    [5,3,"#C8A84B"], [6,3,"#C8A84B"],
    [2,4,"#C8A84B"], [3,4,"#E8D5A3"], [4,4,"#8B6914"],      // Pared + puerta + detalle
    [5,4,"#E8D5A3"], [6,4,"#C8A84B"],
    [2,5,"#C8A84B"], [3,5,"#C8A84B"], [4,5,"#C8A84B"],      // Base
    [5,5,"#C8A84B"], [6,5,"#C8A84B"]
  ]
}
```

### Nomenclatura de sprites

| Prefijo/Categoría | Ejemplos | Uso |
|-------------------|----------|-----|
| Edificios | `house`, `temple`, `farm`, `ziggurat`, `soviet_block` | Construcciones del mundo |
| Árboles | `tree0`-`tree6`, `birch`, `pine` | Vegetación forestal |
| Recursos | `weed`, `wheat`, `stone`, `wood` | Recursos naturales recolectables |
| Interior muebles | `interior_bed`, `interior_chair`, `interior_plant` | Mobiliario de habitaciones |
| Interior pared | `interior_painting_1`, `interior_window`, `interior_torch` | Decoración mural |
| Temáticos | `ussr_flag`, `ma_g`, `soviet_fighter_jet` | Sprites de épocas específicas |
| Mascotas | `pet_dog` | Compañero animal |

### Colores

Formato hexadecimal estándar:
- `#8B6914` → RGB (marrón oscuro)
- `#C8A84B` → RGB (dorado)
- `#E8D5A3` → RGB (crema claro)
- `#4A8A3A` → RGB (verde vegetación)
- `#AABBCCDD` → RGBA (los últimos 2 dígitos son alpha: 00=transparente, FF=opaco)

---

## 3. Función de Renderizado: `drawEntitySpriteAt()`

**Ubicación**: `engine/game-engine.js`

```js
function drawEntitySpriteAt(name, x, y, w, h, options)
```

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `name` | `string` | Clave del sprite en `ENTITY_PIXEL_LIBRARY` (ej: `'weed'`, `'house'`) |
| `x` | `number` | Posición X en pantalla — **centro del sprite** |
| `y` | `number` | Posición Y en pantalla — **base del sprite** (los pies) |
| `w` | `number` | Ancho deseado en píxeles |
| `h` | `number` | Alto deseado en píxeles |
| `options` | `object` | `{ noShadow: boolean, ignoreEntityScale: boolean }` |

### Algoritmo

```
1. Aplicar escala del editor (si standalone) → drawW, drawH
2. Guardar estado del canvas (ctx.save)
3. Dibujar sombra: elipse semitransparente bajo el sprite
4. SI el sprite existe en ENTITY_PIXEL_LIBRARY:
   a. Obtener grid y pixels de la definición
   b. scale = floor(min(drawW, drawH) / grid)
   c. Calcular offset para centrar el sprite en (x, y)
   d. PARA CADA [px, py, color] en pixels:
        ctx.fillStyle = color
        ctx.fillRect(offX + px*scale, offY + py*scale, scale, scale)
   e. ctx.restore → FIN
5. SI NO existe en la librería:
   a. Buscar en cachés (_SPRITE_IMAGES, _ICON_BITMAPS, _ENTITY_BITMAPS)
   b. Si hay imagen → ctx.drawImage(img, ...)
```

### Ejemplo de uso

```js
// Dibujar una casa en la posición de tile (5, 3)
const { x, y } = worldToScreen(5, 3);
const tileSize = getTileSize();
drawEntitySpriteAt('house', x + tileSize*0.5, y + tileSize, tileSize, tileSize);

// Dibujar un weed sin sombra
drawEntitySpriteAt('weed', screenX, screenY, 24, 24, { noShadow: true });
```

---

## 4. Carga de Sprites en Memoria

### Flujo de inicialización

```
┌─────────────────────────────────────────────────────────┐
│ 1. electron/preload.js                                  │
│    fs.readFileSync('data/entity-pixels.json')          │
│    contextBridge.exposeInMainWorld('__mesoPreload',    │
│      { entityPixels, entityDefs, npcDialogues, ... })  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. index.html (carga)                                   │
│    window.__mesoPreload ya está disponible              │
│    (inyectado por contextBridge antes del DOM)          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. engine/game-engine.js → ensureEntityPixelsLibrary() │
│    - Si __mesoPreload.entityPixels existe → lo usa     │
│    - Si no → fetch('data/entity-pixels.json')          │
│      (solo funciona en HTTP; en file:// usa meso-local)│
│    - window.ENTITY_PIXEL_LIBRARY = json.icons          │
└─────────────────────────────────────────────────────────┘
```

### Estructura final en memoria

```js
window.ENTITY_PIXEL_LIBRARY = {
  "house":     { grid: 9,  pixels: [[4,0,"#8B6914"], ...] },
  "weed":      { grid: 9,  pixels: [[1,0,"#4A8A3A"], ...] },
  "tree0":     { grid: 12, pixels: [[6,0,"#2A5A1A"], ...] },
  "interior_chair": { grid: 7, pixels: [[1,0,"#8B6830"], ...] },
  ...
}
```

**No se pre-renderizan canvases intermedios.** Cada frame, los píxeles se dibujan
directamente desde el array `pixels` con `fillRect`. Para pixel-art (cientos de píxeles
por sprite como máximo), esto es perfectamente rápido.

---

## 5. Sistema de Coordenadas

### Mundo exterior — Modo ortogonal (top-down)

```js
function worldToScreen(col, row) {
  const tileSize = getTileSize();
  return { x: col * tileSize + camX, y: row * tileSize + camY };
}
```

| Variable | Significado |
|----------|-------------|
| `col, row` | Coordenadas de mundo (fraccionarias, ej: `player.x = 45.3`) |
| `tileSize` | Tamaño de tile en píxeles (~48px por defecto, escala con zoom) |
| `camX, camY` | Desplazamiento de cámara (el jugador se mueve, la cámara lo sigue) |

La cámara se centra en el jugador:
```js
camX = canvas.width/2 - player.x * tileSize;
camY = canvas.height/2 - player.y * tileSize;
```

### Interiores — Proyección pseudo-3D

Para interiores se usa `tileToScreen()` que aplica perspectiva:

```js
const perspFactor = 0.82;  // la pared trasera es el 82% del ancho frontal

tileToScreen(col, row) → {
  x: backX + (frontX - backX) * (row / (iRows-1)),
  y: roomTop + row * floorTileH,
  w: ancho_de_tile_con_perspectiva,
  h: floorTileH
}
```

Esto produce el efecto visual de una habitación vista desde un ángulo ligeramente
elevado, con la pared del fondo más estrecha que el primer plano.

```
        backLeft ──────────────── backRight    ← pared trasera (82% ancho)
          ╲                        ╱
           ╲   [painting] [torch] ╱             ← decoraciones
            ╲                    ╱
             ╲  ┌────┐ ┌──────┐ ╱              ← muebles
              ╲ │bed │ │table │╱
               ╲└────┘ └──────┘╱
              roomLeft ─── roomRight            ← borde frontal (100% ancho)
```

---

## 6. Renderizado de Interiores (estilo Habbo)

### Archivos de datos

**Ubicación**: `data/interiors/*.json`

### Formato completo

```json
{
  "defaultFloor": 0,
  "floors": [{
    "name": "Planta baja",
    "width": 10, "height": 8,
    "entryCol": 4, "entryRow": 5,
    "chestItems": ["wheat", "stone", "brick"],
    "wallPalette": {
      "back": "#7A4D38", "backBrick": "#6B4030", "backBrick2": "#8A5A41",
      "left": "#6B4030", "leftBrick": "#5A3825",
      "right": "#8A5A41", "rightBrick": "#7A5535"
    },
    "npcs": [
      { "col": 6, "row": 2, "name": "Aldeana", "npcType": "villager", "static": true }
    ],
    "tiles": [
      ["wall","painting","wall","window","wall","torch","wall","painting","wall","wall"],
      ["wall","bed","bed","chair","table","chair","plant","rug","rug","wall"],
      ["wall","pot","floor","floor","floor","floor","floor","rug","rug","wall"],
      ["wall","bookshelf","floor","counter","floor","chest","floor","plant","floor","wall"],
      ["wall","chair","floor","firepit","floor","floor","floor","chair","floor","wall"],
      ["wall","floor","floor","floor","floor","door","floor","floor","floor","wall"],
      ["wall","floor","plant","floor","floor","floor","floor","pot","floor","wall"],
      ["wall","wall","wall","wall","wall","wall","wall","wall","wall","wall"]
    ]
  }]
}
```

### Tipos de tile y su comportamiento

| Tile | Renderizado | Transitable |
|------|-------------|-------------|
| `wall` | Pared con textura de ladrillos (fila 0 = trasera, col 0/n = laterales) | ❌ No |
| `painting` | Pared trasera + cuadro decorativo | ❌ No |
| `window` | Pared trasera + ventana con cristal | ❌ No |
| `torch` | Pared trasera + antorcha con brillo animado | ❌ No |
| `floor` | Suelo en damero (2 tonos alternados) | ✅ Sí |
| `rug` | Sprite de alfombra persa | ✅ Sí |
| `bed` | Sprite de cama | ✅ Sí |
| `table` | Sprite de mesa | ✅ Sí |
| `chair` | Sprite de silla | ✅ Sí |
| `pot` | Sprite de vasija | ✅ Sí |
| `chest` | Sprite de cofre (contenedor) | ✅ Sí |
| `firepit` | Sprite de hoguera | ✅ Sí |
| `plant` | Sprite de planta decorativa | ✅ Sí |
| `bookshelf` | Sprite de estantería | ✅ Sí |
| `counter` | Sprite de mostrador/barra | ✅ Sí |
| `door` | Puerta de salida (indicador visual tenue) | ✅ Sí |
| `stairs_up` | Escaleras (dibujo geométrico) | ✅ Sí |
| `stairs_down` | Escaleras (dibujo geométrico) | ✅ Sí |
| `elevator` | Ascensor con panel y botón | ✅ Sí |

### Paleta de paredes (`wallPalette`)

Cada interior define sus colores. Ejemplos por tipo de edificio:

| Edificio | back | left | right | Estilo |
|----------|------|------|-------|--------|
| `house` | `#8B7B6A` | `#7B6B5A` | `#9B8B7A` | Neutro cálido |
| `house_player_home` | `#8B6B4A` | `#7A5A3A` | `#9B7B5A` | Madera rica |
| `house_large` | `#8B7050` | `#7A6040` | `#9B8060` | Beige noble |
| `house_garden` | `#7A8B5A` | `#6A7B4A` | `#8A9B6A` | Verde jardín |
| `residential_tower` | `#7A8A9A` | `#6A7A8A` | `#8A9AAA` | Gris urbano |

---

## 7. Entidades del Mundo Exterior

### Tipos de entidad y su estructura

```js
// ── Recursos naturales ──
{
  id: 'res-1234567890-abc',
  kind: 'resource',
  subtype: 'weed' | 'wheat' | 'stone' | 'wood' | 'meat' | 'seed',
  col: number, row: number,
  _born: timestamp,
  _dropSeed: number (0-1)
}

// ── Árboles ──
{
  id: 'tree-1234567890-abc',
  kind: 'tree',
  variant: 'birch' | 'oak' | 'pine' | 'fir' | 'willow' | 'bush' | ...,
  col: number, row: number,
  hp: 10,
  size: number  // escala relativa (1.0 = normal, 2.2 = abedul alto)
}

// ── NPC / Jugador ──
{
  id: 'npc-...',
  kind: 'player',
  col: number, row: number,
  x: number, y: number,       // posición fraccionaria para movimiento suave
  palette: { skin, hair, cloth, trim },
  dir: 'down' | 'up' | 'left' | 'right',
  name: string,
  hp: number, maxHp: number,
  speed: number,
  moveTarget: { x, y } | null,
  _walkFrame: 0 | 1
}

// ── Edificios (en la grid, no en entities) ──
grid[row][col] = 'house'  // string simple
grid[row][col] = { type: 'mesopotamian_villa_detailed', ... }  // objeto

// ── Animales ──
rabbits[] = { id, col, row, x, y, hp:6, maxHp:6, speed:1.0, size:0.45, nextMove }
foxes[]   = { id, col, row, x, y, hp:10, maxHp:10, speed:1.4, size:0.7, nextMove }
```

### Funciones de colocación

```js
// Recursos
placeResource(col, row, 'weed')   → entities.push({ kind:'resource', subtype:'weed', ... })
placeResource(col, row, 'wheat')  → entities.push({ kind:'resource', subtype:'wheat', ... })

// Árboles
placeTree(col, row, 'birch')      → entities.push({ kind:'tree', variant:'birch', size:2.2, ... })
placeTree(col, row)               → elige variante aleatoria

// Animales
placeRabbit(col, row)             → rabbits.push({ id, col, row, x:col, y:row, size:0.45, ... })
placeFox(col, row)                → foxes.push({ id, col, row, x:col, y:row, size:0.7, ... })
```

---

## 8. Flujo de Renderizado por Frame

```
requestAnimationFrame → render loop:

  1. CALCULAR límites visibles (minC, maxC, minR, maxR)
     - Modo iso: proyectar esquinas del canvas al mundo
     - Modo ortho: screenToWorld(0,0) y screenToWorld(W,H)

  2. DIBUJAR tiles del terreno (agua, arena, estepa, aluvial...)
     - fillRect por cada tile en el rango visible
     - Colores por bioma: agua=#6EA8D7, arena=#EBD9B3, estepa=#C8C080...

  3. SI no hay entidades tree → drawTreesVisible()
     - Árboles procedurales desde GLOBAL_TREE_TEMPLATES
     - Densidad ajustada por zoom

  4. DIBUJAR edificios (grid[r][c]) ordenados por profundidad
     - Edificios "detrás" del jugador primero
     - Edificios "delante" después (oclusión)

  5. DIBUJAR entidades (resources, trees, NPCs, animals)
     - Ordenados por fila (painter's algorithm)
     - Recursos: fallback geométrico + sprite pixel-art
     - NPCs: drawCharacterPixels() con paleta de colores

  6. DIBUJAR partículas (humo, efectos visuales)

  7. DIBUJAR UI (HUD, tooltips, notificaciones, barras de vida)

  8. SI window.currentInterior → saltar pasos 2-5 y:
     a. tileToScreen() para cada tile del interior
     b. Pared trasera con textura + decoraciones
     c. Paredes laterales trapezoidales
     d. Suelo en damero + muebles con drawEntitySpriteAt()
```

---

## 9. Cómo Añadir un Sprite Nuevo

### Añadir definición en `data/entity-pixels.json`

Añadir dentro del objeto `"icons"`:

```json
"mi_sprite_nuevo": {
  "grid": 8,
  "pixels": [
    [3,2,"#C8A84B"], [4,2,"#8B6914"],
    [2,3,"#5A3810"], [3,3,"#DAA520"], [4,3,"#DAA520"], [5,3,"#5A3810"],
    [2,4,"#5A3810"], [3,4,"#8B6914"], [4,4,"#8B6914"], [5,4,"#5A3810"]
  ]
}
```

### Usarlo en el código

```js
// En cualquier parte del render loop:
drawEntitySpriteAt('mi_sprite_nuevo', screenX, screenY, 32, 32);

// Verificar disponibilidad:
if (hasRegisteredSprite('mi_sprite_nuevo')) {
  // el sprite está en ENTITY_PIXEL_LIBRARY
}
```

### Si es un mueble de interior

Añadir al `spriteMap` en el renderizador de interiores:

```js
const spriteMap = {
  bed: 'interior_bed',
  table: 'interior_table',
  // ...existing...
  mi_tile: 'mi_sprite_nuevo'  // ← nuevo
};
```

Y usar el nuevo tile en los archivos JSON de interiores:

```json
["wall", "mi_tile", "floor", ...]
```

---

## 10. Renderizado de Personajes (NPCs/Jugador)

Los personajes usan un sistema diferente al resto de sprites. En vez de estar definidos
en `entity-pixels.json`, se dibujan mediante `drawCharacterPixels()` que combina una
**plantilla de patrones** con una **paleta de colores**.

### Plantilla de personaje

El personaje se define como un array de strings donde cada carácter mapea a una parte:

```js
const CHARACTER_MAP = [
  '..hh....',   // h = hair (pelo)
  '.hhhh...',
  '.hsshh..',   // s = skin (piel)
  '.ssss...',
  '..cccc..',   // c = cloth (ropa)
  '..ctcc..',   // t = trim (detalles)
  '..c..c..',
  '.cc..cc.'
];
```

### Paleta de colores

```js
const palette = {
  skin:  '#C8956C',   // color de piel
  hair:  '#2C1A0A',   // color de pelo
  cloth: '#8B6914',   // color de ropa principal
  trim:  '#DAA520'    // color de detalles (cinturón, bordes)
};
```

### Función de renderizado

```js
drawCharacterPixels(ctx, palette, px, py, scale, {
  dir: 'down' | 'up' | 'left' | 'right',
  frame: 0 | 1  // animación de caminar
})
```

- `dir='left'/'right'` → voltea horizontalmente el sprite
- `frame=1` → desplaza las piernas para animación de caminar

### Sprites detallados (URSS)

Para la época URSS existe `DETAILED_HUMANOID_SPRITE_URSS` que es un sprite de 24×24
con píxeles individuales (no basado en plantilla de caracteres). Ofrece más detalle
visual (botas, cinturón, guerrera militar).

---

## 11. Sistema de Entidades (entities.js)

**Ubicación**: `engine/entities.js`

### Arrays globales

```js
const entities = [];   // recursos, árboles, NPCs, edificios colocados
const rabbits = [];    // conejos (animales pasivos)
const foxes = [];      // zorros (animales)
const graves = [];     // tumbas (entidades especiales)
```

### Funciones de colocación

| Función | Entidad creada | Array destino |
|---------|---------------|---------------|
| `placeResource(col, row, type)` | Recurso | `entities` |
| `placeTree(col, row, variant)` | Árbol | `entities` |
| `placeRabbit(col, row)` | Conejo | `rabbits` |
| `placeFox(col, row)` | Zorro | `foxes` |

### Tick de entidades

`tickEntities(now)` se llama cada frame y maneja:
- Movimiento de NPCs (patrullaje, persecución)
- Movimiento de animales (aleatorio)
- Diálogos automáticos de NPCs
- Envejecimiento y muerte de entidades

---

## 12. Definiciones de Edificios (entities-defs.json)

**Ubicación**: `data/entities-defs.json`

### Estructura

```json
{
  "buildings": {
    "house": {
      "name": "Casa",
      "costBrick": 8, "costWheat": 3,
      "prodPop": 5, "prodWheat": 0, "prodBrick": 0,
      "color": "#C8A84B", "roofColor": "#8B6914",
      "desc": "Aloja 5 habitantes.",
      "size": { "w": 2, "h": 2 }
    }
  },
  "trees": ["oak","pine","birch","bush","weed","tallgrass",...],
  "animals": {
    "rabbit": { "name": "Rabbit", "hp": 6, "speed": 1.0, "size": 0.6 },
    "fox": { "name": "Fox", "hp": 10, "speed": 1.4, "size": 0.9 }
  },
  "enemies": {
    "raider": { "name": "Merodeador", "hp": 12, "speed": 0.9, "reward": {"brick":1} }
  }
}
```

### Campos de edificio

| Campo | Descripción |
|-------|-------------|
| `costBrick`, `costWheat` | Coste de construcción |
| `prodPop`, `prodWheat`, `prodBrick` | Producción por turno |
| `color`, `roofColor` | Colores para el renderizado (usados por drawEntitySpriteAt) |
| `size` | Tamaño en tiles `{w, h}` |
| `attackRange`, `attackDmg`, `attackCooldown` | Solo para torres defensivas |

---

## 13. Consejos de Rendimiento

1. **`fillRect` sobre `drawImage`**: Para pixel-art, `fillRect` píxel a píxel es más
   fiable y suficientemente rápido. Un sprite de grid=12 tiene ~40-80 píxeles. 200
   sprites × 60 píxeles = 12,000 llamadas a `fillRect` por frame — insignificante.

2. **Iterar solo tiles visibles**: `minC, maxC, minR, maxR` se calculan desde la cámara.
   No iterar el mapa entero (180×120 = 21,600 tiles), solo el rectángulo visible.

3. **No crear canvases offscreen**: Renderizar a un canvas intermedio para luego hacer
   `drawImage` reintroduce la dependencia de GPU y añade un paso innecesario.

4. **Limpiar cachés en desarrollo**: `npm run start-electron-dev` ejecuta
   `scripts/clean-dev.js` que borra localStorage, cachés GPU y archivos temporales.

5. **Colores predefinidos**: Usar strings de color constantes (`#C8A87A`) en vez de
   crear objetos `rgba()` dinámicamente. El motor de canvas los parsea igual de rápido
   pero es más legible.

6. **Orden de renderizado**: Dibujar de atrás hacia adelante (filas menores primero)
   para que los objetos cercanos ocluyan correctamente a los lejanos (painter's algorithm).

---

## 14. Formato Alternativo: String + Paleta (`buildPixelSprite`)

Además del formato `{ grid, pixels: [[x,y,color],...] }`, existe un formato compacto
basado en **strings de caracteres + paleta** usado en Football Retro y el Pixel Editor.

### Estructura

```json
{
  "grid": "16x22",
  "palette": {
    "o": "#111", "h": "#333", "s": "#e8b48f", "c": "#e63946", "p": "#1a1a3a"
  },
  "rows": [
    "......oooo......",
    ".....ohhhho.....",
    "....ohhhhhho....",
    "...acccccccca...",
    "..accccnncccca..",
    "....pppppppp...."
  ]
}
```

| Campo | Descripción |
|-------|-------------|
| `rows` | Array de strings. Cada carácter = 1 píxel. `.` = transparente. |
| `palette` | Objeto que mapea cada carácter a un color hexadecimal. |
| `grid` | "W×H" informativo (el ancho se calcula de `rows[0].length`). |

### Función conversora

```js
function buildPixelSprite(rows, palette) {
    const pixels = [];
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            const ch = rows[r][c];
            if (ch !== '.' && palette[ch]) {
                pixels.push([c, r, palette[ch]]);
            }
        }
    }
    return { grid: rows[0].length, pixels: pixels };
}
```

### Uso típico

```js
// Definir sprite de forma legible
PIXEL_LIBRARY["shooter_back"] = buildPixelSprite([
    "......oooo......",
    ".....ohhhho.....",
    "...accccnnccca..",
    "....pppppppp....",
], {
    o: "#111", h: "#333", s: "#e8b48f",
    a: "#e8b48f", c: "#e63946", n: "#fff",
    p: "#1a1a3a", P: "#0a0a1a"
});
```

### Ventajas sobre el formato de arrays

| Aspecto | Array `[[x,y,color],...]` | String + paleta |
|---------|--------------------------|-----------------|
| Legibilidad | Baja (coordenadas sueltas) | Alta (se ve la forma) |
| Edición manual | Difícil | Fácil (editor de texto) |
| Tamaño | Mínimo | Compacto |
| Cambiar un color | Editar cada `[x,y,color]` | Cambiar 1 entrada en `palette` |

### Archivo de sprites editables

Football Retro almacena sprites en este formato en `data/sprites-penalty.json`.
Se cargan al iniciar el juego y sobrescriben las definiciones hardcodeadas:

```js
fetch('/data/sprites-penalty.json')
    .then(r => r.json())
    .then(data => {
        for (const key of ["goal_front", "gk_front", "shooter_back"]) {
            PIXEL_LIBRARY[key] = buildPixelSprite(data[key].rows, data[key].palette);
        }
    });
```

---

## 15. Pixel Editor Standalone

### Acceso

- **MesoBuilder**: `npm run pixel-editor` → `http://127.0.0.1:3458`
- **Football Retro**: `http://127.0.0.1:3456/pixel-editor.html`

### Funcionalidades

| Herramienta | Descripción |
|-------------|-------------|
| 🖌 Pincel | Dibuja píxeles individuales |
| ✏️ Lápiz | Píxeles de 1px sin suavizado |
| 🪣 Bote | Rellena área conectada |
| ⬜ Rectángulo | Dibuja rectángulos (relleno o borde) |
| ⭕ Elipse | Dibuja elipses |
| ✂ Selección | Selecciona, mueve, copia, pega regiones |
| 🔄 Flip H/V | Voltea horizontal/verticalmente |
| ↩ Rotar | Rota 90° a la derecha |
| 📐 Grid | Ajustable de 8×8 a 64×64 |
| 🔍 Zoom | 1x a 32x |
| 📋 Capas | Sistema de capas con undo/redo |

### Panel Football Retro integrado

El editor incluye un panel lateral específico para Football Retro:

| Botón | Acción |
|-------|--------|
| **📥 Importar JSON** | Carga un sprite desde formato `rows + palette` |
| **📤 Exportar PIXEL_LIBRARY** | Genera `{ grid, pixels: [[x,y,color],...] }` |
| **📋 Copiar buildSprite()** | Genera código `buildPixelSprite([...], {...})` listo para pegar |

### Preview en tiempo real

El panel incluye un mini-canvas que renderiza el sprite actual usando el mismo
algoritmo `fillRect` por píxel que el juego, con:

- Sombra elíptica bajo el sprite (como `drawEntitySpriteAt`)
- Fondo cuadriculado para visualizar transparencias
- Slider de escala (1x-12x)
- Info: grid, número de píxeles, tamaño en px

---

## 16. Integración con Football Retro

El sistema de renderizado de Football Retro es una adaptación directa del de MesoBuilder.
Comparten el mismo principio fundamental (`fillRect` por píxel) y formatos de datos
compatibles.

### Equivalencias

| Concepto | MesoBuilder | Football Retro |
|----------|-------------|----------------|
| Librería de sprites | `ENTITY_PIXEL_LIBRARY` | `PIXEL_LIBRARY` |
| Formato de sprite | `{ grid, pixels: [[x,y,color],...] }` | Igual |
| Función de renderizado | `drawEntitySpriteAt(name, x, y, w, h, options)` | `drawStaticSprite(ctx, key, x, y, scale)` |
| Sombra | `ctx.ellipse(...)` bajo el sprite | No (los sprites son más pequeños) |
| Carga de sprites | `entity-pixels.json` via preload | `sprites-penalty.json` via fetch |
| Sprites de personajes | `drawCharacterPixels()` con plantillas | `drawEntitySpriteAt()` con `CHARACTER_MAP` |

### Función de renderizado en Football Retro

```js
function drawStaticSprite(ctx, key, x, y, scale) {
    const sprite = PIXEL_LIBRARY[key];
    if (!sprite) return;
    for (let i = 0; i < sprite.pixels.length; i++) {
        const px = sprite.pixels[i];
        ctx.fillStyle = px[2];
        ctx.fillRect(
            Math.floor(x + px[0] * scale),
            Math.floor(y + px[1] * scale),
            scale, scale
        );
    }
}
```

### Sprites específicos de Football Retro (vista de penalti)

| Sprite | Grid | Uso |
|--------|------|-----|
| `goal_front` | 58×32 | Portería vista desde el frente |
| `gk_front` | 16×22 | Portero de frente (amarillo) |
| `shooter_back` | 16×22 | Lanzador de espaldas (rojo) |
| `stand_penalty` | 58×7 | Grada de fondo |
| `balon` | 7×7 | Balón de fútbol |

---

## 17. Flujo de Trabajo: Crear/Editar un Sprite

```
1. Abrir Pixel Editor
   └─ npm run pixel-editor (MesoBuilder)
   └─ http://127.0.0.1:3456/pixel-editor.html (Football Retro)

2. Opción A: Importar sprite existente
   └─ Panel Football Retro → 📥 Importar JSON
   └─ Pegar contenido de sprites-penalty.json

   Opción B: Crear desde cero
   └─ Seleccionar grid size
   └─ Dibujar con las herramientas

3. Editar el sprite
   └─ Pincel, relleno, formas, selección...
   └─ El preview se actualiza en tiempo real

4. Exportar
   └─ 📤 Exportar PIXEL_LIBRARY → para usar en código JS
   └─ 📋 Copiar buildSprite() → pegar directamente en retro-striker.html
   └─ O guardar en sprites-penalty.json manualmente

5. Probar en el juego
   └─ Recargar retro-striker.html?mode=penalty
   └─ El juego carga los sprites desde sprites-penalty.json
```
