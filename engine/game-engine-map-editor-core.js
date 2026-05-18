export function createMapEditorCore(deps) {
  const getState = () => deps.getState();
  const setState = (patch) => deps.setState(patch || {});
  const getTileBiome = () => (typeof deps.getTileBiome === 'function' ? deps.getTileBiome() : deps.tileBiome);
  const getHeightMap = () => (typeof deps.getHeightMap === 'function' ? deps.getHeightMap() : deps.heightMap);
  const getGrid = () => (typeof deps.getGrid === 'function' ? deps.getGrid() : deps.grid);
  const getEntities = () => (typeof deps.getEntities === 'function' ? deps.getEntities() : deps.entities);
  const getPlayer = () => (typeof deps.getPlayer === 'function' ? deps.getPlayer() : deps.player);

  function getMapTerrainMeta(terrainId) {
    return deps.MAP_EDITOR_TERRAINS.find(t => t.id === terrainId) || deps.MAP_EDITOR_TERRAINS[0];
  }

  function getMapTerrainLabel(terrainId) {
    return getMapTerrainMeta(terrainId).label;
  }

  function getMapBrushCells(centerCol, centerRow) {
    const { mapEditorBrushSize } = getState();
    const radius = Math.max(0, Number(mapEditorBrushSize || 1) - 1);
    const cells = [];
    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (col < 0 || col >= deps.COLS || row < 0 || row >= deps.ROWS) continue;
        if (radius > 0 && Math.hypot(col - centerCol, row - centerRow) > radius + 0.25) continue;
        cells.push({ col, row });
      }
    }
    return cells;
  }

  function updateMapEditorUI() {
    try {
      const { mapEditorEnabled, mapEditorBrush, mapEditorBrushSize, editMode } = getState();
      const toggleBtn = document.getElementById('btn-map-editor-toggle');
      const shortcutBtn = document.getElementById('btn-map-editor-shortcut');
      const statusEl = document.getElementById('map-editor-status');
      const sizeInput = document.getElementById('map-editor-brush-size');
      const sizeLabel = document.getElementById('map-editor-brush-size-label');
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', mapEditorEnabled);
        toggleBtn.textContent = mapEditorEnabled ? 'Desactivar editor' : 'Activar editor';
      }
      if (shortcutBtn) shortcutBtn.classList.toggle('active', mapEditorEnabled);
      if (sizeInput) sizeInput.value = String(mapEditorBrushSize);
      if (sizeLabel) sizeLabel.textContent = String(mapEditorBrushSize);
      document.querySelectorAll('.map-editor-terrain').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.terrain === mapEditorBrush);
      });
      if (statusEl) {
        if (!editMode) statusEl.textContent = 'Activa el modo edición para pintar el mapa manualmente.';
        else if (mapEditorEnabled) statusEl.textContent = `Pincel ${getMapTerrainLabel(mapEditorBrush)} · tamaño ${mapEditorBrushSize}. Arrastra sobre el mapa para pintar.`;
        else statusEl.textContent = 'Pulsa “Activar editor” para dibujar biomas y caminos a mano.';
      }
    } catch (e) {}
  }

  function setMapEditorBrush(terrainId) {
    const meta = getMapTerrainMeta(terrainId);
    setState({ mapEditorBrush: meta.id });
    updateMapEditorUI();
  }

  function setMapEditorEnabled(enabled, options = {}) {
    const { editMode, mapEditorBrush } = getState();
    const next = !!enabled;
    setState({
      mapEditorEnabled: next,
      mapEditorPainting: false,
      mapEditorLastPaintKey: null,
      ...(next ? { selectedTool: null } : null)
    });
    if (next) {
      if (!editMode) deps.setEditMode(true);
      try { document.querySelectorAll('.build-btn, #btn-demolish').forEach(b => b.classList.remove('selected')); } catch (e) {}
    }
    updateMapEditorUI();
    if (!options.silent) deps.notify(next ? `Editor de mapa activo: ${getMapTerrainLabel(mapEditorBrush)}.` : 'Editor de mapa desactivado.');
  }

  function pruneEditedTerrainEntities(cells, terrainId) {
    try {
      const edited = new Set(cells.map(cell => `${cell.col},${cell.row}`));
      const entities = getEntities();
      for (let i = entities.length - 1; i >= 0; i--) {
        const ent = entities[i];
        if (!ent) continue;
        const col = (typeof ent.col === 'number') ? ent.col : (typeof ent.x === 'number' ? Math.floor(ent.x) : null);
        const row = (typeof ent.row === 'number') ? ent.row : (typeof ent.y === 'number' ? Math.floor(ent.y) : null);
        if (col === null || row === null || !edited.has(`${col},${row}`)) continue;
        if (ent.kind === 'tree' || ent.kind === 'ambient' || (terrainId === 'water' && ent.kind === 'resource')) entities.splice(i, 1);
      }
    } catch (e) {}
  }

  function paintTerrainAt(centerCol, centerRow) {
    const { startLocked, editMode, mapEditorEnabled, mapEditorBrush } = getState();
    if ((startLocked && !window._standaloneEditorMode) || !editMode || !mapEditorEnabled) return 0;
    if (centerCol < 0 || centerCol >= deps.COLS || centerRow < 0 || centerRow >= deps.ROWS) return 0;
    const grid = getGrid();
    const tileBiome = getTileBiome();
    const heightMap = getHeightMap();
    const cells = getMapBrushCells(centerCol, centerRow);
    const targetHeight = deps.MAP_EDITOR_HEIGHT_PRESETS[mapEditorBrush];
    const changed = [];
    for (const cell of cells) {
      const { col, row } = cell;
      if (grid[row] && grid[row][col]) continue;
      const currentBiome = (tileBiome[row] && tileBiome[row][col]) || 'alluvial';
      const currentHeight = (heightMap[row] && typeof heightMap[row][col] === 'number') ? heightMap[row][col] : null;
      const nextHeight = (typeof targetHeight === 'number') ? targetHeight : currentHeight;
      if (currentBiome === mapEditorBrush && currentHeight === nextHeight) continue;
      tileBiome[row][col] = mapEditorBrush;
      if (typeof nextHeight === 'number') heightMap[row][col] = nextHeight;
      changed.push(cell);
    }
    if (!changed.length) return 0;
    pruneEditedTerrainEntities(changed, mapEditorBrush);
    deps.setMapCacheDirty(true);
    try { deps.rebuildMapCacheDebounced(20); } catch (e) {}
    try { deps.saveAppStateDebounced(500); } catch (e) {}
    try { deps.render(); } catch (e) {}
    return changed.length;
  }

  function cloneMapDesignValue(value, fallback) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return fallback;
    }
  }

  function getMapDesignObject() {
    const tileBiome = getTileBiome();
    const heightMap = getHeightMap();
    const grid = getGrid();
    const entities = getEntities();
    const player = getPlayer();
    return {
      meta: {
        type: 'mesobuilder-map-design',
        version: 2,
        exportedAt: new Date().toISOString(),
        epoch: deps.getCurrentEpoch()
      },
      epoch: deps.getCurrentEpoch(),
      cols: deps.COLS,
      rows: deps.ROWS,
      tileBiome: tileBiome.map(row => row.slice()),
      heightMap: heightMap.map(row => row.slice()),
      grid: cloneMapDesignValue(grid, []),
      entities: cloneMapDesignValue(entities || [], []),
      villages: cloneMapDesignValue(window._VILLAGES || [], []),
      zoneSpawnPresets: cloneMapDesignValue(window._ZONE_SPAWN_PRESETS || {}, {}),
      player: {
        col: player.col,
        row: player.row,
        x: player.x,
        y: player.y
      }
    };
  }

  function exportMapDesign() {
    try {
      const data = getMapDesignObject();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `meso-map-design-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { a.remove(); } catch (e) {}
        try { URL.revokeObjectURL(url); } catch (e) {}
      }, 300);
      deps.notify('Diseño de mapa exportado.');
    } catch (e) {
      console.error('exportMapDesign', e);
      deps.notify('No se pudo exportar el diseño del mapa.');
    }
  }

  function importMapDesignFromObject(data, options = {}) {
    try {
      const source = (data && data.tileBiome) ? data : (data && data.mapDesign && data.mapDesign.tileBiome ? data.mapDesign : null);
      const tileBiome = getTileBiome();
      const heightMap = getHeightMap();
      const grid = getGrid();
      const entities = getEntities();
      const player = getPlayer();
      if (!source || !Array.isArray(source.tileBiome)) throw new Error('Formato de diseño no válido');
      if (source.epoch && !options.skipEpochApply && source.epoch !== deps.getCurrentEpoch()) {
        try { deps.applyEpochProfile(source.epoch, true); } catch (e) {}
      }
      const copyRows = Math.min(deps.ROWS, source.tileBiome.length);
      for (let r = 0; r < copyRows; r++) {
        const row = Array.isArray(source.tileBiome[r]) ? source.tileBiome[r].slice(0, deps.COLS) : Array(deps.COLS).fill('alluvial');
        while (row.length < deps.COLS) row.push('alluvial');
        tileBiome[r] = row;
      }
      for (let r = copyRows; r < deps.ROWS; r++) tileBiome[r] = Array(deps.COLS).fill('alluvial');
      if (Array.isArray(source.heightMap)) {
        const heightRows = Math.min(deps.ROWS, source.heightMap.length);
        for (let r = 0; r < heightRows; r++) {
          const row = Array.isArray(source.heightMap[r]) ? source.heightMap[r].slice(0, deps.COLS) : Array(deps.COLS).fill(0.12);
          while (row.length < deps.COLS) row.push(0.12);
          heightMap[r] = row.map(v => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.12));
        }
        for (let r = heightRows; r < deps.ROWS; r++) heightMap[r] = Array(deps.COLS).fill(0.12);
      }
      if (Array.isArray(source.grid)) {
        const gridRows = Math.min(deps.ROWS, source.grid.length);
        for (let r = 0; r < gridRows; r++) {
          const row = Array.isArray(source.grid[r]) ? source.grid[r].slice(0, deps.COLS) : Array(deps.COLS).fill(null);
          while (row.length < deps.COLS) row.push(null);
          grid[r] = row.map(cell => (cell ? cloneMapDesignValue(cell, null) : null));
        }
        for (let r = gridRows; r < deps.ROWS; r++) grid[r] = Array(deps.COLS).fill(null);
      }
      if (Object.prototype.hasOwnProperty.call(source, 'entities') && Array.isArray(source.entities)) {
        try {
          entities.length = 0;
          source.entities.forEach(ent => {
            if (!ent || typeof ent !== 'object') return;
            const it = cloneMapDesignValue(ent, null);
            if (!it) return;
            if (typeof it.col !== 'number') it.col = (typeof it.x === 'number') ? Math.floor(it.x) : 0;
            if (typeof it.row !== 'number') it.row = (typeof it.y === 'number') ? Math.floor(it.y) : 0;
            it.x = typeof it.x === 'number' ? it.x : it.col;
            it.y = typeof it.y === 'number' ? it.y : it.row;
            entities.push(it);
          });
        } catch (e) {}
      }
      if (Object.prototype.hasOwnProperty.call(source, 'villages') && Array.isArray(source.villages)) {
        try { window._VILLAGES = cloneMapDesignValue(source.villages, []); } catch (e) {}
      }
      if (Object.prototype.hasOwnProperty.call(source, 'zoneSpawnPresets') && source.zoneSpawnPresets && typeof source.zoneSpawnPresets === 'object') {
        try { window._ZONE_SPAWN_PRESETS = cloneMapDesignValue(source.zoneSpawnPresets, {}); } catch (e) {}
      } else {
        try { window._ZONE_SPAWN_PRESETS = window._ZONE_SPAWN_PRESETS || {}; } catch (e) {}
      }
      if (source.player && typeof source.player === 'object') {
        try {
          const px = typeof source.player.x === 'number' ? source.player.x : source.player.col;
          const py = typeof source.player.y === 'number' ? source.player.y : source.player.row;
          if (typeof px === 'number' && typeof py === 'number') {
            player.x = px;
            player.y = py;
            player.col = Math.floor(px);
            player.row = Math.floor(py);
          }
        } catch (e) {}
      }
      try { deps.rebuildInteriorDoorsFromGrid(); } catch (e) {}
      deps.setMapCacheDirty(true);
      try { deps.rebuildMapCacheDebounced(10); } catch (e) {}
      try { deps.saveAppStateDebounced(10); } catch (e) {}
      try { deps.updateBuildMenuFromGrid(); } catch (e) {}
      try { deps.updateUI(); } catch (e) {}
      try { deps.updateCharCard(); } catch (e) {}
      try { deps.render(); } catch (e) {}
      updateMapEditorUI();
      deps.notify('Diseño de mapa importado.');
    } catch (e) {
      console.error('importMapDesignFromObject', e);
      deps.notify('El archivo de diseño no es válido.');
    }
  }

  return {
    getMapTerrainMeta,
    getMapTerrainLabel,
    getMapBrushCells,
    updateMapEditorUI,
    setMapEditorBrush,
    setMapEditorEnabled,
    pruneEditedTerrainEntities,
    paintTerrainAt,
    cloneMapDesignValue,
    getMapDesignObject,
    exportMapDesign,
    importMapDesignFromObject
  };
}
