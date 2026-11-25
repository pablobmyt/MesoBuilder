# MesoBuilder — Ficha técnica

> Resumen de stack, arquitectura y organización del proyecto.
> Generado: 2026-11-25 · Versión del proyecto: `0.1.0` (Alpha, `version.properties`)

---

## 1. Identidad del proyecto

| Campo | Valor |
|---|---|
| Nombre | **MesoBuilder** |
| Tipo | Juego de **colonia en tiempo real** (construcción y gestión) |
| Ambientación | Mesopotamia, ~2350 a.C. |
| Estado | Alpha jugable, en desarrollo activo |
| Plataformas | Navegador (Chromium) y **escritorio Windows** (Electron) |
| Idioma | Código y documentación en **español** (identificadores técnicos en inglés) |
| Documento rector | [`docs/DISEÑO.md`](docs/DISEÑO.md) — manda sobre cualquier otro diseño |

**Bucle de juego:** fundas una aldea junto al Éufrates → colocas edificios → sube la producción
(población como puntuación) → subes de hito (Aldea → Villa → Ciudad → Capital) → aguantas la
crecida del río cada 6 días y los saqueos.

**Historia del proyecto:** nació como juego narrativo multipóca (Mesopotamia / URSS / medieval).
El 2026-10-13 se retira la narrativa y las otras épocas quedan **congeladas**, no borradas, mediante
un único interruptor al principio de `engine/game-engine.js`:

```js
const MODO_COLONIA = true;               // colonia en tiempo real
const NARRATIVA = !MODO_COLONIA;         // false: sin prólogo, actos ni cinemáticas
const CONSTRUIR_EN_JUEGO = MODO_COLONIA; // se construye sin entrar en modo edición
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| Lenguaje | **JavaScript ES modules** | Sin TypeScript. `package.json` en CommonJS (Electron); el juego usa `type="module"` en [`index.html`](index.html) |
| Render | **Canvas 2D** puro | `imageSmoothingEnabled = false`; vistas `ortho` (por defecto) e `iso` con volumen 2.5D generado en el motor |
| UI | HTML + CSS escritos a mano | ~2.570 líneas en [`styles.css`](styles.css); HUD pintado además sobre canvas |
| Audio | **Web Audio API** ([`engine/sound-manager.js`](engine/sound-manager.js)) | `Tone.js` + `jsmidparser` por CDN para MIDI; fallback a beeps si falta el asset |
| Escritorio | **Electron 26** + `electron-packager` | Ventana frameless, `contextIsolation: true`, `sandbox: false`, `backgroundThrottling: false` |
| Datos | **JSON plano** | `data/*.json`; `entity-pixels.json` pesa ~8 MB |
| Persistencia de partida | `localStorage` | Prefijo de claves `meso.` |
| Build | **Ninguno** | El código se ejecuta tal cual; solo hay paso de empaquetado (`package-win`) |
| Testing | **No hay framework** | Validación con `node --check`, arranque real y APIs de introspección (`MESO_DEBUG`, `MESO_COLONIA`, `MESO_CRECIDA`) |

**Ausencias deliberadas:** no hay bundler, transpilador, linter configurado, framework de UI,
motor de juego de terceros ni ORM.

---

## 3. Arquitectura

Arquitectura de **monolito con satélites**: un motor central grande del que se van extrayendo
subsistemas, sin reescritura.

### 3.1 Núcleo

| Fichero | Tamaño | Responsabilidad |
|---|---|---|
| [`engine/game-engine.js`](engine/game-engine.js) | **~29.700 líneas** | Generación de mundo, simulación, economía, render, input, HUD, guardado y menús. `render()` ≈ 4.100 líneas; `createMenuBar()` ≈ 1.015 |
| [`index.html`](index.html) | ~2.210 líneas | Menú, splash, bootstrap, cursor custom y carga de módulos |
| [`styles.css`](styles.css) | ~2.570 líneas | Temas, HUD, paneles y editores |

Todo el estado vive como **variables de módulo** (`viewMode`, `editMode`, `player`, `entities`,
`COLS`/`ROWS`, `mapCacheDirty`, `camX`/`camY`, `zoom`…). Parte se publica en `window` para que los
satélites lo lean (`window.entities`, `window.player`, `window.rabbits`/`foxes`/`graves`).

### 3.2 Satélites extraídos

El despiece está guiado por una herramienta propia, [`tools/refactor-deps.mjs`](tools/refactor-deps.mjs),
que cuenta las **variables libres** de cada función antes de moverla:

- **0 dependencias** → movimiento directo (copiar, `export`, `import`, borrar).
- **1–6** → se pasan como parámetros o en un objeto `deps`.
- **>10** → primero hay que separar el estado.

Proceso y siguiente paso recomendado: [`docs/REFACTOR-MONOLITO.md`](docs/REFACTOR-MONOLITO.md).

**Arte generado por código** (no rejillas en JSON):

| Módulo | Contenido |
|---|---|
| [`engine/character-art.js`](engine/character-art.js) | Fuente única del personaje (jugador y NPCs), compartida con el editor |
| [`engine/animal-art.js`](engine/animal-art.js) | Conejo, zorro, perro/Kidu y lobo animados por partes |
| [`engine/tree-art.js`](engine/tree-art.js) | Especies de árbol con balanceo de viento |
| [`engine/plant-art.js`](engine/plant-art.js) | Trigo por fases de crecimiento |
| [`engine/horse-sheet-art.js`](engine/horse-sheet-art.js) | Caballo desde hoja PNG (rejilla 4×8 con las cuatro direcciones y galope de 11 fotogramas); compone encabritarse/tumbarse |
| [`engine/grave-art.js`](engine/grave-art.js), [`engine/corpse-art.js`](engine/corpse-art.js) | Tumbas y cadáveres |

**Subsistemas `game-engine-*-utils.js`:** `bootstrap`, `preload`, `selection`, `sprite-runtime`,
`entity-def`, `map-editor-core`, `settlement` (planificador urbano: manzanas, viario, muralla,
puertas), `structures`, `story`, `fx`, `icons`, `debug`.

**Sistemas con estado propio:** [`observatory.js`](engine/observatory.js),
[`stealth.js`](engine/stealth.js), [`game-engine-structures.js`](engine/game-engine-structures.js)
(conjuntos de edificios por plantillas `dc/dr`), [`terrain-generator.js`](engine/terrain-generator.js)
(ruido de valor + fbm), [`scene-manager.js`](engine/scene-manager.js) (índice espacial),
[`event-manager.js`](engine/event-manager.js), [`atlas-builder.js`](engine/atlas-builder.js),
[`building-volume.js`](engine/building-volume.js).

> ⚠️ **Stubs:** `renderer.js`, `map.js`, `ui.js`, `input.js`, `death-system.js` solo hacen
> `console.warn` — la implementación real está en `game-engine.js`. `game.js` es un shim legacy.

### 3.3 Puente navegador ↔ Electron

Se resuelve con **tres capas redundantes** (todas necesarias en algún escenario):

1. **[`electron/preload.js`](electron/preload.js)** — lee los JSON de disco y los expone por
   `contextBridge` en `window.__mesoPreload`, porque `fetch('file://')` está bloqueado en Chromium.
2. **Protocolo custom `meso-local://`** en [`electron/main.js`](electron/main.js) — sirve ficheros
   del proyecto con cabeceras CORS y `Cross-Origin-Resource-Policy`, para que `getImageData` pueda
   recortar las hojas de sprites sin "manchar" el canvas.
3. **[`scripts/dev-server.js`](scripts/dev-server.js)** — servidor estático para desarrollo en
   navegador (`?debug=1`, `?editor=1`).

---

## 4. Organización de carpetas

```text
MesoBuilder/
├── index.html              Menú, splash y bootstrap del juego
├── styles.css              Temas, HUD y paneles
├── game.js                 Shim legacy (no usar)
├── package.json            Scripts npm (Electron + herramientas)
├── version.properties      Versión mostrada en el splash
├── MANUAL.md               Manual de jugador y desarrollo (~98 KB)
├── ACTUALIZACIONES.md      Registro de cambios
├── TODO.md / ideas.md      Pendientes y bocetos
├── engine/                 Motor: juego, render, arte y sistemas
├── electron/               main.js + preload.js (wrapper de escritorio)
├── data/                   Datos y assets (JSON, PNG, WAV, MID, interiores)
├── scripts/                Servidores de desarrollo y editores
├── tools/                  Pipeline de arte, índices y auditoría
│   └── Support/            Editores standalone en HTML
├── docs/                   ~35 documentos de diseño y sistemas + indice.json
├── bin/                    Lanzadores .vbs / .bat
└── miniJuegos/ur           Minijuego UR (congelado)
```

| Carpeta | Responsabilidad |
|---|---|
| `engine/` | Motor de juego y módulos de render/arte/sistemas |
| `electron/` | Proceso principal y preload del wrapper de escritorio |
| `data/` | `entities-defs.json`, `entity-pixels.json` (8 MB), `entity-views.json`, `npc-dialogues.json`, `interiors/`, `sheets/` (PNG de 1,2–3,7 MB), `Sounds/`, `Music/` |
| `scripts/` | `dev-server`, `serve-entity-editor` (+ API de vistas), `serve-pixel-editor`, `clean-dev` |
| `tools/` | Generadores de arte, constructores de índices, auditores y previsualizadores |
| `docs/` | Documentación viva por subsistema + índice de la guía in-game (F1) |

---

## 5. Cadena de producción de contenido

El proyecto no usa Tiled ni Aseprite: tiene su **pipeline propio en tres vías**.

### Vía A — Arte nuevo desde PNG
```text
data/sheets/*.png
   → tools/Support/entity-sheet-editor.html   (npm run editor)
   → data/entity-views.json                   (ruta + rectángulo por vista)
   → cargarVistasDeEntidades() en el motor    (recorte de píxeles al arrancar)
```

### Vía B — Sprites en JSON
```text
tools/Support/pixel-editor-standalone.html
   → data/entity-pixels.json
   → respaldos con tools/Support/backup-entity-pixels.js
```

### Vía C — Arte generado por código
```text
engine/*-art.js
   → previsualización en Node:
     tools/preview-plants.js · tools/preview-animals.js · tools/build-trees.js
     tools/build-mesopotamia-sprites.js · tools/build-horse-sheet.py
```

### Índices y control de calidad
| Herramienta | Salida |
|---|---|
| `tools/build-entity-index.mjs` | `data/entity-index.json` (~113 KB) |
| `tools/build-docs-index.mjs` | `docs/indice.json` (índice de la guía F1) |
| `tools/audit-sprites.js` | Auditoría de sprites |
| `tools/check-module-scope.mjs` | Detecta código de módulo atrapado dentro de `render()` |
| `tools/syntax_check.js` | Comprobación de sintaxis |

### Scripts npm

| Script | Función |
|---|---|
| `start-electron` | Arranca el juego en Electron |
| `start-electron-dev` | Electron apuntando al proyecto actual (`MESOBUILDER_EXTERNAL_PATH`) |
| `start-electron-dev-limpio` | Igual, limpiando cachés y `localStorage` |
| `start-electron-pro` | Limpia, empaqueta y lanza el build |
| `package-win` | Genera `dist/MesoBuilder-win32-x64` |
| `editor` | Servidor + editor de entidades (puerto 4321+) |
| `pixel-editor` | Servidor del editor de píxeles |
| `docs-index` / `entity-index` | Regeneran los índices |

---

## 6. Convenciones y estado

- **Un solo interruptor de diseño**: `MODO_COLONIA`, `NARRATIVA` y `CONSTRUIR_EN_JUEGO` controlan
  qué sistemas están vivos, congelados o muertos.
- **Documentación como sistema**: cada subsistema tiene su `.md` con decisiones, medidas y trampas.
  [`docs/AUDITORIA.md`](docs/AUDITORIA.md) registra averías silenciosas corregidas con evidencia;
  [`MANUAL.md`](MANUAL.md) hace de manual de jugador y de desarrollo.
- **Nombres de dominio en español** (`playerBuilt`, `crecida`, `hito`, `parcela`) con identificadores
  técnicos en inglés.
- **Commits fechados por día de trabajo** ("Des 29 - MesoBuilda", "Des 28 - …").

### Deuda técnica conocida (documentada)

| Deuda | Dónde está el plan |
|---|---|
| Monolito de ~29.700 líneas y estado global | [`docs/REFACTOR-MONOLITO.md`](docs/REFACTOR-MONOLITO.md) |
| Tres vías de carga de datos (preload / `meso-local://` / HTTP) | Comentarios de `electron/main.js` y `preload.js` |
| Arranque con caché de terreno (~1,0–1,5 s) | [`TODO.md`](TODO.md), [`docs/RENDIMIENTO.md`](docs/RENDIMIENTO.md) |
| Crecimiento de mundo por bandas (~52 ms por banda) | [`docs/EDIFICIOS-VOLUMEN-Y-CRECIMIENTO.md`](docs/EDIFICIOS-VOLUMEN-Y-CRECIMIENTO.md) §4 |
| Falta de sonidos para acciones (plan `engine/sfx.js`) | [`TODO.md`](TODO.md) |
| Stubs vacíos (`renderer`, `map`, `ui`, `input`, `death-system`) | `MANUAL.md` §2 |

---

## 7. Documentación de referencia

### Diseño y manuales
- [`docs/DISEÑO.md`](docs/DISEÑO.md) — **documento rector** del juego actual
- [`MANUAL.md`](MANUAL.md) — manual de jugador y desarrollo
- [`ACTUALIZACIONES.md`](ACTUALIZACIONES.md) — changelog
- [`docs/indice.json`](docs/indice.json) — índice generado de toda la documentación

### Sistemas
`ACCIONES-Y-ANIMACIONES` · `AGRICULTURA` · `ARTE-ARBOLES-Y-ANIMALES` · `CABALLO-*` ·
`CADAVERES` · `DIALOGOS-Y-ENCARGOS` · `EDIFICIOS-VOLUMEN-Y-CRECIMIENTO` · `ESTRUCTURAS` ·
`HERIDAS-Y-CABALLO` · `HUD-DINAMICO` · `HUD-MINIMALISTA` · `INTERIORES` · `OBSERVATORIO` ·
`PUERTAS-Y-CONTROL` · `RIOS-Y-PESCADORES` · `SIGILO` · `TERRENO-Y-MUNDO` ·
`VEGETACION-CULTIVOS-Y-SONIDO`

### Técnica y herramientas
`AUDITORIA` · `ARRANQUE-GUARDADO-E-INTERFAZ` · `EDITOR-DE-ENTIDADES` · `MODO-DEBUG` ·
`REFACTOR-MONOLITO` · `RENDIMIENTO` · `RENDERIZADO-PIXEL` · `UN-SPRITE-POR-VISTA`

---

## 8. Resumen para terceros

> MesoBuilder es un juego de gestión en 2D con arte pixel-art, hecho en JavaScript puro sobre
> Canvas 2D y empaquetado con Electron. El motor es un monolito grande y muy comentado del que se
> van extrayendo subsistemas con una herramienta que mide dependencias; el arte se produce con
> editores HTML propios que escriben JSON de sprites, y el proyecto está documentado como un
> cuaderno de ingeniería: cada sistema tiene su `.md` con el porqué, las medidas y los fallos que
> ya se corrigieron.
