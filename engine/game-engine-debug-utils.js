// engine/game-engine-debug-utils.js
// ─────────────────────────────────────────────────────────────────────────────
// MODO DEBUG / INSPECTOR VISUAL de MesoBuilder
//
// Objetivo: poder VER y AJUSTAR los sprites y colocaciones en tiempo real, sin
// tener que recompilar ni editar JSON a ciegas.
//
//   F9 ........................ activa / desactiva el modo debug
//   Clic ...................... selecciona lo que hay bajo el cursor
//   Arrastrar ................. mueve la selección (Alt = sin ajustar a rejilla)
//   Alt+Clic .................. cicla entre elementos solapados
//   Flechas ................... ajuste fino (±1 px de mundo); Shift = ±1 casilla
//   [ / ] ..................... escala del sprite de la selección
//   , / . ..................... offset vertical del sprite
//   ; / ' ..................... offset horizontal del sprite
//   G ......................... rejilla / cajas de depuración
//   P ......................... pausar / reanudar el mundo (para ajustar quieto)
//   H ......................... centrar la cámara en la selección
//   Supr ...................... borrar la entidad seleccionada
//   Ctrl+Z .................... deshacer el último movimiento
//   Esc ....................... deseleccionar
//
// Ajustes persistentes:
//   * Por sprite (todas las instancias de esa clave): escala / offset / alfa
//   * Por tipo de edificio: escala / offset
//   * Por entidad concreta (sesión): escala / offset / sprite alternativo
//   Se exportan a JSON y se pueden guardar como data/sprite-adjustments.json
//   para que el motor los aplique SIEMPRE (incluso sin modo debug).
// ─────────────────────────────────────────────────────────────────────────────

import { entities, rabbits, foxes, graves } from './entities.js';
import { icono as iconoUI } from './icons.js';

const ADJUST_FILE = 'data/sprite-adjustments.json';
const STORAGE_KEY = 'meso.debug.overrides.v1';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

export function createDebugTools(deps) {
  // ── Estado interno ────────────────────────────────────────────────────────
  const state = {
    enabled: false,
    selected: null,          // { collection, ref, kind, label }
    hover: null,
    drag: null,
    snap: true,
    pauseWorld: true,
    showGrid: true,
    showBoxes: true,
    precise: true,
    pickCycle: { key: '', index: 0, at: 0 },
    spawnKey: '',
    spawnMode: false,
    // ── Estructuras / conjuntos ──
    structSel: '',
    structDraftText: '',
    structRadius: 14,
    structId: '',
    undo: [],
    pausedBackup: null
  };

  // Ajustes por clave de sprite (afectan a TODAS las instancias)
  const spriteAdjust = {};
  // Ajustes por tipo de edificio
  const buildingAdjust = {};

  const api = {
    ready: false,
    init,
    get enabled() { return state.enabled; },
    spriteAdjust,
    buildingAdjust,
    toggle: () => setEnabled(!state.enabled),
    setEnabled,
    togglePanel,
    select: (info) => { setSelection(info); },
    clearSelection: () => setSelection(null),
    exportJSON,
    importJSON,
    resetAll,
    snapshot: () => ({ sprites: { ...spriteAdjust }, buildings: { ...buildingAdjust } }),
    // Usado por el motor durante el dibujado (lectura muy barata)
    getSpriteAdjust: (key) => (window._mesoDbgSprite ? window._mesoDbgSprite[key] : null) || null,
    getBuildingAdjust: (type) => (window._mesoDbgBuilding ? window._mesoDbgBuilding[type] : null) || null,
    getEntityAdjust: (ent) => (ent && ent._dbg) ? ent._dbg : null,
    // Utilidades expuestas por si se quiere automatizar desde la consola
    moveSelectionBy,
    scaleSelectionBy: (delta) => adjustVisual('scale', num(delta, 0.05)),
    setVisual,
    undo,
    refreshPanel,
    listSprites: () => getSpriteKeys(),
    // ── Revisión del mundo sin depender del render ──────────────────────────
    // Permiten volcar el mapa a texto/JSON para revisar colocaciones a vista
    // de pájaro (útil cuando la ventana está oculta o el zoom no da detalle).
    getGrid: () => { try { return eng().grid || null; } catch (e) { return null; } },
    getTileBiome: () => { try { return eng().tileBiome || null; } catch (e) { return null; } },
    mapSnapshot,
    auditMap,
    legend,
    // Picking programático (útil para automatizar y para depurar el propio inspector)
    pickAtClient: (clientX, clientY) => {
      try {
        const canvas = deps.getCanvas();
        const rect = canvas.getBoundingClientRect();
        const sx = (Number(clientX) - rect.left) * (canvas.width / Math.max(1, rect.width));
        const sy = (Number(clientY) - rect.top) * (canvas.height / Math.max(1, rect.height));
        const hit = pickAt(sx, sy, {});
        return hit ? { type: hit.type, label: hit.label, collection: hit.collection || null } : null;
      } catch (e) { return null; }
    },
    getState: () => ({
      enabled: state.enabled,
      snap: state.snap,
      pauseWorld: state.pauseWorld,
      showGrid: state.showGrid,
      showBoxes: state.showBoxes,
      spawnMode: state.spawnMode,
      spawnKey: state.spawnKey,
      selected: state.selected
        ? { type: state.selected.type, label: state.selected.label, collection: state.selected.collection || null }
        : null,
      cursor: state.cursor ? { col: state.cursor.col, row: state.cursor.row, x: state.cursor.world.x, y: state.cursor.world.y } : null,
      undoDepth: state.undo.length,
      lastPick: state.lastPick || null,
      spriteAdjustCount: Object.keys(spriteAdjust).length,
      buildingAdjustCount: Object.keys(buildingAdjust).length
    })
  };
  // Ayudas de prueba del motor (dibujar un sprite y leer los píxeles), para
  // comprobar desde fuera que algo se dibuja de verdad.
  if (deps.testDraw) api.testDraw = deps.testDraw;
  // Ayudas de las vistas del motor que viven en su propio módulo (el observatorio:
  // abrir la cúpula, apuntar a una constelación por id, forzar la revelación…).
  if (deps.observatorio) api.observatorio = deps.observatorio;
  try { window.MESO_DEBUG = api; } catch (e) {}

  const dom = { overlay: null, ctx: null, panel: null, body: null, root: null };

  // ── Acceso a estado del motor ─────────────────────────────────────────────
  function eng() { try { return deps.getEngineState ? deps.getEngineState() : {}; } catch (e) { return {}; } }
  function activeCollections() {
    const cols = [];
    try { if (Array.isArray(entities)) cols.push({ name: 'entities', list: entities }); } catch (e) {}
    try { if (Array.isArray(rabbits)) cols.push({ name: 'rabbits', list: rabbits }); } catch (e) {}
    try { if (Array.isArray(foxes)) cols.push({ name: 'foxes', list: foxes }); } catch (e) {}
    try { if (Array.isArray(graves)) cols.push({ name: 'graves', list: graves }); } catch (e) {}
    try { if (Array.isArray(window._ENEMIES)) cols.push({ name: 'enemies', list: window._ENEMIES }); } catch (e) {}
    return cols;
  }
  function collectionFor(ref) {
    for (const c of activeCollections()) { if (c.list.indexOf(ref) >= 0) return c.name; }
    return 'entities';
  }
  function listOf(name) {
    const found = activeCollections().find(c => c.name === name);
    return found ? found.list : null;
  }

  // ── Revisión del mundo: planos y auditoría de colocación ─────────────────
  // Colores por tipo de edificio. Fuente única de verdad: los planos que se
  // dibujan fuera del canvas del juego usan esta misma leyenda.
  const BUILDING_COLORS = {
    ziggurat: '#ffe680', steel_foundry: '#7f8896',
    temple: '#ffd0a0', factory: '#8e939c',
    market: '#ff9f40', state_warehouse: '#b3a184',
    granary: '#ffd700', collective_farm: '#8bc35f',
    farm: '#7fbf5a', farm_plot: '#639a45',
    house: '#dcdcdc', house_small: '#c2c2c2', house_large: '#f0f0f0', house_garden: '#d9e8b5',
    hut: '#c98b4b', reed_hut: '#cbaa80', longhouse: '#a86c34', stone_house: '#9a9ea3',
    house_isolated: '#c9a86b', mesopotamian_house: '#e6d7a8', mesopotamian_villa_detailed: '#fff0b0',
    mesopotamian_baths: '#7fc4ff', mesopotamian_arch: '#ff8a8a',
    soviet_block: '#a3abb8', soviet_superblock: '#8d97a6', soviet_superblock_b: '#6e7785',
    party_hq: '#c9787f', state_clinic: '#93b6cd', checkpoint_gate: '#a08484',
    wall_segment: '#6f6050', wall_tower: '#8f7565', tower: '#8f7565', watchtower: '#a09080',
    road: '#cdbd8e', concrete_road: '#a2a8b0',
    well: '#7ec8ff', fountain: '#48b4ff', lamp_post: '#6a6a6a', soviet_streetlight: '#5a5a64',
    soviet_monument: '#a24444', pottery: '#e08868', sheepfold: '#dcc79a', dock: '#b5a184'
  };
  // Colores de terreno/bioma.
  const BIOME_COLORS = {
    water: '#2d5f8a', deep_water: '#1e4468', riparian: '#4c7a4c', alluvial: '#8d7f5a',
    steppe: '#9a8f6a', hills: '#7d7360', grass: '#5e8f4a', saline: '#a8a08c',
    marsh: '#5d7a63', road: '#cdbd8e', concrete_road: '#a2a8b0', canal_road: '#6f8ea0',
    sand: '#c2b184', forest: '#3f6b3a', savanna: '#a8a05c', tundra: '#b4b8a8'
  };
  function legend() {
    return { buildings: { ...BUILDING_COLORS }, biomes: { ...BIOME_COLORS } };
  }

  // Vuelca una ventana del mapa a datos listos para dibujar un plano.
  function mapSnapshot(col0, row0, w, h) {
    const g = (eng().grid) || [];
    const tb = (eng().tileBiome) || [];
    const cells = [];
    for (let r = 0; r < h; r++) {
      const srcRow = tb[row0 + r] || [];
      const ownRow = g[row0 + r] || [];
      const outRow = [];
      for (let c = 0; c < w; c++) {
        const cell = ownRow[col0 + c] || null;
        let b = null;
        if (cell) b = (typeof cell === 'string') ? cell : (cell.type || null);
        outRow.push({ t: srcRow[col0 + c] || null, b });
      }
      cells.push(outRow);
    }
    return { col0, row0, cols: w, rows: h, cells };
  }

  // Auditoría de colocación: detecta tipos desconocidos, huellas solapadas,
  // edificios sobre agua y huellas que se salen del mapa.
  function auditMap() {
    const g = (eng().grid) || [];
    const tb = (eng().tileBiome) || [];
    const known = (() => { try { return new Set(deps.getBuildingTypes ? deps.getBuildingTypes() : []); } catch (e) { return new Set(); } })();
    const byType = {};
    const unknownTypes = {};
    const bases = new Map();
    let cells = 0;
    for (let r = 0; r < g.length; r++) {
      const row = g[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        cells++;
        const type = (typeof cell === 'string') ? cell : (cell.type || '(sin tipo)');
        byType[type] = (byType[type] || 0) + 1;
        if (known.size && !known.has(type)) unknownTypes[type] = (unknownTypes[type] || 0) + 1;
        if (typeof cell === 'object' && cell.baseCol != null && cell.baseRow != null) {
          const key = cell.baseCol + ',' + cell.baseRow;
          if (!bases.has(key)) bases.set(key, { col: cell.baseCol, row: cell.baseRow, type });
        }
      }
    }
    // Huellas reales + solapes
    const owner = new Map();
    const onWater = [];
    const outOfBounds = [];
    for (const [key, info] of bases) {
      let size = null;
      try { size = deps.getBuildingSize ? deps.getBuildingSize(info.type) : null; } catch (e) {}
      info.w = (size && size.w) || 1;
      info.h = (size && size.h) || 1;
      if (info.col < 0 || info.row < 0 || info.col + info.w > (g[0] || []).length || info.row + info.h > g.length) {
        outOfBounds.push({ type: info.type, col: info.col, row: info.row, w: info.w, h: info.h });
      }
      let water = false;
      for (let r = 0; r < info.h; r++) {
        for (let c = 0; c < info.w; c++) {
          const k = (info.row + r) + ',' + (info.col + c);
          if (!owner.has(k)) owner.set(k, []);
          owner.get(k).push(key);
          const biome = (tb[info.row + r] || [])[info.col + c];
          if (biome === 'water' || biome === 'deep_water') water = true;
        }
      }
      if (water) onWater.push({ type: info.type, col: info.col, row: info.row });
    }
    const overlaps = [];
    for (const [k, list] of owner) {
      if (list.length > 1) overlaps.push({ cell: k, count: list.length, types: list.map(x => (bases.get(x) || {}).type) });
    }
    return {
      cellsWithBuilding: cells,
      buildingCount: bases.size,
      byType,
      unknownTypes,
      overlapCells: overlaps.length,
      overlaps: overlaps.slice(0, 40),
      onWater,
      outOfBounds
    };
  }

  // ── Etiquetas legibles ────────────────────────────────────────────────────
  function describeEntity(ref) {
    if (!ref || typeof ref !== 'object') return 'entidad';
    const parts = [];
    if (ref.kind) parts.push(ref.kind);
    if (ref.subtype) parts.push(ref.subtype);
    if (ref.variant) parts.push(ref.variant);
    if (ref.name) parts.push(ref.name);
    if (ref.type && !ref.subtype && !ref.variant) parts.push(ref.type);
    if (ref.id) parts.push('#' + String(ref.id).slice(0, 14));
    return parts.length ? parts.join(' · ') : 'entidad';
  }
  function spriteKeyOf(ref) {
    if (!ref || typeof ref !== 'object') return null;
    if (ref._dbg && ref._dbg.sprite) return ref._dbg.sprite;
    if (ref.sprite) return ref.sprite;   // entidades de previsualización del modo debug
    if (ref.kind === 'tree') return ref.variant || 'tree0';
    if (ref.kind === 'pet' && ref.petType === 'dog') return 'pet_dog';
    if (ref.subtype) return ref.subtype;
    if (ref.variant) return ref.variant;
    return null;
  }

  // ── Sync con los globals que lee el render del motor ─────────────────────
  function syncGlobals() {
    try { window._mesoDebugActive = !!state.enabled; } catch (e) {}
    try { window._mesoDbgSprite = Object.keys(spriteAdjust).length ? spriteAdjust : null; } catch (e) {}
    try { window._mesoDbgBuilding = Object.keys(buildingAdjust).length ? buildingAdjust : null; } catch (e) {}
    try { window._mesoDbgPrecise = !!(state.enabled ? state.precise : window._mesoDbgPrecise); } catch (e) {}
  }

  // ── Persistencia ──────────────────────────────────────────────────────────
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sprites: spriteAdjust,
        buildings: buildingAdjust,
        savedAt: new Date().toISOString()
      }));
    } catch (e) {}
  }
  function loadPersisted() {
    let loaded = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { applyOverridePayload(JSON.parse(raw), { silent: true }); loaded = true; }
    } catch (e) {}
    return loaded;
  }
  // Carga data/sprite-adjustments.json (lo aplica el motor siempre, incluso sin F9)
  async function loadFromFile() {
    try {
      // En Electron el preload es la fuente autoritativa: si no lo trae, el archivo
      // no existe y no tiene sentido intentar un fetch (evita un 404 inútil).
      if (window.__mesoPreload && window.__mesoPreload.isElectron) {
        const pre = window.__mesoPreload.spriteAdjustments;
        if (pre) {
          applyOverridePayload(pre, { silent: true });
          try { console.log('[MESO_DEBUG] ajustes de sprites cargados desde ' + ADJUST_FILE); } catch (e) {}
        }
        return;
      }
      const res = await fetch(ADJUST_FILE + '?v=' + Date.now());
      if (res && res.ok) {
        const json = await res.json();
        applyOverridePayload(json, { silent: true });
        try { console.log('[MESO_DEBUG] ajustes de sprites cargados desde ' + ADJUST_FILE); } catch (e) {}
      }
    } catch (e) { /* no existe el archivo: normal */ }
  }

  function applyOverridePayload(payload, opts = {}) {
    try {
      const src = payload && payload.payload ? payload.payload : payload;
      if (!src) return false;
      const sprites = src.sprites || src.spriteAdjust || null;
      const buildings = src.buildings || src.buildingAdjust || null;
      if (sprites) {
        for (const k of Object.keys(sprites)) {
          const v = sprites[k] || {};
          spriteAdjust[k] = {
            scale: clamp(num(v.scale, 1), 0.1, 4),
            offsetX: clamp(num(v.offsetX, 0), -2, 2),
            offsetY: clamp(num(v.offsetY, 0), -2, 2),
            alpha: clamp(num(v.alpha, 1), 0.05, 1)
          };
        }
      }
      if (buildings) {
        for (const k of Object.keys(buildings)) {
          const v = buildings[k] || {};
          buildingAdjust[k] = {
            scale: clamp(num(v.scale, 1), 0.1, 4),
            offsetX: clamp(num(v.offsetX, 0), -2, 2),
            offsetY: clamp(num(v.offsetY, 0), -2, 2)
          };
        }
      }
      syncGlobals();
      if (!opts.silent) { refreshPanel(); try { deps.render(); } catch (e) {} }
      return true;
    } catch (e) { return false; }
  }

  function exportJSON() {
    return JSON.stringify({
      version: 1,
      generatedBy: 'MesoBuilder debug tools',
      savedAt: new Date().toISOString(),
      sprites: spriteAdjust,
      buildings: buildingAdjust
    }, null, 2);
  }

  function importJSON(text) {
    try {
      const data = typeof text === 'string' ? JSON.parse(text) : text;
      if (!applyOverridePayload(data)) return false;
      persist();
      refreshPanel();
      deps.notify('Ajustes de debug importados.');
      return true;
    } catch (e) {
      deps.notify('JSON de ajustes no válido.');
      return false;
    }
  }

  function downloadJSON() {
    try {
      const blob = new Blob([exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sprite-adjustments.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 500);
      deps.notify('Guardado sprite-adjustments.json en Descargas.');
    } catch (e) {
      deps.notify('No se pudo exportar.');
    }
  }

  function resetAll(opts = {}) {
    for (const k of Object.keys(spriteAdjust)) delete spriteAdjust[k];
    for (const k of Object.keys(buildingAdjust)) delete buildingAdjust[k];
    for (const c of activeCollections()) {
      for (const ref of c.list) { if (ref && ref._dbg) delete ref._dbg; }
    }
    if (!opts.keepStorage) { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
    syncGlobals();
    refreshPanel();
    try { deps.render(); } catch (e) {}
    if (!opts.silent) deps.notify('Ajustes de debug restablecidos.');
  }

  // ── Activación / desactivación ────────────────────────────────────────────
  function setEnabled(on) {
    state.enabled = !!on;
    try {
      if (state.enabled) {
        ensureOverlay();
        ensurePanel();
        state.pausedBackup = num(window._timeScale, 1);
        if (state.pauseWorld) window._timeScale = 0;
        try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
        deps.notify('Modo debug ACTIVADO — F9 para salir. Clic/arrastrar para mover sprites.');
      } else {
        if (state.pausedBackup !== null && num(window._timeScale, 1) === 0) {
          window._timeScale = state.pausedBackup;
        }
        state.pausedBackup = null;
        state.drag = null;
        state.hover = null;
        if (dom.panel) dom.panel.style.display = 'none';
        if (dom.overlay) dom.overlay.style.display = 'none';
        try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
        deps.notify('Modo debug desactivado.');
      }
    } catch (e) { /* ignore */ }
    syncGlobals();
    return state.enabled;
  }

  // ── Overlay (canvas transparente encima del canvas del juego) ─────────────
  function ensureOverlay() {
    try {
      if (dom.overlay && document.body.contains(dom.overlay)) return;
      const ov = document.createElement('canvas');
      ov.id = 'meso-debug-overlay';
      Object.assign(ov.style, {
        position: 'fixed', left: '0', top: '0', pointerEvents: 'none',
        zIndex: '90000', imageRendering: 'pixelated'
      });
      document.body.appendChild(ov);
      dom.overlay = ov;
      dom.ctx = ov.getContext('2d');
    } catch (e) {}
  }

  function syncOverlaySize() {
    try {
      const canvas = deps.getCanvas();
      if (!canvas || !dom.overlay) return false;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      if (dom.overlay.width !== canvas.width || dom.overlay.height !== canvas.height) {
        dom.overlay.width = canvas.width;
        dom.overlay.height = canvas.height;
      }
      dom.overlay.style.left = rect.left + 'px';
      dom.overlay.style.top = rect.top + 'px';
      dom.overlay.style.width = rect.width + 'px';
      dom.overlay.style.height = rect.height + 'px';
      return true;
    } catch (e) { return false; }
  }

  // ── Geometría ─────────────────────────────────────────────────────────────
  function cellFrame(col, row) {
    try {
      const mode = deps.getViewMode();
      const p = deps.worldToScreen(col, row);
      if (mode === 'iso') {
        const iso = deps.getIsoTileSize();
        return { x: p.x - iso.w / 2, y: p.y, w: iso.w, h: iso.h };
      }
      const t = deps.getTileSize();
      return { x: p.x, y: p.y, w: t, h: t };
    } catch (e) { return null; }
  }

  // Rectángulo real dibujado (lo rellena el motor desde drawEntitySpriteAt)
  function drawnRect(ref) {
    try {
      if (!ref || !ref._dbgRect) return null;
      if (Date.now() - (ref._dbgRectAt || 0) > 400) return null;
      const r = ref._dbgRect;
      if (!Number.isFinite(r.x) || !Number.isFinite(r.y)) return null;
      return r;
    } catch (e) { return null; }
  }

  function entityAnchor(ref) {
    try {
      const x = (typeof ref.x === 'number') ? ref.x : ref.col;
      const y = (typeof ref.y === 'number') ? ref.y : ref.row;
      return { x: num(x, 0), y: num(y, 0) };
    } catch (e) { return { x: 0, y: 0 }; }
  }

  // Caja de referencia (aproximada si el motor aún no ha dibujado la entidad)
  function entityFrame(ref) {
    try {
      const rect = drawnRect(ref);
      if (rect) return { x: rect.x, y: rect.y, w: rect.w, h: rect.h, exact: true };
      const tile = deps.getTileSize();
      const a = entityAnchor(ref);
      const size = Math.max(0.4, num(ref.size, 1));
      const p = deps.worldToScreen(a.x, a.y);
      const mode = deps.getViewMode();
      const w = Math.max(6, tile * size);
      const h = Math.max(6, tile * size);
      if (mode === 'iso') return { x: p.x - w / 2, y: p.y - h, w, h, exact: false };
      return { x: p.x + tile * 0.5 - w / 2, y: p.y + tile - h, w, h, exact: false };
    } catch (e) { return null; }
  }

  function buildingFrame(info) {
    try {
      if (!info) return null;
      const size = deps.getBuildingSize(info.type) || { w: 1, h: 1 };
      const mode = deps.getViewMode();
      const p = deps.worldToScreen(info.baseCol, info.baseRow);
      if (mode === 'iso') {
        const iso = deps.getIsoTileSize();
        return { x: p.x - iso.w / 2, y: p.y, w: iso.w * size.w, h: iso.h * (size.w + size.h) / 2 + iso.h * 0.2 };
      }
      const t = deps.getTileSize();
      return { x: p.x, y: p.y, w: t * size.w, h: t * size.h };
    } catch (e) { return null; }
  }

  // ── Picking ───────────────────────────────────────────────────────────────
  function pickAt(canvasX, canvasY, opts = {}) {
    try {
      const world = deps.screenToWorldFloat(canvasX, canvasY);
      const col = Math.floor(world.x), row = Math.floor(world.y);
      const candidates = [];

      // edificios (footprint)
      try {
        const cell = deps.getCellInfo(col, row);
        if (cell && cell.type) {
          const size = deps.getBuildingSize(cell.type) || { w: 1, h: 1 };
          candidates.push({
            type: 'building', ref: null, label: 'edificio · ' + cell.type,
            building: {
              type: cell.type,
              baseCol: num(cell.baseCol, col),
              baseRow: num(cell.baseRow, row),
              w: size.w, h: size.h
            },
            distance: 0
          });
        }
      } catch (e) {}

      // entidades / animales / tumbas / enemigos
      const collections = activeCollections();
      for (const c of collections) {
        for (let i = c.list.length - 1; i >= 0; i--) {
          const ref = c.list[i];
          if (!ref || typeof ref !== 'object') continue;
          const fr = entityFrame(ref);
          const a = entityAnchor(ref);
          const near = Math.hypot((a.x + 0.5) - world.x, (a.y + 0.6) - world.y);
          const radius = Math.max(0.45, 0.5 * Math.max(0.6, num(ref.size, 1)));
          // Se acepta si el cursor está dentro de la caja dibujada (generosa) o
          // cerca del ancla. Así se pueden seleccionar sprites grandes (árboles,
          // edificios-ente) y pequeños (hierba, recursos) con la misma comodidad.
          const insideBox = !!fr && canvasX >= fr.x - 2 && canvasX <= fr.x + fr.w + 2 &&
                                       canvasY >= fr.y - 2 && canvasY <= fr.y + fr.h + 2;
          if (!insideBox && !(opts.loose ? false : near <= radius)) continue;
          candidates.push({
            type: 'entity', ref, collection: c.name,
            label: describeEntity(ref),
            distance: near
          });
        }
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        // edificios primero si el clic está claramente dentro (suelen ser el objetivo)
        const order = { building: 0, entity: 1 };
        const d = (order[a.type] - order[b.type]);
        if (d !== 0) return d;
        return a.distance - b.distance;
      });
      if (opts.cycle) {
        const key = col + ',' + row;
        const now = Date.now();
        if (state.pickCycle.key !== key || (now - state.pickCycle.at) > 1500) {
          state.pickCycle = { key, index: 0, at: now };
        } else {
          state.pickCycle.index = (state.pickCycle.index + 1) % candidates.length;
          state.pickCycle.at = now;
        }
        return candidates[state.pickCycle.index];
      }
      return candidates[0];
    } catch (e) { return null; }
  }

  function setSelection(info) {
    state.selected = info || null;
    try { refreshPanel(); } catch (e) {}
  }

  // ── Movimiento ────────────────────────────────────────────────────────────
  function pushUndo(entry) {
    try {
      state.undo.push(entry);
      if (state.undo.length > 120) state.undo.shift();
    } catch (e) {}
  }

  function moveEntityRef(ref, x, y, opts = {}) {
    try {
      const beforeX = (typeof ref.x === 'number') ? ref.x : ref.col;
      const beforeY = (typeof ref.y === 'number') ? ref.y : ref.row;
      if (!opts.silent) pushUndo({ type: 'entity', ref, x: beforeX, y: beforeY, col: ref.col, row: ref.row });
      ref.x = x; ref.y = y;
      if (opts.syncColRow !== false) {
        ref.col = Math.floor(x);
        ref.row = Math.floor(y);
      }
      ref._dbgMoved = true;
      try { if (window.SceneManager && window.SceneManager.rebuild) window.SceneManager.rebuild(entities); } catch (e) {}
    } catch (e) {}
  }

  function moveBuildingRef(sel, toCol, toRow) {
    try {
      const info = sel.building;
      if (!info) return;
      toCol = clamp(Math.floor(toCol), 0, Math.max(0, deps.COLS - info.w));
      toRow = clamp(Math.floor(toRow), 0, Math.max(0, deps.ROWS - info.h));
      if (toCol === info.baseCol && toRow === info.baseRow) return;
      pushUndo({ type: 'building', building: info, baseCol: info.baseCol, baseRow: info.baseRow });
      const moved = deps.moveBuilding(info.type, info.baseCol, info.baseRow, toCol, toRow);
      if (moved) {
        info.baseCol = toCol;
        info.baseRow = toRow;
        sel.label = 'edificio · ' + info.type + ' (' + toCol + ',' + toRow + ')';
        refreshPanel();
      }
    } catch (e) {}
  }

  function moveSelectionBy(dx, dy) {
    const sel = state.selected;
    if (!sel) return false;
    try {
      if (sel.type === 'entity' && sel.ref) {
        const a = entityAnchor(sel.ref);
        moveEntityRef(sel.ref, a.x + dx, a.y + dy);
        return true;
      }
      if (sel.type === 'building' && sel.building) {
        moveBuildingRef(sel, sel.building.baseCol + dx, sel.building.baseRow + dy);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function undo() {
    try {
      const entry = state.undo.pop();
      if (!entry) { deps.notify('Nada que deshacer.'); return false; }
      if (entry.type === 'entity' && entry.ref) {
        moveEntityRef(entry.ref, entry.x, entry.y, { silent: true, syncColRow: false });
        if (typeof entry.col === 'number') entry.ref.col = entry.col;
        if (typeof entry.row === 'number') entry.ref.row = entry.row;
      } else if (entry.type === 'building' && entry.building) {
        deps.moveBuilding(entry.building.type, entry.building.baseCol, entry.building.baseRow, entry.baseCol, entry.baseRow);
        entry.building.baseCol = entry.baseCol;
        entry.building.baseRow = entry.baseRow;
      }
      refreshPanel();
      deps.notify('Deshecho.');
      return true;
    } catch (e) { return false; }
  }

  // ── Ajustes visuales ──────────────────────────────────────────────────────
  function ensureEntityDbg(ref) {
    if (!ref) return null;
    if (!ref._dbg) ref._dbg = {};
    return ref._dbg;
  }

  function ensureSpriteAdjust(key) {
    if (!key) return null;
    if (!spriteAdjust[key]) spriteAdjust[key] = { scale: 1, offsetX: 0, offsetY: 0, alpha: 1 };
    return spriteAdjust[key];
  }

  function ensureBuildingAdjust(type) {
    if (!type) return null;
    if (!buildingAdjust[type]) buildingAdjust[type] = { scale: 1, offsetX: 0, offsetY: 0 };
    return buildingAdjust[type];
  }

  // Devuelve el objeto de ajuste de la selección. Con create=false NO crea
  // entradas nuevas (importante: pintar el panel no debe ensuciar los ajustes).
  function currentAdjustTarget(create = false) {
    const sel = state.selected;
    if (!sel) return null;
    if (sel.type === 'building' && sel.building) {
      const type = sel.building.type;
      const obj = buildingAdjust[type] || (create ? ensureBuildingAdjust(type) : null);
      return { scope: 'building', type, obj };
    }
    if (sel.type === 'entity' && sel.ref) {
      const key = spriteKeyOf(sel.ref);
      if (key) {
        const obj = spriteAdjust[key] || (create ? ensureSpriteAdjust(key) : null);
        return { scope: 'sprite', key, obj, ref: sel.ref };
      }
      const dbg = sel.ref._dbg || (create ? ensureEntityDbg(sel.ref) : null);
      return { scope: 'entity', obj: dbg, ref: sel.ref };
    }
    return null;
  }

  function adjustVisual(field, delta) {
    const t = currentAdjustTarget(true);
    if (!t || !t.obj) return;
    const clampMap = { scale: [0.1, 4], offsetX: [-2, 2], offsetY: [-2, 2], alpha: [0.05, 1] };
    const [lo, hi] = clampMap[field] || [-4, 4];
    const base = num(t.obj[field], field === 'scale' || field === 'alpha' ? 1 : 0);
    t.obj[field] = clamp(base + delta, lo, hi);
    if (t.scope === 'sprite') syncGlobals();
    persist();
    refreshPanel();
    try { deps.render(); } catch (e) {}
    deps.notify(`${field} = ${t.obj[field].toFixed(2)}`);
  }

  function setVisual(field, value) {
    const t = currentAdjustTarget(true);
    if (!t || !t.obj) return;
    t.obj[field] = num(value, t.obj[field]);
    if (t.scope === 'sprite') syncGlobals();
    persist();
    refreshPanel();
    try { deps.render(); } catch (e) {}
  }

  function setEntitySprite(ref, key) {
    if (!ref) return;
    if (!key) { if (ref._dbg) delete ref._dbg.sprite; }
    else ensureEntityDbg(ref).sprite = key;
    refreshPanel();
    try { deps.render(); } catch (e) {}
  }

  function deleteSelection() {
    const sel = state.selected;
    if (!sel || sel.type !== 'entity' || !sel.ref) { deps.notify('Selecciona una entidad para borrarla.'); return; }
    const list = listOf(sel.collection) || entities;
    const idx = list.indexOf(sel.ref);
    if (idx < 0) { deps.notify('La entidad ya no existe.'); return; }
    pushUndo({ type: 'delete', list, ref: sel.ref, index: idx });
    list.splice(idx, 1);
    setSelection(null);
    deps.notify('Entidad eliminada (Ctrl+Z no la restaura todavía).');
  }

  function centerOnSelection() {
    const sel = state.selected;
    if (!sel) return;
    try {
      const a = sel.type === 'building' && sel.building
        ? { x: sel.building.baseCol + sel.building.w / 2, y: sel.building.baseRow + sel.building.h / 2 }
        : entityAnchor(sel.ref);
      deps.centerCameraOn(a.x, a.y);
    } catch (e) {}
  }

  // ── Spawn de prueba ───────────────────────────────────────────────────────
  function spawnAt(canvasX, canvasY) {
    try {
      const key = state.spawnKey;
      if (!key) { deps.notify('Elige un sprite para colocar.'); return; }
      const world = deps.screenToWorldFloat(canvasX, canvasY);
      const created = deps.spawnPreviewSprite(key, Math.floor(world.x), Math.floor(world.y));
      if (created) {
        created._dbg = { spawned: true };
        setSelection({ type: 'entity', ref: created, collection: 'entities', label: describeEntity(created) });
        deps.notify('Sprite colocado: ' + key + ' — modo colocar sigue activo (Alt+Clic para seleccionar/mover).');
      } else {
        deps.notify('No se pudo colocar el sprite.');
      }
    } catch (e) { deps.notify('Error colocando sprite.'); }
  }

  // ── Entrada ───────────────────────────────────────────────────────────────
  function pointOnCanvas(ev) {
    try {
      const canvas = deps.getCanvas();
      const rect = canvas.getBoundingClientRect();
      const cssX = ev.clientX - rect.left;
      const cssY = ev.clientY - rect.top;
      if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) return null;
      const sx = canvas.width / Math.max(1, rect.width);
      const sy = canvas.height / Math.max(1, rect.height);
      return { x: cssX * sx, y: cssY * sy };
    } catch (e) { return null; }
  }

  function insidePanel(ev) {
    try { return !!(dom.panel && dom.panel.contains(ev.target)); } catch (e) { return false; }
  }

  // El motor escucha 'mousedown'/'mouseup'/'click' (eventos de ratón clásicos),
  // que NO se cancelan por hacer stopPropagation sobre los eventos de puntero.
  // Sin este bloqueo, arrastrar un sprite también disparaba acciones del juego
  // (labrar con la azada, abrir el panel de entidad, disparar con la Makarov…).
  // Sólo se bloquea cuando el evento va dirigido al canvas del juego: los botones
  // de la interfaz (barra superior, panel de acciones, menús) siguen operativos.
  function blockGameMouseEvent(ev) {
    if (!state.enabled) return;
    if (insidePanel(ev)) return;
    try { if (ev.target !== deps.getCanvas()) return; } catch (e) { return; }
    ev.stopPropagation();
    if (ev.type === 'mousedown' || ev.type === 'click') { try { ev.preventDefault(); } catch (e) {} }
  }

  function onPointerDown(ev) {
    if (!state.enabled) return;
    if (insidePanel(ev)) return;
    const p = pointOnCanvas(ev);
    if (!p) return;
    try {
      // Botón derecho: deselecciona. Si no hay selección, dejamos pasar el evento
      // para que el motor siga usando el botón derecho para el zoom.
      if (ev.button === 2) {
        if (state.selected) { ev.stopPropagation(); ev.preventDefault(); setSelection(null); }
        return;
      }
      if (ev.button !== 0) return;
      ev.stopPropagation();
      ev.preventDefault();
      if (state.spawnMode && !ev.altKey) { spawnAt(p.x, p.y); return; }
      const hit = pickAt(p.x, p.y, { cycle: !!ev.altKey });
      state.lastPick = { label: hit ? hit.label : null, at: [Math.round(p.x), Math.round(p.y)], movedFrom: state.cursor ? [state.cursor.col, state.cursor.row] : null };
      setSelection(hit);
      if (hit) {
        state.drag = {
          sel: hit,
          startCanvas: { x: p.x, y: p.y },
          startWorld: deps.screenToWorldFloat(p.x, p.y),
          startAnchor: hit.type === 'entity' ? entityAnchor(hit.ref) : { x: hit.building.baseCol, y: hit.building.baseRow },
          moved: false,
          free: !!ev.altKey
        };
        state.hover = hit;
      }
    } catch (e) {}
  }

  function onPointerMove(ev) {
    if (!state.enabled) return;
    if (insidePanel(ev)) return;
    const p = pointOnCanvas(ev);
    if (!p) { state.hover = null; return; }
    try {
      const world = deps.screenToWorldFloat(p.x, p.y);
      state.cursor = { canvas: p, world, col: Math.floor(world.x), row: Math.floor(world.y) };
      if (state.drag) {
        ev.stopPropagation();
        const d = state.drag;
        const dx = world.x - d.startWorld.x;
        const dy = world.y - d.startWorld.y;
        if (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004) d.moved = true;
        if (d.sel.type === 'entity' && d.sel.ref) {
          let nx = d.startAnchor.x + dx;
          let ny = d.startAnchor.y + dy;
          if (state.snap && !d.free) { nx = Math.round(nx * 2) / 2; ny = Math.round(ny * 2) / 2; }
          moveEntityRef(d.sel.ref, nx, ny, { silent: true });
        } else if (d.sel.type === 'building' && d.sel.building) {
          moveBuildingRef(d.sel, d.startAnchor.x + dx, d.startAnchor.y + dy);
        }
        refreshPanelLive();
        return;
      }
      if (state.showBoxes) {
        const hit = pickAt(p.x, p.y, { loose: false });
        state.hover = hit;
      } else {
        state.hover = null;
      }
    } catch (e) {}
  }

  function onPointerUp(ev) {
    if (!state.enabled) return;
    if (insidePanel(ev)) return;
    if (state.drag) {
      ev.stopPropagation();
      const d = state.drag;
      if (d.moved) {
        if (d.sel.type === 'entity' && d.sel.ref) {
          const a = entityAnchor(d.sel.ref);
          state.undo.push({ type: 'entity', ref: d.sel.ref, x: d.startAnchor.x, y: d.startAnchor.y, col: Math.floor(d.startAnchor.x), row: Math.floor(d.startAnchor.y) });
          deps.notify('Movido a (' + a.x.toFixed(2) + ', ' + a.y.toFixed(2) + ')');
        } else if (d.sel.type === 'building' && d.sel.building) {
          deps.notify('Edificio en (' + d.sel.building.baseCol + ', ' + d.sel.building.baseRow + ')');
        }
        try { deps.saveStateDebounced(); } catch (e) {}
      } else if (d.sel && d.sel.type === 'building' && d.sel.building) {
        // clic simple en edificio: selección sin mover
      }
      state.drag = null;
      refreshPanel();
    }
  }

  function onKeyDown(ev) {
    try {
      if (ev.key === 'F9') {
        if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
        ev.preventDefault();
        ev.stopPropagation();
        setEnabled(!state.enabled);
        return;
      }
      if (!state.enabled) return;
      if (insidePanel(ev)) return;
      const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      const step = ev.shiftKey ? 1 : 0.125;
      switch (ev.key) {
        case 'ArrowLeft': ev.preventDefault(); ev.stopPropagation(); moveSelectionBy(-step, 0); return;
        case 'ArrowRight': ev.preventDefault(); ev.stopPropagation(); moveSelectionBy(step, 0); return;
        case 'ArrowUp': ev.preventDefault(); ev.stopPropagation(); moveSelectionBy(0, -step); return;
        case 'ArrowDown': ev.preventDefault(); ev.stopPropagation(); moveSelectionBy(0, step); return;
        case '[': ev.preventDefault(); ev.stopPropagation(); adjustVisual('scale', -0.05); return;
        case ']': ev.preventDefault(); ev.stopPropagation(); adjustVisual('scale', 0.05); return;
        case ',': ev.preventDefault(); ev.stopPropagation(); adjustVisual('offsetY', -0.01); return;
        case '.': ev.preventDefault(); ev.stopPropagation(); adjustVisual('offsetY', 0.01); return;
        case ';': ev.preventDefault(); ev.stopPropagation(); adjustVisual('offsetX', -0.01); return;
        case "'": ev.preventDefault(); ev.stopPropagation(); adjustVisual('offsetX', 0.01); return;
        case 'Delete': case 'Backspace': ev.preventDefault(); ev.stopPropagation(); deleteSelection(); return;
        case 'Escape': ev.preventDefault(); ev.stopPropagation(); setSelection(null); return;
        case 'h': case 'H': ev.preventDefault(); ev.stopPropagation(); centerOnSelection(); return;
        case 'p': case 'P':
          ev.preventDefault(); ev.stopPropagation();
          state.pauseWorld = !state.pauseWorld;
          if (state.pauseWorld) { state.pausedBackup = num(window._timeScale, 1); window._timeScale = 0; }
          else { window._timeScale = state.pausedBackup === 0 || state.pausedBackup === null ? 1 : state.pausedBackup; }
          try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
          refreshPanel();
          deps.notify(state.pauseWorld ? 'Mundo en pausa' : 'Mundo en marcha');
          return;
        default: break;
      }
      if (ev.key && ev.key.toLowerCase() === 'g') { ev.preventDefault(); ev.stopPropagation(); toggle('showGrid'); return; }
      if (ev.key && ev.key.toLowerCase() === 'z' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ev.stopPropagation(); undo(); return; }
    } catch (e) {}
  }

  function toggle(field) {
    state[field] = !state[field];
    refreshPanel();
    try { deps.render(); } catch (e) {}
  }

  // ── Panel DOM ─────────────────────────────────────────────────────────────
  function ensurePanel() {
    try {
      if (dom.panel && document.body.contains(dom.panel)) { dom.panel.style.display = 'block'; return; }
      injectStyles();
      const panel = document.createElement('div');
      panel.id = 'meso-debug-panel';
      panel.innerHTML = `
        <div class="mdp-head">
          <span class="mdp-title">${iconoUI('llave', { size: 14 })} Debug · Inspector</span>
          <span class="mdp-head-actions">
            <button class="mdp-x" data-act="collapse" title="Plegar">–</button>
            <button class="mdp-x" data-act="close" title="Cerrar (F9)">✕</button>
          </span>
        </div>
        <div class="mdp-body" id="mdp-body"></div>
      `;
      document.body.appendChild(panel);
      dom.panel = panel;
      dom.body = panel.querySelector('#mdp-body');
      panel.addEventListener('click', (ev) => {
        const act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
        if (!act) return;
        if (act === 'close') setEnabled(false);
        if (act === 'collapse') {
          const b = panel.querySelector('#mdp-body');
          b.style.display = b.style.display === 'none' ? 'block' : 'none';
        }
      });
      panel.style.display = 'block';
      refreshPanel();
    } catch (e) {}
  }

  function togglePanel() {
    try {
      if (!dom.panel) ensurePanel();
      dom.panel.style.display = dom.panel.style.display === 'none' ? 'block' : 'none';
    } catch (e) {}
  }

  function injectStyles() {
    try {
      if (document.getElementById('meso-debug-styles')) return;
      const st = document.createElement('style');
      st.id = 'meso-debug-styles';
      st.textContent = `
        #meso-debug-panel {
          position: fixed; right: 10px; top: 46px; width: 330px; max-height: 78vh; overflow: auto;
          z-index: 95000; background: rgba(10,10,12,0.94); color: #E8E8D8;
          border: 1px solid rgba(255,210,122,0.35); border-radius: 8px;
          font-family: Segoe UI, Roboto, sans-serif; font-size: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6); pointer-events: auto;
        }
        #meso-debug-panel .mdp-head { display:flex; align-items:center; justify-content:space-between;
          padding:6px 8px; background:rgba(255,210,122,0.10); border-bottom:1px solid rgba(255,210,122,0.25); position:sticky; top:0; }
        #meso-debug-panel .mdp-title { font-weight:700; color:#FFD27A; }
        #meso-debug-panel .mdp-x { background:transparent; border:1px solid rgba(255,255,255,0.15); color:#ddd;
          border-radius:4px; cursor:pointer; padding:1px 6px; margin-left:4px; }
        #meso-debug-panel .mdp-body { padding:8px; }
        #meso-debug-panel h4 { margin:8px 0 4px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#9ec8ff; }
        #meso-debug-panel .mdp-row { display:flex; align-items:center; justify-content:space-between; gap:6px; margin:3px 0; }
        #meso-debug-panel input[type=text], #meso-debug-panel input[type=number], #meso-debug-panel select {
          background:#151515; color:#eee; border:1px solid rgba(255,255,255,0.12); border-radius:4px; padding:3px 5px;
          font-size:12px; min-width:0;
        }
        #meso-debug-panel input[type=range] { width:130px; }
        #meso-debug-panel button.mdp-btn { background:#20232a; color:#e8e8d8; border:1px solid rgba(255,255,255,0.14);
          border-radius:5px; padding:3px 7px; cursor:pointer; font-size:11px; }
        #meso-debug-panel button.mdp-btn:hover { background:#2c313c; }
        #meso-debug-panel button.mdp-btn.warn { border-color:rgba(255,120,120,0.5); color:#ffb9b9; }
        #meso-debug-panel .mdp-hint { color:#9a9a8a; font-size:11px; line-height:1.35; }
        #meso-debug-panel .mdp-kv { font-family: Consolas, monospace; font-size:11px; color:#cfe3d9; word-break:break-all; }
        #meso-debug-panel .mdp-sel { border:1px solid rgba(255,210,122,0.25); border-radius:6px; padding:6px; background:rgba(255,210,122,0.05); }
        #meso-debug-panel .mdp-badge { background:#2b3a55; color:#cfe0ff; border-radius:10px; padding:1px 6px; font-size:10px; }
        #meso-debug-panel .mdp-list { max-height:110px; overflow:auto; border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:4px; }
        #meso-debug-panel .mdp-item { display:flex; justify-content:space-between; gap:6px; font-family:Consolas,monospace; font-size:11px; }
      `;
      document.head.appendChild(st);
    } catch (e) {}
  }

  function selectionInfoHTML() {
    const sel = state.selected;
    if (!sel) return `<div class="mdp-hint">Nada seleccionado.<br>Clic sobre un sprite o edificio del mapa.</div>`;
    if (sel.type === 'building' && sel.building) {
      const b = sel.building;
      return `<div class="mdp-kv">tipo: ${b.type}<br>celda base: ${b.baseCol}, ${b.baseRow}<br>tamaño: ${b.w}×${b.h}</div>`;
    }
    const ref = sel.ref || {};
    const a = entityAnchor(ref);
    const key = spriteKeyOf(ref) || '—';
    return `<div class="mdp-kv">tipo: ${describeEntity(ref)}<br>colección: ${sel.collection || 'entities'}<br>sprite: <span class="mdp-badge">${key}</span><br>
      x: ${a.x.toFixed(3)}  y: ${a.y.toFixed(3)}<br>col: ${num(ref.col, Math.floor(a.x))}  row: ${num(ref.row, Math.floor(a.y))}<br>
      size: ${num(ref.size, 1).toFixed(2)}</div>`;
  }

  function adjustControlsHTML() {
    const t = currentAdjustTarget();
    if (!t) return `<div class="mdp-hint">Selecciona algo para ajustar su sprite.</div>`;
    const scopeLabel = t.scope === 'building' ? ('tipo de edificio: ' + t.type)
      : t.scope === 'sprite' ? ('sprite (todas las copias): ' + t.key)
      : 'esta entidad';
    const o = t.obj || {};
    return `
      <div class="mdp-hint">Ámbito: ${scopeLabel}</div>
      <div class="mdp-row"><span>Escala</span>
        <input type="range" data-field="scale" min="0.2" max="3" step="0.01" value="${num(o.scale, 1)}">
        <input type="number" data-field="scale" min="0.1" max="4" step="0.01" value="${num(o.scale, 1)}" style="width:56px">
      </div>
      <div class="mdp-row"><span>Offset X</span>
        <input type="range" data-field="offsetX" min="-0.5" max="0.5" step="0.005" value="${num(o.offsetX, 0)}">
        <input type="number" data-field="offsetX" min="-2" max="2" step="0.005" value="${num(o.offsetX, 0)}" style="width:56px">
      </div>
      <div class="mdp-row"><span>Offset Y</span>
        <input type="range" data-field="offsetY" min="-0.5" max="0.5" step="0.005" value="${num(o.offsetY, 0)}">
        <input type="number" data-field="offsetY" min="-2" max="2" step="0.005" value="${num(o.offsetY, 0)}" style="width:56px">
      </div>
      ${t.scope !== 'building' ? `<div class="mdp-row"><span>Alfa</span>
        <input type="range" data-field="alpha" min="0.05" max="1" step="0.01" value="${num(o.alpha, 1)}">
        <input type="number" data-field="alpha" min="0.05" max="1" step="0.01" value="${num(o.alpha, 1)}" style="width:56px">
      </div>` : ''}
      <div class="mdp-row">
        <button class="mdp-btn" data-act2="resetVisual">Reset ajuste</button>
        <button class="mdp-btn" data-act2="applyToAll">Aplicar a todas las copias</button>
      </div>
    `;
  }

  function spawnControlsHTML() {
    const keys = getSpriteKeys();
    const options = keys.map(k => `<option value="${k}"></option>`).join('');
    return `
      <div class="mdp-row">
        <input type="text" id="mdp-spawn-key" list="mdp-sprite-keys" placeholder="clave de sprite…" value="${state.spawnKey || ''}" style="flex:1">
        <button class="mdp-btn" data-act2="toggleSpawn" title="Activa/desactiva colocar sprites con el clic">${state.spawnMode ? 'Colocando…' : 'Colocar'}</button>
      </div>
      <datalist id="mdp-sprite-keys">${options}</datalist>
      <div class="mdp-row">
        <button class="mdp-btn" data-act2="spriteGallery" title="Ver todos los sprites del juego en grande, cada uno dentro de la huella que ocupa">${iconoUI('lupa', { size: 13 })} Ver biblioteca de sprites</button>
      </div>
      <div class="mdp-hint">${keys.length} sprites disponibles. Coloca cualquier sprite del juego en el mundo para verlo de cerca, moverlo y ajustarlo.</div>
    `;
  }

  // ── Galería de sprites ────────────────────────────────────────────────────
  // Revisar el pixel-art sin depender del zoom del juego: cada sprite se dibuja
  // con las MISMAS reglas que el render (escala por ancho, apoyo en la línea de
  // suelo) dentro de la caja de su huella, con buscador para filtrar.
  function closeSpriteGallery() {
    try { const el = document.getElementById('meso-sprite-gallery'); if (el) el.remove(); } catch (e) {}
  }

  function toggleSpriteGallery() {
    try {
      if (document.getElementById('meso-sprite-gallery')) { closeSpriteGallery(); return; }
      const lib = window.ENTITY_PIXEL_LIBRARY || {};
      const footprints = (() => {
        try {
          // Huella real (celdas) de cada edificio según el motor; si no es un
          // edificio, se asume 1×1.
          const out = {};
          const sizes = (deps.getBuildingSizes && deps.getBuildingSizes()) || {};
          Object.keys(sizes).forEach(k => { if (sizes[k] && sizes[k].w) out[k] = { w: sizes[k].w, h: sizes[k].h }; });
          const defs = (deps.getEntityDefs && deps.getEntityDefs()) || null;
          const b = (defs && defs.buildings) || {};
          Object.keys(b).forEach(k => {
            if (out[k]) return;
            const s = (b[k] && b[k].size) || {};
            if (s.w && s.h) out[k] = { w: s.w, h: s.h };
          });
          return out;
        } catch (e) { return {}; }
      })();
      const root = document.createElement('div');
      root.id = 'meso-sprite-gallery';
      root.style.cssText = 'position:fixed;inset:24px;z-index:2000000;background:#0e0e13;border:2px solid #FFD27A;border-radius:8px;padding:10px;overflow:auto;color:#eee;font:11px monospace';
      const bar = document.createElement('div');
      bar.style.cssText = 'position:sticky;top:0;background:#0e0e13;padding-bottom:8px;display:flex;gap:8px;align-items:center';
      const title = document.createElement('strong');
      title.textContent = 'Biblioteca de sprites (' + Object.keys(lib).length + ') · cada recuadro es la huella en celdas';
      title.style.color = '#FFD27A';
      const search = document.createElement('input');
      search.placeholder = 'filtrar…';
      search.style.cssText = 'flex:1;background:#1b1b22;border:1px solid #555;color:#eee;padding:4px 6px;border-radius:4px';
      const close = document.createElement('button');
      close.textContent = '✕ Cerrar';
      close.className = 'mdp-btn';
      close.addEventListener('click', closeSpriteGallery);
      bar.appendChild(title); bar.appendChild(search); bar.appendChild(close);
      root.appendChild(bar);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px';
      root.appendChild(grid);
      const CELL = 22;
      const render = (filter) => {
        grid.innerHTML = '';
        Object.keys(lib).sort().forEach(name => {
          if (filter && name.toLowerCase().indexOf(filter) < 0) return;
          const def = lib[name] || {};
          const fp = footprints[name] || { w: 1, h: 1 };
          const boxW = Math.min(120, fp.w * CELL), boxH = Math.min(96, fp.h * CELL);
          const card = document.createElement('div');
          card.style.cssText = 'background:#17171d;border:1px solid #333;border-radius:6px;padding:6px;text-align:center';
          const cv = document.createElement('canvas');
          cv.width = boxW + 8; cv.height = boxH + 8;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#2a2a20'; ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.strokeStyle = 'rgba(255,210,122,0.55)'; ctx.setLineDash([2, 2]);
          ctx.strokeRect(4.5, 4.5, boxW - 1, boxH - 1); ctx.setLineDash([]);
          const gw = def.gridW || def.grid || 9, gh = def.gridH || def.grid || 9;
          const shaped = !!(def.gridW || def.gridH);
          let scale = shaped
            ? Math.min(boxW / gw, Math.max(boxH * 2.5, boxH + 8) / gh)
            : Math.max(1, Math.floor(Math.min(boxW, boxH) / gw));
          if (shaped && scale >= 1) scale = Math.floor(scale);
          const cellPx = Math.max(1, Math.ceil(scale));
          const spriteW = gw * scale, spriteH = gh * scale;
          const offX = 4 + boxW / 2 - spriteW / 2;
          const offY = 4 + boxH - spriteH + boxH * 0.08;
          (def.pixels || []).forEach(p => {
            if (!p || !p[2]) return;
            ctx.fillStyle = p[2];
            ctx.fillRect(Math.round(offX + p[0] * scale), Math.round(offY + p[1] * scale), cellPx, cellPx);
          });
          const info = document.createElement('div');
          info.innerHTML = '<b>' + name + '</b><br>' + gw + '×' + gh + ' px · ' + fp.w + '×' + fp.h + ' celdas' + (shaped ? '' : ' · cuadrado');
          info.style.color = '#bbb';
          card.appendChild(cv); card.appendChild(info);
          grid.appendChild(card);
        });
      };
      render('');
      search.addEventListener('input', () => render(search.value.trim().toLowerCase()));
      document.body.appendChild(root);
    } catch (e) { deps.notify('No se pudo abrir la galería: ' + (e && e.message ? e.message : e)); }
  }

  function globalControlsHTML() {
    const keys = Object.keys(spriteAdjust);
    const bkeys = Object.keys(buildingAdjust);
    const listRows = arr => arr.length
      ? arr.map(k => `<div class="mdp-item"><span>${k}</span><span>${JSON.stringify(spriteAdjust[k] || buildingAdjust[k])}
          <button class="mdp-btn warn" data-act2="removeAdjust" data-key="${k}" data-kind="${spriteAdjust[k] ? 'sprite' : 'building'}">×</button></span></div>`).join('')
      : '<div class="mdp-hint">Sin ajustes guardados.</div>';
    return `
      <h4>Ajustes guardados</h4>
      <div class="mdp-list">${listRows(keys)}${bkeys.length ? '' : ''}</div>
      ${bkeys.length ? `<div class="mdp-list" style="margin-top:4px">${bkeys.map(k => `<div class="mdp-item"><span>${k}</span><span>${JSON.stringify(buildingAdjust[k])}
          <button class="mdp-btn warn" data-act2="removeAdjust" data-key="${k}" data-kind="building">×</button></span></div>`).join('')}</div>` : ''}
      <h4>Herramientas</h4>
      <div class="mdp-row">
        <button class="mdp-btn" data-act2="export">Exportar JSON</button>
        <button class="mdp-btn" data-act2="import">Importar JSON</button>
        <button class="mdp-btn warn" data-act2="resetAll">Reset todo</button>
      </div>
      <div class="mdp-hint">Guarda el archivo como <b>data/sprite-adjustments.json</b> y el motor aplicará los ajustes siempre, incluso sin modo debug.</div>
      <h4>Mundo</h4>
      <div class="mdp-row"><span>Velocidad</span>
        ${[0, 0.5, 1, 2, 4].map(v => `<button class="mdp-btn" data-act2="speed" data-v="${v}">${v}×</button>`).join('')}
      </div>
      <div class="mdp-row"><span>Acciones</span>
        <button class="mdp-btn" data-act2="teleport">Traer jugador aquí</button>
        <button class="mdp-btn" data-act2="center">Centrar sel.</button>
      </div>
    `;
  }

  // ── Estructuras (conjuntos de edificios) ──────────────────────────────────
  function structureSystem() { try { return deps.structures || null; } catch (e) { return null; } }

  function structuresHTML() {
    const st = structureSystem();
    if (!st) return '<div class="mdp-hint">Sistema de estructuras no disponible.</div>';
    let catalog = [];
    try { catalog = st.list({}); } catch (e) { catalog = []; }
    const options = catalog.map(s =>
      `<option value="${s.id}" ${state.structSel === s.id ? 'selected' : ''}>${s.name} · ${s.pieces} piezas${s.custom ? ' ★' : ''} (${s.placedCount}/${s.maxPerMap})</option>`
    ).join('');
    if (!state.structSel && catalog.length) state.structSel = catalog[0].id;
    let placedList = [];
    try { placedList = st.listPlaced(); } catch (e) {}
    const placedRows = placedList.length
      ? placedList.map(p => `<div class="mdp-item">
          <span>${p.name}</span>
          <span>${p.anchorC},${p.anchorR}
            <button class="mdp-btn" data-act2="structCenter" data-c="${p.anchorC}" data-r="${p.anchorR}" title="Ir">→</button>
            <button class="mdp-btn warn" data-act2="structDel" data-c="${p.anchorC}" data-r="${p.anchorR}" title="Quitar">×</button>
          </span></div>`).join('')
      : '<div class="mdp-hint">Ninguna estructura colocada en esta partida.</div>';
    return `
      <div class="mdp-row">
        <select id="mdp-struct-sel" style="flex:1">${options || '<option value="">(catálogo vacío)</option>'}</select>
      </div>
      <div class="mdp-row">
        <button class="mdp-btn" data-act2="structPlace" title="Coloca el conjunto en la casilla del cursor (limpia lo que haya debajo)">Colocar aquí</button>
        <button class="mdp-btn" data-act2="structRemove" title="Quita la estructura que esté bajo el cursor">Borrar aquí</button>
        <button class="mdp-btn" data-act2="structGenerate" title="Reparte conjuntos por el mapa ahora mismo">Generar en el mapa</button>
      </div>
      <div class="mdp-row">
        <span>Radio</span>
        <input type="number" id="mdp-struct-radius" min="4" max="40" step="1" value="${state.structRadius}" style="width:52px">
        <button class="mdp-btn" data-act2="structCapture" title="Toma los edificios/caminos de alrededor como plantilla nueva">Capturar zona</button>
      </div>
      <div class="mdp-row">
        <input type="text" id="mdp-struct-id" placeholder="id_nueva_estructura" value="${state.structId || ''}" style="flex:1">
        <button class="mdp-btn" data-act2="structSave" title="Guardar el JSON de abajo en el catálogo">Guardar</button>
      </div>
      <textarea id="mdp-struct-json" spellcheck="false" placeholder="Pega aquí una definición JSON o captura una zona…"
        style="width:100%;height:110px;background:#121212;color:#dfe7df;border:1px solid rgba(255,255,255,0.12);border-radius:4px;font-family:Consolas,monospace;font-size:11px;padding:4px">${escapeHTML(state.structDraftText)}</textarea>
      <div class="mdp-row">
        <button class="mdp-btn" data-act2="structExport">Exportar catálogo</button>
        <button class="mdp-btn" data-act2="structImport">Importar</button>
        <button class="mdp-btn" data-act2="structReload">Recargar</button>
        <button class="mdp-btn warn" data-act2="structDelDef" title="Borrar la definición seleccionada del catálogo">Borrar def.</button>
      </div>
      <div class="mdp-hint">Los cambios se guardan en <b>localStorage</b>; exporta y guarda como
        <b>data/structures.json</b> para que formen parte del juego. Guía: <b>docs/ESTRUCTURAS.md</b>.</div>
      <h4>Conjuntos colocados</h4>
      <div class="mdp-list">${placedRows}</div>
      <input type="file" id="mdp-struct-file" accept=".json,application/json" style="display:none">
    `;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cursorCell() {
    const c = state.cursor;
    if (!c || !Number.isFinite(c.col)) return null;
    return { c: c.col, r: c.row };
  }

  function structureAction(act, btn) {
    const st = structureSystem();
    if (!st) { deps.notify('Sistema de estructuras no disponible.'); return; }
    try {
      if (act === 'structPlace') {
        const cell = cursorCell();
        if (!cell) { deps.notify('Pon el cursor sobre el mapa.'); return; }
        const res = st.place(state.structSel, cell.c, cell.r, { clear: true, removeEntities: true, transform: 'none' });
        deps.notify(res.ok
          ? `Conjunto «${res.name}» colocado en ${cell.c},${cell.r} (${(res.pieces || []).length} edificios).`
          : `No se pudo colocar: ${res.reason}`);
      } else if (act === 'structRemove') {
        const cell = cursorCell();
        if (!cell) { deps.notify('Pon el cursor sobre el mapa.'); return; }
        const res = st.removeAt(cell.c, cell.r);
        deps.notify(res.ok ? `Conjunto «${res.removed}» eliminado (${res.pieces} edificios).` : res.reason);
      } else if (act === 'structGenerate') {
        const res = st.generatePass({ cap: 4, attempts: 200 });
        deps.notify(res.placed.length
          ? `Generados: ${res.placed.map(p => p.name).join(', ')}`
          : 'No se encontró sitio para más conjuntos.');
      } else if (act === 'structCapture') {
        const cell = cursorCell();
        if (!cell) { deps.notify('Pon el cursor sobre el mapa.'); return; }
        const res = st.capture(cell.c, cell.r, { radius: state.structRadius });
        if (!res.ok) { deps.notify('No hay edificios alrededor para capturar.'); return; }
        state.structDraftText = JSON.stringify(res.draft, null, 2);
        deps.notify(`Capturados ${res.stats.pieces} edificios, ${res.stats.terrain} caminos y ${res.stats.entities} decorados.`);
      } else if (act === 'structSave') {
        const parsed = JSON.parse(state.structDraftText || 'null');
        if (!parsed) { deps.notify('El JSON está vacío.'); return; }
        const def = parsed.structures ? Object.values(parsed.structures)[0] : (parsed.pieces ? parsed : null);
        if (!def || !Array.isArray(def.pieces) || !def.pieces.length) { deps.notify('El JSON no tiene "pieces".'); return; }
        const id = (state.structId || def.name || 'nueva_estructura').toString().trim().replace(/[^\w\-]/g, '_').toLowerCase();
        const res = st.addDef(id, def, { persist: true });
        deps.notify(res.ok ? `Estructura «${id}» añadida al catálogo.` : ('Error: ' + res.reason));
        if (res.ok) state.structSel = id;
      } else if (act === 'structExport') {
        downloadText(st.exportJSON(), 'structures.json');
        deps.notify('Exportado structures.json (guárdalo en data/).');
      } else if (act === 'structImport') {
        const fi = document.getElementById('mdp-struct-file');
        if (fi) {
          fi.value = '';
          fi.onchange = async () => {
            try {
              const f = fi.files && fi.files[0];
              if (!f) return;
              const res = st.importJSON(await f.text());
              deps.notify(res.ok ? `Importadas ${res.imported} estructuras.` : ('Error: ' + res.reason));
              refreshPanel();
            } catch (e) { deps.notify('No se pudo leer el archivo.'); }
          };
          fi.click();
        }
      } else if (act === 'structReload') {
        try { st.init(); } catch (e) {}
        deps.notify('Catálogo recargado.');
      } else if (act === 'structDelDef') {
        if (!state.structSel) return;
        const res = st.removeDef(state.structSel);
        deps.notify(res.ok ? `Definición «${state.structSel}» eliminada del catálogo.` : res.reason);
        state.structSel = '';
      } else if (act === 'structCenter') {
        deps.centerCameraOn(Number(btn.getAttribute('data-c')) + 0.5, Number(btn.getAttribute('data-r')) + 0.5);
      } else if (act === 'structDel') {
        const res = st.removeAt(Number(btn.getAttribute('data-c')), Number(btn.getAttribute('data-r')));
        deps.notify(res.ok ? `Conjunto «${res.removed}» eliminado.` : res.reason);
      }
    } catch (e) {
      deps.notify('Error en estructuras: ' + (e && e.message ? e.message : e));
    }
    refreshPanel();
  }

  function downloadText(text, filename) {
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 500);
    } catch (e) {}
  }

  function refreshPanel() {
    try {
      if (!dom.panel || !dom.body) return;
      if (!state.enabled) return;
      const c = state.cursor || {};
      const hoverTxt = Number.isFinite(c.col) ? `casilla ${c.col}, ${c.row} · mundo ${c.world.x.toFixed(2)}, ${c.world.y.toFixed(2)}` : '—';
      dom.body.innerHTML = `
        <div class="mdp-hint">Clic = seleccionar · Arrastrar = mover · Alt+Clic = ciclar solapados<br>
        Flechas = mover · Shift+Flechas = 1 casilla · [ ] escala · , . offset Y · ; ' offset X<br>
        Supr = borrar · Ctrl+Z = deshacer · P = pausa · G = rejilla · H = centrar · Esc = quitar selección</div>
        <h4>Cursor</h4>
        <div class="mdp-kv">${hoverTxt}</div>
        <h4>Selección</h4>
        <div class="mdp-sel">${selectionInfoHTML()}</div>
        <h4>Ajuste visual</h4>
        ${adjustControlsHTML()}
        <h4>Colocar sprite</h4>
        ${spawnControlsHTML()}
        <h4>Estructuras (conjuntos)</h4>
        ${structuresHTML()}
        <h4>Opciones</h4>
        <div class="mdp-row"><label><input type="checkbox" data-opt="snap" ${state.snap ? 'checked' : ''}> rejilla 0.5</label>
          <label><input type="checkbox" data-opt="showGrid" ${state.showGrid ? 'checked' : ''}> rejilla</label></div>
        <div class="mdp-row"><label><input type="checkbox" data-opt="showBoxes" ${state.showBoxes ? 'checked' : ''}> cajas</label>
          <label><input type="checkbox" data-opt="pauseWorld" ${state.pauseWorld ? 'checked' : ''}> pausar mundo</label></div>
        ${globalControlsHTML()}
        <input type="file" id="mdp-import-file" accept=".json,application/json" style="display:none">
      `;
      bindPanelEvents();
    } catch (e) {}
  }

  // Actualización ligera (solo valores) mientras se arrastra, sin reconstruir el panel
  function refreshPanelLive() {
    try {
      if (!dom.panel || !dom.body || !state.enabled) return;
      const kv = dom.body.querySelector('.mdp-sel .mdp-kv');
      if (kv) kv.parentElement.innerHTML = selectionInfoHTML();
    } catch (e) {}
  }

  // Lectura en vivo de la casilla bajo el cursor (sin reconstruir el panel)
  let _lastCursorReadout = 0;
  function refreshCursorReadout() {
    try {
      if (!dom.panel || !dom.body || !state.enabled) return;
      const now = Date.now();
      if (now - _lastCursorReadout < 150) return;
      _lastCursorReadout = now;
      const els = dom.body.querySelectorAll('.mdp-kv');
      const el = els[0];
      if (!el) return;
      const c = state.cursor;
      const txt = (c && Number.isFinite(c.col))
        ? `casilla ${c.col}, ${c.row} · mundo ${c.world.x.toFixed(2)}, ${c.world.y.toFixed(2)}`
        : '—';
      if (el.textContent !== txt) el.textContent = txt;
    } catch (e) {}
  }

  function bindPanelEvents() {
    try {
      dom.body.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input', () => {
          const f = el.getAttribute('data-field');
          const val = el.value;
          // sincroniza slider ↔ número
          dom.body.querySelectorAll(`[data-field="${f}"]`).forEach(sib => { if (sib !== el) sib.value = val; });
          setVisual(f, val);
        });
      });
      dom.body.querySelectorAll('[data-opt]').forEach(el => {
        el.addEventListener('change', () => {
          const opt = el.getAttribute('data-opt');
          state[opt] = el.checked;
          if (opt === 'pauseWorld') {
            if (state.pauseWorld) { state.pausedBackup = num(window._timeScale, 1); window._timeScale = 0; }
            else { window._timeScale = (!state.pausedBackup ? 1 : state.pausedBackup); }
            try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
          }
          refreshPanel();
        });
      });
      const spawnInput = dom.body.querySelector('#mdp-spawn-key');
      if (spawnInput) spawnInput.addEventListener('input', () => { state.spawnKey = spawnInput.value.trim(); });
      // ── Estructuras: entradas persistentes (no se reconstruyen al teclear) ──
      const structSel = dom.body.querySelector('#mdp-struct-sel');
      if (structSel) structSel.addEventListener('change', () => { state.structSel = structSel.value; });
      const structRadius = dom.body.querySelector('#mdp-struct-radius');
      if (structRadius) structRadius.addEventListener('input', () => { state.structRadius = Math.max(4, Math.min(40, parseInt(structRadius.value || '14', 10) || 14)); });
      const structId = dom.body.querySelector('#mdp-struct-id');
      if (structId) structId.addEventListener('input', () => { state.structId = structId.value.trim(); });
      const structJson = dom.body.querySelector('#mdp-struct-json');
      if (structJson) structJson.addEventListener('input', () => { state.structDraftText = structJson.value; });
      dom.body.querySelectorAll('[data-act2]').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-act2');
          if (act && act.indexOf('struct') === 0) { structureAction(act, btn); return; }
          if (act === 'resetVisual') {
            const t = currentAdjustTarget();
            if (t && t.obj) {
              t.obj.scale = 1; t.obj.offsetX = 0; t.obj.offsetY = 0;
              if ('alpha' in t.obj) t.obj.alpha = 1;
              if (t.scope === 'sprite') syncGlobals();
              persist(); refreshPanel(); try { deps.render(); } catch (e) {}
            }
          } else if (act === 'applyToAll') {
            const sel = state.selected;
            const ref = sel && sel.ref;
            const key = ref ? spriteKeyOf(ref) : null;
            if (ref && ref._dbg && key) {
              const base = ensureSpriteAdjust(key);
              if (typeof ref._dbg.scale === 'number') base.scale = ref._dbg.scale;
              if (typeof ref._dbg.offsetX === 'number') base.offsetX = ref._dbg.offsetX;
              if (typeof ref._dbg.offsetY === 'number') base.offsetY = ref._dbg.offsetY;
              if (typeof ref._dbg.alpha === 'number') base.alpha = ref._dbg.alpha;
              delete ref._dbg;
              syncGlobals(); persist(); refreshPanel(); try { deps.render(); } catch (e) {}
              deps.notify('Ajuste aplicado a todas las copias de ' + key);
            } else {
              deps.notify('La selección ya usa ajuste por sprite compartido.');
            }
          } else if (act === 'toggleSpawn') {
            state.spawnMode = !state.spawnMode;
            refreshPanel();
            deps.notify(state.spawnMode ? 'Clic en el mapa para colocar el sprite.' : 'Colocación desactivada.');
          } else if (act === 'spriteGallery') {
            toggleSpriteGallery();
          } else if (act === 'removeAdjust') {
            const key = btn.getAttribute('data-key');
            const kind = btn.getAttribute('data-kind');
            if (kind === 'building') delete buildingAdjust[key]; else delete spriteAdjust[key];
            syncGlobals(); persist(); refreshPanel(); try { deps.render(); } catch (e) {}
          } else if (act === 'export') {
            downloadJSON();
          } else if (act === 'import') {
            const fi = document.getElementById('mdp-import-file');
            if (fi) {
              fi.value = '';
              fi.onchange = async () => {
                try {
                  const f = fi.files && fi.files[0];
                  if (!f) return;
                  importJSON(await f.text());
                } catch (e) { deps.notify('No se pudo leer el archivo.'); }
              };
              fi.click();
            }
          } else if (act === 'resetAll') {
            resetAll();
          } else if (act === 'speed') {
            const v = num(btn.getAttribute('data-v'), 1);
            window._timeScale = v;
            state.pauseWorld = v === 0;
            try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
            refreshPanel();
          } else if (act === 'teleport') {
            try {
              const c = state.cursor;
              if (c) { deps.teleportPlayer(c.world.x, c.world.y); deps.notify('Jugador movido al cursor.'); }
            } catch (e) {}
          } else if (act === 'center') {
            centerOnSelection();
          }
        });
      });
    } catch (e) {}
  }

  // ── Lista de sprites disponibles ──────────────────────────────────────────
  let _spriteKeysCache = null;
  function getSpriteKeys() {
    try {
      if (_spriteKeysCache) return _spriteKeysCache;
      const set = new Set();
      const lib = window.ENTITY_PIXEL_LIBRARY || {};
      Object.keys(lib).forEach(k => set.add(k));
      ['_SPRITE_IMAGES', '_ICON_BITMAPS', '_ENTITY_BITMAPS'].forEach(g => {
        const obj = window[g];
        if (obj) Object.keys(obj).forEach(k => set.add(k));
      });
      try {
        const defs = window.ENTITY_DEFS || deps.getEntityDefs();
        if (defs) {
          if (defs.trees) defs.trees.forEach(t => set.add(t.variant || t.id || t.name));
          if (defs.buildings) Object.keys(defs.buildings).forEach(k => set.add(k));
        }
      } catch (e) {}
      _spriteKeysCache = Array.from(set).filter(Boolean).sort();
      return _spriteKeysCache;
    } catch (e) { return []; }
  }
  function invalidateSpriteKeys() { _spriteKeysCache = null; }

  // ── Dibujo del overlay ────────────────────────────────────────────────────
  function draw() {
    try {
      if (!state.enabled || !dom.ctx) return;
      try { refreshCursorReadout(); } catch (e) {}
      if (!syncOverlaySize()) return;
      const ctx = dom.ctx;
      const W = dom.overlay.width, H = dom.overlay.height;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.font = '11px Consolas, monospace';
      ctx.textBaseline = 'top';

      // rejilla alrededor del cursor
      const c = state.cursor;
      if (state.showGrid && c && Number.isFinite(c.col)) {
        const R = 6;
        ctx.lineWidth = 1;
        for (let row = c.row - R; row <= c.row + R; row++) {
          for (let col = c.col - R; col <= c.col + R; col++) {
            if (col < 0 || row < 0 || col >= deps.COLS || row >= deps.ROWS) continue;
            const f = cellFrame(col, row);
            if (!f || f.x + f.w < 0 || f.y + f.h < 0 || f.x > W || f.y > H) continue;
            const isHover = col === c.col && row === c.row;
            ctx.strokeStyle = isHover ? 'rgba(255,210,122,0.95)' : 'rgba(140,200,255,0.20)';
            ctx.strokeRect(Math.round(f.x) + 0.5, Math.round(f.y) + 0.5, Math.round(f.w), Math.round(f.h));
          }
        }
        // etiqueta de casilla
        const f = cellFrame(c.col, c.row);
        if (f) {
          const label = `${c.col},${c.row}`;
          const tw = ctx.measureText(label).width + 8;
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(f.x, f.y - 16, tw, 15);
          ctx.fillStyle = '#FFD27A';
          ctx.fillText(label, f.x + 4, f.y - 14);
        }
      }

      // caja del hover
      if (state.showBoxes && state.hover && state.hover !== state.selected) {
        drawSelectionBox(ctx, state.hover, 'rgba(120,200,255,0.9)', state.hover.label, false);
      }
      // caja de la selección
      if (state.selected) {
        drawSelectionBox(ctx, state.selected, 'rgba(255,210,122,1)', state.selected.label, true);
      }
      // línea de arrastre
      if (state.drag && state.drag.moved) {
        try {
          const d = state.drag;
          if (d.sel.type === 'entity' && d.sel.ref) {
            const a = entityAnchor(d.sel.ref);
            const p = deps.worldToScreen(a.x, a.y);
            ctx.strokeStyle = 'rgba(120,255,150,0.8)';
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(d.startCanvas.x, d.startCanvas.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } catch (e) {}
      }
      // anclas de entidades cercanas al cursor (referencia visual)
      if (state.showBoxes && c && Number.isFinite(c.world.x)) {
        try {
          const near = window.SceneManager && typeof window.SceneManager.queryNearby === 'function'
            ? window.SceneManager.queryNearby(c.world.x, c.world.y, 3)
            : null;
          const list = near && near.length ? near : entities;
          for (const ref of list) {
            if (!ref || ref === (state.selected && state.selected.ref)) continue;
            const a = entityAnchor(ref);
            if (Math.abs(a.x - c.world.x) > 4 || Math.abs(a.y - c.world.y) > 4) continue;
            const p = deps.worldToScreen(a.x, a.y);
            ctx.fillStyle = 'rgba(255,120,120,0.9)';
            ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
            const key = spriteKeyOf(ref);
            if (key && zoomEnough()) {
              ctx.fillStyle = 'rgba(255,190,190,0.85)';
              ctx.fillText(key, Math.round(p.x) + 4, Math.round(p.y) - 6);
            }
          }
        } catch (e) {}
      }
      ctx.restore();
    } catch (e) {}
  }

  function zoomEnough() {
    try { return deps.getTileSize() > 22; } catch (e) { return true; }
  }

  function drawSelectionBox(ctx, sel, color, label, isSelected) {
    try {
      let f = null;
      if (sel.type === 'building' && sel.building) f = buildingFrame(sel.building);
      else if (sel.ref) f = entityFrame(sel.ref);
      if (!f) return;
      ctx.save();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = color;
      ctx.strokeRect(Math.round(f.x) + 0.5, Math.round(f.y) + 0.5, Math.round(f.w), Math.round(f.h));
      if (isSelected) {
        // esquinas
        const s = 5;
        ctx.fillStyle = color;
        [[f.x, f.y], [f.x + f.w, f.y], [f.x, f.y + f.h], [f.x + f.w, f.y + f.h]].forEach(([hx, hy]) => {
          ctx.fillRect(Math.round(hx) - s / 2, Math.round(hy) - s / 2, s, s);
        });
        // radio real de selección del motor (0.42 * size)
        try {
          const ref = sel.ref;
          if (ref) {
            const radiusTiles = 0.42 * Math.max(0.55, num(ref.size, 1));
            const a = entityAnchor(ref);
            const p1 = deps.worldToScreen(a.x + 0.5, a.y + 0.6);
            const p2 = deps.worldToScreen(a.x + 0.5 + radiusTiles, a.y + 0.6);
            const rpx = Math.abs(p2.x - p1.x);
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, Math.max(2, rpx), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(120,255,150,0.55)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        } catch (e) {}
      }
      if (label) {
        const tw = ctx.measureText(label).width + 8;
        const ly = Math.max(0, f.y - 15);
        ctx.fillStyle = isSelected ? 'rgba(60,45,0,0.9)' : 'rgba(0,0,0,0.7)';
        ctx.fillRect(f.x, ly, tw, 14);
        ctx.fillStyle = color;
        ctx.fillText(label, f.x + 4, ly + 2);
      }
      ctx.restore();
    } catch (e) {}
  }

  // ── Bucle del overlay ─────────────────────────────────────────────────────
  let _rafStarted = false;
  let _lastPauseCheck = 0;
  function startLoop() {
    if (_rafStarted) return;
    _rafStarted = true;
    const tick = () => {
      try {
        if (state.enabled) {
          draw();
          // El motor puede reanudar el tiempo por su cuenta (widgets, eventos,
          // apertura de menús...). Mientras el debug pida pausa, la reafirmamos.
          const now = Date.now();
          if (state.pauseWorld && now - _lastPauseCheck > 400) {
            _lastPauseCheck = now;
            if (num(window._timeScale, 1) !== 0) {
              window._timeScale = 0;
              try { if (window._refreshTimeWidget) window._refreshTimeWidget(); } catch (e) {}
            }
          }
        }
      } catch (e) {}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── init ──────────────────────────────────────────────────────────────────
  function init() {
    if (api.ready) return api;
    api.ready = true;
    try {
      loadPersisted();
      loadFromFile().then(() => { invalidateSpriteKeys(); }).catch(() => {});
    } catch (e) {}

    try {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('blur', () => { state.drag = null; });
      // Bloqueo de los eventos de ratón sobre el canvas (ver blockGameMouseEvent)
      ['mousedown', 'mouseup', 'click', 'dblclick'].forEach(type => {
        window.addEventListener(type, blockGameMouseEvent, true);
      });
      // menú contextual propio del modo debug (sólo si hay algo seleccionado;
      // si no, se respeta el comportamiento del juego)
      window.addEventListener('contextmenu', (ev) => {
        if (!state.enabled) return;
        if (insidePanel(ev)) return;
        if (!state.selected) return;
        ev.preventDefault();
        ev.stopPropagation();
      }, true);
    } catch (e) {}

    // Botón en la barra de herramientas Dev existente
    try { addToolbarButton(); } catch (e) {}
    try { startLoop(); } catch (e) {}
    try { syncGlobals(); } catch (e) {}

    // Arranca activado si la URL lo pide:  ?debug=1
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('debug') === '1') setTimeout(() => setEnabled(true), 800);
    } catch (e) {}

    return api;
  }

  function addToolbarButton() {
    try {
      const groups = document.querySelectorAll('#toolbar .tool-group');
      if (!groups.length) return;
      const target = groups[groups.length - 1];
      if (document.getElementById('btn-debug-mode')) return;
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.id = 'btn-debug-mode';
      btn.innerHTML = `${iconoUI('llave', { size: 13 })}<span>Debug (F9)</span>`;
      btn.addEventListener('click', () => setEnabled(!state.enabled));
      target.appendChild(btn);
      // indicador de estado en el botón
      setInterval(() => {
        try { btn.classList.toggle('selected', state.enabled); btn.style.outline = state.enabled ? '1px solid #FFD27A' : ''; } catch (e) {}
      }, 500);
    } catch (e) {}
  }

  return api;
}
