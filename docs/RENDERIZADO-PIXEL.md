# Sistema de Renderizado Pixel-Art de MesoBuilder

## Índice
1. [Visión General](#visión-general)
2. [Flujo de Renderizado (Pipeline)](#flujo-de-renderizado-pipeline)
3. [Sistema de Definición de Pixels](#sistema-de-definición-de-pixels)
4. [Cachés y Pre-generación de Sprites](#cachés-y-pre-generación-de-sprites)
5. [Renderizado de Personajes](#renderizado-de-personajes)
6. [Renderizado de Entidades y Edificios](#renderizado-de-entidades-y-edificios)
7. [Caché de Terreno (Optimización)](#caché-de-terreno-optimización)
8. [Bucle Principal de Renderizado](#bucle-principal-de-renderizado)
9. [Cómo Reutilizar el Sistema](#cómo-reutilizar-el-sistema)

---

## Visión General

MesoBuilder usa un sistema de **renderizado pixel-art puro** sin texturas externas. Cada sprite, icono y personaje se define como una matriz de píxeles coloreados en archivos JSON. Estos se convierten en `<canvas>` offscreen que luego se dibujan en el canvas principal con `drawImage()` (acelerado por GPU) usando `imageSmoothingEnabled = false` para mantener el look pixelado.

**Tecnologías**: Canvas 2D API pura. No usa WebGL, ni bibliotecas de renderizado.

---

## Flujo de Renderizado (Pipeline)

```
┌──────────────────────────────────────────────────────────────┐
│  1. CARGA DE DEFINICIONES (al iniciar)                       │
│                                                              │
│  entity-pixels.json  ──►  window.ENTITY_PIXEL_LIBRARY       │
│  (cada sprite como         { nombre: { grid, pixels } }     │
│   array de pixels)                                          │
│                         │                                   │
│                         ▼                                   │
│  2. PRE-GENERACIÓN DE SPRITES (generateSpriteImages)        │
│                                                              │
│  createCanvasFromPixelDef()  ──►  _ENTITY_BITMAPS[name]     │
│  (pixel def → <canvas>)          _ICON_BITMAPS[name]        │
│                         │         (caché en RAM)             │
│                         ▼                                   │
│  createImageBitmap()     ──►  _SPRITE_IMAGES[name]          │
│  o Image() + toBlob()         (ImageBitmap para GPU)        │
│                         │                                   │
│                         ▼                                   │
│  localStorage            ──►  persistencia entre sesiones   │
│  ('meso.spriteCache')                                       │
├──────────────────────────────────────────────────────────────┤
│  3. CACHÉ DE TERRENO (rebuildMapCachesAsync)                │
│                                                              │
│  tileBiome[][]  ──►  mapCacheOrtho (canvas offscreen)       │
│                       mapCacheIso   (canvas offscreen)       │
│                                                              │
│  Se construye UNA vez a zoom=1 (tamaño fijo ~22MB).         │
│  En cada frame se escala con drawImage(scale=zoom).         │
├──────────────────────────────────────────────────────────────┤
│  4. BUCLE DE RENDERIZADO (render(), cada frame)             │
│                                                              │
│  ① Cielo (gradiente día/noche)                              │
│  ② Estrellas (noche)                                        │
│  ③ Nubes (overlay semitransparente)                         │
│  ④ HUD de supervivencia                                     │
│  ⑤ TERRENO: drawImage(mapCacheOrtho/Iso, scale=zoom)       │
│  ⑥ Árboles                                                  │
│  ⑦ Edificios (depth-sorted, delante/detrás del jugador)    │
│  ⑧ Entidades/Recursos (sorted por profundidad)              │
│  ⑨ Jugador + NPCs                                           │
│  ⑩ Edificios diferidos (delante del jugador)               │
│  ⑪ Partículas (humo, sangre, texto flotante)               │
│  ⑫ Overlays (modo editor, selección, niebla de guerra)     │
│  ⑬ UI (barra de acción, panel, minimapa)                   │
│  ⑭ Cursor                                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Sistema de Definición de Pixels

### Formato de datos

Cada sprite/icono se guarda en `data/entity-pixels.json` con esta estructura:

```json
{
  "nombre_sprite": {
    "grid": 9,
    "pixels": [
      [4, 0, "#8B6914"],
      [3, 1, "#8B6914"],
      [4, 1, "#8B6914"],
      [5, 1, "#8B6914"]
    ]
  }
}
```

| Campo | Descripción |
|-------|-------------|
| `grid` | Resolución virtual del sprite (N×N píxeles). Define la escala. |
| `pixels` | Array de `[columna, fila, "#colorHex"]`. Solo se definen píxeles no transparentes. |

### Renderizado fundamental: `drawPixelArt()`

```js
function drawPixelArt(ctx, pixels, scale) {
  pixels.forEach(([x, y, c]) => {
    ctx.fillStyle = c;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  });
}
```

Cada píxel se dibuja como un `fillRect` del tamaño `scale`. La clave es `imageSmoothingEnabled = false` para mantener bordes nítidos.

### Conversión a Canvas: `createCanvasFromPixelDef()`

```js
window.createCanvasFromPixelDef = function(def, name, targetScale = 32) {
  const grid = def.grid || 9;
  const pixels = def.pixels || [];
  const scale = Math.max(1, Math.floor(targetScale / grid));
  const canvas = document.createElement('canvas');
  canvas.width = grid * scale;
  canvas.height = grid * scale;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  pixels.forEach(([x, y, color]) => {
    if (color) {
      c.fillStyle = color;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  // Registrar en cachés globales
  window._ICON_BITMAPS[name] = canvas;
  window._ENTITY_BITMAPS[name] = canvas;
  return canvas;
};
```

---

## Cachés y Pre-generación de Sprites

El sistema usa **3 niveles de caché** en cascada:

### Jerarquía de cachés

```
Nivel 1: _SPRITE_IMAGES[name]     ← ImageBitmap (GPU, más rápido)
Nivel 2: _ENTITY_BITMAPS[name]    ← Canvas offscreen (RAM)
Nivel 3: _ICON_BITMAPS[name]      ← Canvas offscreen (RAM, iconos)
Nivel 4: ENTITY_PIXEL_LIBRARY[name] ← Definición cruda JSON (se genera al vuelo)
```

### Flujo de generación (`generateSpriteImages`)

1. Itera todas las claves en `_ENTITY_BITMAPS`
2. Por cada una, dibuja el canvas en un canvas temporal
3. Intenta crear `ImageBitmap` (más eficiente para GPU)
4. Si falla, crea `Image` + Blob URL
5. Persiste en `localStorage` como data URI (límite ~3MB)

### Resolución de lookups

Cuando se necesita dibujar un sprite, se busca en este orden (ej: `drawRegisteredIcon`):

```js
// 1. ¿Está en la librería de pixels?
if (ENTITY_PIXEL_LIBRARY[name]) {
  // Usar canvas cacheado o crearlo al vuelo
}

// 2. ¿Hay ImageBitmap pre-generado?
if (_SPRITE_IMAGES[name]) { /* GPU-accelerated */ }

// 3. ¿Hay canvas cacheado como icono?
if (_ICON_BITMAPS[name]) { /* fallback canvas */ }

// 4. ¿Hay canvas cacheado como entidad?
if (_ENTITY_BITMAPS[name]) { /* fallback canvas */ }

// 5. Último recurso: crear desde definición cruda
if (ENTITY_PIXEL_LIBRARY[name]) {
  createCanvasFromPixelDef(...)
}
```

---

## Renderizado de Personajes

### Sistema de paletas

Los personajes usan un sistema de **mapeo de paleta** con 4 canales:

```js
const palette = {
  skin: '#C8956C',   // h → s (hair → skin en CHARACTER_MAP)
  hair: '#2C1A0A',   // s → hair
  cloth: '#7A2E1C',  // c → cloth
  trim: '#DAA520'    // t → trim
};
```

### Mapa de caracteres (`CHARACTER_MAP`)

Es una matriz de strings donde cada letra mapea a un color de la paleta:

```
h = hair (pelo)
s = skin (piel)
c = cloth (ropa)
t = trim (detalles)
```

### Renderizado direccional

`drawCharacterPixels(ctx, palette, x, y, scale, opts)` soporta:

- **4 direcciones**: `'up'`, `'down'`, `'left'`, `'right'`
- **Flip horizontal**: al mirar a la izquierda, se invierten las columnas
- **2 frames de animación**: frame 0 (quieto) y frame 1 (caminando)
- **Modo headOnly**: solo renderiza la cabeza (filas 0-5)

```js
function drawCharacterPixels(ctx, palette, x, y, scale, opts) {
  const dir = opts.dir || 'down';
  const frame = opts.frame || 0;
  const flip = dir === 'left';
  
  for (let row = 0; row < maxRow; row++) {
    for (let col = 0; col < line.length; col++) {
      const srcCol = flip ? (line.length - 1 - col) : col;
      const ch = line[srcCol];
      let color = null;
      if (ch === 'h') color = palette.hair;
      if (ch === 's') color = palette.skin;
      if (ch === 'c') color = palette.cloth;
      if (ch === 't') color = palette.trim;
      
      // Desplazamiento por frame de animación
      let dx = 0, dy = 0;
      if (frame === 1 && isLegRow(row)) {
        // Piernas se mueven lateralmente
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(x + col*scale + dx*scale, y + row*scale + dy*scale, scale, scale);
    }
  }
}
```

---

## Renderizado de Entidades y Edificios

### `drawEntitySpriteAt(name, x, y, w, h, options)`

Función principal para dibujar cualquier sprite en coordenadas del mundo:

```js
function drawEntitySpriteAt(name, x, y, w, h, options) {
  // 1. Buscar en cachés (SPRITE_IMAGES → ICON_BITMAPS → ENTITY_BITMAPS)
  // 2. Si no existe, crear desde ENTITY_PIXEL_LIBRARY
  // 3. Dibujar sombra elíptica debajo (a menos que options.noShadow)
  // 4. ctx.drawImage(img, px, py, drawW, drawH) con imageSmoothingEnabled=false
}
```

### `drawBuilding(col, row, type, alpha)`

Renderiza edificios con:
- Sprites registrados (preferido para casas, bloques soviéticos)
- Fallback a dibujo programático con `fillRect` (arcos, termas, casas mesopotámicas)
- Escalado visual por tipo de edificio (ej: `soviet_block` ×4.5)
- Soporte de opacidad (`alpha`)

### Depth-sorting en el render loop

Los edificios se dividen en dos grupos para oclusión correcta:

```js
// En isométrico: depthKey = col + row  (mayor = más cerca)
// En ortográfico: depthKey = row

if (buildingDepthKey < playerDepthKey) {
  drawBuilding(...);  // detrás del jugador → dibujar ya
} else {
  _deferredBuildings.push(...);  // delante → dibujar después del jugador
}
```

---

## Caché de Terreno (Optimización)

Esta es la optimización más importante del sistema. En lugar de dibujar cada tile individualmente en cada frame, el terreno se pre-renderiza en **canvases offscreen**:

### Dos caches independientes

| Cache | Vista | Construcción |
|-------|-------|-------------|
| `mapCacheOrtho` | Ortográfica (top-down) | `fillRect` por tile |
| `mapCacheIso` | Isométrica | `fillPath` romboidal por tile |

### Construcción asíncrona (`rebuildMapCachesAsync`)

```js
async function rebuildMapCachesAsync() {
  const BATCH = 14; // filas por yield

  // ── Ortográfico ──
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const biome = tileBiome[r][c];
      oc.fillStyle = getBiomeFillColor(biome);
      oc.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
    if (r % BATCH === 0) await yieldToMain(); // no bloquear UI
  }

  // ── Isométrico ──
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Proyectar (col,row) → (x,y) en espacio iso
      // Dibujar rombo con fillPath
    }
  }
}
```

### Uso en el render loop

```js
// El cache se construye SIEMPRE a zoom=1 (TILE píxeles por tile)
// En el render loop se escala vía GPU:
ctx.drawImage(
  mapCacheOrtho,
  0, 0, mapCacheOrtho.width, mapCacheOrtho.height,  // fuente
  -camX, -camY,                                      // destino
  mapCacheOrtho.width * zoom, mapCacheOrtho.height * zoom
);
```

**Clave**: el canvas del cache tiene tamaño fijo (~22MB para mapas grandes). El `drawImage` con escala lo maneja la GPU eficientemente. Así el zoom nunca requiere reconstruir el cache.

---

## Bucle Principal de Renderizado

```js
function render() {
  // 1. Delta time + límite de framerate
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  
  // 2. Tick del EventManager (eventos híbridos)
  EventManager.tick(gdt);
  
  // 3. Transiciones de zoom suave (smoothstep)
  
  // 4. Limpiar canvas
  ctx.clearRect(0, 0, W, H);
  
  // 5. Screen shake (daño)
  
  // 6. Rectángulo de selección (marquee)
  
  // 7. Fondo de montañas decorativas
  drawMountainsBackground(ctx, W, H);
  
  // 8. Movimiento del jugador (pathfinding A*)
  
  // 9. Tick de supervivencia (hambre, sed, regeneración)
  
  // 10. Cielo (gradiente día/noche) + estrellas + nubes
  
  // 11. HUD de supervivencia (HP, hambre, sed)
  
  // 12. TERRENO: drawImage del mapCache escalado
  
  // 13. Árboles visibles
  
  // 14. Edificios (depth-sorted, 2 pasadas)
  
  // 15. Entidades/recursos (sorted por profundidad)
  
  // 16. Jugador + NPCs
  
  // 17. Edificios diferidos (delante del jugador)
  
  // 18. Partículas (humo, daño, texto flotante)
  
  // 19. Overlays (niebla de guerra, editor, zona de安全)
  
  // 20. UI/Menús (barra de acción, panel, minimapa)
  
  // 21. Cursor
  
  // 22. requestAnimationFrame(render)
}
```

---

## Cómo Reutilizar el Sistema

### Paso 1: Define tus sprites

Crea un archivo JSON con tus sprites:

```json
{
  "mi_personaje": {
    "grid": 16,
    "pixels": [
      [7, 0, "#FF0000"],
      [8, 0, "#FF0000"],
      [7, 1, "#FF0000"],
      [8, 1, "#00FF00"]
    ]
  },
  "mi_icono": {
    "grid": 8,
    "pixels": [
      [3, 2, "#336699"],
      [4, 2, "#336699"],
      [3, 3, "#336699"],
      [4, 3, "#336699"]
    ]
  }
}
```

### Paso 2: Carga los datos

```js
// Cargar el JSON
const resp = await fetch('mis-sprites.json');
const spriteData = await resp.json();

// Guardar en la librería global
window.ENTITY_PIXEL_LIBRARY = spriteData;

// Inicializar cachés
window._ENTITY_BITMAPS = {};
window._ICON_BITMAPS = {};
window._SPRITE_IMAGES = {};
```

### Paso 3: Función de renderizado base

```js
// Renderizado pixel-art puro (sin caches)
function drawPixelArt(ctx, pixels, scale) {
  pixels.forEach(([x, y, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  });
}

// Conversión a canvas (con caché)
function getSpriteCanvas(name, targetSize = 32) {
  // ¿Ya está cacheado?
  if (window._ENTITY_BITMAPS[name]) {
    return window._ENTITY_BITMAPS[name];
  }
  
  const def = window.ENTITY_PIXEL_LIBRARY[name];
  if (!def) return null;
  
  const grid = def.grid;
  const scale = Math.max(1, Math.floor(targetSize / grid));
  
  const canvas = document.createElement('canvas');
  canvas.width = grid * scale;
  canvas.height = grid * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false; // ← CLAVE: sin esto se ve borroso
  
  def.pixels.forEach(([x, y, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  });
  
  window._ENTITY_BITMAPS[name] = canvas;
  return canvas;
}
```

### Paso 4: Dibujar en el canvas principal

```js
function drawSprite(name, x, y, width, height) {
  const spriteCanvas = getSpriteCanvas(name, Math.max(width, height));
  if (!spriteCanvas) return;
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas, x - width/2, y - height/2, width, height);
}
```

### Paso 5: Render loop

```js
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Dibujar terreno (cacheado para rendimiento)
  ctx.drawImage(terrainCache, -camX, -camY);
  
  // Dibujar entidades
  entities.forEach(e => {
    drawSprite(e.sprite, worldToScreenX(e.x), worldToScreenY(e.y), 32, 32);
  });
  
  requestAnimationFrame(gameLoop);
}
```

### Paso 6: Optimización de terreno

```js
function buildTerrainCache(cols, rows, tileSize) {
  const cache = document.createElement('canvas');
  cache.width = cols * tileSize;
  cache.height = rows * tileSize;
  const cctx = cache.getContext('2d');
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cctx.fillStyle = getTileColor(c, r);
      cctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
    }
  }
  
  return cache;
}

// En el render loop:
// Escalar con zoom usando drawImage (GPU-accelerated)
ctx.drawImage(
  terrainCache,
  0, 0, terrainCache.width, terrainCache.height,
  -camX, -camY,
  terrainCache.width * zoom, terrainCache.height * zoom
);
```

### Consejos clave

1. **`imageSmoothingEnabled = false`** es esencial para el look pixel-art
2. **Construye el cache de terreno una vez**, no por frame
3. **Usa `drawImage` con escala** en lugar de redibujar tiles — la GPU lo maneja
4. **Ordena entidades por profundidad** (`y` o `col+row` en iso) para oclusión correcta
5. **Pre-genera ImageBitmaps** con `createImageBitmap()` para mejor rendimiento GPU
6. **No reconstruyas el cache al hacer zoom** — solo escala con `drawImage`
7. **Persiste en localStorage** para evitar regenerar sprites cada sesión

---

## Archivos Clave del Sistema

| Archivo | Rol |
|---------|-----|
| `data/entity-pixels.json` | Definiciones de pixels para TODOS los sprites e iconos |
| `engine/game-engine.js` | Motor principal: `render()`, `drawPixelArt()`, `drawCharacterPixels()`, `drawEntitySpriteAt()`, `drawBuilding()`, `drawRegisteredIcon()` |
| `engine/game-engine-sprite-runtime-utils.js` | `generateSpriteImages()` — convierte definiciones a ImageBitmaps |
| `engine/game-engine-entity-def-utils.js` | Carga de `entities-defs.json`, inicialización de cachés |
| `engine/atlas-builder.js` | Atlas de árboles (empaqueta múltiples sprites en un canvas) |
