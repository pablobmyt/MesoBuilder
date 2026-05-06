export async function cacheIcons(progress) {
  try {
    const canvasEls = Array.from(document.querySelectorAll('canvas[id^="icon-"]'));
    if (canvasEls.length === 0) { progress.update(10, 'Iconos: none'); return; }
    const total = canvasEls.length; let i = 0;
    for (const c of canvasEls) {
      i++;
      const id = c.id || ('icon-' + i);
      try {
        const off = document.createElement('canvas'); off.width = c.width || 32; off.height = c.height || 32;
        const cx = off.getContext('2d'); cx.drawImage(c,0,0);
        if (window.createImageBitmap) {
          const bmp = await createImageBitmap(off);
          window._ICON_BITMAPS[id] = bmp;
        } else {
          window._ICON_BITMAPS[id] = off;
        }
        progress.update((i/total)*30, `Iconos: ${id}`);
      } catch (e) {
        progress.update((i/total)*30, `Iconos: ${id} (err)`);
      }
    }
  } catch (e) {}
}

export async function buildSpritesheet(progress) {
  try {
    const keys = Object.keys(window._ICON_BITMAPS || {});
    if (keys.length === 0) { progress.update(35, 'Sprites: none'); return; }
    const size = 32; const cols = Math.ceil(Math.sqrt(keys.length)); const rows = Math.ceil(keys.length / cols);
    const atlas = document.createElement('canvas'); atlas.width = cols * size; atlas.height = rows * size;
    const ax = atlas.getContext('2d');
    let i = 0;
    for (const id of keys) {
      const x = (i % cols) * size; const y = Math.floor(i / cols) * size;
      const bmp = window._ICON_BITMAPS[id];
      try { ax.drawImage(bmp, x + 4, y + 4, size-8, size-8); } catch (e) {}
      window._ICON_BITMAPS[id + '_atlas_pos'] = { x:x+4, y:y+4, w:size-8, h:size-8 };
      i++; progress.update(30 + (i/keys.length)*10, `Sprites: ${i}/${keys.length}`);
    }
    if (window.createImageBitmap) window._ICON_BITMAPS._atlas = await createImageBitmap(atlas); else window._ICON_BITMAPS._atlas = atlas;
  } catch (e) {}
}

export async function preRenderMapChunks(progress, deps) {
  const { COLS, ROWS, TILE, tileBiome, grid } = deps;
  try {
    const CHUNK = 32;
    const chunkCols = Math.ceil(COLS / CHUNK);
    const chunkRows = Math.ceil(ROWS / CHUNK);
    let total = chunkCols * chunkRows; let count = 0;
    for (let cy = 0; cy < chunkRows; cy++) {
      for (let cx = 0; cx < chunkCols; cx++) {
        const key = cx + ',' + cy;
        try {
          const off = document.createElement('canvas'); off.width = CHUNK * TILE; off.height = CHUNK * TILE;
          const oc = off.getContext('2d');
          for (let ty = 0; ty < CHUNK; ty++) {
            for (let tx = 0; tx < CHUNK; tx++) {
              const col = cx * CHUNK + tx; const row = cy * CHUNK + ty;
              if (col >= COLS || row >= ROWS) continue;
              const b = (tileBiome && tileBiome[row] && tileBiome[row][col]) ? tileBiome[row][col] : 'sand';
              let color = '#EBD9B3';
              if (b === 'sand') color = '#EBD9B3'; else if (b === 'dirt') color = '#CFA07A'; else if (b === 'water') color = '#6EA8D7'; else if (b === 'grass') color = '#8BBF7E';
              oc.fillStyle = color; oc.fillRect(tx * TILE, ty * TILE, TILE, TILE);
            }
          }
          for (let ty = 0; ty < CHUNK; ty++) {
            for (let tx = 0; tx < CHUNK; tx++) {
              const col = cx * CHUNK + tx; const row = cy * CHUNK + ty;
              if (col >= COLS || row >= ROWS) continue;
              const cell = grid[row][col];
              if (!cell) continue;
              try {
                if (typeof cell !== 'string' && cell.type) {
                  const pos = window._ICON_BITMAPS[cell.type ? ('icon-' + cell.type) : 'icon-house'];
                  if (pos) {
                    try { oc.fillStyle = '#00000022'; oc.fillRect(tx * TILE + 4, ty * TILE + 4, TILE - 8, TILE - 8); } catch (e) {}
                  }
                }
              } catch (e) {}
            }
          }
          if (window.createImageBitmap) {
            try { window.MAP_CHUNKS[key] = await createImageBitmap(off); } catch (e) { window.MAP_CHUNKS[key] = off; }
          } else window.MAP_CHUNKS[key] = off;
        } catch (e) {}
        count++; progress.update(45 + (count/total)*50, `Chunks: ${count}/${total}`);
      }
    }
  } catch (e) {}
}

export async function preRenderEntities(progress, deps) {
  const { COLS, ROWS, grid } = deps;
  try {
    const entries = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c]; if (!cell) continue;
      if (typeof cell === 'string') entries.push({ type: cell, key: 'building:' + cell });
      else if (cell.type) entries.push({ type: cell.type, key: 'building:' + cell.type });
    }
    try { (window.entities || []).forEach(en => { if (en && en.kind) entries.push({ type: en.kind + (en.variant ? (':' + en.variant) : ''), key: 'entity:' + (en.id || (en.kind + '-' + en.col + '-' + en.row)) }); }); } catch (e) {}
    try { (window.rabbits || []).forEach(r => entries.push({ type: 'rabbit', key: 'rabbit:' + r.id })); } catch (e) {}
    try { (window.foxes || []).forEach(f => entries.push({ type: 'fox', key: 'fox:' + f.id })); } catch (e) {}

    const map = {}; entries.forEach(e => { map[e.key] = e; });
    const keys = Object.keys(map); if (keys.length === 0) { progress.update(40, 'Entidades: none'); return; }
    let i = 0; for (const k of keys) {
      i++; const en = map[k]; const id = k.replace(/[:]/g,'_');
      try {
        const off = document.createElement('canvas'); off.width = 64; off.height = 64; const oc = off.getContext('2d');
        if (en.type.indexOf('tree') !== -1 || en.type.indexOf('tree') === 0) {
          oc.fillStyle = '#3A6B2A'; oc.beginPath(); oc.ellipse(32,22,18,14,0,0,Math.PI*2); oc.fill(); oc.fillStyle = '#5B3E1B'; oc.fillRect(28,28,8,20);
        } else if (en.type.indexOf('rabbit') !== -1 || en.type === 'rabbit') {
          oc.fillStyle = '#DDDDDD'; oc.beginPath(); oc.ellipse(36,34,10,6,0,0,Math.PI*2); oc.fill(); oc.fillStyle = '#222'; oc.fillRect(30,30,2,2);
        } else if (en.type.indexOf('fox') !== -1 || en.type === 'fox') {
          oc.fillStyle = '#C85A1A'; oc.beginPath(); oc.ellipse(36,34,11,7,0,0,Math.PI*2); oc.fill();
        } else if (en.type.indexOf('building') !== -1 || en.type.indexOf('house') !== -1) {
          oc.fillStyle = '#C8A84B'; oc.fillRect(16,20,32,24); oc.fillStyle = '#7A4F12'; oc.fillRect(14,12,36,12);
        } else {
          oc.fillStyle = '#FFF'; oc.beginPath(); oc.arc(32,32,8,0,Math.PI*2); oc.fill();
        }
        if (window.createImageBitmap) {
          try { window._ENTITY_BITMAPS[id] = await createImageBitmap(off); } catch (e) { window._ENTITY_BITMAPS[id] = off; }
        } else window._ENTITY_BITMAPS[id] = off;
      } catch (e) {}
      progress.update(40 + (i/keys.length)*10, `Entidades: ${i}/${keys.length}`);
    }
  } catch (e) {}
}

export async function preloadAllBeforeStart(deps) {
  const {
    showProgressOverlay,
    loadEntityDefinitions,
    generateSpriteImages,
    COLS,
    ROWS,
    TILE,
    tileBiome,
    grid
  } = deps;
  const p = showProgressOverlay('Precargando recursos...');
  try {
    p.update(0, 'Iniciando...');
    try { await loadEntityDefinitions(p); } catch (e) {}
    await cacheIcons(p);
    await buildSpritesheet(p);
    await preRenderEntities(p, { COLS, ROWS, grid });
    try { p.update(55, 'Generando imágenes de sprites...'); await generateSpriteImages(p); } catch (e) { console.warn('sprite gen failed', e); }
    await preRenderMapChunks(p, { COLS, ROWS, TILE, tileBiome, grid });
    p.update(99, 'Finalizando...');
    await new Promise(r => setTimeout(r, 120));
  } catch (e) { console.warn('preloadAllBeforeStart err', e); }
  p.hide();
}

export function clearRuntimeCaches(deps) {
  const { resetMapCaches } = deps;
  try { if (typeof resetMapCaches === 'function') resetMapCaches(); } catch (e) {}
  try { window.MAP_CHUNKS = {}; } catch (e) {}
  try { window._ICON_BITMAPS = {}; } catch (e) {}
  try {
    if (window._SPRITE_URLS) {
      for (const k of Object.keys(window._SPRITE_URLS)) {
        try { URL.revokeObjectURL(window._SPRITE_URLS[k]); } catch (e) {}
      }
    }
    if (window._SPRITE_IMAGES) {
      for (const k of Object.keys(window._SPRITE_IMAGES)) {
        try { const img = window._SPRITE_IMAGES[k]; if (img && img.parentNode) img.parentNode.removeChild(img); } catch (e) {}
      }
    }
    window._SPRITE_URLS = {};
    window._SPRITE_IMAGES = {};
    window._ENTITY_BITMAPS = {};
  } catch (e) {}
}
