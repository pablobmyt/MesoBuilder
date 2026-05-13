export function createStandaloneEditorUtils(deps) {
  const getState = () => deps.getState();
  const setState = (patch) => deps.setState(patch || {});
  const getGrid = () => (typeof deps.getGrid === 'function' ? deps.getGrid() : deps.grid);
  const getEntities = () => (typeof deps.getEntities === 'function' ? deps.getEntities() : deps.entities);
  const getRabbits = () => (typeof deps.getRabbits === 'function' ? deps.getRabbits() : deps.rabbits);
  const getFoxes = () => (typeof deps.getFoxes === 'function' ? deps.getFoxes() : deps.foxes);
  const getResources = () => (typeof deps.getResources === 'function' ? deps.getResources() : deps.res);

  function syncSelectedToolButtons() {
    try {
      const { selectedTool } = getState();
      document.querySelectorAll('.build-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.type === selectedTool));
      const demolishBtn = document.getElementById('btn-demolish');
      if (demolishBtn) demolishBtn.classList.toggle('selected', selectedTool === 'demolish');
    } catch (e) {}
  }

  function resetWorldForProceduralEditor() {
    try {
      const grid = getGrid();
      if (grid && grid.length) {
        for (let r = 0; r < deps.ROWS; r++) {
          for (let c = 0; c < deps.COLS; c++) grid[r][c] = null;
        }
      }
    } catch (e) {}
    try {
      const entities = getEntities();
      if (entities && entities.length >= 0) entities.length = 0;
    } catch (e) {}
    try {
      const rabbits = getRabbits();
      const foxes = getFoxes();
      rabbits.length = 0;
      foxes.length = 0;
    } catch (e) {}
    try { window._VILLAGES = []; } catch (e) {}
    try { window.MAP_CHUNKS = {}; deps.setMapCacheDirty(true); } catch (e) {}
  }

  function ensureStandaloneEditorSandboxState() {
    try { setState({ startLocked: false }); } catch (e) {}
    try {
      const res = getResources();
      res.wheat = Math.max(Number(res.wheat) || 0, 999999);
      res.brick = Math.max(Number(res.brick) || 0, 999999);
      res.pop = Math.max(Number(res.pop) || 0, 5000);
    } catch (e) {}
    try { deps.setEditMode(true); } catch (e) {}
    try { deps.updateUI(); } catch (e) {}
  }

  function getStandaloneEditorBuildingScale() {
    if (!window._standaloneEditorMode) return 1;
    const { standaloneEditorBuildingScale } = getState();
    const value = Number(standaloneEditorBuildingScale);
    if (!Number.isFinite(value)) return 1;
    return Math.max(0.5, Math.min(2.5, value));
  }

  function setStandaloneEditorBuildingScale(scale) {
    const value = Number(scale);
    setState({ standaloneEditorBuildingScale: Number.isFinite(value) ? Math.max(0.5, Math.min(2.5, value)) : 1 });
    try { deps.render(); } catch (e) {}
    return getStandaloneEditorBuildingScale();
  }

  function getStandaloneEditorEntityScale() {
    if (!window._standaloneEditorMode) return 1;
    const { standaloneEditorEntityScale } = getState();
    const value = Number(standaloneEditorEntityScale);
    if (!Number.isFinite(value)) return 1;
    return Math.max(0.5, Math.min(2.5, value));
  }

  function setStandaloneEditorEntityScale(scale) {
    const value = Number(scale);
    setState({ standaloneEditorEntityScale: Number.isFinite(value) ? Math.max(0.5, Math.min(2.5, value)) : 1 });
    try { deps.render(); } catch (e) {}
    return getStandaloneEditorEntityScale();
  }

  function regenerateProceduralMapForEditor(epochId) {
    try {
      if (epochId) deps.applyEpochProfile(epochId, true);
    } catch (e) {}
    ensureStandaloneEditorSandboxState();
    resetWorldForProceduralEditor();
    deps.generateMap('random');
    ensureStandaloneEditorSandboxState();
    try { deps.setMapEditorEnabled(false, { silent: true }); } catch (e) {}
    try { setState({ selectedTool: null }); syncSelectedToolButtons(); } catch (e) {}
    try { deps.updateUI(); } catch (e) {}
    try { deps.updateCharCard(); } catch (e) {}
    try { deps.renderActionList(); } catch (e) {}
    try { deps.updateInventory(); } catch (e) {}
    try { deps.rebuildMapSceneTriggers(); } catch (e) {}
    try { deps.updateBuildMenuFromGrid(); } catch (e) {}
    try { deps.centerCamera(); } catch (e) {}
    try { deps.rebuildMapCacheDebounced(10); } catch (e) {}
    try { deps.render(); } catch (e) {}
    try { deps.saveAppStateDebounced(10); } catch (e) {}
    return deps.getMapDesignObject();
  }

  function setStandaloneBuildTool(type) {
    ensureStandaloneEditorSandboxState();
    if (!type) {
      setState({ selectedTool: null });
    } else if (type === 'demolish') {
      setState({ selectedTool: 'demolish' });
    } else {
      const { mapEditorEnabled } = getState();
      if (mapEditorEnabled) deps.setMapEditorEnabled(false, { silent: true });
      setState({ selectedTool: type });
    }
    syncSelectedToolButtons();
    return getState().selectedTool;
  }

  function getStandaloneBuildPalette(epochId) {
    const palette = deps.getEpochBuildPalette(epochId || window._currentEpoch || 'mesopotamia');
    return palette.map(type => ({
      id: type,
      resolvedId: deps.resolveEpochBuildingType(type, epochId),
      ...deps.getBuildingDisplay(type)
    }));
  }

  function getCanvasAndRect() {
    const canvas = (typeof deps.getCanvas === 'function') ? deps.getCanvas() : null;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { canvas, rect };
  }

  function clampCell(col, row) {
    const c = Math.max(0, Math.min(deps.COLS - 1, Math.floor(Number(col) || 0)));
    const r = Math.max(0, Math.min(deps.ROWS - 1, Math.floor(Number(row) || 0)));
    return { col: c, row: r };
  }

  function pickEntityAtCell(col, row) {
    try {
      const entities = getEntities() || [];
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (!ent || typeof ent !== 'object') continue;
        const ec = (typeof ent.col === 'number') ? Math.floor(ent.col) : Math.floor(Number(ent.x) || 0);
        const er = (typeof ent.row === 'number') ? Math.floor(ent.row) : Math.floor(Number(ent.y) || 0);
        if (ec !== col || er !== row) continue;
        return {
          index: i,
          id: ent.id || null,
          kind: ent.kind || 'entity',
          subtype: ent.subtype || null,
          col: ec,
          row: er
        };
      }
    } catch (e) {}
    return null;
  }

  function pickBuildingAtCell(col, row) {
    try {
      if (col < 0 || row < 0 || col >= deps.COLS || row >= deps.ROWS) return null;
      const info = (typeof deps.getCellInfo === 'function') ? deps.getCellInfo(col, row) : null;
      if (!info || !info.type) return null;
      const size = (typeof deps.getBuildingSize === 'function') ? deps.getBuildingSize(info.type) : { w: 1, h: 1 };
      return {
        type: info.type,
        baseCol: (typeof info.baseCol === 'number') ? info.baseCol : col,
        baseRow: (typeof info.baseRow === 'number') ? info.baseRow : row,
        width: Math.max(1, Number(size && size.w) || 1),
        height: Math.max(1, Number(size && size.h) || 1),
        isBase: !!info.isBase
      };
    } catch (e) {}
    return null;
  }

  function getCellClientFrame(col, row) {
    try {
      const cr = getCanvasAndRect();
      if (!cr || typeof deps.worldToScreen !== 'function') return null;
      const { canvas, rect } = cr;
      const world = deps.worldToScreen(col, row);
      if (!world || typeof world.x !== 'number' || typeof world.y !== 'number') return null;
      const scaleX = rect.width / Math.max(1, canvas.width);
      const scaleY = rect.height / Math.max(1, canvas.height);
      const mode = (typeof deps.getViewMode === 'function') ? deps.getViewMode() : 'ortho';
      if (mode === 'iso' && typeof deps.getIsoTileSize === 'function') {
        const iso = deps.getIsoTileSize() || { w: 32, h: 18 };
        return {
          left: rect.left + (world.x - iso.w / 2) * scaleX,
          top: rect.top + world.y * scaleY,
          width: iso.w * scaleX,
          height: iso.h * scaleY,
          mode: 'iso'
        };
      }
      const tileSize = (typeof deps.getTileSize === 'function') ? deps.getTileSize() : 32;
      return {
        left: rect.left + world.x * scaleX,
        top: rect.top + world.y * scaleY,
        width: tileSize * scaleX,
        height: tileSize * scaleY,
        mode: 'ortho'
      };
    } catch (e) {
      return null;
    }
  }

  function pickFromClient(clientX, clientY) {
    try {
      const cr = getCanvasAndRect();
      if (!cr || typeof deps.screenToWorld !== 'function') return null;
      const { canvas, rect } = cr;
      const localCssX = Number(clientX) - rect.left;
      const localCssY = Number(clientY) - rect.top;
      if (localCssX < 0 || localCssY < 0 || localCssX > rect.width || localCssY > rect.height) return null;
      const sx = localCssX * (canvas.width / rect.width);
      const sy = localCssY * (canvas.height / rect.height);
      const world = deps.screenToWorld(sx, sy);
      if (!world || typeof world.col !== 'number' || typeof world.row !== 'number') return null;
      const cell = clampCell(world.col, world.row);
      const building = pickBuildingAtCell(cell.col, cell.row);
      const entity = pickEntityAtCell(cell.col, cell.row);
      let terrain = null;
      try {
        if (typeof deps.getTileBiome === 'function') {
          const map = deps.getTileBiome();
          terrain = map && map[cell.row] ? (map[cell.row][cell.col] || null) : null;
        }
      } catch (e) {}
      return {
        col: cell.col,
        row: cell.row,
        building,
        entity,
        terrain
      };
    } catch (e) {
      return null;
    }
  }

  function refreshStandaloneEditorApi() {
    try {
      window.MESO_MAP_EDITOR_API = {
        ready: true,
        getEpoch: () => window._currentEpoch || 'mesopotamia',
        setEpoch: (epochId) => { try { deps.applyEpochProfile(epochId || 'mesopotamia', true); } catch (e) {} return window._currentEpoch || 'mesopotamia'; },
        regenerateProceduralMap: (epochId) => regenerateProceduralMapForEditor(epochId),
        enableTerrainBrush: (terrainId, size) => {
          ensureStandaloneEditorSandboxState();
          if (terrainId) deps.setMapEditorBrush(terrainId);
          if (typeof size === 'number') setState({ mapEditorBrushSize: Math.max(1, Math.min(6, Math.round(size))) });
          deps.setMapEditorEnabled(true, { silent: true });
          deps.updateMapEditorUI();
          const { mapEditorBrush, mapEditorBrushSize } = getState();
          return { brush: mapEditorBrush, brushSize: mapEditorBrushSize };
        },
        disableTerrainBrush: () => { try { deps.setMapEditorEnabled(false, { silent: true }); } catch (e) {} return true; },
        setBrushSize: (size) => {
          setState({ mapEditorBrushSize: Math.max(1, Math.min(6, Math.round(size || 1))) });
          deps.updateMapEditorUI();
          return getState().mapEditorBrushSize;
        },
        setBuildingScale: (scale) => setStandaloneEditorBuildingScale(scale),
        getBuildingScale: () => getStandaloneEditorBuildingScale(),
        setEntityScale: (scale) => setStandaloneEditorEntityScale(scale),
        getEntityScale: () => getStandaloneEditorEntityScale(),
        selectBuildTool: (type) => setStandaloneBuildTool(type),
        clearTool: () => setStandaloneBuildTool(null),
        getBuildPalette: (epochId) => getStandaloneBuildPalette(epochId),
        exportMapDesignData: () => deps.getMapDesignObject(),
        importMapDesignData: (data) => { ensureStandaloneEditorSandboxState(); return deps.importMapDesignFromObject(data); },
        savePendingMapDesign: () => deps.getMapDesignObject(),
        pickFromClient: (clientX, clientY) => pickFromClient(clientX, clientY),
        getCellClientFrame: (col, row) => getCellClientFrame(col, row),
        getMapSize: () => ({ cols: deps.COLS, rows: deps.ROWS })
      };
    } catch (e) {}
  }

  function setupMapEditorUI() {
    try {
      const toggleBtn = document.getElementById('btn-map-editor-toggle');
      const shortcutBtn = document.getElementById('btn-map-editor-shortcut');
      const exportBtn = document.getElementById('btn-map-editor-export');
      const importBtn = document.getElementById('btn-map-editor-import');
      const importInput = document.getElementById('map-editor-import-input');
      const sizeInput = document.getElementById('map-editor-brush-size');
      if (toggleBtn && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = '1';
        toggleBtn.addEventListener('click', () => deps.setMapEditorEnabled(!getState().mapEditorEnabled));
      }
      if (shortcutBtn && !shortcutBtn.dataset.bound) {
        shortcutBtn.dataset.bound = '1';
        shortcutBtn.addEventListener('click', () => deps.setMapEditorEnabled(!getState().mapEditorEnabled));
      }
      if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = '1';
        exportBtn.addEventListener('click', () => deps.exportMapDesign());
      }
      if (importBtn && importInput && !importBtn.dataset.bound) {
        importBtn.dataset.bound = '1';
        importBtn.addEventListener('click', () => importInput.click());
      }
      if (importInput && !importInput.dataset.bound) {
        importInput.dataset.bound = '1';
        importInput.addEventListener('change', async (ev) => {
          try {
            const file = ev.target && ev.target.files && ev.target.files[0];
            if (!file) return;
            const text = await file.text();
            deps.importMapDesignFromObject(JSON.parse(text));
          } catch (e) {
            console.error('map editor import', e);
            deps.notify('No se pudo leer el archivo del mapa.');
          } finally {
            try { importInput.value = ''; } catch (e) {}
          }
        });
      }
      if (sizeInput && !sizeInput.dataset.bound) {
        sizeInput.dataset.bound = '1';
        sizeInput.addEventListener('input', () => {
          setState({ mapEditorBrushSize: Math.max(1, Math.min(6, parseInt(sizeInput.value || '1', 10) || 1)) });
          deps.updateMapEditorUI();
        });
      }
      document.querySelectorAll('.map-editor-terrain').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
          deps.setMapEditorBrush(btn.dataset.terrain || 'alluvial');
          if (!getState().mapEditorEnabled) deps.setMapEditorEnabled(true, { silent: true });
          deps.updateMapEditorUI();
        });
      });
      deps.updateMapEditorUI();
    } catch (e) {
      console.error('setupMapEditorUI', e);
    }
  }

  return {
    syncSelectedToolButtons,
    resetWorldForProceduralEditor,
    ensureStandaloneEditorSandboxState,
    getStandaloneEditorBuildingScale,
    setStandaloneEditorBuildingScale,
    getStandaloneEditorEntityScale,
    setStandaloneEditorEntityScale,
    regenerateProceduralMapForEditor,
    setStandaloneBuildTool,
    getStandaloneBuildPalette,
    refreshStandaloneEditorApi,
    setupMapEditorUI
  };
}
