// Progress overlay with percentage bar
function showProgressOverlay(title) {
  let el = document.getElementById('progress-overlay');
  if (!el) {
    el = document.createElement('div'); el.id = 'progress-overlay';
    el.style.position = 'fixed'; el.style.left = '0'; el.style.top = '0'; el.style.right = '0'; el.style.bottom = '0';
    el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
    el.style.background = 'rgba(0,0,0,0.75)'; el.style.zIndex = 110000;
    el.innerHTML = `<div style="width:520px;max-width:94%;background:rgba(20,20,20,0.98);color:#FFD27A;padding:18px 22px;border-radius:10px;font-weight:700;font-family:sans-serif">
      <div id="progress-title">${title || 'Cargando...'}</div>
      <div style="margin-top:12px;background:#111;border:1px solid #333;height:18px;border-radius:8px;overflow:hidden">
        <div id="progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#DAA520,#FFD27A)"></div>
      </div>
      <div id="progress-msg" style="margin-top:8px;font-size:12px;color:#ccc">Preparando...</div>
      <div id="progress-activity" style="margin-top:10px;font-size:12px;color:#bbb;max-height:120px;overflow:auto"></div>
    </div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
  function update(p, msg) {
    const bar = document.getElementById('progress-bar'); if (bar) bar.style.width = Math.max(0,Math.min(100,p)) + '%';
      const m = document.getElementById('progress-msg'); if (m && msg) m.textContent = msg;
      const act = document.getElementById('progress-activity'); if (act && msg) {
        const time = (new Date()).toLocaleTimeString();
        const line = document.createElement('div'); line.textContent = `[${time}] ${msg}`; act.appendChild(line); act.scrollTop = act.scrollHeight;
      }
  }
  function hide() { const e = document.getElementById('progress-overlay'); if (e) e.style.display = 'none'; }
  return { update, hide };
}

// Export pre-rendered entity sprites (from window._ENTITY_BITMAPS) into a JSON mapping of key -> base64 PNG
async function exportEntitySpritesToJSON(download = true) {
  try {
    const cache = window._ENTITY_BITMAPS || {};
    const out = {};
    for (const k of Object.keys(cache)) {
      try {
        const v = cache[k];
        // prepare temporary canvas
        const tmp = document.createElement('canvas');
        const w = (v && v.width) ? v.width : 64;
        const h = (v && v.height) ? v.height : 64;
        tmp.width = w; tmp.height = h;
        const tc = tmp.getContext('2d'); tc.clearRect(0,0,w,h);
        try { tc.drawImage(v, 0, 0, w, h); } catch (e) { /* ignore draw failures */ }
        let data = null;
        try { data = tmp.toDataURL('image/png'); } catch (e) { data = null; }
        out[k] = { key: k, width: w, height: h, dataURI: data };
      } catch (ie) { out[k] = { key: k, error: String(ie) }; }
    }
    if (download) {
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'entity-sprites.json'; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 200);
    }
    return out;
  } catch (e) { console.warn('exportEntitySpritesToJSON err', e); return null; }
}
try { window.exportEntitySpritesToJSON = exportEntitySpritesToJSON; } catch (e) {}

// Export pre-rendered entity sprites as pixel arrays (hex RGBA per pixel) in a JSON structure
async function exportEntitySpritesPixelsJSON(download = true) {
  try {
    const cache = window._ENTITY_BITMAPS || {};
    const out = {};
    for (const k of Object.keys(cache)) {
      try {
        const v = cache[k];
        const w = (v && v.width) ? v.width : 64;
        const h = (v && v.height) ? v.height : 64;
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
        const tc = tmp.getContext('2d'); tc.clearRect(0,0,w,h);
        try { tc.drawImage(v, 0, 0, w, h); } catch (e) {}
        let img = null;
        try { img = tc.getImageData(0,0,w,h); } catch (e) { img = null; }
        if (!img) { out[k] = { key: k, width: w, height: h, pixels: null, error: 'no-image-data' }; continue; }
        const data = img.data;
        const rows = [];
        for (let y = 0; y < h; y++) {
          const row = [];
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) { row.push(null); }
            else {
              const hr = r.toString(16).padStart(2,'0');
              const hg = g.toString(16).padStart(2,'0');
              const hb = b.toString(16).padStart(2,'0');
              const ha = a.toString(16).padStart(2,'0');
              row.push('#' + hr + hg + hb + ha);
            }
          }
          rows.push(row);
        }
        out[k] = { key: k, width: w, height: h, pixels: rows };
      } catch (inner) { out[k] = { key: k, error: String(inner) }; }
    }
    if (download) {
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'entity-sprites-pixels.json'; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 200);
    }
    return out;
  } catch (e) { console.warn('exportEntitySpritesPixelsJSON err', e); return null; }
}
try { window.exportEntitySpritesPixelsJSON = exportEntitySpritesPixelsJSON; } catch (e) {}

// Export selected entity sprites as PNG files: tries POST to local save server, falls back to download
async function exportEntitySpritesPNGs(names, options = {}) {
  try {
    const server = options.server || (window.SPRITE_SERVER_URL || 'http://localhost:3001/save-sprite');
    const doPost = options.post !== undefined ? options.post : true;
    const doDownload = options.download !== undefined ? options.download : true;
    const lib = window.ENTITY_PIXEL_LIBRARY || {};
    const exported = [];
    const toExport = Array.isArray(names) && names.length ? names : Object.keys(lib).filter(k => k.startsWith('tree') || k === 'mountain');
    for (const name of toExport) {
      try {
        let canvas = null;
        // use cached bitmap if present
        if (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS[name]) {
          const bmp = window._ENTITY_BITMAPS[name];
          canvas = document.createElement('canvas'); canvas.width = bmp.width || 32; canvas.height = bmp.height || 32;
          const ctxc = canvas.getContext('2d'); try { ctxc.drawImage(bmp, 0, 0); } catch (e) { /* ignore */ }
        } else if (lib[name]) {
          canvas = window.createCanvasFromPixelDef(lib[name], name, lib[name].grid || 16);
        }
        if (!canvas) continue;
        // get blob
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) continue;
        const dataURI = await new Promise((res) => {
          try { const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height; tmp.getContext('2d').drawImage(canvas,0,0); res(tmp.toDataURL('image/png')); } catch (e) { res(null); }
        });
        // attempt POST
        let posted = false;
        if (doPost && server && server.indexOf('http') === 0) {
          try {
            await fetch(server, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name + '.png', dataURI }) });
            posted = true;
          } catch (e) { posted = false; }
        }
        // fallback: download
        if (!posted && doDownload) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = name + '.png'; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 400);
        }
        exported.push({ name, posted });
      } catch (inner) { console.warn('export sprite err', name, inner); }
    }
    return exported;
  } catch (e) { console.warn('exportEntitySpritesPNGs err', e); return null; }
}
try { window.exportEntitySpritesPNGs = exportEntitySpritesPNGs; } catch (e) {}

// Load entity definitions from `data/entities-defs.json` (merge into runtime)
async function loadEntityDefinitions(progress) {
  try {
    if (progress && progress.update) progress.update(2, 'Cargando definiciones...');
    const path = 'data/entities-defs.json';
    let resp = null;
    try { resp = await fetch(path, { cache: 'no-store' }); } catch (e) { resp = null; }
    if (!resp || !resp.ok) { if (progress && progress.update) progress.update(6, 'Defs: fallback'); window._ENTITY_DEFS = window._ENTITY_DEFS || { buildings: BUILDINGS }; return; }
    const j = await resp.json();
    window._ENTITY_DEFS = window._ENTITY_DEFS || {};
    window._ENTITY_DEFS.buildings = Object.assign({}, BUILDINGS, j.buildings || {});
    window._ENTITY_DEFS.trees = Array.isArray(j.trees) ? j.trees.slice() : (window._ENTITY_DEFS.trees || []);
    window._ENTITY_DEFS.animals = Object.assign({}, j.animals || {});
    try { for (const k in window._ENTITY_DEFS.buildings) BUILDINGS[k] = window._ENTITY_DEFS.buildings[k]; } catch (e) {}
    if (progress && progress.update) progress.update(8, 'Defs cargadas');
  } catch (e) { console.warn('loadEntityDefinitions err', e); }
}

// Import (merge) entity definitions from JSON object (used by editor)
function importEntityDefinitionsFromObject(obj) {
  try {
    if (!obj) return false;
    window._ENTITY_DEFS = window._ENTITY_DEFS || {};
    if (obj.buildings) window._ENTITY_DEFS.buildings = Object.assign({}, window._ENTITY_DEFS.buildings || {}, obj.buildings);
    if (obj.trees) window._ENTITY_DEFS.trees = Array.isArray(obj.trees) ? obj.trees.slice() : (window._ENTITY_DEFS.trees || []);
    if (obj.animals) window._ENTITY_DEFS.animals = Object.assign({}, window._ENTITY_DEFS.animals || {}, obj.animals);
    try { for (const k in window._ENTITY_DEFS.buildings) BUILDINGS[k] = window._ENTITY_DEFS.buildings[k]; } catch (e) {}
    return true;
  } catch (e) { console.warn('importEntityDefinitionsFromObject err', e); return false; }
}
// expose to other windows (editor)
try { window.importEntityDefinitionsFromObject = importEntityDefinitionsFromObject; } catch (e) {}

// Lightweight caches used during runtime preload
window._ICON_BITMAPS = window._ICON_BITMAPS || {};
window.MAP_CHUNKS = window.MAP_CHUNKS || {};
window._ENTITY_BITMAPS = window._ENTITY_BITMAPS || {}; // cached entity sprites
// default densities (modifiable from new-game UI)
window._DEFAULT_DENSITIES = window._DEFAULT_DENSITIES || { npc: 1.0, animals: 1.0, vegetation: 1.0 };
// whether the main game loop is running (menu pauses the loop until user starts)
window._gameStarted = window._gameStarted || false;
// whether the UI panels (topbar/toolbar/main) should be shown — only set true when loading/creating
window._showPanels = window._showPanels || false;
// RTS-style selection state
window._selectedEntities = window._selectedEntities || [];
let _isSelecting = false;
let _selectStart = null; // { sx, sy }
let _selectRect = null; // { x,y,w,h }

// Simple loading overlay (spinner + text) used by several flows
function showLoadingOverlay(text) {
  try {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div'); el.id = 'loading-overlay';
      el.style.position = 'fixed'; el.style.left = '0'; el.style.top = '0'; el.style.right = '0'; el.style.bottom = '0';
      el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
      el.style.background = 'rgba(0,0,0,0.6)'; el.style.zIndex = 120001;
      const box = document.createElement('div');
      box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.alignItems = 'center'; box.style.gap = '10px';
      box.style.background = 'rgba(18,18,18,0.98)'; box.style.color = '#FFD27A'; box.style.padding = '18px 22px'; box.style.borderRadius = '10px'; box.style.fontFamily = 'sans-serif';
      const spinner = document.createElement('div'); spinner.id = 'loading-spinner';
      spinner.style.width = '42px'; spinner.style.height = '42px'; spinner.style.border = '5px solid rgba(255,255,255,0.08)'; spinner.style.borderTopColor = '#FFD27A'; spinner.style.borderRadius = '50%'; spinner.style.animation = 'meso-spin 900ms linear infinite';
      const label = document.createElement('div'); label.id = 'loading-label'; label.textContent = text || '(cargando)'; label.style.fontWeight = '700'; label.style.marginTop = '4px';
      box.appendChild(spinner); box.appendChild(label); el.appendChild(box);
      const style = document.createElement('style'); style.id = 'meso-loading-styles'; style.textContent = '@keyframes meso-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }';
      document.head.appendChild(style);
      document.body.appendChild(el);
    }
    const lbl = document.getElementById('loading-label'); if (lbl) lbl.textContent = text || '(cargando)';
    el.style.display = 'flex';
  } catch (e) { /* ignore */ }
}

// Generate PNG blob URLs and Image objects from cached entity canvases to speed rendering
async function generateSpriteImages(progress) {
  try {
    const cache = window._ENTITY_BITMAPS || {};
    window._SPRITE_URLS = window._SPRITE_URLS || {};
    window._SPRITE_IMAGES = window._SPRITE_IMAGES || {};
    const keys = Object.keys(cache);
    if (keys.length === 0) { if (progress && progress.update) progress.update(60, 'Sprites: none'); return; }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      try {
        if (!cache[k]) continue;
        if (window._SPRITE_IMAGES[k]) continue; // already generated
        if (progress && progress.update) progress.update(Math.floor(60 + (i / Math.max(1, keys.length)) * 30), `Generando sprites... (${i+1}/${keys.length})`);
        const v = cache[k];
        const tmp = document.createElement('canvas'); tmp.width = v.width || 32; tmp.height = v.height || 32;
        const tc = tmp.getContext('2d'); tc.clearRect(0,0,tmp.width,tmp.height);
        try { tc.drawImage(v, 0, 0, tmp.width, tmp.height); } catch (e) {/* ignore draw issues */}

        // Prefer createImageBitmap for fast, GPU-friendly bitmaps
        try {
          if (window.createImageBitmap) {
            const bmp = await createImageBitmap(tmp);
            window._SPRITE_IMAGES[k] = bmp;
            // keep an optional object URL for debug or legacy code, but it's not required
            try { const blob = await new Promise((resolve) => tmp.toBlob(resolve, 'image/png')); if (blob) window._SPRITE_URLS[k] = URL.createObjectURL(blob); } catch (e) {}
          } else {
            // fallback: create an Image element but don't append to DOM
            const blob = await new Promise((resolve) => tmp.toBlob(resolve, 'image/png'));
            if (!blob) continue;
            const url = URL.createObjectURL(blob);
            const img = new Image(); img.src = url; img.dataset.spriteName = k;
            window._SPRITE_IMAGES[k] = img;
            window._SPRITE_URLS[k] = url;
          }
        } catch (e) {
          console.warn('generateSpriteImages: createImageBitmap failed for', k, e);
        }

        // Optional: non-blocking upload/save of dataURI (do not await)
        (async () => {
          try {
            const server = (window.SPRITE_SERVER_URL || 'http://localhost:3001/save-sprite');
            if (server && server.indexOf('http') === 0) {
              try {
                const dataURI = tmp.toDataURL('image/png');
                fetch(server, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: k + '.png', dataURI })
                }).then(r => { if (!r.ok) console.warn('sprite save failed', k, r.status); }).catch(()=>{});
              } catch(e){}
            }
          } catch (e) {}
        })();

      } catch (e) { console.warn('generateSpriteImages error', k, e); }
    }
    if (progress && progress.update) progress.update(95, 'Sprites generados');
  } catch (e) { console.warn('generateSpriteImages err', e); }
}
function hideLoadingOverlay() { try { const el = document.getElementById('loading-overlay'); if (el) el.style.display = 'none'; } catch (e) {} }

// Cache icon canvases into ImageBitmaps for faster draws
async function cacheIcons(progress) {
  try {
    // collect all canvas elements whose id starts with 'icon-' so new icons are auto-detected
    const canvasEls = Array.from(document.querySelectorAll('canvas[id^="icon-"]'));
    if (canvasEls.length === 0) { progress.update(10, 'Iconos: none'); return; }
    const total = canvasEls.length; let i = 0;
    for (const c of canvasEls) {
      i++;
      const id = c.id || ('icon-' + i);
      try {
        // clone to offscreen canvas to avoid altering visible canvas
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
  } catch (e) { /* ignore */ }
}

// Build a simple procedural atlas from cached icons
async function buildSpritesheet(progress) {
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
      try { ax.drawImage(bmp, x + 4, y + 4, size-8, size-8); } catch (e) { /* ignore */ }
      window._ICON_BITMAPS[id+'_atlas_pos'] = { x:x+4, y:y+4, w:size-8, h:size-8 };
      i++; progress.update(30 + (i/keys.length)*10, `Sprites: ${i}/${keys.length}`);
    }
    if (window.createImageBitmap) window._ICON_BITMAPS['_atlas'] = await createImageBitmap(atlas); else window._ICON_BITMAPS['_atlas'] = atlas;
  } catch (e) { /* ignore */ }
}

// Pre-render map into chunks (32x32 tiles) and cache as ImageBitmap/canvas
async function preRenderMapChunks(progress) {
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
          // draw simple tile background from tileBiome (best-effort)
          for (let ty = 0; ty < CHUNK; ty++) {
            for (let tx = 0; tx < CHUNK; tx++) {
              const col = cx * CHUNK + tx; const row = cy * CHUNK + ty;
              if (col >= COLS || row >= ROWS) continue;
              const b = (tileBiome && tileBiome[row] && tileBiome[row][col]) ? tileBiome[row][col] : 'sand';
              // simple color mapping
              let color = '#EBD9B3';
              if (b === 'sand') color = '#EBD9B3'; else if (b === 'dirt') color = '#CFA07A'; else if (b === 'water') color = '#6EA8D7'; else if (b === 'grass') color = '#8BBF7E';
              oc.fillStyle = color; oc.fillRect(tx * TILE, ty * TILE, TILE, TILE);
            }
          }
          // optionally draw buildings inside this chunk for better fidelity
          // iterate grid cells
          for (let ty = 0; ty < CHUNK; ty++) {
            for (let tx = 0; tx < CHUNK; tx++) {
              const col = cx * CHUNK + tx; const row = cy * CHUNK + ty;
              if (col >= COLS || row >= ROWS) continue;
              const cell = grid[row][col];
              if (!cell) continue;
              try {
                // draw base tile if string
                if (typeof cell === 'string') {
                  // nothing extra
                } else if (cell.type) {
                  // draw building icon if available
                  const pos = window._ICON_BITMAPS[cell.type ? ('icon-'+cell.type) : 'icon-house'];
                  if (pos) {
                    // draw a small representation
                    try { oc.fillStyle = '#00000022'; oc.fillRect(tx*TILE+4, ty*TILE+4, TILE-8, TILE-8); } catch (e) {}
                  }
                }
              } catch (e) {}
            }
          }
          // create bitmap
          if (window.createImageBitmap) {
            try { window.MAP_CHUNKS[key] = await createImageBitmap(off); } catch (e) { window.MAP_CHUNKS[key] = off; }
          } else window.MAP_CHUNKS[key] = off;
        } catch (e) { /* ignore chunk failure */ }
        count++; progress.update(45 + (count/total)*50, `Chunks: ${count}/${total}`);
      }
    }
  } catch (e) { /* ignore */ }
}

// Pre-render entities (trees, animals, buildings, NPCs) into offscreen canvases
async function preRenderEntities(progress) {
  try {
    const entries = [];
    // collect placed grid buildings
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c]; if (!cell) continue;
      if (typeof cell === 'string') entries.push({ type: cell, key: 'building:' + cell });
      else if (cell.type) entries.push({ type: cell.type, key: 'building:' + cell.type });
    }
    // runtime entities from entities.js
    try { (window.entities || []).forEach(en => { if (en && en.kind) entries.push({ type: en.kind + (en.variant? (':' + en.variant) : ''), key: 'entity:' + (en.id || (en.kind + '-' + en.col + '-' + en.row)) }); }); } catch (e) {}
    try { (window.rabbits || []).forEach(r => entries.push({ type: 'rabbit', key: 'rabbit:' + r.id })); } catch (e) {}
    try { (window.foxes || []).forEach(f => entries.push({ type: 'fox', key: 'fox:' + f.id })); } catch (e) {}

    // dedupe by key
    const map = {}; entries.forEach(e => { map[e.key] = e; });
    const keys = Object.keys(map); if (keys.length === 0) { progress.update(40, 'Entidades: none'); return; }
    let i = 0; for (const k of keys) {
      i++; const en = map[k]; const id = k.replace(/[:]/g,'_');
      try {
        const off = document.createElement('canvas'); off.width = 64; off.height = 64; const oc = off.getContext('2d');
        // simple placeholder rendering depending on type
        if (en.type.indexOf('tree') !== -1 || en.type.indexOf('tree') === 0) {
          oc.fillStyle = '#3A6B2A'; oc.beginPath(); oc.ellipse(32,22,18,14,0,0,Math.PI*2); oc.fill(); oc.fillStyle = '#5B3E1B'; oc.fillRect(28,28,8,20);
        } else if (en.type.indexOf('rabbit') !== -1 || en.type === 'rabbit') {
          oc.fillStyle = '#DDDDDD'; oc.beginPath(); oc.ellipse(36,34,10,6,0,0,Math.PI*2); oc.fill(); oc.fillStyle='#222'; oc.fillRect(30,30,2,2);
        } else if (en.type.indexOf('fox') !== -1 || en.type === 'fox') {
          oc.fillStyle = '#C85A1A'; oc.beginPath(); oc.ellipse(36,34,11,7,0,0,Math.PI*2); oc.fill();
        } else if (en.type.indexOf('building') !== -1 || en.type.indexOf('house') !== -1) {
          oc.fillStyle = '#C8A84B'; oc.fillRect(16,20,32,24); oc.fillStyle='#7A4F12'; oc.fillRect(14,12,36,12);
        } else {
          // generic dot
          oc.fillStyle = '#FFF'; oc.beginPath(); oc.arc(32,32,8,0,Math.PI*2); oc.fill();
        }
        if (window.createImageBitmap) {
          try { window._ENTITY_BITMAPS[id] = await createImageBitmap(off); } catch (e) { window._ENTITY_BITMAPS[id] = off; }
        } else window._ENTITY_BITMAPS[id] = off;
      } catch (e) {}
      progress.update(40 + (i/keys.length)*10, `Entidades: ${i}/${keys.length}`);
    }
  } catch (e) { /* ignore */ }
}

// Export current entity definitions (buildings, tree variants, animals) as a JSON file
function exportEntityDefinitionsToJSON() {
  try {
    const defs = window._ENTITY_DEFS || { buildings: BUILDINGS, trees: null, animals: null };
    const data = { buildings: defs.buildings || BUILDINGS, trees: defs.trees || null, animals: defs.animals || null };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'entities-defs.json'; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 200);
  } catch (e) { console.warn('exportEntityDefinitionsToJSON err', e); }
}
try { window.exportEntityDefinitionsToJSON = exportEntityDefinitionsToJSON; } catch (e) {}

try { window.loadEntityDefinitions = loadEntityDefinitions; } catch (e) {}

// Wait until entity pixel library is ready (created canvases), resolve early if already available
async function ensureEntityPixelsReady(timeoutMs = 1200) {
  if (window.ENTITY_PIXEL_LIBRARY && Object.keys(window.ENTITY_PIXEL_LIBRARY).length > 0) return true;
  return await new Promise((resolve) => {
    let done = false;
    const onReady = () => { if (done) return; done = true; cleanup(); resolve(true); };
    const cleanup = () => { window.removeEventListener('entityPixelsLoaded', onReady); window.removeEventListener('message', onMessage); if (timer) clearTimeout(timer); };
    const onMessage = (ev) => { try { if (ev && ev.data && ev.data.type === 'entityPixelsLoaded') onReady(); } catch (e) {} };
    window.addEventListener('entityPixelsLoaded', onReady);
    window.addEventListener('message', onMessage);
    const timer = setTimeout(() => { if (done) return; done = true; cleanup(); resolve(!!(window.ENTITY_PIXEL_LIBRARY && Object.keys(window.ENTITY_PIXEL_LIBRARY).length > 0)); }, timeoutMs);
  });
}

// Accept postMessage imports from editor windows
window.addEventListener('message', (ev) => {
  try {
    const d = ev.data; if (!d) return;
    // legacy import from editor: entity definitions
    if (d.type === 'meso.importEntityDefs' && d.data) {
      const ok = importEntityDefinitionsFromObject(d.data);
      try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'meso.importResult', ok: !!ok, msg: ok? 'Imported' : 'Failed' }, '*'); } catch (e) {}
      return;
    }

    // Editor requests current entity-pixels JSON
    if (d.type === 'requestEntityPixels') {
      const data = window.ENTITY_PIXEL_LIBRARY || {};
      try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsData', data }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsData', data }, '*'); }
      return;
    }

    // Editor asks for list of available pixel objects
    if (d.type === 'listEntityPixels') {
      const keys = Object.keys(window.ENTITY_PIXEL_LIBRARY || {});
      try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsList', list: keys }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsList', list: keys }, '*'); }
      return;
    }

    // Editor sends updated pixel definitions to save/replace
    if (d.type === 'saveEntityPixels' && d.data) {
      try {
        const newData = d.data || {};
        // provide a backup download of the previous version for safety
        try {
          const oldData = JSON.stringify(window.ENTITY_PIXEL_LIBRARY || {}, null, 2);
          const blobOld = new Blob([oldData], { type: 'application/json' });
          const aOld = document.createElement('a');
          aOld.href = URL.createObjectURL(blobOld);
          aOld.download = 'entity-pixels.bck.' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
          document.body.appendChild(aOld); aOld.click(); aOld.remove();
        } catch (e) { console.warn('Could not create backup download', e); }

        // update in-memory library and regenerate canvases
        window.ENTITY_PIXEL_LIBRARY = newData.icons || newData;
        for (const k in window.ENTITY_PIXEL_LIBRARY) {
          try { window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[k], k); } catch (e) { console.warn('rebuild icon', k, e); }
        }

        // trigger a save download of the updated JSON so developer can persist the change
        try {
          const blobNew = new Blob([JSON.stringify({ icons: window.ENTITY_PIXEL_LIBRARY }, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blobNew);
          a.download = 'entity-pixels.json';
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e) { console.warn('Could not trigger save download', e); }

        try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsSaved', ok: true }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsSaved', ok: true }, '*'); }
      } catch (err) {
        try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsSaved', ok: false, error: err.message }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsSaved', ok: false, error: err.message }, '*'); }
      }
      return;
    }
  } catch (e) { console.error('message handler error', e); }
});

// Master preload runner
async function preloadAllBeforeStart() {
  const p = showProgressOverlay('Precargando recursos...');
  try {
    p.update(0, 'Iniciando...');
    try { await loadEntityDefinitions(p); } catch (e) { /* ignore */ }
    await cacheIcons(p);
    await buildSpritesheet(p);
    await preRenderEntities(p);
    // generate static sprite images (blob URLs) from pre-rendered canvases to speed runtime draws
    try { p.update(55, 'Generando imágenes de sprites...'); await generateSpriteImages(p); } catch (e) { console.warn('sprite gen failed', e); }
    await preRenderMapChunks(p);
    p.update(99, 'Finalizando...');
    await new Promise(r => setTimeout(r, 120));
  } catch (e) { console.warn('preloadAllBeforeStart err', e); }
  p.hide();
}

// Clear caches used by preload and runtime
function clearRuntimeCaches() {
  try { mapCache = null; mapCacheDirty = true; } catch (e) {}
  try { window.MAP_CHUNKS = {}; } catch (e) {}
  try { window._ICON_BITMAPS = {}; } catch (e) {}
  try {
    // revoke generated sprite blob URLs and remove hidden img nodes
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

  // Check interior doors (enter) when standing on mapped tile
  // Previously auto-entered interiors when standing on door tiles.
  // Entry must now be explicit via the 'E' key to avoid accidental transitions.
}
//  MESOPOTAMIA CITY BUILDER  —  Core engine module (moved from game.js)
// This file is now loaded as an ES module from index.html

import { entities, rabbits, foxes, placeResource, placeRabbit, placeFox, spawnNPC, placeTree } from './entities.js';

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

// create a top-layer DOM overlay for selection marquee so it is visible above panels
try {
  if (!document.getElementById('selection-overlay')) {
    const so = document.createElement('div'); so.id = 'selection-overlay';
    so.style.position = 'fixed'; so.style.left = '0'; so.style.top = '0'; so.style.width = '100%'; so.style.height = '100%';
    so.style.pointerEvents = 'none'; so.style.zIndex = 140000; so.style.display = 'none';
    const box = document.createElement('div'); box.id = 'selection-overlay-box';
    box.style.position = 'absolute'; box.style.border = '2px dashed rgba(70,110,200,0.95)'; box.style.background = 'rgba(80,140,255,0.12)';
    box.style.boxSizing = 'border-box'; box.style.borderRadius = '4px';
    const lbl = document.createElement('div'); lbl.id = 'selection-overlay-label'; lbl.style.position = 'absolute'; lbl.style.left = '6px'; lbl.style.top = '6px'; lbl.style.padding = '2px 6px'; lbl.style.background = 'rgba(0,0,0,0.6)'; lbl.style.color = '#FFF'; lbl.style.font = '12px sans-serif'; lbl.style.borderRadius = '4px';
    box.appendChild(lbl);
    so.appendChild(box);
    document.body.appendChild(so);
  }
} catch (e) {}

function _updateSelectionOverlay(rect) {
  try {
    const so = document.getElementById('selection-overlay');
    const box = document.getElementById('selection-overlay-box');
    const lbl = document.getElementById('selection-overlay-label');
    if (!so || !box || !lbl) return;
    if (!rect) { so.style.display = 'none'; return; }
    so.style.display = 'block';
    box.style.left = rect.x + 'px'; box.style.top = rect.y + 'px'; box.style.width = Math.max(1, rect.w) + 'px'; box.style.height = Math.max(1, rect.h) + 'px';
    const count = window._selectPreviewCount || 0; lbl.textContent = count ? `Seleccionando: ${count}` : 'Seleccionando';
  } catch (e) {}
}

// Global registry for floating panels so the menu can control them
window.FLOATING_PANELS = window.FLOATING_PANELS || {};

function registerPanel(el) {
  if (!el) return;
  if (!el.id) el.id = 'panel-' + Math.random().toString(36).slice(2,8);
  window.FLOATING_PANELS[el.id] = el;
  // ensure panel uses the same cursor as the document/body (custom pixel cursor)
  try {
    const cssCursor = document.body && document.body.style && document.body.style.cursor;
    if (cssCursor) {
      el.style.cursor = cssCursor;
      try {
        // also propagate to common floating panel child containers so background areas match
        const inner = el.querySelectorAll('.floating-body, .meso-menu, .floating-content');
        for (const c of inner) { try { c.style.cursor = cssCursor; } catch (ee) {} }
      } catch (ee) {}
    }
  } catch (e) {}
  // restore panel position/visibility if we loaded a saved state earlier
  try {
    // prefer session-specific panel state (transient) if present
    let saved = null;
    try {
      const sess = sessionStorage.getItem('meso.panelsSession');
      if (sess) {
        const sObj = JSON.parse(sess);
        if (sObj && sObj[el.id]) saved = sObj[el.id];
      }
    } catch (e) { /* ignore session parse errors */ }
    if (!saved) saved = window._MESO_SAVED_STATE && window._MESO_SAVED_STATE.panels && window._MESO_SAVED_STATE.panels[el.id];
    if (saved) {
      if (saved.left) el.style.left = saved.left;
      if (saved.top) el.style.top = saved.top;
      if (saved.display === 'none') el.style.display = 'none';
      // if minimized, hide body when body exists
      const body = el.querySelector && el.querySelector('.floating-body');
      if (body && saved.minimized) body.style.display = 'none';
    }
  } catch (e) { /* ignore */ }
}
// --- Map rendering cache (offscreen) ---
let mapCache = null;
let mapCacheDirty = true;
let _rebuildMapTimer = null;
function rebuildMapCacheDebounced(delay = GRAPHICS_CONFIG.cacheRebuildDelay) {
  if (_rebuildMapTimer) clearTimeout(_rebuildMapTimer);
  _rebuildMapTimer = setTimeout(() => { try { rebuildMapCache(); } catch (e) { console.warn('rebuildMapCache err', e); } }, delay);
}

function rebuildMapCache() {
  // create offscreen canvas sized for current viewMode at current zoom
  // If we're in free mode (not editMode) we prefer per-tile rendering — skip building a cache.
  if (!editMode) { mapCache = null; mapCacheDirty = true; return; }
  const tileSize = getTileSize();
  if (viewMode === 'iso') {
    // compute projected iso extents at current zoom
    const w1 = TILE * zoom;
    const h1 = TILE * zoom * ISO_RATIO;
    function proj1(col, row) { return { x: (col - row) * (w1 / 2), y: (col + row) * (h1 / 2) - h1 / 2 }; }
    const a = proj1(0,0), b = proj1(COLS-1,0), c = proj1(0,ROWS-1), d = proj1(COLS-1,ROWS-1);
    const minX1 = Math.floor(Math.min(a.x,b.x,c.x,d.x) - w1 / 2);
    const maxX1 = Math.ceil(Math.max(a.x,b.x,c.x,d.x) + w1/2);
    const minY1 = Math.floor(Math.min(a.y,b.y,c.y,d.y));
    const maxY1 = Math.ceil(Math.max(a.y,b.y,c.y,d.y) + h1);
    const W = maxX1 - minX1; const H = maxY1 - minY1;
    if (!mapCache || mapCache.width !== W || mapCache.height !== H) {
      mapCache = document.createElement('canvas');
      mapCache.width = Math.max(1, W); mapCache.height = Math.max(1, H);
    }
    const cctx = mapCache.getContext('2d');
    cctx.clearRect(0,0,mapCache.width,mapCache.height);
    // draw tiles into cache
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = proj1(c, r);
        const x = Math.floor(p.x - minX1);
        const y = Math.floor(p.y - minY1);
        const biome = tileBiome[r][c] || 'sand';
        if (biome === 'water' || isRiver(c)) {
          cctx.fillStyle = `hsl(205,60%,${40}%)`;
          // draw diamond
          cctx.beginPath();
          cctx.moveTo(x, y);
          cctx.lineTo(x + w1/2, y + h1/2);
          cctx.lineTo(x, y + h1);
          cctx.lineTo(x - w1/2, y + h1/2);
          cctx.closePath(); cctx.fill();
        } else {
          let fill;
          if (biome === 'forest') fill = '#2E8B2E'; else if (biome === 'hills') fill = '#B8860B'; else if (biome === 'grass') fill = '#9BC17A'; else fill = `rgb(200,165,100)`;
          cctx.fillStyle = fill;
          cctx.beginPath();
          cctx.moveTo(x, y);
          cctx.lineTo(x + w1/2, y + h1/2);
          cctx.lineTo(x, y + h1);
          cctx.lineTo(x - w1/2, y + h1/2);
          cctx.closePath(); cctx.fill();
        }
      }
    }
    mapCache._isoOffset = { minX: minX1, minY: minY1 };
    mapCache._cacheZoom = zoom;
  } else {
    // orthographic cache at tileSize
    const W = COLS * tileSize; const H = ROWS * tileSize;
    if (!mapCache || mapCache.width !== W || mapCache.height !== H) {
      mapCache = document.createElement('canvas');
      mapCache.width = Math.max(1, W); mapCache.height = Math.max(1, H);
    }
    const cctx = mapCache.getContext('2d');
    cctx.clearRect(0,0,mapCache.width,mapCache.height);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * tileSize; const y = r * tileSize;
        const biome = tileBiome[r][c] || 'sand';
        if (biome === 'water' || isRiver(c)) {
          cctx.fillStyle = `hsl(205,60%,40%)`;
          cctx.fillRect(x, y, tileSize, tileSize);
        } else {
          if (biome === 'forest') cctx.fillStyle = '#2E8B2E'; else if (biome === 'hills') cctx.fillStyle = '#B8860B'; else if (biome === 'grass') cctx.fillStyle = '#9BC17A'; else cctx.fillStyle = 'rgb(200,165,100)';
          cctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
    delete mapCache._isoOffset;
    mapCache._cacheZoom = zoom;
  }
  mapCacheDirty = false;
}

// Quick diagnostic overlay to verify the module loaded in-browser
try {
  const diag = document.createElement('div');
  diag.id = 'engine-status';
  diag.textContent = 'Engine: loaded';
  diag.style.position = 'fixed';
  diag.style.right = '8px';
  diag.style.top = '8px';
  diag.style.background = 'rgba(0,0,0,0.6)';
  diag.style.color = '#FFD27A';
  diag.style.padding = '6px 8px';
  diag.style.zIndex = 99999;
  diag.style.fontFamily = 'sans-serif';
  diag.style.fontSize = '12px';
  document.body.appendChild(diag);
} catch (err) { console.error('Could not create diag overlay', err); }

// Global error handlers to surface runtime errors visibly
window.addEventListener('error', function (e) {
  console.error('Unhandled error', e.error || e.message || e);
  try {
    const el = document.getElementById('fatal-error-overlay') || document.createElement('div');
    el.id = 'fatal-error-overlay';
    el.style.position = 'fixed'; el.style.left = '8px'; el.style.top = '8px'; el.style.right = '8px';
    el.style.padding = '10px'; el.style.background = 'rgba(40,0,0,0.9)'; el.style.color = '#fff'; el.style.zIndex = 9999;
    el.style.fontFamily = 'monospace'; el.style.whiteSpace = 'pre-wrap';
    el.textContent = 'FATAL ERROR: ' + (e.error && e.error.stack ? e.error.stack : (e.message || String(e)));
    document.body.appendChild(el);
  } catch (err) { console.error('Error showing overlay', err); }
});
window.addEventListener('unhandledrejection', function (ev) {
  console.error('Unhandled promise rejection', ev.reason);
  try {
    const el = document.getElementById('fatal-error-overlay') || document.createElement('div');
    el.id = 'fatal-error-overlay';
    el.style.position = 'fixed'; el.style.left = '8px'; el.style.top = '8px'; el.style.right = '8px';
    el.style.padding = '10px'; el.style.background = 'rgba(40,0,0,0.9)'; el.style.color = '#fff'; el.style.zIndex = 9999;
    el.style.fontFamily = 'monospace'; el.style.whiteSpace = 'pre-wrap';
    el.textContent = 'UNHANDLED REJECTION: ' + (ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason));
    document.body.appendChild(el);
  } catch (err) { console.error('Error showing overlay', err); }
});

// ── CONFIG ────────────────────────────────────────────────────
const TILE    = 32;          // px per cell
// Visual tuning: scale factor applied to building/artwork drawing (relative to tile size)
const BUILDING_SCALE = 2.2;
// Make the map much larger
const COLS    = 120;
const ROWS    = 80;
// River placement and width (adaptive to COLS)
const RIVER_COL_START = Math.floor(COLS / 3);
const RIVER_WIDTH     = 4;
// Pan sensitivity tweaks
const PAN_SENSITIVITY_X = 1.15; // slightly amplify horizontal pan when feeling small
const PAN_SENSITIVITY_Y = 1.0;
// Graphics / LOD configuration (user-editable via menu)
const GRAPHICS_CONFIG = {
  quality: 'balanced', // 'high' | 'balanced' | 'performance'
  smoothingThreshold: 0.95, // zoom >= -> enable imageSmoothing
  treeSkip: { near: 0.45, mid: 0.75, far: 0.95 }, // skip cutoffs (higher => sparser)
  cacheRebuildDelay: 120
};

// ── RESOURCES ─────────────────────────────────────────────────
const res = { wheat: 50, brick: 40, pop: 0 };

// ── BUILDINGS DEFINITION ──────────────────────────────────────
const BUILDINGS = {
  house:    { name:'Casa',    costBrick:8,  costWheat:3,  prodPop:5,  prodWheat:0, prodBrick:0, color:'#C8A84B', roofColor:'#8B6914', desc:'Aloja 5 habitantes.', size:{ w:2, h:2 } },
  house_small: { name:'Casa pequeña', costBrick:4, costWheat:2, prodPop:2, prodWheat:0, prodBrick:0, color:'#D0B35A', roofColor:'#9B7A2A', desc:'Pequeña vivienda.', size:{ w:1, h:1 } },
  house_large: { name:'Casa grande', costBrick:12, costWheat:4, prodPop:8, prodWheat:0, prodBrick:0, color:'#C8A84B', roofColor:'#7A4F12', desc:'Vivienda grande.', size:{ w:2, h:2 } },
  hut:     { name:'Choza',   costBrick:1, costWheat:0, prodPop:1, prodWheat:0, prodBrick:0, color:'#D9C08A', roofColor:'#F2D16B', desc:'Choza de paja.', size:{ w:1, h:1 } },
  longhouse: { name:'Casa comunal', costBrick:10, costWheat:2, prodPop:6, prodWheat:0, prodBrick:0, color:'#C9B07A', roofColor:'#8A5F2A', desc:'Vivienda larga comunal.', size:{ w:3, h:1 } },
  stone_house: { name:'Casa de piedra', costBrick:14, costWheat:2, prodPop:6, prodWheat:0, prodBrick:0, color:'#9A9EA3', roofColor:'#6E6E6E', desc:'Construcción en piedra.', size:{ w:2, h:2 } },
  farm:     { name:'Granja',  costBrick:1,  costWheat:3,  prodPop:0,  prodWheat:4, prodBrick:0, color:'#4A7C3F', roofColor:'#2E5028', desc:'Produce 4 trigo/turno.' },
  temple:   { name:'Templo',  costBrick:15, costWheat:5,  prodPop:5,  prodWheat:1, prodBrick:1, color:'#E8D5A3', roofColor:'#A0522D', desc:'+5 pop, +1 trigo, +1 ladrillo.' },
  market:   { name:'Mercado', costBrick:8,  costWheat:4,  prodPop:2,  prodWheat:2, prodBrick:2, color:'#D2691E', roofColor:'#8B4513', desc:'+2 trigo, +2 ladrillos.' },
  granary:  { name:'Granero', costBrick:6,  costWheat:0,  prodPop:0,  prodWheat:0, prodBrick:3, color:'#B8860B', roofColor:'#8B6914', desc:'+3 ladrillos/turno.' },
  ziggurat: { name:'Zigurat', costBrick:30, costWheat:10, prodPop:10, prodWheat:3, prodBrick:3, color:'#F5ECD7', roofColor:'#C8A84B', desc:'Maravilla: +10 pop, +3 todo.', size:{ w:4, h:4 } },
};

// House with garden variant
BUILDINGS.house_garden = { name: 'Casa con jardín', costBrick: 12, costWheat: 3, prodPop: 5, prodWheat:0, prodBrick:0, color:'#C8A84B', roofColor:'#E04A3F', desc:'Casa con pequeño jardín.', size: { w:2, h:2 } };

// Road definition: small footprint, player-can-build
BUILDINGS.road = { name: 'Camino', costBrick:0, costWheat:0, prodPop:0, prodWheat:0, prodBrick:0, color:'#8B7B5B', roofColor:'#8B7B5B', desc:'Conecta edificios.', size: { w:1, h:1 } };

// Tower building for sandbox + tower-defense playstyle
BUILDINGS.tower = { name: 'Torre', costBrick:6, costWheat:0, prodPop:0, prodWheat:0, prodBrick:0, color:'#6B6B6B', roofColor:'#444444', desc:'Torre defensiva: ataca enemigos cercanos.', size:{ w:1, h:1 }, attackRange:5, attackDmg:5, attackCooldown:800 };

// ── GRID ──────────────────────────────────────────────────────
const grid = Array.from({length:ROWS}, () => Array(COLS).fill(null));

// ── STATE ─────────────────────────────────────────────────────
let selectedTool = null;   // building type or 'demolish'
let turn = 1;
let hoverCell = null;
// utility globals for effects and NPC villages
window.floatingTexts = window.floatingTexts || [];
window.effectParticles = window.effectParticles || [];
window._VILLAGES = window._VILLAGES || [];
window._LAST_VILLAGE_ID = window._LAST_VILLAGE_ID || null;

window.spawnFloatingText = function(worldX, worldY, text, colorOrOpts) {
  try {
    // backward-compatible args: colorOrOpts can be a color string or an options object { color, force }
    let color = '#FFF'; let force = false;
    if (typeof colorOrOpts === 'object' && colorOrOpts !== null) { color = colorOrOpts.color || '#FFF'; force = !!colorOrOpts.force; }
    else if (typeof colorOrOpts === 'string') color = colorOrOpts;

    // If not forced, avoid showing floating text for non-NPC/non-player entities accidentally
    if (!force && Array.isArray(window.entities)) {
      const ent = window.entities.find(e => e && (typeof e.col === 'number' || typeof e.row === 'number') && Math.abs((e.col || e.x) - worldX) < 0.6 && Math.abs((e.row || e.y) - worldY) < 0.6);
      if (ent) {
        // allow only player-like entities and explicit NPC ids
        const isNpcId = ent.id && String(ent.id).indexOf('npc-') === 0;
        const isPlayerKind = ent.kind === 'player';
        if (!isNpcId && !isPlayerKind) return; // ignore for trees/rabbits/resources
      }
    }

    // store world coordinates and project each frame so text follows moving entities
    window.floatingTexts.push({ born: Date.now(), life: 2600, worldX: worldX, worldY: worldY, yv: -0.35, color: color || '#FFF', text });
  } catch (e) { }
};

// Tile biomes
const tileBiome = Array.from({length:ROWS}, () => Array(COLS).fill('sand'));
// Heightmap for gentle hills/mountains (0..1)
const heightMap = Array.from({length:ROWS}, () => Array(COLS).fill(0));

// Draw a layered mountain background using the heightMap as source of peaks
function drawMountainsBackground(ctx, W, H) {
  try {
    // compute column-wise peak from heightMap
    const peaks = new Array(COLS).fill(0);
    for (let c = 0; c < COLS; c++) {
      let m = 0;
      for (let r = 0; r < ROWS; r++) m = Math.max(m, (heightMap[r] && heightMap[r][c]) ? heightMap[r][c] : 0);
      peaks[c] = m;
    }
    // sample down to ~80 samples to avoid excessive path points
    const samples = [];
    const step = Math.max(1, Math.floor(COLS / 80));
    for (let i = 0; i < COLS; i += step) samples.push(peaks[i]);

    const layers = [ { off: 0.18, height: 0.30, color: 'rgba(30,36,40,0.85)' },
                     { off: 0.28, height: 0.42, color: 'rgba(55,52,50,0.78)' },
                     { off: 0.42, height: 0.62, color: 'rgba(96,92,86,0.9)' } ];

    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      ctx.save();
      const baseY = Math.round(H * L.off);
      ctx.beginPath();
      // start off-canvas left
      ctx.moveTo(-50, H + 20);
      // draw peaks across width
      for (let i = 0; i < samples.length; i++) {
        const t = i / Math.max(1, samples.length - 1);
        const x = Math.round(t * (W + 100) - 50);
        const peak = samples[i] || 0;
        const y = Math.round(baseY - peak * H * L.height);
        // smooth curve using quadratic to previous point
        if (i === 0) ctx.lineTo(x, y);
        else ctx.quadraticCurveTo(x - Math.round((W / samples.length) * 0.5), y + Math.round(H * 0.02), x, y);
      }
      // close polygon to bottom
      ctx.lineTo(W + 50, H + 20);
      ctx.closePath();
      // gradient fill for layer
      const g = ctx.createLinearGradient(0, baseY - H * L.height, 0, H);
      try { g.addColorStop(0, L.color); g.addColorStop(1, 'rgba(8,6,4,0.0)'); } catch (e) {}
      ctx.fillStyle = g;
      ctx.fill();
      // light ridge
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  } catch (e) { /* ignore drawing errors */ }
}


// Rabbits stored in `engine/entities.js`

// ── CHARACTER ─────────────────────────────────────────────────
const char = {
  hp: 100, maxHp: 100,
  ap: 8,   maxAp: 10,
  xp: 0,   xpNext: 100,
  level: 1,
  special: { FUE:6, PER:7, RES:5, CAR:8, INT:7, AGI:5, SUE:6 }
};

const STORAGE_CHAR_KEY = 'meso.characterId';
const STORAGE_CHAR_MODE = 'meso.characterMode';
const STORAGE_CHAR_CUSTOM = 'meso.characterCustom';
let startLocked = true;
let editMode = true;

// App-wide state persistence key
const APP_STATE_KEY = 'meso.appState';

// Debounced save helper
let _saveTimer = null;
function saveAppStateDebounced(delay = 250) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { try { saveAppState(); } catch (e) {} }, delay);
}

function saveAppState() {
  try {
    const panels = {};
    Object.keys(window.FLOATING_PANELS || {}).forEach(id => {
      try {
        const p = window.FLOATING_PANELS[id];
        const body = p.querySelector && p.querySelector('.floating-body');
        panels[id] = {
          left: p.style.left || null,
          top: p.style.top || null,
          display: (p.style.display === 'none') ? 'none' : 'block',
          minimized: body ? (body.style.display === 'none') : false
        };
      } catch (e) {}
    });
    // Save minimal grid and biomes (sparse) to reduce size: store full arrays for simplicity
    const state = {
      panels,
      player: { x: player.x, y: player.y, col: player.col, row: player.row, name: player.name, palette: player.palette, presetId: player.presetId },
      char: (typeof char !== 'undefined') ? char : null,
      res: (typeof res !== 'undefined') ? res : null,
      // keep turn and flags
      turn: typeof turn === 'number' ? turn : 0,
      startLocked: !!startLocked,
      editMode: !!editMode,
      camera: { camX: camX, camY: camY, zoom: zoom },
      selectedTool: selectedTool,
      tileBiome,
      grid,
      // persist entities and runtime lists so world persists exactly
      entities: (typeof entities !== 'undefined' && Array.isArray(entities)) ? entities.map(e => ({ ...e })) : [],
      rabbits: (typeof rabbits !== 'undefined' && Array.isArray(rabbits)) ? rabbits.map(r => ({ ...r })) : [],
      foxes: (typeof foxes !== 'undefined' && Array.isArray(foxes)) ? foxes.map(f => ({ ...f })) : [],
      enemies: (typeof enemies !== 'undefined' && Array.isArray(enemies)) ? enemies.map(en => ({ ...en })) : [],
      effectParticles: (typeof effectParticles !== 'undefined' && Array.isArray(effectParticles)) ? effectParticles.map(p => ({ ...p })) : [],
      floatingTexts: (typeof window.floatingTexts !== 'undefined' && Array.isArray(window.floatingTexts)) ? window.floatingTexts.map(t => ({ ...t })) : [],
      villages: (window._VILLAGES && Array.isArray(window._VILLAGES)) ? window._VILLAGES.map(v => ({ ...v })) : []
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    // Also save transient panel visibility/position to sessionStorage so it survives reloads in this session
    try { sessionStorage.setItem('meso.panelsSession', JSON.stringify(panels)); } catch (e) { /* ignore */ }
  } catch (err) { /* ignore */ }
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s) return null;
    // restore biomes and grid if present (be tolerant of older/smaller saves)
    try {
      if (s.tileBiome && Array.isArray(s.tileBiome)) {
        const copyRows = Math.min(ROWS, s.tileBiome.length);
        for (let r = 0; r < copyRows; r++) {
          const row = Array.isArray(s.tileBiome[r]) ? s.tileBiome[r].slice(0, COLS) : Array(COLS).fill('sand');
          // ensure row has COLS entries
          while (row.length < COLS) row.push('sand');
          tileBiome[r] = row;
        }
        for (let r = copyRows; r < ROWS; r++) tileBiome[r] = Array(COLS).fill('sand');
      }
    } catch (e) { console.warn('tileBiome restore skipped due to malformed data', e); }

    try {
      if (s.grid && Array.isArray(s.grid)) {
        const copyRows = Math.min(ROWS, s.grid.length);
        for (let r = 0; r < copyRows; r++) {
          const row = Array.isArray(s.grid[r]) ? s.grid[r].slice(0, COLS) : Array(COLS).fill(null);
          while (row.length < COLS) row.push(null);
          grid[r] = row;
        }
        for (let r = copyRows; r < ROWS; r++) grid[r] = Array(COLS).fill(null);
      }
    } catch (e) { console.warn('grid restore skipped due to malformed data', e); }
    // restore player pos if present
    if (s.player && typeof s.player.x === 'number') {
      player.x = s.player.x; player.y = s.player.y; player.col = Math.floor(s.player.x); player.row = Math.floor(s.player.y);
      try { if (s.player.name) player.name = s.player.name; } catch (e) {}
      try { if (s.player.palette) player.palette = s.player.palette; } catch (e) {}
      try { if (s.player.presetId) player.presetId = s.player.presetId; } catch (e) {}
    }
      // restore entities and rabbits if present
      try {
        if (s.entities && Array.isArray(s.entities)) {
          entities.length = 0;
          s.entities.forEach(e => {
            if (!e || typeof e !== 'object') return;
            const it = { ...e };
            if (typeof it.col !== 'number') {
              if (typeof it.x === 'number') it.col = Math.floor(it.x);
              else it.col = 0;
            }
            if (typeof it.row !== 'number') {
              if (typeof it.y === 'number') it.row = Math.floor(it.y);
              else it.row = 0;
            }
            it.x = typeof it.x === 'number' ? it.x : it.col;
            it.y = typeof it.y === 'number' ? it.y : it.row;
            entities.push(it);
          });
        }
        if (s.rabbits && Array.isArray(s.rabbits)) {
          rabbits.length = 0;
          s.rabbits.forEach(r => {
            if (!r || typeof r !== 'object') return;
            const it = { ...r };
            if (typeof it.col !== 'number') {
              if (typeof it.x === 'number') it.col = Math.floor(it.x);
              else it.col = 0;
            }
            if (typeof it.row !== 'number') {
              if (typeof it.y === 'number') it.row = Math.floor(it.y);
              else it.row = 0;
            }
            it.x = typeof it.x === 'number' ? it.x : it.col;
            it.y = typeof it.y === 'number' ? it.y : it.row;
            rabbits.push(it);
          });
        }
        // restore foxes, enemies and transient lists if present
        if (s.foxes && Array.isArray(s.foxes)) {
          try {
            foxes.length = 0;
            s.foxes.forEach(f => {
              if (!f || typeof f !== 'object') return;
              const it = { ...f };
              if (typeof it.col !== 'number') { if (typeof it.x === 'number') it.col = Math.floor(it.x); else it.col = 0; }
              if (typeof it.row !== 'number') { if (typeof it.y === 'number') it.row = Math.floor(it.y); else it.row = 0; }
              it.x = typeof it.x === 'number' ? it.x : it.col;
              it.y = typeof it.y === 'number' ? it.y : it.row;
              foxes.push(it);
            });
          } catch (e) { console.warn('foxes restore error', e); }
        }
        if (s.enemies && Array.isArray(s.enemies)) {
          try { enemies.length = 0; s.enemies.forEach(en => { if (!en || typeof en !== 'object') return; enemies.push({ ...en }); }); } catch (e) { console.warn('enemies restore error', e); }
        }
        if (s.effectParticles && Array.isArray(s.effectParticles)) {
          try { effectParticles.length = 0; s.effectParticles.forEach(p => effectParticles.push({ ...p })); } catch (e) {}
        }
        if (s.floatingTexts && Array.isArray(s.floatingTexts)) {
          try { window.floatingTexts.length = 0; s.floatingTexts.forEach(t => window.floatingTexts.push({ ...t })); } catch (e) {}
        }
        if (s.villages && Array.isArray(s.villages)) {
          try { window._VILLAGES = s.villages.map(v => ({ ...v })); } catch (e) { window._VILLAGES = window._VILLAGES || []; }
        }
      } catch (e) { /* ignore restore errors */ }
    // restore panels metadata later when panels are registered
    window._MESO_SAVED_STATE = s;
    // restore camera/other top-level pieces (deferred application in init)
    try {
      if (s.camera) {
        camX = typeof s.camera.camX === 'number' ? s.camera.camX : camX;
        camY = typeof s.camera.camY === 'number' ? s.camera.camY : camY;
        zoom = typeof s.camera.zoom === 'number' ? s.camera.zoom : zoom;
      }
      if (s.char) try { window.char = s.char; } catch (e) {}
      if (s.res) try { window.res = s.res; } catch (e) {}
      if (s.selectedTool) try { selectedTool = s.selectedTool; } catch (e) {}
      // restore other top-level flags
      try { if (typeof s.turn === 'number') turn = s.turn; } catch (e) {}
      try { startLocked = !!s.startLocked; } catch (e) {}
      try { editMode = (typeof s.editMode !== 'undefined') ? s.editMode : editMode; } catch (e) {}
    } catch (e) {}
    return s;
  } catch (err) { return null; }
}

// Export current game state to a downloadable JSON file
function exportGameToFile() {
  try {
    // ensure latest app state saved
    try { saveAppState(); } catch (e) {}
    const base = JSON.parse(localStorage.getItem(APP_STATE_KEY) || '{}');
    const data = {
      meta: { exportedAt: (new Date()).toISOString(), version: 1 },
      appState: base,
      player: { x: player.x, y: player.y, col: player.col, row: player.row },
      char,
      turn,
      res,
      grid,
      tileBiome,
      entities: entities || [],
      rabbits: rabbits || [],
      foxes: foxes || [],
      enemies: enemies || [],
      effectParticles: effectParticles || [],
      floatingTexts: window.floatingTexts || [],
      villages: window._VILLAGES || [],
      camera: { camX, camY, zoom },
      selectedTool,
      FLOATING_PANELS: Object.keys(window.FLOATING_PANELS || {})
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `meso-save-${ts}.json`;
    // create a temporary anchor to trigger download
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { document.body.removeChild(a); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, 1000);
    notify('Partida exportada');
  } catch (err) {
    console.error('export error', err);
    notify('Error exportando partida');
  }
}

// Import a save object (JS object) into the running game
function importGameFromObject(data) {
  try {
    if (!data || typeof data !== 'object') throw new Error('Invalid save');
    if (!confirm('Importar partida: esto sobrescribirá el estado actual. ¿Continuar?')) return;
    // If save contains appState, persist and apply
    if (data.appState) {
      try { localStorage.setItem(APP_STATE_KEY, JSON.stringify(data.appState)); } catch (e) {}
      // apply sparse structures (tolerant copy)
      const s = data.appState;
      try {
        if (s.tileBiome && Array.isArray(s.tileBiome)) {
          const copyRows = Math.min(ROWS, s.tileBiome.length);
          for (let r = 0; r < copyRows; r++) {
            const row = Array.isArray(s.tileBiome[r]) ? s.tileBiome[r].slice(0, COLS) : Array(COLS).fill('sand');
            while (row.length < COLS) row.push('sand');
            tileBiome[r] = row;
          }
          for (let r = copyRows; r < ROWS; r++) tileBiome[r] = Array(COLS).fill('sand');
        }
      } catch (e) { console.warn('import tileBiome skipped malformed', e); }
      try {
        if (s.grid && Array.isArray(s.grid)) {
          const copyRows = Math.min(ROWS, s.grid.length);
          for (let r = 0; r < copyRows; r++) {
            const row = Array.isArray(s.grid[r]) ? s.grid[r].slice(0, COLS) : Array(COLS).fill(null);
            while (row.length < COLS) row.push(null);
            grid[r] = row;
          }
          for (let r = copyRows; r < ROWS; r++) grid[r] = Array(COLS).fill(null);
        }
      } catch (e) { console.warn('import grid skipped malformed', e); }
      try { if (s.player && typeof s.player.x === 'number') { player.x = s.player.x; player.y = s.player.y; player.col = Math.floor(s.player.x); player.row = Math.floor(s.player.y); } } catch (e) {}
      // keep for panel restore
      window._MESO_SAVED_STATE = s;
    }
    // apply other top-level pieces if present
    if (data.player && typeof data.player.x === 'number') { player.x = data.player.x; player.y = data.player.y; player.col = Math.floor(data.player.x); player.row = Math.floor(data.player.y); }
    if (data.char) { try { window.char = data.char; } catch (e) {} }
    if (data.turn !== undefined) try { turn = data.turn; } catch (e) {}
    if (data.res) try { res = data.res; } catch (e) {}
    if (Array.isArray(data.entities)) {
      try {
        entities.length = 0;
        data.entities.forEach(e => {
          if (!e || typeof e !== 'object') return;
          const it = { ...e };
          if (typeof it.col !== 'number') { if (typeof it.x === 'number') it.col = Math.floor(it.x); else it.col = 0; }
          if (typeof it.row !== 'number') { if (typeof it.y === 'number') it.row = Math.floor(it.y); else it.row = 0; }
          it.x = typeof it.x === 'number' ? it.x : it.col;
          it.y = typeof it.y === 'number' ? it.y : it.row;
          entities.push(it);
        });
      } catch (e) { console.warn('import entities error', e); }
    }
    if (Array.isArray(data.rabbits)) {
      try {
        rabbits.length = 0;
        data.rabbits.forEach(r => {
          if (!r || typeof r !== 'object') return;
          const it = { ...r };
          if (typeof it.col !== 'number') { if (typeof it.x === 'number') it.col = Math.floor(it.x); else it.col = 0; }
          if (typeof it.row !== 'number') { if (typeof it.y === 'number') it.row = Math.floor(it.y); else it.row = 0; }
          it.x = typeof it.x === 'number' ? it.x : it.col;
          it.y = typeof it.y === 'number' ? it.y : it.row;
          rabbits.push(it);
        });
      } catch (e) { console.warn('import rabbits error', e); }
    }
    if (Array.isArray(data.foxes)) {
      try {
        foxes.length = 0;
        data.foxes.forEach(f => {
          if (!f || typeof f !== 'object') return;
          const it = { ...f };
          if (typeof it.col !== 'number') { if (typeof it.x === 'number') it.col = Math.floor(it.x); else it.col = 0; }
          if (typeof it.row !== 'number') { if (typeof it.y === 'number') it.row = Math.floor(it.y); else it.row = 0; }
          it.x = typeof it.x === 'number' ? it.x : it.col;
          it.y = typeof it.y === 'number' ? it.y : it.row;
          foxes.push(it);
        });
      } catch (e) { console.warn('import foxes error', e); }
    }
    if (Array.isArray(data.enemies)) { try { enemies.length = 0; data.enemies.forEach(en => { if (!en || typeof en !== 'object') return; enemies.push({ ...en }); }); } catch (e) { console.warn('import enemies error', e); } }
    if (Array.isArray(data.effectParticles)) { try { effectParticles.length = 0; data.effectParticles.forEach(it => effectParticles.push({ ...it })); } catch (e) { console.warn('import effectParticles error', e); } }
    if (Array.isArray(data.floatingTexts)) { try { window.floatingTexts.length = 0; data.floatingTexts.forEach(it => window.floatingTexts.push({ ...it })); } catch (e) { console.warn('import floatingTexts error', e); } }
    if (Array.isArray(data.villages)) { try { window._VILLAGES = data.villages.map(v => ({ ...v })); } catch (e) { console.warn('import villages error', e); } }
    if (data.camera) {
      try { camX = typeof data.camera.camX === 'number' ? data.camera.camX : camX; camY = typeof data.camera.camY === 'number' ? data.camera.camY : camY; zoom = typeof data.camera.zoom === 'number' ? data.camera.zoom : zoom; } catch (e) {}
    }
    if (data.selectedTool) selectedTool = data.selectedTool;

    // persist and rebuild derived caches
    try { saveAppState(); } catch (e) {}
    mapCacheDirty = true; rebuildMapCacheDebounced();

    // restore panel positions/visibility on already-registered panels
    try {
      if (window._MESO_SAVED_STATE && window._MESO_SAVED_STATE.panels) {
        Object.keys(window.FLOATING_PANELS || {}).forEach(id => {
          const p = window.FLOATING_PANELS[id];
          const saved = window._MESO_SAVED_STATE.panels[id];
          if (!p || !saved) return;
          if (saved.left) p.style.left = saved.left;
          if (saved.top) p.style.top = saved.top;
          p.style.display = saved.display === 'none' ? 'none' : 'block';
          const body = p.querySelector && p.querySelector('.floating-body');
          if (body) body.style.display = saved.minimized ? 'none' : 'block';
        });
      }
    } catch (e) {}

    notify('Partida importada');
  } catch (err) {
    console.error('import error', err);
    notify('Error importando partida');
  }
}

const DEFAULT_PALETTE = {
  skin: '#C8956C',
  hair: '#2C1A0A',
  cloth: '#8B6914',
  trim: '#DAA520'
};

const CHARACTER_PRESETS = [
  { id:'scribe', name:'Ninsun', title:'Escriba', classId:'scribe', palette:{ skin:'#CFA07A', hair:'#2C1A0A', cloth:'#2E6FA3', trim:'#DAA520' } },
  { id:'scout', name:'Kishar', title:'Explorador', classId:'scout', palette:{ skin:'#C79063', hair:'#3D2510', cloth:'#4A7C3F', trim:'#C8A84B' } },
  { id:'builder', name:'Urim', title:'Maestro de obras', classId:'builder', palette:{ skin:'#D2A178', hair:'#1A1208', cloth:'#A0522D', trim:'#E8D5A3' } },
  { id:'priest', name:'Enhedu', title:'Sacerdote', classId:'priest', palette:{ skin:'#CFA07A', hair:'#3A2612', cloth:'#F5ECD7', trim:'#8B6914' } },
  { id:'merchant', name:'Tamar', title:'Mercader', classId:'merchant', palette:{ skin:'#C8956C', hair:'#2B1C12', cloth:'#D2691E', trim:'#C8A84B' } }
];

const BASE_SPECIAL = { FUE:6, PER:7, RES:5, CAR:8, INT:7, AGI:5, SUE:6 };

const CHARACTER_CLASSES = [
  { id:'builder', name:'Constructor', title:'Maestro de obras', bonus:{ FUE:2, RES:1 } },
  { id:'scribe', name:'Escriba', title:'Custodio de saber', bonus:{ INT:2, PER:1 } },
  { id:'priest', name:'Sacerdote', title:'Voz del templo', bonus:{ CAR:2, SUE:1 } },
  { id:'scout', name:'Explorador', title:'Ojos del desierto', bonus:{ AGI:2, PER:1 } },
  { id:'merchant', name:'Mercader', title:'Señor de tratos', bonus:{ CAR:2, INT:1 } }
];

const PALETTE_OPTIONS = {
  skin: ['#C8956C', '#CFA07A', '#D2A178', '#B7835E'],
  hair: ['#2C1A0A', '#3D2510', '#1A1208', '#5A3A1A'],
  cloth: ['#8B6914', '#2E6FA3', '#4A7C3F', '#A0522D', '#D2691E'],
  trim: ['#DAA520', '#C8A84B', '#E8D5A3', '#F5ECD7']
};

const player = {
  col: 14,
  row: 12,
  name: 'Ur-Nammu',
  title: 'Rey de Sumer',
  palette: DEFAULT_PALETTE,
  presetId: null
};
// survival stats stored on char; ensure defaults
try {
  char.hunger = typeof char.hunger === 'number' ? char.hunger : 100;
  char.thirst = typeof char.thirst === 'number' ? char.thirst : 100;
  char.maxHunger = typeof char.maxHunger === 'number' ? char.maxHunger : 100;
  char.maxThirst = typeof char.maxThirst === 'number' ? char.maxThirst : 100;
  // decay rates per second
  window.SURVIVAL_HUNGER_RATE = window.SURVIVAL_HUNGER_RATE || 0.05; // hunger per second
  window.SURVIVAL_THIRST_RATE = window.SURVIVAL_THIRST_RATE || 0.08; // thirst per second
  char._lastSurvivalTick = char._lastSurvivalTick || Date.now();
} catch (e) {}
player.weapon = null; // equipped weapon id (optional)

// Initialize continuous position and movement fields
player.x = player.col;
player.y = player.row;
player.vx = 0;
player.vy = 0;
player.speed = 6 / TILE; // tiles per second
player._baseSpeed = player.speed;
// animation / facing defaults
player.dir = 'down';
player._walkTime = 0;
player._walkFrame = 0;

// Input & movement state (missing globals causing runtime errors)
let keyState = {};
let movePath = null;   // current A* path (array of nodes) or null
let moveTarget = null; // simple x/y target when not using path

// Player inventory (items gathered, keyed by item id)
let inventory = {};

// Build-drag state for edit-mode multi-tile placement
let isBuildDragging = false;
let buildDragStart = null; // {col,row} when drag started
let buildDragRect = null;  // {minC,maxC,minR,maxR}

const ACTIONS = [
  { id:'explore', name:'Explorar', cost:1, desc:'Encuentra recursos o rutas ocultas.' },
  { id:'gather', name:'Recolectar', cost:1, desc:'Recolecta trigo o ladrillos cercanos.' },
  { id:'build', name:'Construir', cost:1, desc:'Activa el modo edicion para construir.' },
  { id:'trade', name:'Comerciar', cost:1, desc:'Intercambia recursos en el mercado.' },
  { id:'ritual', name:'Ritual', cost:2, desc:'Invoca un bonus de poblacion.' },
  { id:'study', name:'Investigar', cost:2, desc:'Gana experiencia y mejora un atributo.' },
  { id:'hunt', name:'Cazar', cost:1, desc:'Caza animales salvajes cercanos.' }
];

// add attack action for PvP/hostile interactions
ACTIONS.push({ id:'attack', name:'Atacar', cost:1, desc:'Ataca jugador o animal cercano.' });

// ── CAMERA / PAN ──────────────────────────────────────────────
let camX = 0, camY = 0;
let isPanning = false, panStartX = 0, panStartY = 0, camStartX = 0, camStartY = 0;
let isZooming = false, zoomStartY = 0, zoomStart = 1;
  // camera smoothing / inertia
  let camVX = 0, camVY = 0;
  let lastMouseX = 0, lastMouseY = 0, lastMouseTime = 0;
  let followPlayer = false; // if true camera follows player
  const FOLLOW_SMOOTH = 0.16;
let targetCam = null; // {x,y} for smooth centering
let fitTransition = null; // { startZoom, targetZoom, startTime, duration }
let zoom = 1;
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 2.5;
let viewMode = 'ortho';
let panMode = false;
const ISO_RATIO = 0.6;
let lastFrameTime = Date.now();
let frameCounter = 0;
let lastSavePosTime = 0;
// Right-button drag/zoom state
let rightDown = false, rightDownX = 0, rightDownY = 0, rightMoved = false;
// Day-night cycle
const DAY_SECONDS = 120; // one in-game day = 120 real seconds
let dayHour = 8.0; // 0-24
let prevDayHour = dayHour;
let dayCount = 1;

// ═══════════════════════════════════════════════════════════════
//  PIXEL-ART ICON DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════
function drawPixelArt(ctx, pixels, scale) {
  pixels.forEach(([x, y, c]) => {
    ctx.fillStyle = c;
    ctx.fillRect(x*scale, y*scale, scale, scale);
  });
}

// Create a small canvas from a pixel-definition object and register it in icon/entity caches
window.createCanvasFromPixelDef = function(def, name, targetScale = 32) {
  try {
    const grid = def.grid || 9;
    const pixels = def.pixels || [];
    const scale = Math.max(1, Math.floor(targetScale / grid));
    const canvas = document.createElement('canvas');
    canvas.width = grid * scale; canvas.height = grid * scale;
    const c = canvas.getContext('2d');
    c.clearRect(0,0,canvas.width, canvas.height);
    pixels.forEach(([x,y,color]) => { if (color) { c.fillStyle = color; c.fillRect(x*scale, y*scale, scale, scale); }});
    window._ICON_BITMAPS = window._ICON_BITMAPS || {};
    window._ENTITY_BITMAPS = window._ENTITY_BITMAPS || {};
    window._ICON_BITMAPS[name] = canvas;
    window._ENTITY_BITMAPS[name] = canvas;
    return canvas;
  } catch (e) { console.error('createCanvasFromPixelDef error', e); }
}

const CHARACTER_MAP = [
  '..hh....',
  '.hhhh...',
  '.hsshh..',
  '.ssss...',
  '..cccc..',
  '..ctcc..',
  '..c..c..',
  '.cc..cc.'
];

  // drawCharacterPixels supports optional direction flip and a simple two-frame walk animation
function drawCharacterPixels(ctx, palette, x, y, scale, opts) {
  opts = opts || {};
  const dir = opts.dir || 'down'; // 'down','up','left','right'
  const frame = opts.frame || 0; // 0 or 1 (walking)
  // inverted horizontal axis: flip when facing 'right' instead of 'left'
  const flip = dir === 'right';
  const maxRow = opts.headOnly ? Math.min(CHARACTER_MAP.length, 4) : CHARACTER_MAP.length;
  for (let row = 0; row < maxRow; row++) {
    const line = CHARACTER_MAP[row];
    for (let col = 0; col < line.length; col++) {
      // compute source column (flipped if facing left)
      const srcCol = flip ? (line.length - 1 - col) : col;
      const ch = line[srcCol];
      let color = null;
      if (ch === 'h') color = palette.hair;
      if (ch === 's') color = palette.skin;
      if (ch === 'c') color = palette.cloth;
      if (ch === 't') color = palette.trim;
      if (!color) continue;

      // Simple walk frame: shift lower body pixels horizontally by 1 pixel when frame=1
      let dx = 0;
      if (frame === 1 && (row === 6 || row === 7) && (ch === 'c' || ch === 's')) {
        // invert horizontal axis: reverse sign so stepping matches flipped sprite
        dx = (dir === 'right') ? -1 : (dir === 'left' ? 1 : 0);
      }

      ctx.fillStyle = color;
      ctx.fillRect(x + (col * scale) + dx * scale, y + row * scale, scale, scale);
    }
  }
}

function toggleInventory() {
  const p = document.getElementById('inventory-panel');
  if (!p) return;
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  updateInventory();
}

function drawCharacterPortrait(ctx, w, h, palette) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1A1208';
  ctx.fillRect(0, 0, w, h);
  const scale = Math.floor(Math.min(w, h) / 10);
  const spriteW = CHARACTER_MAP[0].length * scale;
  const spriteH = CHARACTER_MAP.length * scale;
  const px = Math.floor((w - spriteW) / 2);
  const py = Math.floor((h - spriteH) / 2);
  drawCharacterPixels(ctx, palette, px, py, scale);
}

// Draw an icon by name using loaded pixel-library or cached icon canvases
function drawRegisteredIcon(ctx, name, w, h) {
  try {
    // prefer pre-generated sprite images (blob URLs attached to hidden Image elements)
    if (window._SPRITE_IMAGES && window._SPRITE_IMAGES[name]) {
      const img = window._SPRITE_IMAGES[name];
      if (img && img.complete) { ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, w, h); return; }
    }
    // prefer prebuilt cached canvases
    if (window._ICON_BITMAPS && window._ICON_BITMAPS[name]) {
      const img = window._ICON_BITMAPS[name];
      ctx.clearRect(0,0,w,h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      return;
    }
    // try entity bitmap cache
    if (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS[name]) {
      const img = window._ENTITY_BITMAPS[name];
      ctx.clearRect(0,0,w,h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      return;
    }
    // try raw pixel definitions library
    if (window.ENTITY_PIXEL_LIBRARY && window.ENTITY_PIXEL_LIBRARY[name]) {
      const c = window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[name], name, Math.min(w,h));
      if (c) { ctx.clearRect(0,0,w,h); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, w, h); return; }
    }
    // fallback: clear
    ctx.clearRect(0,0,w,h);
  } catch (e) { console.warn('drawRegisteredIcon err', name, e); ctx.clearRect(0,0,w,h); }
}

// Draw a registered sprite centered at world coords (x,y) using caches or pixel defs
function drawEntitySpriteAt(name, x, y, w, h) {
  try {
    // prefer pre-generated images
    const img = (window._SPRITE_IMAGES && window._SPRITE_IMAGES[name]) || (window._ICON_BITMAPS && window._ICON_BITMAPS[name]) || (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS[name]);
    if (img) {
      const px = Math.round(x - w/2);
      const py = Math.round(y - h + (h*0.08));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, px, py, w, h);
      return;
    }
    // fallback to pixel library rendering into an offscreen canvas
    if (window.ENTITY_PIXEL_LIBRARY && window.ENTITY_PIXEL_LIBRARY[name]) {
      const c = window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[name], name, Math.min(w,h));
      if (c) {
        const px = Math.round(x - w/2);
        const py = Math.round(y - h + (h*0.08));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(c, px, py, w, h);
        return;
      }
    }
  } catch (e) { console.warn('drawEntitySpriteAt err', name, e); }
}

function drawWheatIcon(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(8,0,2,18);
  ctx.fillRect(4,2,4,3);
  ctx.fillRect(10,4,4,3);
  ctx.fillRect(3,7,4,3);
  ctx.fillRect(11,9,4,3);
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(5,3,2,2);
  ctx.fillRect(11,5,2,2);
}


// Load pixel-library from data/entity-pixels.json at startup (replaces inline draw-functions when available)
(function ensureEntityPixelsLibrary() {
  try {
    async function loadLibrary() {
      try {
        const res = await fetch('data/entity-pixels.json?v=' + Date.now());
        if (!res.ok) throw new Error('entity-pixels.json not found');
        const json = await res.json();
        window.ENTITY_PIXEL_LIBRARY = json.icons || json || {};
        const keys = Object.keys(window.ENTITY_PIXEL_LIBRARY);
        for (const k of keys) {
          try { window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[k], k); } catch (e) { console.warn('icon create failed', k, e); }
        }
        // if the library contains tree templates (tree0..tree6), override GLOBAL_TREE_TEMPLATES
        try {
          const treeKeys = ['tree0','tree1','tree2','tree3','tree4','tree5','tree6'];
          const templates = [];
          let foundAny = false;
          for (let i = 0; i < treeKeys.length; i++) {
            const tk = treeKeys[i];
            if (window.ENTITY_PIXEL_LIBRARY[tk] && Array.isArray(window.ENTITY_PIXEL_LIBRARY[tk].pixels)) {
              templates.push(window.ENTITY_PIXEL_LIBRARY[tk].pixels.slice());
              foundAny = true;
            } else {
              templates.push(BUILTIN_TREE_TEMPLATES[i] || BUILTIN_TREE_TEMPLATES[0]);
            }
          }
          if (foundAny) GLOBAL_TREE_TEMPLATES = templates;
        } catch (e) { console.warn('populate tree templates err', e); }
        // notify any editor/listener windows the library is ready
        try { window.postMessage({ type: 'entityPixelsLoaded', list: keys }, '*'); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('entityPixelsLoaded', { detail: keys })); } catch (e) {}
      } catch (e) {
        // if loading fails, leave builtin draw functions intact
        console.warn('Entity pixels library not loaded, falling back to inline draw functions.', e);
      }
    }
    // start async load but don't block startup
    loadLibrary();
  } catch (e) { console.warn('ensureEntityPixelsLibrary err', e); }
})();

// Easter egg: click the exact title "★ Mesopotamia ★" 10 times (completely secret)
(function mesopotamiaEasterEgg() {
  try {
    const headers = Array.from(document.querySelectorAll('h1'));
    const titleEl = headers.find(h => /★\s*MesoBuilder\s*★/i.test((h.textContent || '').trim()));
    if (!titleEl) return;
    let clicks = 0; let timer = null; const required = 10;
    function reset() { clicks = 0; if (timer) { clearTimeout(timer); timer = null; } }
    titleEl.addEventListener('click', () => {
      clicks++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, 3000);
      if (clicks >= required) {
        reset();
        try { notify('Mesopotamia desbloqueado (secreto)'); } catch (e) { console.log('Easter egg triggered'); }
      }
    });
  } catch (err) { console.warn('mesopotamiaEasterEgg err', err); }
})();

// ── CRAFTING PANEL ───────────────────────────────────────
function createCraftingPanel() {
  if (document.getElementById('crafting-panel')) return;
  const panel = document.createElement('div'); panel.id = 'crafting-panel';
  panel.style.position = 'fixed'; panel.style.left = '12px'; panel.style.bottom = '80px'; panel.style.zIndex = 4000;
  panel.style.width = '420px'; panel.style.maxHeight = '420px'; panel.style.overflow = 'auto'; panel.style.padding = '10px';
  stylePanel(panel);

  const left = document.createElement('div'); left.style.width = '160px'; left.style.display = 'inline-block'; left.style.verticalAlign = 'top';
  const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(3,44px)'; grid.style.gridGap='6px'; grid.style.background='transparent';
  grid.id = 'craft-grid';
  for (let i=0;i<9;i++) {
    const slot = document.createElement('div'); slot.style.width='44px'; slot.style.height='44px'; slot.style.background='#151515'; slot.style.border='1px solid #333'; slot.style.borderRadius='4px'; slot.style.display='flex'; slot.style.alignItems='center'; slot.style.justifyContent='center';
    slot.innerHTML = '';
    grid.appendChild(slot);
  }
  left.appendChild(grid);

  const right = document.createElement('div'); right.style.display='inline-block'; right.style.width='240px'; right.style.marginLeft='10px'; right.style.verticalAlign='top';
  const title = document.createElement('div'); title.textContent='Recetas'; title.style.fontWeight='700'; title.style.marginBottom='8px'; title.style.color='var(--sand-mid)';
  right.appendChild(title);

  const list = document.createElement('div'); list.id='craft-recipe-list'; list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px';
  // populate recipe list from RECIPES
  Object.keys(RECIPES).forEach(rid => {
    const r = RECIPES[rid];
    const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.padding='6px'; row.style.background='rgba(255,255,255,0.02)'; row.style.borderRadius='6px';
    const info = document.createElement('div'); info.style.fontSize='13px'; info.style.color='#fff'; info.innerHTML = `<div style='font-weight:700'>${rid}</div>`;
    const reqs = document.createElement('div'); reqs.style.fontSize='12px'; reqs.style.color='#ccc'; reqs.textContent = Object.entries(r.requires).map(([k,v]) => `${v} ${k}`).join(', ');
    info.appendChild(reqs);
    const rightSide = document.createElement('div'); rightSide.style.display='flex'; rightSide.style.flexDirection='column'; rightSide.style.alignItems='flex-end';
    const craftBtn = document.createElement('button'); craftBtn.textContent = 'Craftear'; craftBtn.style.padding='6px 8px'; craftBtn.style.borderRadius='6px'; craftBtn.style.background='#222'; craftBtn.style.color='#FFD27A'; craftBtn.style.border='1px solid #333';
    craftBtn.addEventListener('click', () => { if (canCraft(rid)) { craftItem(rid); } else { notify('Te faltan materiales para ' + rid); } });
    rightSide.appendChild(craftBtn);
    row.appendChild(info); row.appendChild(rightSide);
    list.appendChild(row);
  });
  right.appendChild(list);

  const guide = document.createElement('div'); guide.style.marginTop='10px'; guide.style.fontSize='12px'; guide.style.color='#ddd'; guide.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Guía rápida</div>';
  // build guide text from RECIPES
  const lines = [];
  Object.keys(RECIPES).forEach(rid => {
    const r = RECIPES[rid];
    const reqs = Object.entries(r.requires).map(([k,v]) => `${v} ${k}`).join(', ');
    lines.push(`<div style="margin-bottom:4px"><b>${rid}:</b> Necesitas ${reqs}. Pulsa "Craftear" si tienes los materiales.</div>`);
  });
  guide.innerHTML += lines.join('');
  right.appendChild(guide);

  panel.appendChild(left); panel.appendChild(right);
  document.body.appendChild(panel);
  try { enableFloatingBehavior(panel); registerPanel(panel); } catch (e) {}
  panel.style.display='none';
}

function toggleCraftingPanel() { const p = document.getElementById('crafting-panel'); if (!p) createCraftingPanel(); const el = document.getElementById('crafting-panel'); if (!el) return; el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

function drawBrickIcon(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(1,3,16,4);
  ctx.fillRect(1,9,16,4);
  ctx.fillStyle = '#C8A84B';
  ctx.fillRect(1,3,7,4);
  ctx.fillRect(10,9,7,4);
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0,7,18,2);
}

function drawPopIcon(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#E8D5A3';
  ctx.beginPath(); ctx.arc(9,5,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#C8A84B';
  ctx.beginPath(); ctx.arc(9,14,6,Math.PI,0); ctx.fill();
}

function drawPortrait(ctx, w, h) {
  ctx.clearRect(0,0,w,h);
  // Background
  ctx.fillStyle = '#1A1208';
  ctx.fillRect(0,0,w,h);
  // Skin
  ctx.fillStyle = '#C8956C';
  ctx.fillRect(18,6,18,20);
  // Beard
  ctx.fillStyle = '#2C1A0A';
  ctx.fillRect(16,18,22,10);
  ctx.fillStyle = '#3D2510';
  ctx.fillRect(18,22,18,8);
  // Eyes
  ctx.fillStyle = '#1A0A00';
  ctx.fillRect(21,12,4,4);
  ctx.fillRect(29,12,4,4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(22,13,2,2);
  ctx.fillRect(30,13,2,2);
  // Crown
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(14,2,26,6);
  ctx.fillRect(16,0,4,4);
  ctx.fillRect(23,0,4,4);
  ctx.fillRect(30,0,4,4);
  ctx.fillStyle = '#B8860B';
  ctx.fillRect(14,6,26,2);
  // Collar
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(12,26,30,8);
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(14,28,26,4);
  // Lapis lazuli decoration
  ctx.fillStyle = '#2E6FA3';
  ctx.fillRect(20,29,4,2);
  ctx.fillRect(28,29,4,2);
  // Nose
  ctx.fillStyle = '#B87050';
  ctx.fillRect(25,16,4,4);
  // Mouth
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(22,21,10,2);
}

// ═══════════════════════════════════════════════════════════════
//  CANVAS RENDERING
// ═══════════════════════════════════════════════════════════════
function resizeCanvas() {
  const main = document.getElementById('main');
  const panel = document.getElementById('panel');
  const floatingPanels = document.body.classList.contains('floating-panels');
  canvas.width  = floatingPanels ? main.clientWidth : main.clientWidth - panel.offsetWidth;
  canvas.height = main.clientHeight;
  clampCamera();
  render();
}

function getTileSize() {
  return TILE * zoom;
}

// small deterministic noise for micro-tiles
function tileNoise(a,b,subx,suby) {
  const v = (a*73856093 ^ b*19349663 ^ (subx+1)*83492791 ^ (suby+1)*2654435761) >>> 0;
  return (Math.abs(Math.sin(v) * 10000) % 1);
}

function getIsoTileSize() {
  const w = TILE * zoom;
  const h = TILE * zoom * ISO_RATIO;
  return { w, h };
}

// Apply a consistent look for floating UI panels
function stylePanel(el) {
  el.style.background = 'rgba(18,18,18,0.95)';
  el.style.color = '#fff';
  el.style.padding = '10px';
  el.style.borderRadius = '4px';
  el.style.border = '1px solid #FFD27A';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
}

function projectIso(col, row) {
  const { w, h } = getIsoTileSize();
  // return coordinates where x is the tile center x, and y is the tile's top vertex y
  // centerX = (col - row) * (w/2)
  // topY = (col + row) * (h/2) - h/2
  return {
    x: (col - row) * (w / 2),
    y: (col + row) * (h / 2) - h / 2
  };
}

function getWorldBounds() {
  if (viewMode === 'iso') {
    const a = projectIso(0, 0);
    const b = projectIso(COLS - 1, 0);
    const c = projectIso(0, ROWS - 1);
    const d = projectIso(COLS - 1, ROWS - 1);
    const { w, h } = getIsoTileSize();
    const minX = Math.min(a.x, b.x, c.x, d.x) - w / 2;
    const maxX = Math.max(a.x, b.x, c.x, d.x) + w / 2;
    const minY = Math.min(a.y, b.y, c.y, d.y);
    const maxY = Math.max(a.y, b.y, c.y, d.y) + h;
    return { minX, maxX, minY, maxY };
  }

  const tileSize = getTileSize();
  return {
    minX: 0,
    maxX: COLS * tileSize,
    minY: 0,
    maxY: ROWS * tileSize
  };
}

function clampCamera() {
  const padding = 10;
  const bounds = getWorldBounds();
  const minCamX = canvas.width - padding - bounds.maxX;
  const maxCamX = padding - bounds.minX;
  const minCamY = canvas.height - padding - bounds.maxY;
  const maxCamY = padding - bounds.minY;
  camX = Math.max(minCamX, Math.min(maxCamX, camX));
  camY = Math.max(minCamY, Math.min(maxCamY, camY));
}

function centerCamera() {
  const bounds = getWorldBounds();
  camX = (canvas.width - (bounds.maxX - bounds.minX)) / 2 - bounds.minX;
  camY = (canvas.height - (bounds.maxY - bounds.minY)) / 2 - bounds.minY;
  clampCamera();
}

function centerCameraSmooth() {
  const bounds = getWorldBounds();
  const tx = (canvas.width - (bounds.maxX - bounds.minX)) / 2 - bounds.minX;
  const ty = (canvas.height - (bounds.maxY - bounds.minY)) / 2 - bounds.minY;
  targetCam = { x: tx, y: ty };
}

function worldToScreen(col, row) {
  if (viewMode === 'iso') {
    const p = projectIso(col, row);
    return { x: p.x + camX, y: p.y + camY };
  }
  const tileSize = getTileSize();
  return { x: col * tileSize + camX, y: row * tileSize + camY };
}

function screenToWorld(sx, sy) {
  if (viewMode === 'iso') {
    const { w, h } = getIsoTileSize();
    // invert projection where worldToScreen produced x=centerX and y=topY
    const x = (sx - camX) / (w / 2);
    const y = (sy - camY + h / 2) / (h / 2); // adjust back from topY to centerY-based math
    const col = (x + y) / 2;
    const row = (y - x) / 2;
    return { col: Math.floor(col), row: Math.floor(row) };
  }
  const tileSize = getTileSize();
  return {
    col: Math.floor((sx - camX) / tileSize),
    row: Math.floor((sy - camY) / tileSize)
  };
}

function screenToWorldFloat(sx, sy) {
  if (viewMode === 'iso') {
    const { w, h } = getIsoTileSize();
    const px = sx - camX;
    const py = sy - camY;
    // adjust py to account for projectIso returning topY (centerY = topY + h/2)
    const col = (px / (w/2) + (py + h/2) / (h/2)) / 2;
    const row = ((py + h/2) / (h/2) - px / (w/2)) / 2;
    return { x: col, y: row };
  }
  const tileSize = getTileSize();
  return { x: (sx - camX) / tileSize, y: (sy - camY) / tileSize };
}

function lerp(a,b,t){return a+(b-a)*t}

function getBuildingSize(type) {
  const b = BUILDINGS[type];
  return b && b.size ? b.size : { w: 1, h: 1 };
}

function getCellInfo(col, row) {
  const cell = grid[row][col];
  if (!cell) return null;
  if (typeof cell === 'string') {
    return { type: cell, baseCol: col, baseRow: row, isBase: true };
  }
  return {
    type: cell.type,
    baseCol: cell.baseCol,
    baseRow: cell.baseRow,
    isBase: cell.baseCol === col && cell.baseRow === row
  };
}

function setBuildingCells(baseCol, baseRow, type) {
  const size = getBuildingSize(type);
  for (let r = 0; r < size.h; r++) {
    for (let c = 0; c < size.w; c++) {
      grid[baseRow + r][baseCol + c] = { type, baseCol, baseRow };
    }
  }
  try { saveAppStateDebounced(); } catch (e) {}
  try { mapCacheDirty = true; rebuildMapCacheDebounced(); } catch (e) {}
}

// Carve a simple Manhattan road between two tiles (inclusive)
function carveRoadPath(c1, r1, c2, r2) {
  let x = c1, y = r1;
  while (x !== c2 || y !== r2) {
    try {
      // mark biome as road terrain so it's rendered as dirt path
      if (tileBiome[y] && tileBiome[y][x] !== 'road') tileBiome[y][x] = 'road';
    } catch (e) {}
    if (x !== c2) x += (c2 > x) ? 1 : -1;
    else if (y !== r2) y += (r2 > y) ? 1 : -1;
  }
  try { if (tileBiome[y] && tileBiome[y][x] !== 'road') tileBiome[y][x] = 'road'; } catch (e) {}
}

// Spawn a small organized village near a base col/row
function spawnVillage(baseCol, baseRow, opts) {
  opts = opts || {};
  // try to find a non-water, non-forest, non-river center nearby
  let bc = baseCol, br = baseRow, t=0;
  while ((isRiver(bc) || isNearRiver(bc) || (tileBiome[br] && tileBiome[br][bc] === 'forest') || (tileBiome[br] && tileBiome[br][bc] === 'water') || grid[br][bc]) && t < 300) {
    bc = Math.max(2, Math.min(COLS-3, baseCol + Math.floor(Math.random()*7)-3));
    br = Math.max(2, Math.min(ROWS-3, baseRow + Math.floor(Math.random()*7)-3));
    t++;
  }
  if (t >= 300) return;

  // layout: rows x cols grid of house plots (wider spacing for clearer visualization)
  const cols = 2 + Math.floor(Math.random()*3); // 2..4
  const rows = 1 + Math.floor(Math.random()*2); // 1..2
  const spacing = 3 + Math.floor(Math.random()*2); // 3..4 for more space between houses
  const houses = [];
  const startC = Math.max(2, Math.min(COLS-3, bc - Math.floor((cols-1)/2) * (spacing+1)));
  const startR = Math.max(2, Math.min(ROWS-3, br - Math.floor((rows-1)/2) * (spacing+1)));

  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      const hc = startC + cc * (spacing+1);
      const hr = startR + rr * (spacing+1);
      if (hc < 1 || hr < 1 || hc >= COLS-1 || hr >= ROWS-1) continue;
      if (isRiver(hc) || grid[hr][hc]) continue;
      const biome = tileBiome[hr] && tileBiome[hr][hc];
      if (biome === 'forest' || biome === 'water') continue;
      // choose variant (include huts and occasionally a market/temple)
      let variant = 'house';
      const r = Math.random();
      if (r < 0.12) variant = 'hut';
      else if (r < 0.45) variant = 'house_small';
      else if (r < 0.78) variant = 'house';
      else variant = 'house_large';
      try { setBuildingCells(hc, hr, variant); houses.push({c:hc, r:hr}); } catch (e) {}
    }
  }

  // place a small farm near the cluster
  try {
    const fc = Math.min(COLS-2, bc + cols + 1);
    const fr = Math.min(ROWS-2, br + 1);
    if (!grid[fr][fc] && tileBiome[fr][fc] !== 'forest' && !isRiver(fc)) setBuildingCells(fc, fr, 'farm');
  } catch (e) {}

  // connect houses with roads (connect to first house)
  if (houses.length > 0) {
    const hub = houses[0];
    for (let i = 1; i < houses.length; i++) {
      carveRoadPath(hub.c, hub.r, houses[i].c, houses[i].r);
    }
    // compute village bounds (padding 2 tiles)
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    houses.forEach(h => { minC = Math.min(minC, h.c); maxC = Math.max(maxC, h.c); minR = Math.min(minR, h.r); maxR = Math.max(maxR, h.r); });
    minC = Math.max(0, minC - 2); minR = Math.max(0, minR - 2); maxC = Math.min(COLS-1, maxC + 2); maxR = Math.min(ROWS-1, maxR + 2);
    const vid = 'village-' + Date.now() + '-' + Math.random().toString(36).slice(2,4);
    const villageObj = { id: vid, houses: houses.slice(), minC, maxC, minR, maxR };
    window._VILLAGES = window._VILLAGES || [];
    window._VILLAGES.push(villageObj);
    // spawn a couple of NPCs inside the village bounds
      try {
      window._LAST_VILLAGE_ID = vid;
      const baseNpc = 1 + Math.floor(Math.random()*3);
      const npcDensity = (window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.npc) ? window._DEFAULT_DENSITIES.npc : 1.0;
      const npcCount = Math.max(0, Math.round(baseNpc * npcDensity));
      for (let ni = 0; ni < npcCount; ni++) {
        const nc = Math.floor((minC + maxC) / 2) + Math.floor(Math.random() * (maxC - minC + 1)) - Math.floor((maxC - minC)/2);
        const nr = Math.floor((minR + maxR) / 2) + Math.floor(Math.random() * (maxR - minR + 1)) - Math.floor((maxR - minR)/2);
        try { const p = spawnNPC('Aldeano' + (ni+1), Math.max(0, Math.min(COLS-1, nc)), Math.max(0, Math.min(ROWS-1, nr))); if (p) p.npcType = 'villager'; } catch (e) {}
      }
      window._LAST_VILLAGE_ID = null;
    } catch (e) {}
  }

  // Remove trees/resources and rabbits/entities close to houses (within 2 tiles)
  try {
    for (const h of houses) {
      for (let rr = -2; rr <= 2; rr++) {
        for (let cc = -2; cc <= 2; cc++) {
          const tc = h.c + cc, tr = h.r + rr;
          if (tc < 0 || tr < 0 || tc >= COLS || tr >= ROWS) continue;
          // flatten nearby biome so village doesn't mix with forest
          try { tileBiome[tr][tc] = 'grass'; } catch (e) {}
        }
      }
    }
    // remove environmental entities (trees/resources) near houses
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      if (!ent) continue;
      if (ent.kind === 'tree' || ent.kind === 'resource') {
        let tooClose = false;
        for (const h of houses) {
          const d = Math.hypot(ent.col - h.c, ent.row - h.r);
          if (d < 2) { tooClose = true; break; }
        }
        if (tooClose) entities.splice(i, 1);
      }
    }
    // remove rabbits near houses
    for (let i = rabbits.length - 1; i >= 0; i--) {
      const rb = rabbits[i];
      if (!rb) continue;
      let tooClose = false;
      for (const h of houses) {
        const d = Math.hypot(rb.col - h.c, rb.row - h.r);
        if (d < 2) { tooClose = true; break; }
      }
      if (tooClose) rabbits.splice(i, 1);
    }
  } catch (e) {}

  // spawn villagers near houses
  const baseNpcCount = Math.max(2, Math.min(8, Math.floor(houses.length * (1.2 + Math.random()))));
  const npcDensity2 = (window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.npc) ? window._DEFAULT_DENSITIES.npc : 1.0;
  const npcCount = Math.max(0, Math.round(baseNpcCount * npcDensity2));
  for (let i = 0; i < npcCount; i++) {
    const h = houses[Math.floor(Math.random()*houses.length)];
    if (!h) continue;
    const nc = Math.max(0, Math.min(COLS-1, h.c + (Math.floor(Math.random()*3)-1)));
    const nr = Math.max(0, Math.min(ROWS-1, h.r + (Math.floor(Math.random()*3)-1)));
    if (!isRiver(nc) && !grid[nr][nc]) {
      try { spawnNPC('Aldeano' + (i+1), nc, nr); } catch (err) {}
    }
  }
}

function clearBuildingCells(baseCol, baseRow, type) {
  const size = getBuildingSize(type);
  for (let r = 0; r < size.h; r++) {
    for (let c = 0; c < size.w; c++) {
      const row = baseRow + r;
      const col = baseCol + c;
      const cell = grid[row][col];
      if (!cell) continue;
      if (typeof cell === 'string') {
        grid[row][col] = null;
      } else if (cell.baseCol === baseCol && cell.baseRow === baseRow) {
        grid[row][col] = null;
      }
    }
  }
  try { saveAppStateDebounced(); } catch (e) {}
  try { mapCacheDirty = true; rebuildMapCacheDebounced(); } catch (e) {}
}

function canPlaceAt(baseCol, baseRow, type) {
  const size = getBuildingSize(type);
  if (baseCol < 0 || baseRow < 0 || baseCol + size.w > COLS || baseRow + size.h > ROWS) return false;
  for (let r = 0; r < size.h; r++) {
    for (let c = 0; c < size.w; c++) {
      const col = baseCol + c;
      const row = baseRow + r;
      if (isRiver(col)) return false;
      if (grid[row][col]) return false;
    }
  }
  return true;
}

function forEachFootprint(baseCol, baseRow, type, fn) {
  const size = getBuildingSize(type);
  for (let r = 0; r < size.h; r++) {
    for (let c = 0; c < size.w; c++) {
      fn(baseCol + c, baseRow + r);
    }
  }
}

function isRiver(col) {
  return col >= RIVER_COL_START && col < RIVER_COL_START + RIVER_WIDTH;
}

function isNearRiver(col) {
  return col >= RIVER_COL_START - 2 && col < RIVER_COL_START + RIVER_WIDTH + 2;
}

// Movement speed multiplier depending on terrain (water slows you down)
function movementMultiplier(col, row) {
  try {
    if (col < 0 || row < 0 || row >= ROWS || col >= COLS) return 1;
    if (isRiver(col)) return 0.45;
    if (tileBiome[row] && tileBiome[row][col] === 'water') return 0.45;
    return 1;
  } catch (e) { return 1; }
}

function tryMovePlayer(dx, dy) {
  const nextCol = player.col + dx;
  const nextRow = player.row + dy;
  if (!canWalkTo(nextCol, nextRow)) return;
  player.col = nextCol;
  player.row = nextRow;
}

// New canWalkTo: disallow stepping into buildings or river
function canWalkTo(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (grid[row][col]) return false;
  return true;
}

// placeResource/placeRabbit moved to engine/entities.js

function generateMap(mapType) {
  // Fill base biomes
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // default sand
      let p = Math.random();
      if (isRiver(c)) {
        tileBiome[r][c] = 'water';
      } else if (p < 0.06) {
        tileBiome[r][c] = 'forest';
      } else if (p < 0.12) {
        tileBiome[r][c] = 'hills';
      } else if (p < 0.25) {
        tileBiome[r][c] = 'grass';
      } else {
        tileBiome[r][c] = 'sand';
      }
    }
  }

  // Smooth biomes to create coherent patches
  for (let pass = 0; pass < 3; pass++) {
    const copy = tileBiome.map(row => row.slice());
    for (let r = 1; r < ROWS-1; r++) {
      for (let c = 1; c < COLS-1; c++) {
        if (isRiver(c)) { copy[r][c] = 'water'; continue; }
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const b = tileBiome[r+oy][c+ox];
          counts[b] = (counts[b] || 0) + 1;
        }
        // pick neighbor majority if any exceeds 3
        let best = tileBiome[r][c]; let bestCount = 0;
        for (const k in counts) {
          if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
        }
        if (bestCount >= 4) copy[r][c] = best;
      }
    }
    for (let r = 0; r < ROWS; r++) tileBiome[r] = copy[r].slice();
  }

  // further refine into larger patches for visual coherence
  try { refineBiomes(); } catch (err) { /* ignore */ }

  // Generate a heightmap to create gentle undulations and mountains
  try {
    // layered sine/cos waves + noise for pleasing hills
    const nx = COLS, ny = ROWS;
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        let h = 0;
        h += 0.45 * (0.5 + 0.5 * Math.sin(c * 0.12 + r * 0.07));
        h += 0.25 * (0.5 + 0.5 * Math.cos(c * 0.05 - r * 0.09));
        h += 0.15 * (Math.random() * 0.8);
        // local bump around river banks for variety
        const riverDist = Math.abs(c - RIVER_COL_START);
        if (riverDist < 6) h -= (6 - riverDist) * 0.02;
        // normalize roughly to 0..1
        h = Math.max(0, Math.min(1, h));
        heightMap[r][c] = h;
      }
    }
    // Simple smoothing pass
    for (let pass = 0; pass < 2; pass++) {
      const tmp = heightMap.map(row => row.slice());
      for (let r = 1; r < ny-1; r++) {
        for (let c = 1; c < nx-1; c++) {
          let s = 0; let n = 0;
          for (let oy=-1; oy<=1; oy++) for (let ox=-1; ox<=1; ox++) { s += heightMap[r+oy][c+ox]; n++; }
          tmp[r][c] = s / n;
        }
      }
      for (let r = 0; r < ny; r++) heightMap[r] = tmp[r].slice();
    }

    // Promote high areas to hills/mountains for better isometric visuals
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h = heightMap[r][c];
        if (h > 0.78 && tileBiome[r][c] !== 'water') tileBiome[r][c] = 'hills';
        else if (h > 0.9 && tileBiome[r][c] !== 'water') tileBiome[r][c] = 'hills';
      }
    }
      // Place mountain resources along the upper border rows for a mountain range
      try {
        const topRows = Math.max(3, Math.floor(ROWS * 0.12));
        for (let r = 0; r < topRows; r++) {
          for (let c = 0; c < COLS; c++) {
            if (!grid[r][c] && !isRiver(c) && Math.random() < 0.16) {
              try { placeResource(c, r, 'mountain'); } catch (e) {}
            }
          }
        }
      } catch (e) {}
  } catch (e) { /* ignore heightmap errors */ }

  // place tree entities for forest tiles (not every forest tile to avoid overpopulation)
  try {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // respect vegetation density multiplier
        const vegDensity = (window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.vegetation) ? window._DEFAULT_DENSITIES.vegetation : 1.0;
        if (tileBiome[r][c] === 'forest' && !grid[r][c]) {
          if (Math.random() < 0.28 * vegDensity) {
            try { placeTree(c, r); } catch (e) {}
          }
        } else if (tileBiome[r][c] === 'grass' && !grid[r][c]) {
          if (Math.random() < 0.04 * vegDensity) {
            try {
              const r2 = Math.random();
              if (r2 < 0.6) placeTree(c, r, 'tallgrass');
              else if (r2 < 0.85) placeTree(c, r, 'shrub');
              else placeTree(c, r, 'bush');
            } catch (e) {}
          }
        } else if (tileBiome[r][c] === 'sand' && !grid[r][c]) {
          if (Math.random() < 0.08 * vegDensity) {
            try { placeTree(c, r, 'scrub'); } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}

  // Ensure a few houses near river and some resources
  // Create an initial small village away from the Euphrates river
  const centerCol = Math.floor(COLS/2);
  const centerRow = Math.floor(ROWS/2);
  // find a base location that is not river and not near river
  let baseCol = Math.floor(4 + Math.random() * (COLS - 12));
  let baseRow = Math.floor(4 + Math.random() * (ROWS - 8));
  let tries = 0;
  while ((isRiver(baseCol) || isNearRiver(baseCol) || grid[baseRow][baseCol]) && tries < 200) {
    baseCol = Math.floor(4 + Math.random() * (COLS - 12));
    baseRow = Math.floor(4 + Math.random() * (ROWS - 8));
    tries++;
  }
  // place one or more villages: prefer multiple small villages for a livelier map
  const villagesToSpawn = 1 + Math.floor(Math.random() * 3); // 1..3
  window._VILLAGES = [];
  for (let vi = 0; vi < villagesToSpawn; vi++) {
    let vBaseCol = Math.floor(4 + Math.random() * (COLS - 12));
    let vBaseRow = Math.floor(4 + Math.random() * (ROWS - 8));
    let triesV = 0;
    while ((isRiver(vBaseCol) || isNearRiver(vBaseCol) || grid[vBaseRow][vBaseCol]) && triesV < 300) {
      vBaseCol = Math.floor(4 + Math.random() * (COLS - 12));
      vBaseRow = Math.floor(4 + Math.random() * (ROWS - 8));
      triesV++;
    }
    try { spawnVillage(vBaseCol, vBaseRow); } catch (e) { try { setBuildingCells(vBaseCol, vBaseRow, 'house'); } catch (ee) {} }
  }

  // Place player near the first village center if available
  try {
    if (window._VILLAGES && window._VILLAGES.length > 0) {
      const v = window._VILLAGES[0];
      const vc = Math.floor((v.minC + v.maxC) / 2);
      const vr = Math.floor((v.minR + v.maxR) / 2);
      player.col = Math.max(0, Math.min(COLS-1, vc));
      player.row = Math.max(0, Math.min(ROWS-1, vr));
    } else {
      player.col = Math.max(0, Math.min(COLS-1, baseCol + 1));
      player.row = Math.max(0, Math.min(ROWS-1, baseRow - 1));
    }
  } catch (e) {
    player.col = Math.max(0, Math.min(COLS-1, baseCol + 1));
    player.row = Math.max(0, Math.min(ROWS-1, baseRow - 1));
  }
  player.x = player.col; player.y = player.row;

  // Spawn random resource nodes
  for (let i = 0; i < 40; i++) {
    const c = Math.floor(Math.random()*COLS);
    const r = Math.floor(Math.random()*ROWS);
    if (!grid[r][c] && !isRiver(c)) {
      // include stones as a rarer resource
      const rnd = Math.random();
      const type = rnd < 0.55 ? 'wheat' : (rnd < 0.85 ? 'brick' : 'stone');
      placeResource(c, r, type);
    }
  }

  // Spawn some rabbits (scaled by animals density)
  try {
    const animalDensity = (window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.animals) ? window._DEFAULT_DENSITIES.animals : 1.0;
    const rabbitCount = Math.max(0, Math.round(20 * animalDensity));
    for (let i = 0; i < rabbitCount; i++) {
      const c = Math.floor(Math.random()*COLS);
      const r = Math.floor(Math.random()*ROWS);
      if (!grid[r][c] && !isRiver(c)) placeRabbit(c, r);
    }
    // Spawn a few foxes (wildlife)
    const foxCount = Math.max(0, Math.round(10 * animalDensity));
    for (let i = 0; i < foxCount; i++) {
      const c = Math.floor(Math.random()*COLS);
      const r = Math.floor(Math.random()*ROWS);
      if (!grid[r][c] && !isRiver(c)) try { placeFox(c, r); } catch (e) {}
    }
  } catch (e) {}

  // mark cache dirty after regenerating map
  try { mapCacheDirty = true; rebuildMapCacheDebounced(10); } catch (e) {}
}

// Draw a single building on the canvas
function drawBuilding(col, row, type, alpha) {
  const b = BUILDINGS[type];
  if (!b) return;
  const { x, y } = worldToScreen(col, row);
  const baseT = getTileSize();
  const DT = baseT * BUILDING_SCALE; // draw tile size (scaled up)
  const size = getBuildingSize(type);
  const W = DT * size.w;
  const H = DT * size.h;
  const pad = Math.max(1, Math.round(Math.min(W, H) * 0.05));

  ctx.save();
  ctx.globalAlpha = alpha !== undefined ? alpha : 1;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + pad, y + H * 0.62, W - pad * 2, H * 0.34);

  if (type === 'house') {
    // Roof with slight eave
    const roofH = Math.max(8, Math.floor(DT * 0.38));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + pad, y + pad + roofH - 2, DT - pad*2, 4);
    ctx.fillStyle = b.roofColor || '#E04A3F';
    ctx.fillRect(x + pad, y + pad, DT - pad*2, roofH);
    // simple tile rows
    const tilesPerRow = Math.max(6, Math.floor((DT - pad*2) / 6));
    const tileW = (DT - pad*2) / tilesPerRow;
    for (let ry = 0; ry < 3; ry++) {
      for (let rx = 0; rx < tilesPerRow; rx++) {
        const tx = x + pad + rx * tileW + (ry % 2 ? tileW/2 : 0);
        const ty = y + pad + ry * (roofH / 3);
        ctx.fillStyle = (rx + ry) % 2 === 0 ? '#D94A3A' : '#C83A2A';
        ctx.fillRect(Math.round(tx), Math.round(ty), Math.max(2, Math.floor(tileW)-1), Math.max(2, Math.floor(roofH/3)-2));
      }
    }
    // Walls
    ctx.fillStyle = b.color || '#C8A84B';
    ctx.fillRect(x + pad, y + pad + roofH - 2, DT - pad * 2, DT * 0.62 + 2);
    // brick accents
    ctx.fillStyle = '#B5883A';
    const brickW = Math.max(6, Math.floor((DT - pad*2) / 4));
    const brickH = Math.max(6, Math.floor((DT * 0.62) / 3));
    for (let by = 0; by < 3; by++) {
      for (let bx = 0; bx < 4; bx++) {
        const bxX = x + pad + bx * (brickW + 2) - (by % 2 ? Math.floor(brickW/2) : 0);
        const bxY = y + pad + roofH + by * (brickH + 4);
        ctx.fillRect(bxX, bxY, brickW, brickH);
      }
    }
    // Door with small step
    const doorW = Math.max(6, Math.floor(DT * 0.18));
    const doorH = Math.max(8, Math.floor(DT * 0.28));
    const doorX = Math.floor(x + DT * 0.41);
    const doorY = Math.floor(y + DT * 0.64);
    ctx.fillStyle = '#5C3A1A'; ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.fillStyle = '#2E1A0A'; ctx.fillRect(doorX + Math.max(1, Math.floor(doorW*0.6)), doorY + Math.max(1, Math.floor(doorH*0.5)), 2, 2);
    ctx.fillStyle = '#8B5A38'; ctx.fillRect(doorX - 2, doorY + doorH, doorW + 4, Math.max(2, Math.floor(tileW/3)));
    // Windows
    const winW = Math.max(6, Math.floor(DT * 0.16));
    const winH = Math.max(6, Math.floor(DT * 0.16));
    ctx.fillStyle = '#3A6F9A'; ctx.fillRect(x + DT * 0.14, y + DT * 0.48, winW, winH);
    ctx.fillStyle = '#7FC3F0'; ctx.fillRect(x + DT * 0.14 + 2, y + DT * 0.48 + 2, Math.max(2, winW - 4), Math.max(2, winH - 4));
    ctx.fillStyle = '#3A6F9A'; ctx.fillRect(x + DT * 0.66, y + DT * 0.48, winW, winH);
    ctx.fillStyle = '#7FC3F0'; ctx.fillRect(x + DT * 0.66 + 2, y + DT * 0.48 + 2, Math.max(2, winW - 4), Math.max(2, winH - 4));

  } else if (type === 'farm') {
    // Soil
    ctx.fillStyle = '#5C3A1A';
    ctx.fillRect(x + pad, y + DT * 0.48, DT - pad * 2, DT * 0.48);
    // Rows
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#3D2510';
      ctx.fillRect(x + pad, y + DT * 0.54 + i * (DT * 0.08), DT - pad * 2, DT * 0.035);
    }
    // Crops
    ctx.fillStyle = '#4A7C3F';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + DT * 0.16 + i * (DT * 0.12), y + DT * 0.22, DT * 0.05, DT * 0.28);
    }
    ctx.fillStyle = '#DAA520';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + DT * 0.16 + i * (DT * 0.12), y + DT * 0.18, DT * 0.08, DT * 0.1);
    }

  } else if (type === 'temple') {
    // Base
    ctx.fillStyle = b.color;
    ctx.fillRect(x + pad, y + DT * 0.5, DT - pad * 2, DT * 0.46);
    // Middle tier
    ctx.fillStyle = '#E8D5A3';
    ctx.fillRect(x + DT * 0.14, y + DT * 0.28, DT - DT * 0.28, DT * 0.26);
    // Top
    ctx.fillStyle = '#F5ECD7';
    ctx.fillRect(x + DT * 0.22, y + DT * 0.1, DT - DT * 0.44, DT * 0.22);
    // Columns
    ctx.fillStyle = b.roofColor;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + DT * 0.18 + i * (DT * 0.22), y + DT * 0.5, DT * 0.1, DT * 0.46);
    }
    // Door
    ctx.fillStyle = '#2E1A08';
    ctx.fillRect(x + DT * 0.41, y + DT * 0.66, DT * 0.18, DT * 0.3);

  } else if (type === 'market') {
    // Base
    ctx.fillStyle = b.color;
    ctx.fillRect(x + pad, y + DT * 0.46, DT - pad * 2, DT * 0.5);
    // Awning
    ctx.fillStyle = '#E8D5A3';
    ctx.fillRect(x + pad, y + DT * 0.34, DT - pad * 2, DT * 0.12);
    // Stripes
    ctx.fillStyle = b.roofColor;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + pad + i * (DT * 0.14), y + DT * 0.34, DT * 0.08, DT * 0.12);
    }
    // Goods
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(x + DT * 0.18,  y + DT * 0.64, DT * 0.16, DT * 0.16);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + DT * 0.44, y + DT * 0.64, DT * 0.16, DT * 0.16);
    ctx.fillStyle = '#4A7C3F';
    ctx.fillRect(x + DT * 0.7, y + DT * 0.64, DT * 0.16, DT * 0.16);

  } else if (type === 'granary') {
    // Dome
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(x + DT / 2, y + DT * 0.46, DT / 2 - pad, DT * 0.34, 0, Math.PI, 0);
    ctx.fill();
    // Base
    ctx.fillStyle = b.roofColor;
    ctx.fillRect(x + pad, y + DT * 0.46, DT - pad * 2, DT * 0.5);
    // Door
    ctx.fillStyle = '#3D2510';
    ctx.fillRect(x + DT * 0.41, y + DT * 0.64, DT * 0.18, DT * 0.32);
    // Wheat symbol
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(x + DT * 0.49, y + DT * 0.16, DT * 0.04, DT * 0.2);
    ctx.fillRect(x + DT * 0.44, y + DT * 0.2, DT * 0.08, DT * 0.06);
    ctx.fillRect(x + DT * 0.5, y + DT * 0.26, DT * 0.08, DT * 0.06);

  } else if (type === 'ziggurat') {
    // Tier 3 (base)
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x + pad, y + H * 0.64, W - pad * 2, H * 0.32);
    // Tier 2
    ctx.fillStyle = '#C8A84B';
    ctx.fillRect(x + W * 0.12, y + H * 0.42, W - W * 0.24, H * 0.24);
    // Tier 1
    ctx.fillStyle = '#E8D5A3';
    ctx.fillRect(x + W * 0.22, y + H * 0.24, W - W * 0.44, H * 0.2);
    // Top
    ctx.fillStyle = '#F5ECD7';
    ctx.fillRect(x + W * 0.3, y + H * 0.08, W - W * 0.6, H * 0.18);
    // Flag
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + W * 0.49, y + pad, W * 0.04, H * 0.16);
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(x + W * 0.53, y + pad, W * 0.18, H * 0.1);
  }
  // house with garden: draw garden patch to the left with stepping stones and low fence
  if (type === 'house_garden') {
    try {
      const gx = x + pad - Math.floor(DT * 0.55);
      const gy = y + DT * 0.6;
      const gw = Math.floor(DT * 0.45);
      const gh = Math.floor(DT * 0.38);
      ctx.fillStyle = '#7EC96A'; ctx.fillRect(gx, gy, gw, gh);
      // stepping stones
      ctx.fillStyle = '#E8D5A3';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(gx + Math.floor(gw*0.1) + i * Math.floor(gw*0.28), gy + Math.floor(gh*0.55), Math.max(4, Math.floor(gw*0.18)), Math.max(4, Math.floor(gh*0.12)));
      }
      // little flowers
      ctx.fillStyle = '#F05'; ctx.fillRect(gx + 4, gy + 4, 3, 3);
      ctx.fillStyle = '#FFD200'; ctx.fillRect(gx + 10, gy + 8, 3, 3);
      // low fence
      ctx.fillStyle = '#8B5A38';
      for (let i = 0; i < 5; i++) ctx.fillRect(gx + i*(gw/5) - 1, gy - 4, 3, 4);
    } catch (e) {}
  }

  // small variants
  else if (type === 'house_small') {
    // simple 1x1 house
    ctx.fillStyle = b.color;
    ctx.fillRect(x + pad, y + DT * 0.4, DT*0.6, DT*0.45);
    ctx.fillStyle = b.roofColor;
    ctx.beginPath(); ctx.moveTo(x + DT*0.3, y + DT*0.25); ctx.lineTo(x + DT*0.7, y + DT*0.25); ctx.lineTo(x + DT*0.5, y + DT*0.05); ctx.closePath(); ctx.fill();
  } else if (type === 'house_large') {
    // reuse house drawing but scaled
    ctx.fillStyle = b.color;
    ctx.fillRect(x + pad, y + DT * 0.32, DT - pad * 2, DT * 0.62);
    ctx.fillStyle = b.roofColor;
    ctx.beginPath(); ctx.moveTo(x + DT / 2, y + pad); ctx.lineTo(x + DT - pad, y + DT * 0.38); ctx.lineTo(x + pad,   y + DT * 0.38); ctx.closePath(); ctx.fill();
  } else if (type === 'hut') {
    // small straw hut
    ctx.fillStyle = '#E6D2A3';
    ctx.fillRect(x + pad, y + DT * 0.44, DT * 0.6, DT * 0.42);
    ctx.fillStyle = b.roofColor || '#F2D16B';
    ctx.beginPath(); ctx.ellipse(x + DT * 0.3, y + DT * 0.36, DT * 0.28, DT * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5C3A1A'; ctx.fillRect(x + DT * 0.28, y + DT * 0.6, DT * 0.12, DT * 0.2);
  } else if (type === 'longhouse') {
    // long communal house, 3x1 footprint
    ctx.fillStyle = b.color;
    ctx.fillRect(x + pad, y + DT * 0.42, DT * 2.8, DT * 0.46);
    ctx.fillStyle = b.roofColor;
    ctx.beginPath(); ctx.moveTo(x + pad, y + DT * 0.42); ctx.lineTo(x + DT * 2.8 - pad, y + DT * 0.42); ctx.lineTo(x + DT * 1.4, y + DT * 0.12); ctx.closePath(); ctx.fill();
    // multiple doors
    ctx.fillStyle = '#4A2F12';
    for (let d = 0; d < 3; d++) ctx.fillRect(x + DT * (0.25 + d * 0.9), y + DT * 0.62, DT * 0.12, DT * 0.22);
  } else if (type === 'stone_house') {
    // stone house - sturdier look
    ctx.fillStyle = b.color || '#9A9EA3';
    ctx.fillRect(x + pad, y + DT * 0.32, DT - pad * 2, DT * 0.62);
    ctx.fillStyle = b.roofColor || '#6E6E6E';
    ctx.beginPath(); ctx.moveTo(x + DT / 2, y + pad); ctx.lineTo(x + DT - pad, y + DT * 0.38); ctx.lineTo(x + pad,   y + DT * 0.38); ctx.closePath(); ctx.fill();
    // small stone pattern
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let ry = 0; ry < 3; ry++) for (let rx = 0; rx < 4; rx++) ctx.fillRect(x + pad + rx * (DT * 0.22), y + DT * 0.34 + ry * (DT * 0.18), DT * 0.18, DT * 0.14);
  } else if (type === 'road') {
    // simple road tile: draw textured path
    ctx.fillStyle = '#6E5B46';
    ctx.fillRect(x, y + DT*0.6, DT, DT*0.36);
    ctx.fillStyle = '#9C8B6B';
    for (let i=0;i<3;i++) ctx.fillRect(x + (i+1)*(DT/4) - 1, y + DT*0.66, 2, DT*0.2);
  }

  ctx.restore();
}

function drawDiamond(x, y, w, h, fillStyle, strokeStyle, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

function drawTileHighlight(col, row, fillStyle, strokeStyle, lineWidth) {
  const { x, y } = worldToScreen(col, row);
  if (viewMode === 'iso') {
    const { w, h } = getIsoTileSize();
    drawDiamond(x, y, w, h, fillStyle, strokeStyle, lineWidth);
    return;
  }
  const tileSize = getTileSize();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, tileSize, tileSize);
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.strokeRect(x, y, tileSize, tileSize);
  }
}

function drawPlayer() {
  const { x, y } = worldToScreen(player.x, player.y);
  if (viewMode === 'iso') {
    const { w, h } = getIsoTileSize();
    const scale = Math.max(1, Math.floor(Math.min(w, getTileSize()) / 10));
    const spriteW = CHARACTER_MAP[0].length * scale;
    const spriteH = CHARACTER_MAP.length * scale;
    const px = Math.floor(x - spriteW / 2);
    // position sprite so feet sit on bottom vertex of the diamond
    const pCol = Math.floor(player.x), pRow = Math.floor(player.y);
    const inWater = movementMultiplier(pCol, pRow) < 1;
    const headRows = 4;
    const headH = headRows * scale;
    const py = inWater ? Math.floor(y + h - headH) : Math.floor(y + h - spriteH);
    const walkFrame = player._walkFrame || 0;
    const dir = player.dir || 'down';
    drawCharacterPixels(ctx, player.palette, px, py, scale, { dir, frame: walkFrame, headOnly: inWater });
    // draw player name above head
    try {
      if (player && player.name) {
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        const label = player.name;
        const textW = ctx.measureText(label).width;
        const lx = x - textW / 2 + spriteW / 2;
        const ly = py - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(lx - 4, ly - 12, textW + 8, 16);
        ctx.fillStyle = '#FFF'; ctx.fillText(label, lx, ly);
        ctx.restore();
      }
    } catch (e) {}
      // draw equipped item on player (simple overlay near hands)
      try {
      const it = player.equipped;
      if (it) {
        const handX = px + Math.floor(spriteW/2) + (dir === 'left' ? -6 : (dir === 'right' ? 6 : 0));
        const handY = py + Math.floor(spriteH * 0.6);
        ctx.save();
        ctx.translate(handX, handY);
        ctx.scale(scale, scale);
        // simple pixel representations
        if (it === 'stone-axe') {
          ctx.fillStyle = '#6b6b6b'; ctx.fillRect(-3, -1, 6, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(2,1,1,4);
        } else if (it === 'stone-pick') {
          ctx.fillStyle = '#6b6b6b'; ctx.fillRect(-3, -2, 5, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(2,0,1,4);
        } else if (it === 'stone-sword') {
          ctx.fillStyle = '#9a9a9a'; ctx.fillRect(-2, -3, 4, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(0,-1,1,5);
        } else if (it === 'plank' || it === 'stick') {
          ctx.fillStyle = '#8B5A38'; ctx.fillRect(-3, -1, 6, 2);
        } else if (it === 'campfire' || it === 'furnace') {
          ctx.fillStyle = '#6f6f6f'; ctx.fillRect(-3,-2,6,4); ctx.fillStyle='#c85'; ctx.fillRect(-1,0,2,2);
        } else {
          ctx.fillStyle = '#888'; ctx.fillRect(-3,-2,6,4);
        }
        ctx.restore();
      }
    } catch (e) {}
  } else {
    const tileSize = getTileSize();
    const scale = Math.max(1, Math.floor(Math.min(tileSize, 32) / 10));
    const spriteW = CHARACTER_MAP[0].length * scale;
    const spriteH = CHARACTER_MAP.length * scale;
    const px = Math.floor(x + tileSize * 0.5 - spriteW / 2);
    const pCol = Math.floor(player.x), pRow = Math.floor(player.y);
    const inWater = movementMultiplier(pCol, pRow) < 1;
    const headRows = 4;
    const headH = headRows * scale;
    const py = inWater ? Math.floor(y + tileSize - headH) : Math.floor(y + tileSize - spriteH);
    const walkFrame = player._walkFrame || 0;
    const dir = player.dir || 'down';
    drawCharacterPixels(ctx, player.palette, px, py, scale, { dir, frame: walkFrame, headOnly: inWater });
    // draw equipped item on player (orthographic)
    try {
      const it = player.equipped;
      if (it) {
        const handX = px + Math.floor(spriteW/2) + (dir === 'left' ? -6 : (dir === 'right' ? 6 : 0));
        const handY = py + Math.floor(spriteH * 0.6);
        ctx.save();
        ctx.translate(handX, handY);
        ctx.scale(scale, scale);
        if (it === 'stone-axe') {
          ctx.fillStyle = '#6b6b6b'; ctx.fillRect(-3, -1, 6, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(2,1,1,4);
        } else if (it === 'stone-pick') {
          ctx.fillStyle = '#6b6b6b'; ctx.fillRect(-3, -2, 5, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(2,0,1,4);
        } else if (it === 'stone-sword') {
          ctx.fillStyle = '#9a9a9a'; ctx.fillRect(-2, -3, 4, 2); ctx.fillStyle='#7a4a2a'; ctx.fillRect(0,-1,1,5);
        } else if (it === 'plank' || it === 'stick') {
          ctx.fillStyle = '#8B5A38'; ctx.fillRect(-3, -1, 6, 2);
        } else if (it === 'campfire' || it === 'furnace') {
          ctx.fillStyle = '#6f6f6f'; ctx.fillRect(-3,-2,6,4); ctx.fillStyle='#c85'; ctx.fillRect(-1,0,2,2);
        } else {
          ctx.fillStyle = '#888'; ctx.fillRect(-3,-2,6,4);
        }
        ctx.restore();
      }
    } catch (e) {}
    // draw player name (orthographic)
    try {
      if (player && player.name) {
        ctx.save(); ctx.font = 'bold 12px sans-serif';
        const label2 = player.name; const w2 = ctx.measureText(label2).width;
        const lx2 = x + tileSize * 0.5 - w2/2; const ly2 = py - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(lx2 - 4, ly2 - 12, w2 + 8, 16);
        ctx.fillStyle = '#FFF'; ctx.fillText(label2, lx2, ly2);
        ctx.restore();
      }
    } catch (e) {}
  }
}

function drawPlayerHealth() {
  // draw a small health bar above the player
  const pct = Math.max(0, Math.min(1, char.hp / char.maxHp));
  const { x, y } = worldToScreen(player.x, player.y);
  const barW = Math.max(32, getTileSize() * 0.6);
  const barH = 6;
  const px = x + getTileSize()*0.2 - barW/2;
  const py = y - 10 - barH;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px-1, py-1, barW+2, barH+2);
  ctx.fillStyle = 'rgba(180,50,50,0.9)';
  ctx.fillRect(px, py, barW, barH);
  ctx.fillStyle = 'rgba(60,200,80,0.95)';
  ctx.fillRect(px, py, barW * pct, barH);
}

// ── MAIN RENDER ─────────────────────────────────────────────--
function render() {
  const W = canvas.width, H = canvas.height;
  const now = Date.now();
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  // If the game hasn't been started from the main menu, don't run the simulation loop.
  if (!window._gameStarted) {
    // keep canvas quiet while menu is active
    try { ctx.clearRect(0,0,canvas.width, canvas.height); } catch (e) {}
    return;
  }
  // process any active fit-to-map transition (smooth zoom)
  if (fitTransition) {
    const elapsed = now - fitTransition.startTime;
    const t = Math.max(0, Math.min(1, elapsed / fitTransition.duration));
    // smoothstep easing
    const ease = t * t * (3 - 2 * t);
    zoom = lerp(fitTransition.startZoom, fitTransition.targetZoom, ease);
    if (t >= 1) {
      zoom = fitTransition.targetZoom;
      fitTransition = null;
      try { const s = document.getElementById('zoom-slider'); if (s) s.value = String(zoom); } catch (e) {}
    }
  }
  // smooth wheel-based zoom target (set by wheel handler)
  if (typeof targetZoom !== 'undefined') {
    if (Math.abs(zoom - targetZoom) > 0.0001) {
      // lerp towards targetZoom each frame for smoothness
      const zspeed = (typeof zoomLerpSpeed !== 'undefined') ? zoomLerpSpeed : 0.18;
      zoom = lerp(zoom, targetZoom, Math.min(0.95, zspeed + 0.02));
      // update slider value for visual feedback but avoid rebuilding cache every frame
      try { const s = document.getElementById('zoom-slider'); if (s) s.value = String(zoom); } catch (e) {}
      zoomAnimating = true;
    } else {
      if (zoomAnimating) {
        // final snap and one immediate cache rebuild
        zoom = targetZoom;
        mapCacheDirty = true;
        rebuildMapCacheDebounced(0);
        zoomAnimating = false;
      }
    }
  }
  const tileSize = getTileSize();
  const isoSize = getIsoTileSize();
  frameCounter++;
  try {
    // optional console debug logging controlled by Dev menu
    try {
      if (window.DEBUG_LOG_PLAYER_POS && frameCounter % 30 === 0) {
        console.debug('DEBUG player pos', { x: player.x, y: player.y, col: player.col, row: player.row });
      }
      if (window.DEBUG_LOG_CAMERA && frameCounter % 60 === 0) {
        console.debug('DEBUG camera', { camX, camY, zoom });
      }
    } catch (e) {}
    ctx.clearRect(0, 0, W, H);

    // Debug overlay (visible during development)
    try {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '12px sans-serif';
      const dbg = `mode:${editMode? 'EDIT':'FREE'} px:${(player.x||0).toFixed(2)} py:${(player.y||0).toFixed(2)} col:${player.col},${player.row} path:${movePath? movePath.length:0}`;
      ctx.fillText(dbg, 12, 18);
    } catch (dbgErr) {
      // ignore debug overlay errors
      console.warn('Debug overlay error', dbgErr);
    }

    // draw selection rectangle (screen space)
    try {
      if (_selectRect) {
        ctx.save();
        // more visible selection marquee: semi-opaque fill + dashed stroke
        ctx.fillStyle = 'rgba(80,140,255,0.18)';
        ctx.strokeStyle = 'rgba(70,110,200,0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6,4]);
        ctx.fillRect(_selectRect.x, _selectRect.y, _selectRect.w, _selectRect.h);
        ctx.strokeRect(_selectRect.x + 0.5, _selectRect.y + 0.5, Math.max(0, _selectRect.w-1), Math.max(0, _selectRect.h-1));
        ctx.setLineDash([]);
        // show preview label with count
        try {
          const lbl = (window._selectPreviewCount || 0) > 0 ? `Seleccionando: ${window._selectPreviewCount}` : 'Seleccionando';
          ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          const lx = _selectRect.x + 6; const ly = _selectRect.y + 6;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; const w = ctx.measureText(lbl).width + 8; ctx.fillRect(lx-4, ly-4, w, 20);
          ctx.fillStyle = '#FFF'; ctx.fillText(lbl, lx, ly);
        } catch (ee) {}
        ctx.restore();
      }
    } catch (e) {}

    // decorative mountain background (behind map)
    try { drawMountainsBackground(ctx, W, H); } catch (e) {}

  // Update player movement in free mode (continuous)
  if (!editMode) {
    // move player by tiles in small steps to avoid skipping collisions when sprinting
    function applyPlayerMoveTiles(dxTiles, dyTiles) {
      try {
        const maxStep = 0.45; // tiles per sub-step
        const dist = Math.hypot(dxTiles, dyTiles);
        if (!dist || dist <= 0) return false;
        const steps = Math.max(1, Math.ceil(dist / maxStep));
        const stepDx = dxTiles / steps;
        const stepDy = dyTiles / steps;
        let moved = false;
        for (let s = 0; s < steps; s++) {
          const tryX = player.x + stepDx;
          const tryY = player.y + stepDy;
          const tcol = Math.floor(tryX);
          const trow = Math.floor(tryY);
          if (canWalkTo(tcol, trow)) {
            player.x = tryX; player.y = tryY;
            player.col = Math.floor(player.x); player.row = Math.floor(player.y);
            moved = true;
          } else {
            break;
          }
        }
        return moved;
      } catch (e) { return false; }
    }
    // If there's a computed path (A*), follow it first
      if (movePath && movePath.length > 0) {
      const nextNode = movePath[0];
      const target = { x: nextNode.col + 0.5, y: nextNode.row + 0.5 };
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.18) {
        // reached this node, advance
        movePath.shift();
        if (movePath.length === 0) {
          movePath = null;
          moveTarget = null;
        }
      } else {
      // apply movement speed factor when crossing water
      const sprintPath = keyState['Shift'] ? 1.6 : 1.0;
      const baseNx = (dx / dist) * player.speed * dt * TILE * sprintPath;
      const baseNy = (dy / dist) * player.speed * dt * TILE * sprintPath;
      const curFactor = movementMultiplier(Math.floor(player.x), Math.floor(player.y));
      const targetFactor = movementMultiplier(nextNode.col, nextNode.row);
      const factor = Math.min(curFactor, targetFactor);
      const nx = baseNx * factor;
      const ny = baseNy * factor;
      // attempt movement in small sub-steps to avoid skipping and getting stuck
      const moved = applyPlayerMoveTiles(nx, ny);
      if (moved) {
        try { if (Math.abs(nx) > Math.abs(ny)) player.dir = nx > 0 ? 'right' : 'left'; else player.dir = ny > 0 ? 'down' : 'up'; } catch (e) {}
        player._walkTime = (player._walkTime || 0) + dt;
        player._walkFrame = Math.floor(player._walkTime * 3) % 2;
      } else {
        // collision on path; cancel path and fallback
        movePath = null; moveTarget = null;
      }
      }
    } else if (moveTarget) {
      const dx = moveTarget.x - player.x;
      const dy = moveTarget.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.1) {
        // reached
        moveTarget = null;
      } else {
        const sprintTarget = keyState['Shift'] ? 1.6 : 1.0;
        const baseNx = (dx / dist) * player.speed * dt * TILE * sprintTarget;
        const baseNy = (dy / dist) * player.speed * dt * TILE * sprintTarget;
        const curFactor = movementMultiplier(Math.floor(player.x), Math.floor(player.y));
        const tcol = Math.floor(moveTarget.x), trow = Math.floor(moveTarget.y);
        const targetFactor = movementMultiplier(tcol, trow);
        const factor = Math.min(curFactor, targetFactor);
        const nx = baseNx * factor;
        const ny = baseNy * factor;
        const moved = applyPlayerMoveTiles(nx, ny);
        if (moved) {
          try { if (Math.abs(nx) > Math.abs(ny)) player.dir = nx > 0 ? 'right' : 'left'; else player.dir = ny > 0 ? 'down' : 'up'; } catch (e) {}
          player._walkTime = (player._walkTime || 0) + dt;
          player._walkFrame = Math.floor(player._walkTime * 3) % 2;
        } else {
          moveTarget = null;
        }
      }
    } else {
      let mvx = 0, mvy = 0;
      if (keyState['ArrowUp'] || keyState['w']) mvy -= 1;
      if (keyState['ArrowDown'] || keyState['s']) mvy += 1;
      if (keyState['ArrowLeft'] || keyState['a']) mvx -= 1;
      if (keyState['ArrowRight'] || keyState['d']) mvx += 1;
      if (mvx !== 0 || mvy !== 0) {
        // cancel auto path/target when player takes direct control
        moveTarget = null; movePath = null;
        const len = Math.hypot(mvx, mvy) || 1;
        mvx /= len; mvy /= len;
        const sprintDirect = keyState['Shift'] ? 1.6 : 1.0;
        const baseDX = mvx * player.speed * dt * TILE * sprintDirect;
        const baseDY = mvy * player.speed * dt * TILE * sprintDirect;
        const curFactor = movementMultiplier(Math.floor(player.x), Math.floor(player.y));
        const targetColGuess = Math.floor(player.x + baseDX);
        const targetRowGuess = Math.floor(player.y + baseDY);
        const targetFactor = movementMultiplier(targetColGuess, targetRowGuess);
        const factor = Math.min(curFactor, targetFactor);
        const dxTiles = baseDX * factor;
        const dyTiles = baseDY * factor;
        const moved = applyPlayerMoveTiles(dxTiles, dyTiles);
        if (moved) {
          try { if (Math.abs(mvx) > Math.abs(mvy)) player.dir = mvx > 0 ? 'right' : 'left'; else player.dir = mvy > 0 ? 'down' : 'up'; } catch (e) {}
          player._walkTime = (player._walkTime || 0) + dt;
          player._walkFrame = Math.floor(player._walkTime * 3) % 2;
        }
      }
    }
  } else {
    // snap float position to grid when in edit mode
    player.x = player.col; player.y = player.row;
  }

  // persist player position periodically (throttled)
  try {
    if (now - lastSavePosTime > 3000) { savePlayerPos(false); lastSavePosTime = now; }
  } catch (err) { /* ignore */ }

  // Survival tick: decay hunger/thirst and apply penalties
  try {
    const nowSurv = now;
    const last = char._lastSurvivalTick || nowSurv;
    const elapsed = (nowSurv - last) / 1000;
    if (elapsed >= 0.5) {
      const hr = window.SURVIVAL_HUNGER_RATE || 0.05;
      const tr = window.SURVIVAL_THIRST_RATE || 0.08;
      char.hunger = Math.max(0, (char.hunger || char.maxHunger || 100) - hr * elapsed);
      char.thirst = Math.max(0, (char.thirst || char.maxThirst || 100) - tr * elapsed);
      char._lastSurvivalTick = nowSurv;
      // speed penalty when low
      try {
        const lowThresh = (char.maxHunger || 100) * 0.3;
        if ((char.hunger || 0) <= 0 || (char.thirst || 0) <= 0) {
          // take slow damage when starving/very thirsty
          const dmg = (elapsed / 60) * 3; // ~3 HP per minute
          char.hp = Math.max(0, (char.hp || 0) - dmg);
        }
        if ((char.hunger || 0) < lowThresh || (char.thirst || 0) < lowThresh) {
          player.speed = Math.max(1 / TILE, (player._baseSpeed || (6 / TILE)) * 0.7);
        } else {
          player.speed = player._baseSpeed || (6 / TILE);
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Sky gradient
  // Day-night progression
  prevDayHour = dayHour;
  dayHour += dt * 24 / DAY_SECONDS;
  if (dayHour >= 24) dayHour -= 24;
  // if day wrapped, apply daily production
  if (prevDayHour > dayHour) {
    applyDailyProduction();
  }
  // sky colors: simple day/night bands
  const isDay = dayHour >= 6 && dayHour <= 18;
  const sky = ctx.createLinearGradient(0,0,0,H);
  if (isDay) {
    sky.addColorStop(0, '#87CEEB');
    sky.addColorStop(0.5, '#E8D5A3');
    sky.addColorStop(1, '#C8A84B');
  } else {
    sky.addColorStop(0, '#061428');
    sky.addColorStop(0.6, '#041733');
    sky.addColorStop(1, '#021017');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // subtle night overlay based on hour distance from noon
  const nightFactor = (dayHour < 6 ? 1 : (dayHour > 18 ? 1 : 0)) * 0.55;
  if (nightFactor > 0) {
    ctx.fillStyle = `rgba(2,8,20,${nightFactor})`;
    ctx.fillRect(0,0,W,H);
  }

  // (Cloud overlay moved) - now rendered as a soft difuminado overlay

  // --- Survival HUD (top-right) ---
  try {
    const hudW = 180; const hudH = 48; const pad = 8;
    const px = W - hudW - pad; const py = pad + 6;
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px, py, hudW, hudH);
    // Hunger bar
    const hungerPct = Math.max(0, Math.min(1, (char.hunger || 0) / (char.maxHunger || 100)));
    ctx.fillStyle = '#8B5A2B'; ctx.fillRect(px + 10, py + 8, (hudW - 20) * hungerPct, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '12px sans-serif'; ctx.fillText('Hambre', px + 10, py + 7);
    // Thirst bar
    const thirstPct = Math.max(0, Math.min(1, (char.thirst || 0) / (char.maxThirst || 100)));
    ctx.fillStyle = '#2E8BFF'; ctx.fillRect(px + 10, py + 26, (hudW - 20) * thirstPct, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '12px sans-serif'; ctx.fillText('Sed', px + 10, py + 25);
  } catch (e) {}

  // ── TILES ─────────────────────────────────────────────────-
  // If an interior is active, render that map instead of the world
  // visible bounds (declared here so interior branch can assign them)
  let minC, maxC, minR, maxR;

  if (window.currentInterior) {
    try {
      const interior = window.currentInterior;
      const cols = interior.width || interior.cols || (interior.tiles && interior.tiles[0] ? interior.tiles[0].length : 8);
      const rows = interior.height || interior.rows || (interior.tiles ? interior.tiles.length : 6);
      // simple interior tile rendering: use provided tile chars or colors
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const { x, y } = worldToScreen(c, r);
          const t = (interior.tiles && interior.tiles[r] && interior.tiles[r][c]) ? interior.tiles[r][c] : 'floor';
          let color = '#BDA27D';
          if (t === 'wall') color = '#6B4C3B'; else if (t === 'door') color = '#8B5A2B'; else if (t === 'floor') color = '#C8B48A';
          ctx.fillStyle = color; ctx.fillRect(x, y, getTileSize(), getTileSize());
        }
      }
      // auto-exit if standing on interior exit tile
      if (typeof interior.exitCol === 'number' && typeof interior.exitRow === 'number') {
        if (Math.floor(player.x) === interior.exitCol && Math.floor(player.y) === interior.exitRow) {
          try { if (window.exitInterior) window.exitInterior(); } catch (e) {}
        }
      }
      // skip world tile loop by making visible bounds empty
      minC = 1; maxC = 0; minR = 1; maxR = 0;
    } catch (e) { console.warn('Error rendering interior', e); }
  }
  // compute visible world bounds to avoid iterating entire map
  if (viewMode === 'iso') {
    // Render entire map in isometric mode to avoid missing fragments when zoomed
    minC = 0; maxC = COLS - 1; minR = 0; maxR = ROWS - 1;
  } else {
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(W, H);
    minC = Math.max(0, Math.floor(Math.min(topLeft.col, bottomRight.col) - 2));
    maxC = Math.min(COLS - 1, Math.ceil(Math.max(topLeft.col, bottomRight.col) + 2));
    minR = Math.max(0, Math.floor(Math.min(topLeft.row, bottomRight.row) - 2));
    maxR = Math.min(ROWS - 1, Math.ceil(Math.max(topLeft.row, bottomRight.row) + 2));
  }

  // Debug overlay: show projected map corners and world bounds when enabled
  if (window.DEBUG_ISO) {
    try {
      ctx.save();
      const a = projectIso(0, 0); const b = projectIso(COLS - 1, 0);
      const c = projectIso(0, ROWS - 1); const d = projectIso(COLS - 1, ROWS - 1);
      const pts = [a, b, d, c];
      // draw corner markers
      ctx.fillStyle = 'rgba(255,0,0,0.9)';
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x + camX, p.y + camY, 6, 0, Math.PI*2); ctx.fill(); });
      // draw bounding polygon
      ctx.strokeStyle = 'rgba(255,200,50,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pts[0].x + camX, pts[0].y + camY);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x + camX, pts[i].y + camY);
      ctx.closePath(); ctx.stroke();
      // label
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '12px monospace';
      ctx.fillText('ISO CORNERS', pts[0].x + camX + 8, pts[0].y + camY - 8);
      ctx.restore();
    } catch (err) { /* ignore debug drawing errors */ }
  }

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const { x, y } = worldToScreen(c, r);
      // If we have a map cache and it's fresh and we're in edit mode, draw it once and skip per-tile drawing
      // In free mode we prefer per-tile high-detail rendering, so bypass the cache.
      if (mapCache && !mapCacheDirty && editMode) {
        const cacheZoom = mapCache._cacheZoom || zoom;
        const scale = zoom / cacheZoom;
        if (viewMode === 'iso' && mapCache._isoOffset) {
          // draw iso cache aligned with cam, scaled to current zoom
          const destX = Math.round(mapCache._isoOffset.minX * scale + camX);
          const destY = Math.round(mapCache._isoOffset.minY * scale + camY);
          const destW = Math.round(mapCache.width * scale);
          const destH = Math.round(mapCache.height * scale);
          // adjust image smoothing for quality LOD: higher zoom => smooth, lower zoom => disable (crisper/cheaper)
          const prevSmoothing = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = zoom >= GRAPHICS_CONFIG.smoothingThreshold;
          ctx.drawImage(mapCache, 0, 0, mapCache.width, mapCache.height, destX, destY, destW, destH);
          ctx.imageSmoothingEnabled = prevSmoothing;
          // skip the tile loop entirely
          r = maxR; // break outer loop
          break;
        } else if (viewMode !== 'iso') {
          // orthographic: draw cached map positioned at camX/camY, scaled to current zoom
          const destW = Math.round(mapCache.width * scale);
          const destH = Math.round(mapCache.height * scale);
          const prevSmoothing = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = zoom >= GRAPHICS_CONFIG.smoothingThreshold;
          ctx.drawImage(mapCache, 0, 0, mapCache.width, mapCache.height, Math.round(camX), Math.round(camY), destW, destH);
          ctx.imageSmoothingEnabled = prevSmoothing;
          r = maxR; break;
        }
      }
      if (viewMode === 'iso') {
        const w = isoSize.w;
        const h = isoSize.h;
        if (x + w / 2 < 0 || x - w / 2 > W || y + h < 0 || y > H) continue;
        if (tileBiome[r][c] === 'water' || isRiver(c)) {
          // cheaper water rendering: single color + occasional streaks
          const base = `hsl(205,60%,${40 + Math.sin((now)*0.002 + r*0.4 + c*0.3) * 2}%)`;
          drawDiamond(x, y, w, h, base, null, null);
          if (frameCounter % 6 === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
              const ry = y + h * (0.35 + i * 0.25) + Math.sin((now)*0.003 + i + r) * 2;
              ctx.beginPath();
              ctx.moveTo(x - w * 0.35, ry);
              ctx.lineTo(x + w * 0.35, ry);
              ctx.stroke();
            }
          }
        } else {
          const biome = tileBiome[r][c] || 'sand';
          if (biome === 'road') {
            drawDiamond(x, y, w, h, '#D7C59A', null, null);
          } else if (biome === 'forest') {
            drawDiamond(x, y, w, h, '#2E6FA3', null, null);
          } else if (biome === 'hills') {
            drawDiamond(x, y, w, h, '#B8860B', null, null);
          } else if (biome === 'grass') {
            drawDiamond(x, y, w, h, '#9BC17A', null, null);
          } else {
            const sandVar = ((c*7 + r*13) % 5) * 3;
            const sand = `rgb(${200+sandVar},${165+sandVar},${100+sandVar})`;
            drawDiamond(x, y, w, h, sand, null, null);
          }
          if (isNearRiver(c)) drawDiamond(x, y, w, h, 'rgba(74,124,63,0.15)', null, null);
        }
        
        // only draw grid stroke when in edit mode
        if (editMode) drawDiamond(x, y, w, h, null, 'rgba(0,0,0,0.1)', 0.5);
      } else {
        if (x + tileSize < 0 || x > W || y + tileSize < 0 || y > H) continue;
        if (tileBiome[r][c] === 'water' || isRiver(c)) {
          const base = `hsl(205,60%,${40 + Math.sin((now)*0.002 + r*0.4 + c*0.3) * 2}%)`;
          ctx.fillStyle = base;
          ctx.fillRect(x, y, tileSize, tileSize);
          if (frameCounter % 6 === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
              const ry = y + 6 + i*10 + Math.sin((now)*0.003 + i + r)*3;
              ctx.beginPath();
              ctx.moveTo(x+2, ry);
              ctx.lineTo(x+tileSize-2, ry);
              ctx.stroke();
            }
          }
        } else {
          const biome = tileBiome[r][c] || 'sand';
          // micro-tiles inside each tile for higher-detail landscapes
          const subdiv = Math.min(4, Math.max(1, Math.floor(tileSize / 8)));
          if (subdiv > 1) {
            const sw = tileSize / subdiv;
            for (let sy = 0; sy < subdiv; sy++) {
              for (let sx = 0; sx < subdiv; sx++) {
                const nx = x + sx * sw;
                const ny = y + sy * sw;
                const v = tileNoise(c, r, sx, sy);
                if (biome === 'forest') {
                  // darker/lighter greens
                  const g = Math.floor(100 + v * 80);
                  ctx.fillStyle = `rgb(${30+Math.floor(v*10)},${g},${50})`;
                } else if (biome === 'hills') {
                  const b = 110 + Math.floor(v * 40);
                  ctx.fillStyle = `rgb(${150},${120},${b})`;
                } else if (biome === 'grass') {
                  const g = 140 + Math.floor(v * 60);
                  ctx.fillStyle = `rgb(${80},${g},${60})`;
                } else {
                  const s = 200 + Math.floor((c*7 + r*13 + sx*3 + sy*5) % 20);
                  ctx.fillStyle = `rgb(${s},${165 + (s%6)},${100 + (s%6)})`;
                }
                ctx.fillRect(nx, ny, Math.ceil(sw)+1, Math.ceil(sw)+1);
              }
            }
          } else {
            if (biome === 'road') {
              // draw cobblestone-like road tile
              ctx.fillStyle = '#D7C59A'; ctx.fillRect(x, y, tileSize, tileSize);
              ctx.fillStyle = '#C9B286';
              const stoneW = Math.max(4, Math.floor(tileSize/4));
              const stoneH = Math.max(4, Math.floor(tileSize/6));
              for (let ry=0; ry<3; ry++) {
                for (let rx=0; rx<3; rx++) {
                  const sx = x + rx * (stoneW + 2) + (ry%2 ? 2 : 0);
                  const sy = y + ry * (stoneH + 2) + 2;
                  ctx.fillStyle = (rx+ry)%2 ? '#C5A96A' : '#E0C99A';
                  ctx.fillRect(sx, sy, stoneW, stoneH);
                }
              }
            } else if (biome === 'forest') {
              ctx.fillStyle = '#2E6FA3';
              ctx.fillRect(x, y, tileSize, tileSize);
            } else if (biome === 'hills') {
              ctx.fillStyle = '#B8860B';
              ctx.fillRect(x, y, tileSize, tileSize);
            } else if (biome === 'grass') {
              ctx.fillStyle = '#9BC17A';
              ctx.fillRect(x, y, tileSize, tileSize);
            } else {
              const sandVar = ((c*7 + r*13) % 5) * 3;
              ctx.fillStyle = `rgb(${200+sandVar},${165+sandVar},${100+sandVar})`;
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          }
          if (isNearRiver(c)) { ctx.fillStyle = 'rgba(74,124,63,0.15)'; ctx.fillRect(x, y, tileSize, tileSize); }
        }

        // only draw cell borders in edit mode
        if (editMode) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, tileSize, tileSize);
        }
      }
    }
  }

  // ── BUILDINGS ─────────────────────────────────────────────
  // Trees are now entities (each tree is an entity) — entity rendering handles them
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const info = getCellInfo(c, r);
      if (!info || !info.isBase) continue;
      drawBuilding(info.baseCol, info.baseRow, info.type);
    }
  }

  // ── ENTITIES (resources) ─────────────────────────────────
  entities.forEach(ent => {
    if (!ent) return;
    // ensure continuous position fields for smooth movement
    if (typeof ent.x !== 'number') ent.x = ent.col;
    if (typeof ent.y !== 'number') ent.y = ent.row;
    const { x, y } = worldToScreen(ent.x, ent.y);
    const nowEnt = Date.now();
    if (ent.kind === 'resource') {
      const subtype = ent.subtype;
      // add a subtle pulsing to resources so they look special
      // slower, gentler pulse
      const pulse = 1 + 0.06 * Math.sin(now / 800 + (ent.col * 7 + ent.row * 13));
      if (viewMode === 'iso') {
        const { w, h } = getIsoTileSize();
        // different visuals per subtype
        if (subtype === 'wheat') {
          const sizeW = w * 0.85 * pulse;
          const sizeH = h * 0.85 * pulse;
          ctx.fillStyle = '#DAA520';
          drawDiamond(x, y, sizeW, sizeH, ctx.fillStyle, null, null);
        } else if (subtype === 'wood') {
          // draw a small log with grain marks
          const lw = Math.max(6, Math.floor(w * 0.36 * pulse));
          const lh = Math.max(6, Math.floor(h * 0.28 * pulse));
          const lx = x - lw/2, ly = y - lh*0.2;
          ctx.fillStyle = '#8B5A38'; ctx.fillRect(lx, ly, lw, lh);
          ctx.fillStyle = '#7A4A2A';
          for (let i=0;i<3;i++) ctx.fillRect(lx + 2 + i* (lw/4), ly + 2 + (i%2), 1, lh-4);
        } else if (subtype === 'stone') {
          // draw a small stone/rock cluster
          const rw = Math.max(6, Math.floor(w * 0.5 * pulse));
          const rh = Math.max(6, Math.floor(h * 0.4 * pulse));
          const rx = x - rw/2, ry = y - rh*0.3;
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.ellipse(rx + rw*0.45, ry + rh*0.5, rw*0.45, rh*0.4, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = '#6f6f6f';
          ctx.beginPath();
          ctx.ellipse(rx + rw*0.2, ry + rh*0.55, rw*0.18, rh*0.28, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(rx + rw*0.7, ry + rh*0.6, rw*0.18, rh*0.25, 0, 0, Math.PI*2);
          ctx.fill();
        } else if (subtype === 'mountain') {
          try {
            const { w: iw, h: ih } = getIsoTileSize();
            // make mountain a bit taller than a tile
            const mw = Math.max(20, Math.floor(iw * 1.4));
            const mh = Math.max(20, Math.floor(ih * 1.6));
            drawEntitySpriteAt('mountain', x, y - ih*0.08, mw, mh);
          } catch (e) { console.warn('mountain draw err', e); }
        } else {
          const sizeW = w * 0.6 * pulse;
          const sizeH = h * 0.6 * pulse;
          ctx.fillStyle = '#A0522D';
          drawDiamond(x, y, sizeW, sizeH, ctx.fillStyle, null, null);
        }
      } else {
        const tileSize = getTileSize();
        const sz = tileSize * 0.42 * pulse;
        const cx = x + tileSize*0.5 - sz*0.5;
        const cy = y + tileSize*0.5 - sz*0.5;
        if (subtype === 'wheat') {
          ctx.fillStyle = '#DAA520'; ctx.fillRect(cx, cy, sz, sz);
        } else if (subtype === 'wood') {
          // draw a plank with grain
          ctx.fillStyle = '#8B5A38'; ctx.fillRect(cx, cy + sz*0.15, sz, sz*0.7);
          ctx.fillStyle = '#7A4A2A';
          for (let i=0;i<3;i++) ctx.fillRect(cx + 2 + i*(sz/4), cy + sz*0.2, 1, sz*0.6);
        } else if (subtype === 'stone') {
          // small rock block
          ctx.fillStyle = '#808080'; ctx.fillRect(cx, cy + sz*0.1, sz, sz*0.8);
          ctx.fillStyle = '#6b6b6b'; ctx.fillRect(cx + 2, cy + sz*0.25, sz*0.25, sz*0.5);
        } else {
          ctx.fillStyle = '#A0522D'; ctx.fillRect(cx, cy, sz, sz);
        }
      }
    } else if (ent.kind === 'player') {
      // draw NPC using character pixels if a palette is present so NPCs look like the player
        const tileSize = getTileSize();
        // smooth interpolation towards moveTarget (if present)
        try {
          if (ent.moveTarget) {
            const dx = ent.moveTarget.x - ent.x;
            const dy = ent.moveTarget.y - ent.y;
            // update facing based on movement vector
            try {
              if (Math.abs(dx) > Math.abs(dy)) {
                ent.dir = (dx < 0) ? 'left' : 'right';
              } else {
                ent.dir = (dy < 0) ? 'up' : 'down';
              }
            } catch (e) {}
            const dist = Math.hypot(dx, dy) || 0.0001;
            const speedTiles = ent.speed || 1.2; // tiles per second
            const step = speedTiles * dt; // world units per frame
            if (dist <= step) {
              ent.x = ent.moveTarget.x; ent.y = ent.moveTarget.y; ent.col = Math.floor(ent.x); ent.row = Math.floor(ent.y); delete ent.moveTarget;
            } else {
              ent.x += (dx / dist) * step; ent.y += (dy / dist) * step; ent.col = Math.floor(ent.x); ent.row = Math.floor(ent.y);
            }
            // update simple walking frame
            ent._walkTime = (ent._walkTime || 0) + dt;
            ent._walkFrame = Math.floor(ent._walkTime * 3) % 2;
          }
        } catch (e) {}
      try {
        const palette = ent.palette || DEFAULT_PALETTE;
        // choose a small scale so the sprite fits inside the tile
        const scale = Math.max(1, Math.floor(tileSize / 8));
        const spriteW = CHARACTER_MAP[0].length * scale;
        const spriteH = CHARACTER_MAP.length * scale;
        const px = Math.floor(x + tileSize*0.5 - spriteW / 2);
        const py = Math.floor(y + tileSize - spriteH);
        const dir = ent.dir || 'down';
        const walkFrame = ent._walkFrame || 0;
        drawCharacterPixels(ctx, palette, px, py, scale, { dir, frame: walkFrame });
        // draw hp bar above the tile
        const hpPct = Math.max(0, (ent.hp || 0) / (ent.maxHp || 1));
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + tileSize*0.15, y + tileSize*0.08, tileSize*0.7, 6);
        ctx.fillStyle = 'rgba(60,200,80,0.95)'; ctx.fillRect(x + tileSize*0.15, y + tileSize*0.08, tileSize*0.7 * hpPct, 6);
        if (ent._flashUntil && now < ent._flashUntil) {
          ctx.fillStyle = 'rgba(220,40,40,0.25)'; ctx.fillRect(x + tileSize*0.15, y + tileSize*0.15, tileSize*0.7, tileSize*0.7);
        }
      } catch (e) {
        // fallback to simple portrait box
        ctx.fillStyle = '#222';
        ctx.fillRect(x + tileSize*0.15, y + tileSize*0.15, tileSize*0.7, tileSize*0.7);
        ctx.fillStyle = '#C8956C';
        ctx.fillRect(x + tileSize*0.3, y + tileSize*0.22, tileSize*0.4, tileSize*0.4);
      }
      // draw NPC name above head when nearby and zoomed in
      try {
        const NAME_ZOOM_THRESHOLD = 0.6;
        const NAME_MAX_DIST = 5.0; // world units
        const dist = Math.hypot(ent.x - player.x, ent.y - player.y);
        if (zoom >= NAME_ZOOM_THRESHOLD && dist <= NAME_MAX_DIST && ent.name) {
          const p = worldToScreen(ent.x + 0.5, ent.y - 0.2);
          ctx.save(); ctx.font = '12px sans-serif';
          const w = ctx.measureText(ent.name).width;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - w/2 - 4, p.y - 18, w + 8, 16);
          ctx.fillStyle = '#FFF'; ctx.fillText(ent.name, p.x - w/2, p.y - 6);
          ctx.restore();
        }
      } catch (e) {}
      // highlight NPC if selected
      try {
        if (Array.isArray(window._selectedEntities) && window._selectedEntities.find(s => s && s.id === ent.id)) {
          const bx = x + tileSize*0.5; const by = y + tileSize*0.9; const rrad = Math.max(8, tileSize * 0.26);
          ctx.save();
          // pulsing selection ring
          const pulse = 1 + Math.sin(frameCounter * 0.12) * 0.08;
          ctx.strokeStyle = 'rgba(120,200,255,0.98)'; ctx.lineWidth = 2 * (1.0 * pulse);
          ctx.beginPath(); ctx.ellipse(bx, by, rrad * pulse, rrad*0.5 * pulse, 0, 0, Math.PI*2); ctx.stroke();
          // solid badge above head
          try {
            const p = worldToScreen(ent.x + 0.5, ent.y - 0.2);
            ctx.fillStyle = 'rgba(60,140,255,0.98)'; ctx.beginPath(); ctx.arc(p.x, p.y - 18, Math.max(4, tileSize*0.08), 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#FFF'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✓', p.x, p.y - 18);
          } catch (ee) {}
          ctx.restore();
        }
      } catch (e) {}
    } else if (ent.kind === 'tree') {
      // variant-aware pixel-art tree/vegetation drawing
      const tileSize = getTileSize();
      const variant = (ent.variant || 'oak');
      // small grass/weed variants: draw a tiny tuft
      if (variant === 'tallgrass' || variant === 'weed') {
        const tpl = GLOBAL_TREE_TEMPLATES[6];
        const scale = Math.max(1, Math.floor(tileSize / 6 * (ent.size || 0.6)));
        const cx = Math.floor(x + tileSize * 0.5);
        const cy = Math.floor(y + tileSize - 2);
        const spriteW = (2 + 1) * scale;
        const spriteH = (1 + 1) * scale;
        const sx = cx - Math.floor(spriteW / 2);
        const sy = cy - spriteH;
        for (const [px, py, color] of tpl) {
          ctx.fillStyle = color;
          ctx.fillRect(sx + px * scale, sy + py * scale, scale, scale);
        }
      } else if (variant === 'hedge') {
        const tpl = GLOBAL_TREE_TEMPLATES[5];
        const scale = Math.max(1, Math.floor(tileSize / 5 * (ent.size || 0.8)));
        const cx = Math.floor(x + tileSize * 0.5);
        const cy = Math.floor(y + tileSize - 2);
        const spriteW = (4 + 1) * scale;
        const spriteH = (1 + 1) * scale;
        const sx = cx - Math.floor(spriteW / 2);
        const sy = cy - spriteH;
        for (const [px, py, color] of tpl) {
          ctx.fillStyle = color;
          ctx.fillRect(sx + px * scale, sy + py * scale, scale, scale);
        }
      } else {
        // map variants to templates
        const map = { pine:0, tallslim:4, oak:1, broad:1, round:1, scrub:2, bush:2, shrub:2, multi:3 };
        let idx = (map[variant] !== undefined) ? map[variant] : Math.floor(tileNoise(ent.col || 0, ent.row || 0, 5, 6) * GLOBAL_TREE_TEMPLATES.length);
        idx = Math.max(0, Math.min(GLOBAL_TREE_TEMPLATES.length - 1, idx));
        const tpl = GLOBAL_TREE_TEMPLATES[idx];
        // scale trees based on tile size and entity size hint
        const lodFactor = zoom >= GRAPHICS_CONFIG.smoothingThreshold ? 1 : 0.8;
        // make trees noticeably taller by increasing base scale divisor and
        // applying entity size multiplier (larger for 'tall' variants)
        let baseScale = Math.floor((tileSize / 3) * lodFactor);
        if (ent.variant === 'tall' || ent.variant === 'tallslim') baseScale = Math.floor(baseScale * 1.5);
        const scale = Math.max(1, Math.floor(baseScale * (ent.size || 1)));
        // compute sprite dims
        let maxX = 0, maxY = 0;
        for (const p of tpl) { if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
        const spriteW = (maxX + 1) * scale;
        const spriteH = (maxY + 1) * scale;
        const jitterX = Math.floor((tileNoise(ent.col || 0, ent.row || 0, 7, 8) - 0.5) * tileSize * 0.18);
        const cx = Math.floor(x + tileSize * 0.5 + jitterX);
        const cy = Math.floor(y + tileSize - 2);
        const sx = cx - Math.floor(spriteW / 2);
        const sy = cy - spriteH;
        for (const [px, py, color] of tpl) {
          ctx.fillStyle = color;
          ctx.fillRect(sx + px * scale, sy + py * scale, scale, scale);
        }
      }

      // interaction hint: comic bubble with 'E' when player is near
      const dist = Math.hypot(ent.col - player.x, ent.row - player.y);
      if (dist < 1.5 && !ent._chopUntil) {
        const bx = x + tileSize*0.5; const by = y - 12;
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = '#222';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx-12, by-18, 24, 20, 6) : ctx.rect(bx-12, by-18, 24, 20);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.font = '14px monospace'; ctx.fillText('E', bx-4, by-4);
      }

      // chopping in progress: draw circular progress and finish when done
      if (ent._chopUntil) {
        const total = Math.max(1, ent._chopUntil - (ent._chopStart || (ent._chopUntil - 2000)));
        const elapsed = Math.max(0, nowEnt - (ent._chopStart || (ent._chopUntil - 2000)));
        const pct = Math.min(1, elapsed / total);
        // draw progress arc
        const cx = x + tileSize*0.5, cy = y + tileSize*0.15, r = Math.max(6, Math.floor(tileSize*0.12));
        ctx.beginPath(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(200,200,50,0.95)';
        ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + pct * Math.PI * 2); ctx.stroke();
        // finish chopping
        if (nowEnt >= ent._chopUntil) {
          try {
            // remove the tree entity
            const idx = entities.findIndex(e => e && e.id === ent.id);
            if (idx >= 0) entities.splice(idx, 1);
          } catch (e) {}
          try {
            // drop food sometimes from shrubs/bushes instead of wood
            let drop = 'wood';
            try {
              const variant = ent.variant || '';
              if (variant === 'bush' || variant === 'shrub' || variant === 'tallgrass' || variant === 'weed') {
                // 50% chance to drop food
                if (Math.random() < 0.5) drop = 'food';
                else drop = 'wood';
              }
            } catch (e) {}
            placeResource(ent.col, ent.row, drop);
          } catch (e) {}
        }
      }
    }
  });

  // ── RABBITS ──────────────────────────────────────────────
  rabbits.forEach(rab => {
    if (typeof rab.x !== 'number') rab.x = rab.col;
    if (typeof rab.y !== 'number') rab.y = rab.row;
    const { col, row, hp, maxHp, size } = rab;
    const { x, y } = worldToScreen(rab.x, rab.y);
    const tileSize = getTileSize();
    // rabbit: prefer pixel-art bitmap if available, else fallback to simple vector art
    const bmpRabbit = (window._ENTITY_BITMAPS && (window._ENTITY_BITMAPS['rabbit'] || window._ENTITY_BITMAPS['animal.rabbit'] || window._ENTITY_BITMAPS['rabbit-0'])) ? (window._ENTITY_BITMAPS['rabbit'] || window._ENTITY_BITMAPS['animal.rabbit'] || window._ENTITY_BITMAPS['rabbit-0']) : null;
    const rsz = Math.max(6, tileSize * (size || 0.45));
    if (bmpRabbit) {
      try {
        // determine facing: prefer explicit moveTarget, otherwise use last X delta
        let flip = false;
        try {
          if (rab.moveTarget) {
            flip = (rab.moveTarget.x < rab.x);
          } else if (typeof rab._lastX === 'number') {
            flip = (rab.x < rab._lastX);
          }
        } catch (e) {}
        ctx.save(); try { ctx.imageSmoothingEnabled = false; } catch(e){}
        const w = Math.max(6, tileSize * (0.6 * (size || 0.45)));
        const h = w;
        const cx = x + tileSize*0.5;
        const cy = y + tileSize*0.5;
        if (flip) {
          ctx.translate(cx, cy);
          ctx.scale(-1, 1);
          ctx.drawImage(bmpRabbit, -w/2, -h/2, w, h);
        } else {
          ctx.drawImage(bmpRabbit, cx - w/2, cy - h/2, w, h);
        }
        ctx.restore();
      } catch (e) { /* ignore draw errors */ }
    } else {
      ctx.fillStyle = '#fff';
      // body
      ctx.beginPath(); ctx.ellipse(x + tileSize*0.5, y + tileSize*0.55, rsz*0.6, rsz*0.45, 0, 0, Math.PI*2); ctx.fill();
      // head
      ctx.beginPath(); ctx.arc(x + tileSize*0.5 + rsz*0.45, y + tileSize*0.45, rsz*0.35, 0, Math.PI*2); ctx.fill();
      // ears
      ctx.fillStyle = '#eee'; ctx.fillRect(x + tileSize*0.5 + rsz*0.6, y + tileSize*0.12, rsz*0.12, rsz*0.5);
      ctx.fillRect(x + tileSize*0.5 + rsz*0.3, y + tileSize*0.1, rsz*0.12, rsz*0.5);
      // eye
      ctx.fillStyle = '#222'; ctx.fillRect(x + tileSize*0.5 + rsz*0.55, y + tileSize*0.44, 2, 2);
    }
    // HP bar above
    const hpPct = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + tileSize*0.35, y + tileSize*0.18, tileSize*0.3, 4);
    ctx.fillStyle = 'rgba(200,50,50,0.95)'; ctx.fillRect(x + tileSize*0.35, y + tileSize*0.18, tileSize*0.3, 4);
    ctx.fillStyle = 'rgba(60,200,80,0.95)'; ctx.fillRect(x + tileSize*0.35, y + tileSize*0.18, tileSize*0.3 * hpPct, 4);
    // flash when hit
    if (rab._flashUntil && now < rab._flashUntil) {
      ctx.fillStyle = 'rgba(220,40,40,0.25)'; ctx.fillRect(x, y, tileSize, tileSize);
    }
    // draw name for rabbits when nearby and zoomed in
    try {
      const NAME_ZOOM_THRESHOLD = 0.6;
      const NAME_MAX_DIST = 5.0;
      if (zoom >= NAME_ZOOM_THRESHOLD) {
        const dist = Math.hypot(rab.x - player.x, rab.y - player.y);
        if (dist <= NAME_MAX_DIST && rab.name) {
          const p = worldToScreen(rab.x + 0.5, rab.y - 0.2);
          ctx.save(); ctx.font = '12px sans-serif';
          const w = ctx.measureText(rab.name).width;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - w/2 - 4, p.y - 18, w + 8, 16);
          ctx.fillStyle = '#FFF'; ctx.fillText(rab.name, p.x - w/2, p.y - 6);
          ctx.restore();
        }
      }
    } catch (e) {}
    // highlight if selected
    try {
      if (Array.isArray(window._selectedEntities) && window._selectedEntities.find(s => s && s.id === rab.id)) {
        const bx = x + tileSize*0.5; const by = y + tileSize*0.85; const rrad = Math.max(6, tileSize * 0.22);
        ctx.save(); ctx.strokeStyle = 'rgba(120,180,255,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by, rrad, rrad*0.6, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
      }
    } catch (e) {}
  });

  // Smoothly advance rabbits toward moveTarget (so movement looks natural)
  try {
    for (let i = rabbits.length - 1; i >= 0; i--) {
      const rab = rabbits[i];
      if (!rab) continue;
      if (rab.moveTarget) {
        const dx = rab.moveTarget.x - rab.x;
        const dy = rab.moveTarget.y - rab.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const speedTiles = rab.speed || 1.0;
        const step = speedTiles * dt;
        if (dist <= step) { rab.x = rab.moveTarget.x; rab.y = rab.moveTarget.y; rab.col = Math.floor(rab.x); rab.row = Math.floor(rab.y); delete rab.moveTarget; }
        else { rab.x += (dx / dist) * step; rab.y += (dy / dist) * step; rab.col = Math.floor(rab.x); rab.row = Math.floor(rab.y); }
        // record last X so facing persists when no moveTarget
        try { rab._lastX = rab.x; } catch (e) {}
      }
    }
  } catch (e) {}

  // ── FOXES ───────────────────────────────────────────────
  try {
    foxes.forEach(fox => {
      const { col, row, hp, maxHp, size } = fox;
      // prefer continuous position when available
      const fxPos = (typeof fox.x === 'number' && typeof fox.y === 'number') ? { x: fox.x, y: fox.y } : { x: col, y: row };
      const { x, y } = worldToScreen(fxPos.x, fxPos.y);
      const tileSize = getTileSize();
      const bmpFox = (window._ENTITY_BITMAPS && (window._ENTITY_BITMAPS['fox'] || window._ENTITY_BITMAPS['animal.fox'] || window._ENTITY_BITMAPS['fox-0'])) ? (window._ENTITY_BITMAPS['fox'] || window._ENTITY_BITMAPS['animal.fox'] || window._ENTITY_BITMAPS['fox-0']) : null;
      const fsz = Math.max(8, tileSize * (size || 0.7));
      if (bmpFox) {
        try {
          // determine facing (prefer moveTarget, otherwise use last X delta)
          let flip = false;
          try {
            if (fox.moveTarget) flip = (fox.moveTarget.x < (fox.x || fox.col));
            else if (typeof fox._lastX === 'number') flip = ((fox.x || fox.col) < fox._lastX);
          } catch (e) {}
          ctx.save(); try { ctx.imageSmoothingEnabled = false; } catch(e){}
          const w = Math.max(8, tileSize * (0.8 * (size || 0.7)));
          const h = w;
          const cx = x + tileSize*0.5;
          const cy = y + tileSize*0.5;
          if (flip) {
            ctx.translate(cx, cy);
            ctx.scale(-1,1);
            ctx.drawImage(bmpFox, -w/2, -h/2, w, h);
          } else {
            ctx.drawImage(bmpFox, cx - w/2, cy - h/2, w, h);
          }
          ctx.restore();
        } catch (e) {}
      } else {
        // body (reddish fox)
        ctx.fillStyle = '#D2691E';
        ctx.beginPath(); ctx.ellipse(x + tileSize*0.5, y + tileSize*0.56, fsz*0.65, fsz*0.45, 0, 0, Math.PI*2); ctx.fill();
        // head
        ctx.beginPath(); ctx.arc(x + tileSize*0.5 + fsz*0.36, y + tileSize*0.44, fsz*0.36, 0, Math.PI*2); ctx.fill();
        // tail
        ctx.fillStyle = '#A04A1A'; ctx.beginPath(); ctx.ellipse(x + tileSize*0.5 - fsz*0.6, y + tileSize*0.58, fsz*0.28, fsz*0.15, -0.6, 0, Math.PI*2); ctx.fill();
        // eye
        ctx.fillStyle = '#111'; ctx.fillRect(x + tileSize*0.5 + fsz*0.48, y + tileSize*0.44, 2, 2);
      }
      // highlight if selected
      try {
        if (Array.isArray(window._selectedEntities) && window._selectedEntities.find(s => s && s.id === fox.id)) {
          const bx = x + tileSize*0.5; const by = y + tileSize*0.85; const rrad = Math.max(8, tileSize * 0.26);
          ctx.save(); ctx.strokeStyle = 'rgba(120,180,255,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by, rrad, rrad*0.6, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore();
        }
      } catch (e) {}
      // HP bar
      const hpPct = Math.max(0, hp / maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + tileSize*0.34, y + tileSize*0.16, tileSize*0.32, 4);
      ctx.fillStyle = 'rgba(200,50,50,0.95)'; ctx.fillRect(x + tileSize*0.34, y + tileSize*0.16, tileSize*0.32, 4);
      ctx.fillStyle = 'rgba(60,200,80,0.95)'; ctx.fillRect(x + tileSize*0.34, y + tileSize*0.16, tileSize*0.32 * hpPct, 4);
      // name for foxes if given and nearby
      try {
        const NAME_ZOOM_THRESHOLD = 0.6;
        const NAME_MAX_DIST = 5.0;
        if (zoom >= NAME_ZOOM_THRESHOLD) {
          const dist = Math.hypot(fox.col - player.x, fox.row - player.y);
          if (dist <= NAME_MAX_DIST && fox.name) {
            const p = worldToScreen(fox.col + 0.5, fox.row - 0.2);
            ctx.save(); ctx.font = '12px sans-serif';
            const w = ctx.measureText(fox.name).width;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - w/2 - 4, p.y - 18, w + 8, 16);
            ctx.fillStyle = '#FFF'; ctx.fillText(fox.name, p.x - w/2, p.y - 6);
            ctx.restore();
          }
        }
      } catch (e) {}
    });
  } catch (e) {}

  // ── ENEMIES (tower-defense) render
  try {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i]; if (!en) continue;
      const ex = (en.x || en.col) ; const ey = (en.y || en.row);
      const p = worldToScreen(ex, ey);
      const tileSize = getTileSize();
      // body
      ctx.fillStyle = '#8B2E2E'; ctx.beginPath(); ctx.ellipse(p.x + tileSize*0.5, p.y + tileSize*0.55, Math.max(6, tileSize*0.4), Math.max(4, tileSize*0.32), 0, 0, Math.PI*2); ctx.fill();
      // hp bar
      const hpPct = Math.max(0, (en.hp||0) / (en.maxHp||1));
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x + tileSize*0.2, p.y + tileSize*0.12, tileSize*0.6, 6);
      ctx.fillStyle = 'rgba(200,50,50,0.95)'; ctx.fillRect(p.x + tileSize*0.2, p.y + tileSize*0.12, tileSize*0.6 * hpPct, 6);
    }
  } catch (e) {}

  // draw effect particles
  try {
    const nowEff = now;
    for (let i = effectParticles.length - 1; i >= 0; i--) {
      const p = effectParticles[i];
      const age = nowEff - p.born;
      const t = age / p.life;
      if (t >= 1) { effectParticles.splice(i,1); continue; }
      // simple physics
      p.vy += 0.04;
      p.x += p.vx * 2;
      p.y += p.vy * 2;
      const a = Math.max(0, 1 - t);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, 3 * (1 - t)), 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      const age = nowEff - ft.born;
      const t = age / ft.life;
      if (t >= 1) { floatingTexts.splice(i,1); continue; }
      // if world positions provided, reproject to screen so text follows moving entities
      if (typeof ft.worldX === 'number' && typeof ft.worldY === 'number') {
        const p = worldToScreen(ft.worldX, ft.worldY);
        ft.x = p.x;
        ft.y = p.y - 6; // slight offset above entity
      }
      ft.y += ft.yv * 1.6;
      const alpha = Math.max(0, 1 - t);
      ctx.font = 'bold 14px sans-serif';
      const text = ft.text || '';
      const textWidth = ctx.measureText(text).width;
      const padX = 8;
      const padY = 6;
      const cx = (typeof ft.x === 'number') ? ft.x : 0;
      const cy = (typeof ft.y === 'number') ? ft.y : 0;
      const bx = cx - textWidth / 2 - padX;
      const by = cy - padY - 14;
      // pick bubble/background color opposite to text when text is white
      const textColor = ft.color || '#000';
      const useDarkBg = (String(textColor).toLowerCase() === '#fff' || String(textColor).toLowerCase() === '#ffffff');
      const bgColor = useDarkBg ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.95)';
      const strokeColor = 'rgba(0,0,0,0.6)';
      ctx.globalAlpha = alpha;
      // draw bubble background (rounded rect when available)
      try {
        ctx.fillStyle = bgColor; ctx.strokeStyle = strokeColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, textWidth + padX * 2, padY * 2 + 10, 6);
        else ctx.rect(bx, by, textWidth + padX * 2, padY * 2 + 10);
        ctx.fill(); ctx.stroke();
        // tail pointing down towards the entity
        const tx = cx;
        const ty = by + padY * 2 + 10;
        ctx.beginPath();
        ctx.moveTo(tx - 6, ty);
        ctx.lineTo(tx + 6, ty);
        ctx.lineTo(tx, ty + 8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      } catch (e) { /* ignore drawing issues */ }
      // draw text centered
      try {
        ctx.fillStyle = textColor;
        ctx.fillText(text, cx - textWidth / 2, cy);
      } catch (e) {}
      ctx.globalAlpha = 1;
    }
  } catch (errFx) { /* ignore effect rendering errors */ }

  // Draw movement target marker
  if (moveTarget) {
    const { x: sx, y: sy } = worldToScreen(moveTarget.x, moveTarget.y);
    if (viewMode === 'iso') {
      const { w, h } = getIsoTileSize();
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      drawDiamond(sx, sy, w*0.5, h*0.5, ctx.fillStyle, 'rgba(0,0,0,0.6)', 2);
    } else {
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.fillRect(Math.round(sx-4), Math.round(sy-4), 8, 8);
    }
  }

  // Rabbit AI: move each rabbit on its own timer to slow movement
  const nowRab = now;
  for (let i = rabbits.length - 1; i >= 0; i--) {
    const rab = rabbits[i];
    if (!rab.nextMove) rab.nextMove = nowRab + 1000 + Math.floor(Math.random()*3000);
    if (nowRab >= rab.nextMove) {
      rab.nextMove = nowRab + 1500 + Math.floor(Math.random()*4000);
      const tries = 6;
      for (let t = 0; t < tries; t++) {
        const dcol = Math.floor(Math.random()*3)-1;
        const drow = Math.floor(Math.random()*3)-1;
        const nc = rab.col + dcol;
        const nr = rab.row + drow;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !grid[nr][nc] && !isRiver(nc)) {
          try { rab.moveTarget = { x: nc + 0.5, y: nr + 0.5 }; } catch (e) { rab.col = nc; rab.row = nr; }
          break;
        }
      }
    }
  }

  // Fox AI: similar roaming but slightly faster and with its own timer
  try {
    const nowFox = now;
    for (let i = foxes.length - 1; i >= 0; i--) {
      const fx = foxes[i];
      if (!fx.nextMove) fx.nextMove = nowFox + 800 + Math.floor(Math.random()*3000);
      if (nowFox >= fx.nextMove) {
        fx.nextMove = nowFox + 1000 + Math.floor(Math.random()*3500);
        const tries = 6;
        for (let t = 0; t < tries; t++) {
          const dcol = Math.floor(Math.random()*3)-1;
          const drow = Math.floor(Math.random()*3)-1;
          const nc = fx.col + dcol;
          const nr = fx.row + drow;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && !grid[nr][nc] && !isRiver(nc)) {
            try { fx.moveTarget = { x: nc + 0.5, y: nr + 0.5 }; } catch (e) { fx.col = nc; fx.row = nr; }
            break;
          }
        }
      }
    }
  } catch (e) { /* ignore fox AI errors */ }

  // Smooth fox movement (interpolate towards moveTarget)
  try {
    for (let i = foxes.length - 1; i >= 0; i--) {
      const fx = foxes[i];
      if (!fx) continue;
      if (typeof fx.x !== 'number') fx.x = fx.col;
      if (typeof fx.y !== 'number') fx.y = fx.row;
      if (fx.moveTarget) {
        const dx = fx.moveTarget.x - fx.x, dy = fx.moveTarget.y - fx.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const speedTiles = fx.speed || 1.4;
        const step = speedTiles * dt;
        if (dist <= step) { fx.x = fx.moveTarget.x; fx.y = fx.moveTarget.y; fx.col = Math.floor(fx.x); fx.row = Math.floor(fx.y); delete fx.moveTarget; }
        else { fx.x += (dx / dist) * step; fx.y += (dy / dist) * step; fx.col = Math.floor(fx.x); fx.row = Math.floor(fx.y); }
        // record last X so facing persists when no moveTarget
        try { fx._lastX = fx.x; } catch (e) {}
      }
    }
  } catch (e) {}

  // decay camera inertia
  // follow player: update targetCam each frame when enabled
  if (followPlayer && !isPanning) {
    const tileSize = getTileSize();
    if (viewMode === 'iso') {
      const p = projectIso(player.x, player.y);
      targetCam = { x: canvas.width/2 - p.x, y: canvas.height/2 - p.y };
    } else {
      targetCam = { x: canvas.width/2 - player.x * tileSize, y: canvas.height/2 - player.y * tileSize };
    }
  }

  if (Math.abs(camVX) > 0.01 || Math.abs(camVY) > 0.01) {
    camX += camVX;
    camY += camVY;
    camVX *= 0.93; camVY *= 0.93;
    clampCamera();
  }
  // smooth center target
  if (targetCam) {
    camX = lerp(camX, targetCam.x, 0.12);
    camY = lerp(camY, targetCam.y, 0.12);
    if (Math.hypot(camX-targetCam.x, camY-targetCam.y) < 0.5) targetCam = null;
  }

  // overlay difuminado (nubes suaves) when zoomed out
  try { drawCloudOverlay(); } catch (err) { /* ignore */ }

  drawPlayer();
  drawPlayerHealth();

  // --- INTERACTION PROMPT: show single 'E' with action text for nearest object ---
  try {
    window._interactionTarget = null;
    if (!window.currentInterior) {
      // find nearest door, resource or tree (priority order: door > resource > tree)
      let bestDoor = null, bestDoorDist = 9e9;
      if (Array.isArray(window.INTERIOR_DOORS) && window.INTERIOR_DOORS.length > 0) {
        for (const d of window.INTERIOR_DOORS) {
          if (!d) continue;
          const dx = (d.col + 0.5) - (player.x || 0);
          const dy = (d.row + 0.5) - (player.y || 0);
          const dist = Math.hypot(dx, dy);
          if (dist < bestDoorDist && dist <= 1.25) { bestDoor = d; bestDoorDist = dist; }
        }
      }
      let bestRes = null, bestResDist = 9e9;
      for (let i = 0; i < entities.length; i++) {
        const ent = entities[i];
        if (!ent) continue;
        if (ent.kind === 'resource') {
          const dx = (ent.col + 0.5) - (player.x || 0);
          const dy = (ent.row + 0.5) - (player.y || 0);
          const dist = Math.hypot(dx, dy);
          if (dist < bestResDist && dist <= 1.5) { bestRes = ent; bestResDist = dist; }
        }
      }
      let bestTree = null, bestTreeDist = 9e9;
      for (let i = 0; i < entities.length; i++) {
        const ent = entities[i];
        if (!ent) continue;
        if (ent.kind === 'tree') {
          const dx = (ent.col + 0.5) - (player.x || 0);
          const dy = (ent.row + 0.5) - (player.y || 0);
          const dist = Math.hypot(dx, dy);
          if (dist < bestTreeDist && dist <= 1.5) { bestTree = ent; bestTreeDist = dist; }
        }
      }

      let chosen = null;
      if (bestDoor) chosen = { kind: 'door', ref: bestDoor, actionText: 'Entrar' };
      else if (bestRes) chosen = { kind: 'resource', ref: bestRes, actionText: bestRes.subtype ? ('Recoger ' + bestRes.subtype) : 'Recoger' };
      else if (bestTree) chosen = { kind: 'tree', ref: bestTree, actionText: 'Talar' };

      if (chosen) {
        window._interactionTarget = chosen;
        try {
          const tileSize = getTileSize();
          const screen = worldToScreen((player.x || 0) + 0.5, (player.y || 0) - 0.3);
          ctx.save();
          ctx.font = Math.max(10, Math.floor(12 * (tileSize / 32))) + 'px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 3;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // action text above
          ctx.strokeText(chosen.actionText, screen.x, screen.y - 30);
          ctx.fillText(chosen.actionText, screen.x, screen.y - 30);
          // big E below
          ctx.font = Math.max(12, Math.floor(14 * (tileSize / 32))) + 'px sans-serif';
          ctx.strokeText('E', screen.x, screen.y - 10);
          ctx.fillText('E', screen.x, screen.y - 10);
          ctx.restore();
        } catch (e) {}
      }
    }
  } catch (e) {}

  // ── HOVER PREVIEW ─────────────────────────────────────────
  // draw build-drag selection preview
  if (isBuildDragging && buildDragRect && selectedTool && selectedTool !== 'demolish') {
    for (let rr = buildDragRect.minR; rr <= buildDragRect.maxR; rr++) {
      for (let cc = buildDragRect.minC; cc <= buildDragRect.maxC; cc++) {
        drawTileHighlight(cc, rr, 'rgba(200,168,75,0.18)', 'rgba(200,168,75,0.9)', 1);
      }
    }
  }
  if (editMode && hoverCell && selectedTool && selectedTool !== 'demolish') {
    const { col, row } = hoverCell;
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      const canAfford = canBuild(selectedTool);
      const canPlace = canAfford && canPlaceAt(col, row, selectedTool);
      const fill = canPlace ? 'rgba(200,168,75,0.25)' : 'rgba(200,50,50,0.25)';
      const stroke = canPlace ? 'rgba(200,168,75,0.8)' : 'rgba(200,50,50,0.8)';
      forEachFootprint(col, row, selectedTool, (fc, fr) => {
        if (fc < 0 || fc >= COLS || fr < 0 || fr >= ROWS) return;
        drawTileHighlight(fc, fr, fill, stroke, 2);
      });
      drawBuilding(col, row, selectedTool, 0.5);
    }
  }

  if (editMode && hoverCell && selectedTool === 'demolish') {
    const { col, row } = hoverCell;
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      const info = getCellInfo(col, row);
      if (info) {
        forEachFootprint(info.baseCol, info.baseRow, info.type, (fc, fr) => {
          if (fc < 0 || fc >= COLS || fr < 0 || fr >= ROWS) return;
          drawTileHighlight(fc, fr, 'rgba(200,50,50,0.35)', '#CC3333', 2);
        });
      }
    }
  }

  // ── RIVER LABEL ─────────────────────────────────────────--
  const { x: rx } = worldToScreen(RIVER_COL_START, 0);
  const labelOffset = viewMode === 'iso' ? isoSize.w : tileSize;
  ctx.save();
  ctx.translate(rx + labelOffset, H/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 11px Courier New';
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'center';
  ctx.fillText('RÍO ÉUFRATES', 0, 0);
  ctx.restore();

  // Request next frame for animation
  // process NPC tasks (simple simulated executor)
  try {
    const nowTick = now;
    for (const en of entities) {
      if (!en || !en.id || en.id.indexOf('npc-') !== 0) continue;
      if (!en.task) continue;
      const t = en.task;
      // define durations per action (ms)
      const durations = { explore: 8000, gather: 4000, build: 12000, trade: 6000, ritual: 10000 };
      const dur = durations[t.id] || 5000;
      if (!t.startedAt) t.startedAt = nowTick;
      const elapsed = nowTick - t.startedAt;
      // progress percent
      t.progress = Math.min(1, elapsed / dur);
      // when complete
      if (elapsed >= dur) {
        // grant basic reward / effect
        if (t.id === 'gather') addToInventory('wheat', 1);
        else if (t.id === 'explore') addToInventory('wheat', 1);
        else if (t.id === 'trade') { addToInventory('brick', 1); }
        else if (t.id === 'build') { /* could auto-place small structure later */ }
        else if (t.id === 'ritual') { notify(`${en.name||'Aldeano'} completó un ritual.`); }
        notify(`${en.name||'Aldeano'} completó: ${t.id}`);
        // clear task
        delete en.task;
        if (window.renderNPCList) window.renderNPCList();
      }
    }
  } catch (err) { /* ignore NPC tick errors */ }
  // ── NPC AI: simple roaming and dialogue (copied behaviour similar to rabbits)
  try {
    const nowNpc = now;
    for (let i = entities.length - 1; i >= 0; i--) {
      const en = entities[i];
      if (!en || !en.id || en.id.indexOf('npc-') !== 0) continue;
      if (!en.nextMove) en.nextMove = nowNpc + 1000 + Math.floor(Math.random() * 3000);
      if (nowNpc >= en.nextMove) {
        en.nextMove = nowNpc + 1200 + Math.floor(Math.random() * 5000);
        // village-bounded roaming if assigned
        let minC = 0, maxC = COLS - 1, minR = 0, maxR = ROWS - 1;
        if (en.villageId && window._VILLAGES) {
          const v = window._VILLAGES.find(x => x.id === en.villageId);
          if (v) { minC = v.minC; maxC = v.maxC; minR = v.minR; maxR = v.maxR; }
        }
        for (let t = 0; t < 8; t++) {
          const dcol = Math.floor(Math.random() * 3) - 1;
          const drow = Math.floor(Math.random() * 3) - 1;
          const nc = en.col + dcol;
          const nr = en.row + drow;
          if (nc >= minC && nc <= maxC && nr >= minR && nr <= maxR && nc >= 0 && nr >= 0 && nc < COLS && nr < ROWS && !grid[nr][nc] && !isRiver(nc)) {
            // smooth movement: set a moveTarget instead of teleporting
            try { en.moveTarget = { x: nc + 0.5, y: nr + 0.5 }; } catch (e) { en.col = nc; en.row = nr; }
            break;
          }
        }
        // occasional speech with cooldown per-NPC
        try {
          const last = en._lastSpeak || 0;
          const cooldown = en._speakCooldown || (6000 + Math.floor(Math.random() * 8000));
          if (nowNpc - last >= cooldown) {
            if (Math.random() < 0.16) {
              const dlgType = en.npcType || 'villager';
              const cfg = window.NPC_DIALOGUES[dlgType] || null;
              if (cfg && Array.isArray(cfg.phrases) && cfg.phrases.length > 0) {
                const ph = cfg.phrases[Math.floor(Math.random() * cfg.phrases.length)];
                if (window.spawnFloatingText) window.spawnFloatingText(en.col + 0.5, en.row - 0.1, ph, '#FFF');
                else if (window.floatingTexts) window.floatingTexts.push({ born: nowNpc, life: 2600, x: 0, y: 0, yv: -0.3, color: '#FFF', text: ph, worldX: en.col + 0.5, worldY: en.row - 0.1 });
                en._lastSpeak = nowNpc;
                en._speakCooldown = 6000 + Math.floor(Math.random() * 10000);
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) { /* ignore NPC AI errors */ }

  // Auto-speak: every NPC_SPEAK_INTERVAL ms, pick one NPC and make it speak (best-effort)
  try {
    if (window.AUTO_NPC_SPEAK) {
      const last = window._npcLastAutoSpeak || 0;
      const interval = window.NPC_SPEAK_INTERVAL || 30000;
      if (now - last >= interval) {
        window._npcLastAutoSpeak = now;
        try {
          const npcList = entities.filter(en => en && en.id && en.id.indexOf('npc-') === 0);
          if (npcList.length > 0) {
            const en = npcList[Math.floor(Math.random() * npcList.length)];
            const dlgType = en.npcType || 'villager';
            const cfg = window.NPC_DIALOGUES[dlgType] || null;
            if (cfg && Array.isArray(cfg.phrases) && cfg.phrases.length > 0) {
              const ph = cfg.phrases[Math.floor(Math.random() * cfg.phrases.length)];
              if (window.spawnFloatingText) window.spawnFloatingText(en.col + 0.5, en.row - 0.1, ph, '#FFF');
              else if (window.floatingTexts) window.floatingTexts.push({ born: now, life: 2600, worldX: en.col + 0.5, worldY: en.row - 0.1, yv: -0.3, color: '#FFF', text: ph });
              en._lastSpeak = now;
            }
          }
        } catch (e) { /* ignore speak errors */ }
      }
    }
  } catch (e) {}

  try { tickEnemies(now); } catch (e) { /* ignore enemy tick errors */ }
  if (window._gameStarted) requestAnimationFrame(render);
  } catch (err) {
    // draw error message to canvas for debugging
    console.error(err);
    try {
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = 'rgba(40,40,40,0.95)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      const msg = (err && err.stack) ? err.stack.split('\n').slice(0,6).join(' / ') : String(err);
      ctx.fillText('ERROR: ' + msg, 10, 30);
    } catch (inner) {
      console.error('Error rendering error overlay', inner);
    }
    return;
  }
}

// ═══════════════════════════════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════════════════════════════
function canBuild(type) {
  const b = BUILDINGS[type];
  return res.brick >= b.costBrick && res.wheat >= b.costWheat;
}

// ── Enemies & Tower-Defense helpers (sandbox TD mode)
const enemies = window._ENEMIES || (window._ENEMIES = []);
let _waveTimer = null;

function spawnEnemy(type, col, row) {
  try {
    const now = Date.now();
    const id = 'enemy-' + type + '-' + now + '-' + Math.random().toString(36).slice(2,5);
    const base = { id, type, col, row, x: col + 0.5, y: row + 0.5, hp: 10, maxHp: 10, speed: 0.6 };
    if (type === 'raider') { base.hp = 12; base.maxHp = 12; base.speed = 0.9; }
    if (type === 'beast') { base.hp = 20; base.maxHp = 20; base.speed = 0.6; }
    enemies.push(base);
    return base;
  } catch (e) { return null; }
}

function spawnWave(def) {
  // def = { count, type, intervalMs }
  try {
    const count = def.count || 6; const type = def.type || 'raider'; const interval = def.intervalMs || 400;
    let spawned = 0;
    _waveTimer = setInterval(() => {
      if (spawned >= count) { clearInterval(_waveTimer); _waveTimer = null; return; }
      // spawn at random map edge
      const side = Math.floor(Math.random()*4);
      let c = 0, r = 0;
      if (side === 0) { c = 0; r = Math.floor(Math.random()*ROWS); }
      else if (side === 1) { c = COLS-1; r = Math.floor(Math.random()*ROWS); }
      else if (side === 2) { r = 0; c = Math.floor(Math.random()*COLS); }
      else { r = ROWS-1; c = Math.floor(Math.random()*COLS); }
      spawnEnemy(type, Math.max(0,Math.min(COLS-1,c)), Math.max(0,Math.min(ROWS-1,r)));
      spawned++;
    }, interval);
  } catch (e) { console.warn('spawnWave err', e); }
}

function tickEnemies(now) {
  try {
    const dt = Math.min(0.05, (now - (tickEnemies._last || now)) / 1000);
    tickEnemies._last = now;
    // move enemies toward center (or player if free-mode)
    const targetX = (player && typeof player.x === 'number') ? player.x : (COLS/2);
    const targetY = (player && typeof player.y === 'number') ? player.y : (ROWS/2);

    // collect towers positions
    const towers = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const tType = (typeof cell === 'string') ? cell : (cell && cell.type);
      if (tType === 'tower') towers.push({ col: c, row: r, lastShot: (grid[r][c] && grid[r][c]._lastShot) || 0 });
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i]; if (!en) continue;
      // simple move toward target
      const dx = targetX + 0.5 - en.x; const dy = targetY + 0.5 - en.y; const dist = Math.hypot(dx, dy) || 0.0001;
      const step = (en.speed || 0.6) * dt;
      en.x += (dx / dist) * step; en.y += (dy / dist) * step; en.col = Math.floor(en.x); en.row = Math.floor(en.y);
      // towers attack
      for (const t of towers) {
        const tx = t.col + 0.5, ty = t.row + 0.5;
        const d = Math.hypot(en.x - tx, en.y - ty);
        const bDef = BUILDINGS.tower || {}; const range = bDef.attackRange || 5; const dmg = bDef.attackDmg || 4; const cd = bDef.attackCooldown || 800;
        if (d <= range) {
          const last = (grid[t.row][t.col] && grid[t.row][t.col]._lastShot) || 0;
          if (now - last >= cd) {
            // hit enemy
            en.hp -= dmg;
            // visual effect
            try { effectParticles.push({ born: now, life: 600, x: (en.x||en.col)*TILE + TILE*0.5, y: (en.y||en.row)*TILE + TILE*0.5, vx: 0, vy: -0.6, color: '#FF6B35' }); } catch (e) {}
            try { grid[t.row][t.col] = (typeof grid[t.row][t.col] === 'string') ? grid[t.row][t.col] : Object.assign({}, grid[t.row][t.col] || {}); grid[t.row][t.col]._lastShot = now; } catch (e) {}
            if (en.hp <= 0) { enemies.splice(i,1); addToInventory('brick', 1); break; }
          }
        }
      }
    }
  } catch (e) { /* ignore */ }
}

function startDefenseMode() {
  try {
    // simple wave schedule
    spawnWave({ count: 8, type: 'raider', intervalMs: 600 });
    setTimeout(() => spawnWave({ count: 10, type: 'beast', intervalMs: 500 }), 9000);
  } catch (e) { console.warn('startDefenseMode err', e); }
}

try { window.startDefenseMode = startDefenseMode; window.spawnWave = spawnWave; window.spawnEnemy = spawnEnemy; } catch (e) {}

function placeBuild(col, row) {
  if (startLocked) return;
  if (!editMode) return;
  if (!selectedTool || selectedTool === 'demolish') return;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (!canPlaceAt(col, row, selectedTool)) { notify('No puedes construir aquí.'); return; }
  if (!canBuild(selectedTool)) {
    notify('Recursos insuficientes.'); return;
  }
  const b = BUILDINGS[selectedTool];
  res.brick -= b.costBrick;
  res.wheat -= b.costWheat;
  setBuildingCells(col, row, selectedTool);
  updateUI();
  addLog(`Construido: ${b.name} en (${col},${row})`);
  gainXP(10);
  notify(`${b.name} construida.`);
  // mission progress: building events
  try {
    if (window._missions && window._missions.length > 0) {
      window._missions.forEach(m => {
        if (m.watch && m.watch === ('build.' + selectedTool)) {
          m.progress = (m.progress || 0) + 1;
        }
      });
      if (window.renderMissions) window.renderMissions();
    }
  } catch (err) {}
}

// Place multiple buildings inside a rect (attempts to place as many as resources allow)
function placeBuildMultiple(rect) {
  if (startLocked) return;
  if (!editMode) return;
  if (!selectedTool || selectedTool === 'demolish') return;
  const size = getBuildingSize(selectedTool);
  // iterate top-left anchors inside rect
  const placed = [];
  for (let r = rect.minR; r <= rect.maxR; r++) {
    for (let c = rect.minC; c <= rect.maxC; c++) {
      // only try to place when this cell would be the top-left of the building
      if (!canPlaceAt(c, r, selectedTool)) continue;
      if (!canBuild(selectedTool)) { return placed; }
      // apply cost and set cells
      const b = BUILDINGS[selectedTool];
      res.brick -= b.costBrick;
      res.wheat -= b.costWheat;
      setBuildingCells(c, r, selectedTool);
      placed.push({c,r});
    }
  }
  if (placed.length > 0) {
    updateUI(); addLog(`Construidos ${placed.length} x ${BUILDINGS[selectedTool].name}`);
    // update missions for bulk builds
    try {
      if (window._missions && window._missions.length > 0) {
        window._missions.forEach(m => {
          if (m.watch && m.watch === ('build.' + selectedTool)) {
            m.progress = (m.progress || 0) + placed.length;
          }
        });
        if (window.renderMissions) window.renderMissions();
      }
    } catch (err) {}
  } else notify('No se pudieron colocar construcciones en la selección.');
  return placed;
}

function demolishCell(col, row) {
  if (startLocked) return;
  if (!editMode) return;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const info = getCellInfo(col, row);
  if (!info) return;
  const type = info.type;
  const b = BUILDINGS[type];
  res.brick += Math.floor(b.costBrick * 0.5);
  res.wheat += Math.floor(b.costWheat * 0.5);
  clearBuildingCells(info.baseCol, info.baseRow, type);
  updateUI();
  addLog(`Demolido: ${b.name} en (${col},${row})`);
  notify(`${b.name} demolida.`);
}

function endTurn() {
  // kept for backwards compatibility: trigger daily production
  applyDailyProduction();
}

function applyDailyProduction() {
  if (startLocked) return;
  let dWheat = 0, dBrick = 0, dPop = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const info = getCellInfo(c, r);
      if (!info || !info.isBase) continue;
      const b = BUILDINGS[info.type];
      const bonus = isNearRiver(c) ? 1.25 : 1;
      dWheat += Math.floor(b.prodWheat * bonus);
      dBrick += Math.floor(b.prodBrick * bonus);
      dPop   += b.prodPop;
    }
  }
  // Consumption
  const consumption = Math.floor(res.pop * 0.1);
  dWheat -= consumption;

  res.wheat = Math.max(0, res.wheat + dWheat);
  res.brick = Math.max(0, res.brick + dBrick);
  res.pop   = Math.max(0, res.pop   + dPop);
  dayCount++;

  // Character AP refresh
  char.ap = Math.min(char.maxAp, char.ap + 2);

  // Survival: heal when near shelter (house)
  let nearHouse = false;
  for (let oy=-1; oy<=1; oy++) for (let ox=-1; ox<=1; ox++) {
    const c = player.col + ox, r = player.row + oy;
    const info = (c>=0 && c<COLS && r>=0 && r<ROWS) ? getCellInfo(c,r) : null;
    if (info && info.isBase && info.type === 'house') nearHouse = true;
  }
  if (nearHouse) {
    char.hp = Math.min(char.maxHp, char.hp + 2);
    addLog('Refugio cercano: curación +2 HP');
  }

  updateUI();
  updateProduction();
  addLog(`── Día ${dayCount}: +${dWheat} trigo, +${dBrick} ladrillos, +${dPop} pop`);
  gainXP(5);
  notify(`Día ${dayCount} — Producción recolectada.`);
}

function gainXP(amount) {
  char.xp += amount;
  while (char.xp >= char.xpNext) {
    char.xp -= char.xpNext;
    char.level++;
    char.xpNext = Math.floor(char.xpNext * 1.5);
    char.maxHp += 10;
    char.hp = char.maxHp;
    // Boost a random SPECIAL
    const keys = Object.keys(char.special);
    const k = keys[Math.floor(Math.random()*keys.length)];
    char.special[k] = Math.min(10, char.special[k]+1);
    addLog(`¡Nivel ${char.level} alcanzado! ${k} aumentó.`);
    notify(`¡Nivel ${char.level}! Ur-Nammu crece en poder.`);
  }
  updateCharCard();
}

// ── UI UPDATES ───────────────────────────────────────────────-
function updateUI() {
  document.getElementById('res-wheat').textContent = res.wheat;
  document.getElementById('res-brick').textContent = res.brick;
  document.getElementById('res-pop').textContent   = res.pop;
  // show current day count
  const tn = document.getElementById('turn-num'); if (tn) tn.textContent = dayCount;
  updateProduction();
  updateCharCard();
}

function isNearPlayerShelter(target) {
  // if a target (entity or player) is adjacent to a house, treat as sheltered
  const tc = target.col, tr = target.row;
  for (let oy=-1; oy<=1; oy++) for (let ox=-1; ox<=1; ox++) {
    const c = tc + ox, r = tr + oy;
    if (c<0||c>=COLS||r<0||r>=ROWS) continue;
    const info = getCellInfo(c,r);
    if (info && info.isBase && info.type === 'house') return true;
  }
  return false;
}

function addToInventory(item, qty) {
  qty = qty || 1;
  inventory[item] = (inventory[item] || 0) + qty;
  notify(`+${qty} ${item}`);
  updateInventory();
  try { if (window.updateEquippedUI) window.updateEquippedUI(); } catch (e) {}
  // update missions that watch this item
  try {
    if (window._missions && window._missions.length > 0) {
      let changed = false;
      window._missions.forEach(m => {
        if (m.watch && m.watch === item) {
          m.progress = (m.progress || 0) + qty;
          changed = true;
        }
      });
      if (changed && window.renderMissions) window.renderMissions();
    }
  } catch (err) { }
}

// ── CRAFTING SYSTEM ───────────────────────────────────────
const RECIPES = {
  'plank': { requires: { wood: 1 }, output: { plank: 2 } },
  'stick': { requires: { plank: 1 }, output: { stick: 2 } },
  'stone-pick': { requires: { wood: 2, stone: 3 }, output: { 'stone-pick': 1 } },
  'stone-axe': { requires: { wood: 2, stone: 2 }, output: { 'stone-axe': 1 } },
  'stone-sword': { requires: { wood: 1, stone: 4 }, output: { 'stone-sword': 1 } },
  'campfire': { requires: { wood: 3, stone: 2 }, output: { campfire: 1 } },
  'furnace': { requires: { stone: 8, wood: 2 }, output: { furnace: 1 } },
  'brick-block': { requires: { brick: 4 }, output: { 'brick-block': 1 } }
};

function canCraft(recipeId, qty = 1) {
  const r = RECIPES[recipeId]; if (!r) return false;
  for (const mat in r.requires) {
    if ((inventory[mat] || 0) < r.requires[mat] * qty) return false;
  }
  return true;
}

function craftItem(recipeId, qty = 1) {
  const r = RECIPES[recipeId]; if (!r) { notify('Receta desconocida.'); return false; }
  if (!canCraft(recipeId, qty)) { notify('No tienes los materiales necesarios.'); return false; }
  // consume materials
  for (const mat in r.requires) {
    const need = r.requires[mat] * qty;
    inventory[mat] = Math.max(0, (inventory[mat] || 0) - need);
  }
  // produce outputs
  for (const out in r.output) {
    const amount = r.output[out] * qty;
    addToInventory(out, amount);
  }
  notify(`Has crafteado ${qty} x ${recipeId}`);
  try { saveAppStateDebounced(); } catch (err) {}
  try { updateInventory(); } catch (err) {}
  try { if (window.updateEquippedUI) window.updateEquippedUI(); } catch (e) {}
  return true;
}

// expose recipes and craft functions
window.RECIPES = RECIPES;
window.canCraft = canCraft;
window.craftItem = craftItem;

function updateInventory() {
  const list = document.getElementById('inventory-panel-list') || document.getElementById('inventory-list');
  if (!list) return;
  // Render a compact grid-style inventory similar to Minecraft aesthetic
  list.innerHTML = '';
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  Object.entries(inventory).forEach(([k,v]) => {
    const slot = document.createElement('div');
    slot.style.width = '44px'; slot.style.height = '44px'; slot.style.background = 'rgba(30,30,30,0.95)'; slot.style.border = '2px solid rgba(0,0,0,0.6)'; slot.style.borderRadius = '4px';
    slot.style.display = 'flex'; slot.style.alignItems = 'center'; slot.style.justifyContent = 'center'; slot.style.position = 'relative';
    // small canvas icon
    const cv = document.createElement('canvas'); cv.width = 28; cv.height = 28; cv.style.width = '28px'; cv.style.height = '28px';
    const cctx = cv.getContext('2d');
    // draw simple icon per item
    if (k === 'wheat') {
      cctx.fillStyle = '#DAA520'; cctx.fillRect(6,6,16,16);
      cctx.fillStyle = '#4A7C3F'; cctx.fillRect(10,4,4,10);
    } else if (k === 'brick') {
      cctx.fillStyle = '#B04A2D'; cctx.fillRect(4,6,20,12);
      cctx.fillStyle = 'rgba(0,0,0,0.08)'; cctx.fillRect(8,8,6,4); cctx.fillRect(16,8,6,4);
    } else if (k === 'wood') {
      cctx.fillStyle = '#8B5A38'; cctx.fillRect(4,8,20,12);
      cctx.fillStyle = '#7A4A2A'; for (let i=0;i<3;i++) cctx.fillRect(6 + i*6, 9 + (i%2), 1, 10);
    } else {
      cctx.fillStyle = '#666'; cctx.fillRect(6,6,16,16);
    }
    slot.appendChild(cv);
    // allow clicking to equip tools/weapons
    try {
      const EQUIPPABLE = new Set(['stone-axe','stone-pick','stone-sword','plank','stick','campfire','furnace']);
      slot.style.cursor = 'pointer';
      slot.addEventListener('click', () => {
        if (EQUIPPABLE.has(k)) {
          try { window.equipItem(k); } catch (e) {}
        } else {
          notify(k + ' seleccionado');
        }
      });
    } catch (e) {}
    const qty = document.createElement('div'); qty.textContent = v; qty.style.position = 'absolute'; qty.style.right = '4px'; qty.style.bottom = '2px'; qty.style.fontSize = '11px'; qty.style.color = '#fff'; qty.style.textShadow = '0 1px 0 rgba(0,0,0,0.8)';
    slot.appendChild(qty);
    const label = document.createElement('div'); label.textContent = k; label.style.position='absolute'; label.style.top='46px'; label.style.left='0'; label.style.width='100%'; label.style.fontSize='11px'; label.style.textAlign='center'; label.style.color='#DDD';
    slot.appendChild(label);
    container.appendChild(slot);
  });
  list.appendChild(container);
}

function updateProduction() {
  let dW=0, dB=0, dP=0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const info = getCellInfo(c, r);
    if (!info || !info.isBase) continue;
    const b = BUILDINGS[info.type];
    if (!b) continue; // guard: unknown/legacy cell type
    const bonus = isNearRiver(c) ? 1.25 : 1;
    dW += Math.floor((b.prodWheat || 0) * bonus);
    dB += Math.floor((b.prodBrick || 0) * bonus);
    dP += (b.prodPop || 0);
  }
  const pw = document.getElementById('prod-wheat'); if (pw) pw.textContent = (dW>=0?'+':'')+dW;
  const pb = document.getElementById('prod-brick'); if (pb) pb.textContent = (dB>=0?'+':'')+dB;
  const pp = document.getElementById('prod-pop'); if (pp) pp.textContent = (dP>=0?'+':'')+dP;
}

function updateCharCard() {
  const nameEl = document.getElementById('char-name');
  const titleEl = document.getElementById('char-title');
  if (nameEl) nameEl.textContent = player.name;
  if (titleEl) titleEl.textContent = player.title;
  document.getElementById('char-lv').textContent = char.level;
  const hpPct = (char.hp / char.maxHp * 100).toFixed(0);
  const apPct = (char.ap / char.maxAp * 100).toFixed(0);
  const xpPct = (char.xp / char.xpNext * 100).toFixed(0);
  document.getElementById('bar-hp').style.width = hpPct+'%';
  document.getElementById('bar-ap').style.width = apPct+'%';
  document.getElementById('bar-xp').style.width = xpPct+'%';
  document.getElementById('val-hp').textContent = `${char.hp}/${char.maxHp}`;
  document.getElementById('val-ap').textContent = `${char.ap}/${char.maxAp}`;
  document.getElementById('val-xp').textContent = `${char.xp}/${char.xpNext}`;

  const grid2 = document.getElementById('special-grid');
  grid2.innerHTML = '';
  Object.entries(char.special).forEach(([k,v]) => {
    const row = document.createElement('div');
    row.className = 'special-row';
    row.innerHTML = `<span class="special-key">${k}</span><span class="special-val">${v}</span>`;
    grid2.appendChild(row);
  });
}

function renderActionList() {
  const list = document.getElementById('actions-list');
  if (!list) return;
  list.innerHTML = '';
  ACTIONS.forEach(action => {
    const li = document.createElement('li');
    li.className = 'actions-item';
    li.innerHTML = `
      <div class="actions-row">
        <div>
          <div class="actions-name">${action.name}</div>
          <div class="actions-desc">${action.desc}</div>
        </div>
        <button class="tool-btn actions-btn" data-action="${action.id}">-${action.cost} AP</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.actions-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action;
      if (!actionId) return;
      performAction(actionId);
    });
  });
}

function spendAp(cost) {
  if (char.ap < cost) {
    notify('Accion sin puntos de accion.');
    return false;
  }
  char.ap -= cost;
  return true;
}

function performAction(actionId) {
  if (startLocked) return;
  // Block character actions while in edit mode
  if (editMode) { notify('Acciones deshabilitadas en modo edición'); return; }
  const action = ACTIONS.find(a => a.id === actionId);
  if (!action) return;
  if (!spendAp(action.cost)) return;

  if (actionId === 'explore') {
    const roll = Math.random();
    if (roll < 0.5) {
      res.wheat += 2;
      addLog('Exploracion: encontraste trigo.');
    } else {
      res.brick += 2;
      addLog('Exploracion: hallaste ladrillos.');
    }
    gainXP(5);
  } else if (actionId === 'gather') {
    // Prefer picking up nearby resource entities
    let picked = false;
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      if (Math.abs(ent.col - player.col) <= 1 && Math.abs(ent.row - player.row) <= 1) {
        addToInventory(ent.subtype, 1);
        entities.splice(i,1);
        addLog(`Recolectaste: ${ent.subtype}`);
        picked = true;
      }
    }
    if (picked) {
      if (isNearRiver(player.col)) {
        addToInventory('water', 3);
        addLog('Recolectas agua en la ribera.');
      } else {
        res.brick += 2;
        addLog('Recolectas arcilla y obtienes ladrillos.');
      }
    }
    gainXP(3);
  } else if (actionId === 'build') {
    setEditMode(true);
    addLog('Modo edicion activado para construir.');
  } else if (actionId === 'trade') {
    if (res.wheat >= 5) {
      res.wheat -= 5;
      res.brick += 3;
      addLog('Intercambias trigo por ladrillos.');
    } else if (res.brick >= 5) {
      res.brick -= 5;
      res.wheat += 3;
      addLog('Intercambias ladrillos por trigo.');
    } else {
      char.ap += action.cost;
      notify('No tienes recursos para comerciar.');
      return;
    }
  } else if (actionId === 'ritual') {
    if (res.wheat < 2 || res.brick < 2) {
      char.ap += action.cost;
      notify('Necesitas 2 trigo y 2 ladrillos.');
      return;
    }
    res.wheat -= 2;
    res.brick -= 2;
    res.pop += 2;
    gainXP(4);
    addLog('Ritual completado: la ciudad crece.');
  } else if (actionId === 'study') {
    if (res.wheat < 1) {
      char.ap += action.cost;
      notify('Necesitas 1 trigo para investigar.');
      return;
    }
    res.wheat -= 1;
    gainXP(8);
    const keys = Object.keys(char.special);
    const key = keys[Math.floor(Math.random() * keys.length)];
    char.special[key] = Math.min(10, char.special[key] + 1);
    addLog(`Investigacion: ${key} mejora.`);
  }

  if (actionId === 'attack') {
    // try attack nearest player NPC first, then rabbit
    // melee range 1 tile
    const range = 1;
    // find NPC
    let target = null;
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (ent && ent.kind === 'player' && Math.abs(ent.col - player.col) <= range && Math.abs(ent.row - player.row) <= range) { target = ent; break; }
    }
    if (!target) {
      for (let i = 0; i < rabbits.length; i++) {
        const rab = rabbits[i];
        if (rab && Math.abs(rab.col - player.col) <= range && Math.abs(rab.row - player.row) <= range) { target = rab; break; }
      }
    }
    if (!target) { notify('No hay objetivos cercanos para atacar.'); char.ap += action.cost; return; }
    // compute damage from strength + weapon
    const baseDmg = 2 + Math.floor((char.special.FUE || 0) / 2);
    // detect equipped weapon or inventory weapon
    const WEAPON_BONUS = { sword: 6, spear: 5, club: 4, axe: 5 };
    let weaponName = player.weapon || null;
    if (!weaponName) {
      // search inventory for a known weapon
      for (const w of Object.keys(inventory)) {
        if ((WEAPON_BONUS[w] || 0) > 0 && inventory[w] > 0) { weaponName = w; break; }
      }
    }
    const weaponBonus = weaponName ? (WEAPON_BONUS[weaponName] || 0) : 0;
    const dmg = baseDmg + weaponBonus;
    // apply building defense if near shelter
    const defMult = isNearPlayerShelter(target) ? 0.75 : 1;
    const realDmg = Math.max(1, Math.floor(dmg * defMult));
    if (target.kind === 'player') {
      target.hp = Math.max(0, target.hp - realDmg);
      addLog(`Atacaste a ${target.name} por ${realDmg} daño.`);
      // visual feedback
      try {
        const { x: sx, y: sy } = worldToScreen(target.col, target.row);
        target._flashUntil = Date.now() + 420;
        spawnHitParticles(sx + getTileSize()*0.5, sy + getTileSize()*0.3, 'rgba(220,40,40,0.95)', 10);
        spawnDamageText(sx + getTileSize()*0.5, sy - 4, `-${realDmg}`, '#ff4444');
      } catch (err) { }
      if (target.hp <= 0) { addLog(`${target.name} ha sido derrotado.`); const idx = entities.indexOf(target); if (idx>=0) entities.splice(idx,1); }
      if (weaponName) notify(`Atacas con ${weaponName}`);
    } else {
      // rabbit
      target.hp = Math.max(0, target.hp - realDmg);
      addLog(`Atacaste a un animal por ${realDmg} daño.`);
      try {
        const { x: sx, y: sy } = worldToScreen(target.col, target.row);
        target._flashUntil = Date.now() + 420;
        spawnHitParticles(sx + getTileSize()*0.5, sy + getTileSize()*0.3, 'rgba(220,40,40,0.95)', 10);
        spawnDamageText(sx + getTileSize()*0.5, sy - 4, `-${realDmg}`, '#ff4444');
      } catch (err) {}
      if (target.hp <= 0) { const idx = rabbits.indexOf(target); if (idx>=0) rabbits.splice(idx,1); addToInventory('meat',1); }
      if (weaponName) notify(`Atacas con ${weaponName}`);
    }
    updateUI(); updateInventory();
  }

  if (actionId === 'hunt') {
    // find a rabbit nearby
    for (let i = rabbits.length - 1; i >= 0; i--) {
      const rab = rabbits[i];
      if (Math.abs(rab.col - player.col) <= 1 && Math.abs(rab.row - player.row) <= 1) {
        rabbits.splice(i,1);
        addToInventory('meat', 1);
        addLog('Cazaste un conejo. +1 carne');
        gainXP(6);
        updateUI();
        updateInventory();
        return;
      }
    }
    notify('No hay animales cercanos para cazar.');
    char.ap += action.cost; // refund AP
    return;
  }

  updateUI();
}

function addLog(msg) {
  const log = document.getElementById('log');
  const p = document.createElement('p');
  p.className = 'new';
  p.textContent = '▶ ' + msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  // Dim old entries
  setTimeout(() => p.classList.remove('new'), 2000);
}

// ── NOTIFICATION ─────────────────────────────────────────-----
let notifTimer = null;
function notify(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.style.opacity = '1';
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ── CHARACTER SELECTION ───────────────────────────────────
let selectedPresetId = null;
let selectedMode = 'preset';
const customState = {
  name: '',
  classId: 'builder',
  palette: { ...DEFAULT_PALETTE }
};

function applyClassBonus(classId) {
  const cls = CHARACTER_CLASSES.find(c => c.id === classId) || CHARACTER_CLASSES[0];
  char.special = { ...BASE_SPECIAL };
  Object.entries(cls.bonus).forEach(([key, val]) => {
    char.special[key] = Math.min(10, (char.special[key] || 0) + val);
  });
  return cls;
}

function applyCharacterPreset(preset) {
  if (!preset) return;
  player.name = preset.name;
  player.title = preset.title;
  player.palette = preset.palette;
  player.presetId = preset.id;
  applyClassBonus(preset.classId);
  const portrait = document.getElementById('char-portrait');
  if (portrait) {
    drawCharacterPortrait(portrait.getContext('2d'), portrait.width, portrait.height, preset.palette);
  }
  updateCharCard();
}

function applyCustomCharacter(state) {
  player.name = state.name || 'Habitante';
  player.palette = state.palette;
  player.presetId = 'custom';
  const cls = applyClassBonus(state.classId);
  player.title = cls.title;
  const portrait = document.getElementById('char-portrait');
  if (portrait) {
    drawCharacterPortrait(portrait.getContext('2d'), portrait.width, portrait.height, state.palette);
  }
  updateCharCard();
}

function renderCharacterOptions() {
  const gridEl = document.getElementById('char-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  CHARACTER_PRESETS.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'char-option';
    btn.dataset.char = preset.id;
    const canvas = document.createElement('canvas');
    canvas.className = 'char-preview';
    canvas.width = 28;
    canvas.height = 28;
    const info = document.createElement('div');
    const name = document.createElement('div');
    const title = document.createElement('div');
    name.className = 'char-info-name';
    title.className = 'char-info-title';
    name.textContent = preset.name;
    title.textContent = preset.title;
    info.appendChild(name);
    info.appendChild(title);
    btn.appendChild(canvas);
    btn.appendChild(info);
    btn.addEventListener('click', () => {
      selectedPresetId = preset.id;
      selectedMode = 'preset';
      document.querySelectorAll('.char-option').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      applyCharacterPreset(preset);
    });
    gridEl.appendChild(btn);
    drawCharacterPortrait(canvas.getContext('2d'), canvas.width, canvas.height, preset.palette);
  });
}

function setActiveTab(tab) {
  const btnPresets = document.getElementById('btn-tab-presets');
  const btnCustom = document.getElementById('btn-tab-custom');
  const btnParams = document.getElementById('btn-tab-params');
  const panelPresets = document.getElementById('panel-presets');
  const panelCustom = document.getElementById('panel-custom');
  const panelParams = document.getElementById('panel-params');
  if (btnPresets) btnPresets.classList.toggle('active', tab === 'preset');
  if (btnCustom) btnCustom.classList.toggle('active', tab === 'custom');
  if (btnParams) btnParams.classList.toggle('active', tab === 'params');
  if (panelPresets) panelPresets.classList.toggle('hidden', tab !== 'preset');
  if (panelCustom) panelCustom.classList.toggle('hidden', tab !== 'custom');
  if (panelParams) panelParams.classList.toggle('hidden', tab !== 'params');
  selectedMode = tab;
}

function renderPaletteButtons(containerId, key, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  PALETTE_OPTIONS[key].forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.style.backgroundColor = color;
    btn.classList.toggle('active', color === value);
    btn.addEventListener('click', () => {
      customState.palette[key] = color;
      renderPaletteButtons(containerId, key, color);
      updateCustomPreview();
    });
    container.appendChild(btn);
  });
}

function updateCustomPreview() {
  const canvas = document.getElementById('char-custom-preview');
  if (!canvas) return;
  drawCharacterPortrait(canvas.getContext('2d'), canvas.width, canvas.height, customState.palette);
}

function renderCustomOptions() {
  const nameInput = document.getElementById('char-name-input');
  const classSelect = document.getElementById('char-class');
  if (nameInput) {
    nameInput.value = customState.name;
    nameInput.addEventListener('input', e => {
      customState.name = e.target.value;
    });
  }
  if (classSelect) {
    classSelect.innerHTML = '';
    CHARACTER_CLASSES.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls.id;
      opt.textContent = cls.name;
      classSelect.appendChild(opt);
    });
    classSelect.value = customState.classId;
    classSelect.addEventListener('change', e => {
      customState.classId = e.target.value;
    });
  }
  renderPaletteButtons('palette-skin', 'skin', customState.palette.skin);
  renderPaletteButtons('palette-hair', 'hair', customState.palette.hair);
  renderPaletteButtons('palette-cloth', 'cloth', customState.palette.cloth);
  renderPaletteButtons('palette-trim', 'trim', customState.palette.trim);
  updateCustomPreview();
}

function openCharacterSelect() {
  const modal = document.getElementById('char-select');
  if (!modal) return;
  modal.classList.remove('hidden');
  startLocked = true;
}

function closeCharacterSelect() {
  const modal = document.getElementById('char-select');
  if (!modal) return;
  modal.classList.add('hidden');
  startLocked = false;
}

function setupCharacterSelection() {
  renderCharacterOptions();
  renderCustomOptions();
  const savedMode = localStorage.getItem(STORAGE_CHAR_MODE);
  const savedId = localStorage.getItem(STORAGE_CHAR_KEY);
  const savedCustom = localStorage.getItem(STORAGE_CHAR_CUSTOM);
  const savedPreset = CHARACTER_PRESETS.find(p => p.id === savedId);
  // If there's a stored character id but it no longer matches available presets, clear it and force reselect
  if (savedId && !savedPreset) {
    try { localStorage.removeItem(STORAGE_CHAR_KEY); localStorage.removeItem(STORAGE_CHAR_MODE); } catch (e) {}
    console.warn('Stored character preset not found, forcing character selection');
    openCharacterSelect();
    return;
  }
  // If we have a saved player position but no saved character selection, assume default preset
  const hasSavedPos = !!localStorage.getItem('meso.playerPos');
  const hasAppState = !!localStorage.getItem(APP_STATE_KEY);
  // If a full app state exists, it likely already restored player info via loadAppState(),
  // so avoid overwriting the restored `player.name` here. Only auto-apply default preset
  // when there's a legacy saved position but no full app state and no saved selection.
  if (hasSavedPos && !savedPreset && !savedCustom && !savedMode) {
    if (hasAppState) {
      // state restored earlier — just close selection without changing player
      setActiveTab('preset');
      closeCharacterSelect();
      return;
    }
    const defaultPreset = CHARACTER_PRESETS.find(p => p.id === 'builder') || CHARACTER_PRESETS[0];
    applyCharacterPreset(defaultPreset);
    setActiveTab('preset');
    closeCharacterSelect();
    return;
  }

  if (savedMode === 'custom' && savedCustom) {
    try {
      const data = JSON.parse(savedCustom);
      customState.name = data.name || customState.name;
      customState.classId = data.classId || customState.classId;
      customState.palette = { ...customState.palette, ...data.palette };
      renderCustomOptions();
      applyCustomCharacter(customState);
      setActiveTab('custom');
      closeCharacterSelect();
    } catch (err) {
      openCharacterSelect();
    }
  } else if (savedPreset) {
    selectedPresetId = savedPreset.id;
    applyCharacterPreset(savedPreset);
    setActiveTab('preset');
    closeCharacterSelect();
  } else {
    setActiveTab('preset');
    openCharacterSelect();
  }

  const startBtn = document.getElementById('btn-char-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      // ensure runtime defaults exist (values are updated live when user changes the selector)
      try { window._DEFAULT_DENSITIES = window._DEFAULT_DENSITIES || { npc:1.0, animals:1.0, vegetation:1.0 }; } catch (e) {}

      if (selectedMode === 'custom') {
        applyCustomCharacter(customState);
      } else {
        const preset = CHARACTER_PRESETS.find(p => p.id === selectedPresetId) || CHARACTER_PRESETS[0];
        applyCharacterPreset(preset);
      }
      const saveToggle = document.getElementById('char-save');
      if (saveToggle && saveToggle.checked) {
        if (selectedMode === 'custom') {
          localStorage.setItem(STORAGE_CHAR_MODE, 'custom');
          localStorage.setItem(STORAGE_CHAR_CUSTOM, JSON.stringify(customState));
        } else {
          localStorage.setItem(STORAGE_CHAR_MODE, 'preset');
          localStorage.setItem(STORAGE_CHAR_KEY, selectedPresetId || 'builder');
        }
      }
      closeCharacterSelect();
    });
  }

  if (selectedPresetId) {
    const btn = document.querySelector(`.char-option[data-char="${selectedPresetId}"]`);
    if (btn) btn.classList.add('active');
  }

  const tabPresets = document.getElementById('btn-tab-presets');
  const tabCustom = document.getElementById('btn-tab-custom');
  const tabParams = document.getElementById('btn-tab-params');
  if (tabPresets) tabPresets.addEventListener('click', () => setActiveTab('preset'));
  if (tabCustom) tabCustom.addEventListener('click', () => setActiveTab('custom'));
  if (tabParams) tabParams.addEventListener('click', () => setActiveTab('params'));

  // initialize parameters panel UI (single selector with prev/next + slider)
  try {
    const paramKeys = ['npc','animals','vegetation'];
    const paramLabels = { npc: 'NPCs', animals: 'Animales', vegetation: 'Vegetación' };
    const paramDescs = { npc: 'Ajusta la densidad de habitantes inicial.', animals: 'Ajusta la densidad de animales salvajes.', vegetation: 'Ajusta la densidad de árboles y vegetación.' };
    let cur = 0;
    const titleEl = document.getElementById('param-title');
    const descEl = document.getElementById('param-desc');
    const range = document.getElementById('density-range');
    const valDisplay = document.getElementById('density-value');
    const prev = document.getElementById('param-prev');
    const next = document.getElementById('param-next');
    const indicator = document.getElementById('param-indicator');
    const iconCanvas = document.getElementById('param-icon');
    window._DEFAULT_DENSITIES = window._DEFAULT_DENSITIES || { npc:1.0, animals:1.0, vegetation:1.0 };

    function drawIconFor(key) {
      try {
        if (!iconCanvas) return;
        const ctx = iconCanvas.getContext('2d');
        ctx.clearRect(0,0,iconCanvas.width, iconCanvas.height);
        ctx.fillStyle = 'rgba(200,168,75,1)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fsize = Math.max(14, Math.floor(iconCanvas.height * 0.7));
        ctx.font = fsize + 'px serif';
        let emoji = '❓';
        if (key === 'npc') emoji = '👥';
        else if (key === 'animals') emoji = '🐇';
        else if (key === 'vegetation') emoji = '🌳';
        ctx.fillText(emoji, iconCanvas.width/2, iconCanvas.height/2 + 1);
      } catch (e) {}
    }

    function renderParam() {
      const k = paramKeys[cur];
      if (titleEl) titleEl.textContent = paramLabels[k] || k;
      if (descEl) descEl.textContent = paramDescs[k] || '';
      if (indicator) indicator.textContent = (cur+1) + ' / ' + paramKeys.length;
      drawIconFor(k);
      if (range) {
        const curVal = window._DEFAULT_DENSITIES[k] || 1.0;
        range.value = String(curVal);
        if (valDisplay) valDisplay.textContent = parseFloat(curVal).toFixed(2) + 'x';
      }
    }

    if (prev) prev.addEventListener('click', () => { cur = (cur - 1 + paramKeys.length) % paramKeys.length; renderParam(); });
    if (next) next.addEventListener('click', () => { cur = (cur + 1) % paramKeys.length; renderParam(); });

    if (range) range.addEventListener('input', () => {
      try {
        const k = paramKeys[cur];
        const v = parseFloat(range.value);
        window._DEFAULT_DENSITIES[k] = v;
        if (valDisplay) valDisplay.textContent = v.toFixed(2) + 'x';
        localStorage.setItem('meso.paramPrefs', JSON.stringify(window._DEFAULT_DENSITIES));
      } catch (e) {}
    });

    // restore persisted param preferences (if any)
    try { const p = JSON.parse(localStorage.getItem('meso.paramPrefs') || 'null'); if (p && typeof p === 'object') window._DEFAULT_DENSITIES = Object.assign(window._DEFAULT_DENSITIES, p); } catch (e) {}
    renderParam();
  } catch (e) {}
}

// ── TOOLTIP ─────────────────────────────────────────────────--
function showTooltip(col, row, mx, my) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { tip.style.display='none'; return; }
  if (isRiver(col)) {
    tip.innerHTML = '<b>Río Éufrates</b><br>Fuente de vida.<br>Construir cerca da +25% producción.';
    tip.style.display = 'block';
  } else if (grid[row][col]) {
    const info = getCellInfo(col, row);
    if (!info) { tip.style.display = 'none'; return; }
    const b = BUILDINGS[info.type];
    if (!b) { tip.style.display = 'none'; console.warn('showTooltip: unknown building type', info.type); return; }
    const bonus = isNearRiver(col) ? ' 🌊+25%' : '';
    tip.innerHTML = `<b>${b.name}</b>${bonus}<br>${b.desc}`;
    tip.style.display = 'block';
  } else if (selectedTool && selectedTool !== 'demolish') {
    const b = BUILDINGS[selectedTool];
    if (!b) { tip.style.display = 'none'; console.warn('showTooltip: unknown selectedTool', selectedTool); return; }
    tip.innerHTML = `<b>${b.name}</b><br>Costo: 🧱${b.costBrick} 🌾${b.costWheat}<br>${b.desc}`;
    tip.style.display = 'block';
  } else {
    tip.style.display = 'none';
    return;
  }
  if (typeof canvas === 'undefined' || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  let tx = mx + 12, ty = my - 10;
  if (tx + 170 > rect.width) tx = mx - 175;
  if (ty + 80 > rect.height) ty = my - 90;
  tip.style.left = tx + 'px';
  tip.style.top  = ty + 'px';
}

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

// ---------------------- UI helpers & persistence ----------------------
// Create overlay controls (follow button, inventory panel, settings)
function createOverlayUI() {
  // Use the existing "Ir a jugador" button as the follow-toggle and add a zoom slider
  const centerBtn = document.getElementById('btn-center-player');
  if (centerBtn) {
    function updateCenterBtn() {
      centerBtn.textContent = followPlayer ? 'Ir a jugador — Seguir: ON' : 'Ir a jugador';
    }
    updateCenterBtn();
    centerBtn.addEventListener('click', () => {
      if (!editMode) {
        centerCameraOnPlayer();
        followPlayer = !followPlayer;
        updateCenterBtn();
        notify(followPlayer ? 'Camara: siguiendo jugador' : 'Camara: libre');
        if (followPlayer) {
          const tileSize = getTileSize();
          if (viewMode === 'iso') {
            const p = projectIso(player.x, player.y);
            targetCam = { x: canvas.width/2 - p.x, y: canvas.height/2 - p.y };
          } else {
            targetCam = { x: canvas.width/2 - player.x * tileSize, y: canvas.height/2 - player.y * tileSize };
          }
        } else targetCam = null;
      } else {
        centerCameraOnPlayer();
      }
    });
  }

  // Zoom slider control (bottom-left)
  if (!document.getElementById('zoom-control')) {
    const zc = document.createElement('div');
    zc.id = 'zoom-control';
    zc.style.position = 'fixed'; zc.style.left = '12px'; zc.style.bottom = '12px'; zc.style.zIndex = 2000;
    zc.style.padding = '8px'; zc.style.background = 'rgba(0,0,0,0.6)'; zc.style.borderRadius = '6px'; zc.style.color = '#fff';
    zc.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Zoom</div><input id="zoom-slider" type="range" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="0.01" value="${zoom}" style="width:160px">`;
    document.body.appendChild(zc);
    const slider = document.getElementById('zoom-slider');
    slider.addEventListener('input', () => { zoom = parseFloat(slider.value); clampCamera(); });
  }

  // Create top menu bar for window/panel management and settings
  try { createMenuBar(); } catch (err) { /* ignore */ }

  // Inventory panel (hidden by default) - uses #inventory-list updated elsewhere
  if (!document.getElementById('inventory-panel')) {
    const p = document.createElement('div');
    p.id = 'inventory-panel';
    p.style.position = 'fixed'; p.style.right = '12px'; p.style.bottom = '12px'; p.style.zIndex = 2000;
    p.style.display = 'none';
    stylePanel(p);
    p.style.minWidth = '180px';
    p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong>Inventario</strong><button id="btn-inv-close" style="background:#222;color:#FFD27A;border:none;padding:6px 8px;border-radius:6px">X</button></div><div id="inventory-panel-list" style="max-height:220px;overflow:auto"></div>`;
    document.body.appendChild(p);
    document.getElementById('btn-inv-close').addEventListener('click', () => p.style.display = 'none');
  }

  // Entity info panel (right-click)
  if (!document.getElementById('entity-info')) {
    const info = document.createElement('div');
    info.id = 'entity-info';
    info.style.position = 'fixed'; info.style.left = '50%'; info.style.top = '50%'; info.style.transform = 'translate(-50%,-50%)';
    info.style.zIndex = 3000; info.style.display = 'none'; info.style.minWidth = '220px';
    stylePanel(info);
    info.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong id="entity-info-title">Entidad</strong><button id="entity-info-close" style="background:#222;color:#FFD27A;border:none;padding:6px 8px;border-radius:6px">X</button></div><div id="entity-info-body"></div>`;
    document.body.appendChild(info);
    document.getElementById('entity-info-close').addEventListener('click', () => info.style.display = 'none');
  }

  // (settings gear removed — use top-menubar 'Ajustes' instead)
}

// Ability bar and missions UI
function createAbilityBarAndMissions() {
  // ability state
  if (window.ABILITIES_INITIALIZED) return;
  window.ABILITIES_INITIALIZED = true;
  const abilities = [
    { id: 'attack', label: 'Golpear', key: '1', cooldown: 800, last: 0, desc: 'Atacar con arma o puño' },
    { id: 'dash', label: 'Dash', key: '2', cooldown: 5000, last: 0, desc: 'Avanza rápidamente' },
    { id: 'heal', label: 'Heal', key: '3', cooldown: 12000, last: 0, desc: 'Cura HP' },
    { id: 'beacon', label: 'Beacon', key: '4', cooldown: 15000, last: 0, desc: 'Coloca señal' }
  ];

  // bar container
  let bar = document.getElementById('ability-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'ability-bar';
    bar.style.position = 'fixed'; bar.style.left = '50%'; bar.style.bottom = '8px'; bar.style.transform = 'translateX(-50%)';
    bar.style.zIndex = 4000; bar.style.display = 'flex'; bar.style.gap = '10px';
    bar.style.padding = '6px'; bar.style.background = 'rgba(10,10,10,0.4)'; bar.style.borderRadius = '8px';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  // equipped item slot (left of abilities)
  const eqSlot = document.createElement('div'); eqSlot.id = 'equipped-slot';
  eqSlot.style.width = '56px'; eqSlot.style.height = '56px'; eqSlot.style.background = '#191818'; eqSlot.style.border = '1px solid #444';
  eqSlot.style.borderRadius = '6px'; eqSlot.style.display = 'flex'; eqSlot.style.flexDirection = 'column'; eqSlot.style.alignItems = 'center'; eqSlot.style.justifyContent = 'center'; eqSlot.style.color = '#fff';
  eqSlot.style.marginRight = '6px';
  eqSlot.innerHTML = `<div id="equipped-icon" style="width:40px;height:28px"></div><div id='equipped-label' style='font-size:11px;color:#ccc;margin-top:4px'></div>`;
  bar.appendChild(eqSlot);
  abilities.forEach((ab, idx) => {
    const slot = document.createElement('div');
    slot.className = 'ability-slot'; slot.dataset.idx = idx;
    slot.style.width = '64px'; slot.style.height = '48px'; slot.style.background = '#222'; slot.style.border = '1px solid #555';
    slot.style.borderRadius = '6px'; slot.style.display = 'flex'; slot.style.flexDirection = 'column'; slot.style.alignItems = 'center'; slot.style.justifyContent = 'center'; slot.style.color = '#fff';
    slot.innerHTML = `<div style="font-weight:700">${ab.label}</div><div style="font-size:12px;color:#ccc">${ab.key}</div><div class="cd" style="position:absolute;width:64px;height:48px;left:0;top:0;border-radius:6px;background:rgba(0,0,0,0.45);display:none"></div>`;
    slot.addEventListener('click', () => useAbility(idx));
    bar.appendChild(slot);
  });

  // update equipped UI helper
  function updateEquippedUI() {
    const icon = document.getElementById('equipped-icon');
    const label = document.getElementById('equipped-label');
    if (!icon || !label) return;
    icon.innerHTML = '';
    label.textContent = '';
    const it = player.equipped;
    if (!it) {
      label.textContent = 'Mano';
      return;
    }
    // draw a small canvas icon for equipped item
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 28; cv.style.width='40px'; cv.style.height='28px';
    const cctx = cv.getContext('2d');
    // simple icons
    if (it === 'stone-axe' || it === 'stone-axe') {
      cctx.fillStyle = '#6b6b6b'; cctx.fillRect(4,10,24,6); // head
      cctx.fillStyle = '#7a4a2a'; cctx.fillRect(22,12,6,12); // handle
    } else if (it === 'stone-pick') {
      cctx.fillStyle = '#6b6b6b'; cctx.fillRect(4,8,22,6);
      cctx.fillStyle = '#7a4a2a'; cctx.fillRect(22,12,6,10);
    } else if (it === 'stone-sword') {
      cctx.fillStyle = '#9a9a9a'; cctx.fillRect(6,6,18,4);
      cctx.fillStyle = '#7a4a2a'; cctx.fillRect(18,10,4,12);
    } else if (it === 'plank' || it === 'stick') {
      cctx.fillStyle = '#8B5A38'; cctx.fillRect(6,8,28,8);
    } else if (it === 'furnace' || it === 'campfire') {
      cctx.fillStyle = '#6f6f6f'; cctx.fillRect(6,6,24,14);
      cctx.fillStyle = '#c85'; cctx.fillRect(12,10,8,6);
    } else {
      // generic box for unknown
      cctx.fillStyle = '#888'; cctx.fillRect(8,8,20,12);
    }
    icon.appendChild(cv);
    label.textContent = it;
  }

  // expose updateEquippedUI globally so other modules can call it
  window.updateEquippedUI = updateEquippedUI;

  // expose equip helpers
  window.equipItem = function(itemId) {
    if (!itemId) { player.equipped = null; updateEquippedUI(); return true; }
    if ((inventory[itemId] || 0) <= 0) { notify('No tienes ese objeto para equipar'); return false; }
    player.equipped = itemId;
    updateEquippedUI();
    notify('Equipado: ' + itemId);
    return true;
  };
  window.unequipItem = function() { player.equipped = null; updateEquippedUI(); notify('Desequipado'); };

  // initial render
  setTimeout(updateEquippedUI, 50);
  // add craft toggle button to the bar
  try {
    const cb = document.createElement('button'); cb.id = 'btn-craft-toggle'; cb.textContent = 'Craftear';
    cb.style.marginLeft = '8px'; cb.style.padding = '6px 8px'; cb.style.borderRadius = '6px'; cb.style.border = '1px solid #444'; cb.style.background = '#1a1a1a'; cb.style.color = '#FFD27A'; cb.addEventListener('click', () => { try { toggleCraftingPanel(); } catch (e) {} });
    bar.appendChild(cb);
  } catch (e) {}

  // mission queue container (right side)
  let mq = document.getElementById('mission-queue');
  if (!mq) {
    mq = document.createElement('div'); mq.id = 'mission-queue';
    mq.style.position = 'fixed'; mq.style.right = '12px'; mq.style.top = '80px'; mq.style.zIndex = 4000;
    stylePanel(mq);
    mq.style.minWidth = '220px';
    mq.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Misiones</div><div id="mission-list"></div>`;
    document.body.appendChild(mq);
    // make the missions panel floating/minimizable like other panels
    try { enableFloatingBehavior(mq); registerPanel(mq); } catch (err) { /* ignore */ }
  }

  // mission system state
  window._missions = window._missions || [];

  function renderMissions() {
    const list = document.getElementById('mission-list'); if (!list) return; list.innerHTML = '';
    window._missions.forEach(m => {
        const el = document.createElement('div'); el.className = 'mission-row';
        el.style.padding = '10px'; el.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        el.style.display = 'flex'; el.style.justifyContent = 'space-between'; el.style.alignItems = 'center';
        el.style.background = 'transparent'; el.style.color = '#fff'; el.style.gap = '8px';
        // left: title + desc
        const left = document.createElement('div'); left.style.flex = '1';
        const t = document.createElement('div'); t.textContent = m.title; t.style.fontWeight = '700'; t.style.color = 'var(--sand-mid)'; t.style.fontSize = '0.95rem';
        const d = document.createElement('div'); d.textContent = m.desc; d.style.fontSize = '12px'; d.style.color = 'var(--ui-dim)'; d.style.marginTop = '6px';
        left.appendChild(t); left.appendChild(d);
        // right: progress + claim button
        const right = document.createElement('div'); right.style.textAlign = 'right'; right.style.width = '92px';
        const prog = document.createElement('div'); prog.textContent = `${m.progress||0}/${m.target||1}`; prog.style.fontWeight = '700'; prog.style.color = 'var(--wheat)';
        const btn = document.createElement('button'); btn.textContent = 'Reclamar'; btn.style.marginTop = '8px'; btn.style.padding = '6px 8px'; btn.style.borderRadius = '6px'; btn.style.background = '#222'; btn.style.border = '1px solid rgba(255,255,255,0.04)'; btn.style.color = 'var(--sand-light)'; btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => { if ((m.progress||0) >= (m.target||1)) completeMission(m.id); else notify('Misión incompleta'); });
        right.appendChild(prog); right.appendChild(btn);
        el.appendChild(left); el.appendChild(right);
        list.appendChild(el);
    });
  }
  // expose renderer so other parts can update mission UI
  window.renderMissions = renderMissions;

  // ability use logic
  function useAbility(idx) {
    const ab = abilities[idx]; if (!ab) return;
    const now = Date.now();
    if (now - ab.last < ab.cooldown) { notify('Habilidad en cooldown'); return; }
    ab.last = now;
    // visual cooldown overlay
    const slot = document.querySelector(`#ability-bar .ability-slot[data-idx='${idx}'] .cd`);
    if (slot) { slot.style.display = 'block'; slot.style.opacity = '0.9'; setTimeout(() => { slot.style.display='none'; }, ab.cooldown); }
    // effects
    if (ab.id === 'attack') {
      try { performAction('attack'); } catch (e) { notify('Atacar (error)'); }
    } else if (ab.id === 'dash') {
      player.x += (facingDirX() || 1) * 1.8; player.y += (facingDirY() || 0) * 0.4; notify('Dash!');
    } else if (ab.id === 'heal') {
      char.hp = Math.min(char.maxHp, (char.hp || 10) + 6); notify('Curación aplicada'); updateCharCard();
    } else if (ab.id === 'beacon') {
      addToInventory('beacon', 1); notify('Señal colocada');
    } else if (ab.id === 'buff') {
      char.special.attack = (char.special.attack || 0) + 1; notify('Furor temporal'); setTimeout(() => { char.special.attack = Math.max(0, (char.special.attack||0)-1); }, 12000);
    }
    updateUI();
  }

  // helper to estimate facing direction from last key input
  function facingDirX() { if (keyState['d'] || keyState['ArrowRight']) return 1; if (keyState['a'] || keyState['ArrowLeft']) return -1; return 1; }
  function facingDirY() { if (keyState['s'] || keyState['ArrowDown']) return 1; if (keyState['w'] || keyState['ArrowUp']) return -1; return 0; }

  // mission completion -> reward
  function completeMission(id) {
    const idx = window._missions.findIndex(m => m.id === id); if (idx === -1) return;
    const m = window._missions[idx];
    // grant reward (simple: resource map)
    if (m.reward) {
      Object.entries(m.reward).forEach(([k,v]) => addToInventory(k, v));
    }
    // visual reward popup
    showRewardPopup(m.reward || { gold:1 });
    window._missions.splice(idx,1);
    renderMissions();
  }

  // create a floating reward animation near top
  function showRewardPopup(reward) {
    const el = document.createElement('div');
    el.style.position = 'fixed'; el.style.left = '50%'; el.style.top = '24px'; el.style.transform = 'translateX(-50%)';
    el.style.zIndex = 5000; el.style.display = 'inline-block';
    stylePanel(el);
    // keep unified style: square corners and gold border from stylePanel
    el.style.padding = '8px 14px'; el.style.fontWeight = '700';
    el.style.color = '#FFD27A';
    el.style.border = '3px solid #d4af37';
    el.style.borderRadius = '4px';
    const text = Object.entries(reward).map(([k,v]) => `+${v} ${k}`).join(', ');
    el.textContent = `Recompensa: ${text}`;
    document.body.appendChild(el);
    // animate up & fade
    requestAnimationFrame(() => { el.style.transition = 'transform 600ms ease, opacity 600ms ease'; });
    setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(-18px)'; el.style.opacity = '0'; }, 1200);
    setTimeout(() => { try { document.body.removeChild(el); } catch (e) {} }, 2000);
  }

  // expose mission add helper
  window.addMission = function(m) { m.id = m.id || ('m'+Math.random().toString(36).slice(2,8)); window._missions.push(m); renderMissions(); };

  // sample missions to start with
  if (window._missions.length === 0) {
    window.addMission({ title: 'Recolecta trigo', desc: 'Reúne 3 unidades de trigo.', target: 3, progress: inventory['wheat']||0, reward: { wheat:2, brick:1 }, watch: 'wheat' });
    window.addMission({ title: 'Construye una casa', desc: 'Coloca 1 casa en el mapa.', target: 1, progress: 0, reward: { brick:3 }, watch: 'build.house' });
  }
  renderMissions();

  // global keybinds for abilities (1-4)
  document.addEventListener('keydown', (e) => {
    if (!e.key) return;
    const k = e.key;
    abilities.forEach((ab, i) => { if (ab.key === k) { useAbility(i); e.preventDefault(); } });
  });
}

// Create a simple top menu bar with 'Ver', 'Ventanas' and 'Ajustes'
function createMenuBar() {
  if (document.getElementById('top-menubar')) return;
  const bar = document.createElement('div'); bar.id = 'top-menubar';
  bar.style.position = 'fixed'; bar.style.left = '0'; bar.style.top = '0'; bar.style.right = '0';
  bar.style.height = '34px'; bar.style.zIndex = 99999; bar.style.display = 'flex'; bar.style.alignItems = 'center';
  bar.style.padding = '4px 8px'; bar.style.background = 'rgba(10,10,10,0.95)'; bar.style.borderBottom = '1px solid rgba(255,215,122,0.06)';
  bar.style.color = '#FFD27A'; bar.style.fontFamily = 'sans-serif'; bar.style.fontSize = '13px';

  const left = document.createElement('div'); left.style.display='flex'; left.style.gap='10px'; left.style.alignItems='center';
  // View menu
  const viewBtn = document.createElement('button'); viewBtn.textContent = 'Ver'; viewBtn.style.background='transparent'; viewBtn.style.color='inherit'; viewBtn.style.border='none'; viewBtn.style.cursor='pointer'; viewBtn.className = 'meso-menu-btn';
  const viewMenu = document.createElement('div'); viewMenu.style.position='absolute'; viewMenu.style.top='34px'; viewMenu.style.left='8px'; viewMenu.style.background='rgba(18,18,18,0.98)'; viewMenu.style.border='1px solid #333'; viewMenu.style.display='none'; viewMenu.style.padding='8px'; viewMenu.className = 'meso-menu';
  const floatToggle = document.createElement('label'); floatToggle.style.cursor='pointer'; floatToggle.innerHTML = `<input type='checkbox' ${document.body.classList.contains('floating-panels') ? 'checked' : ''}> Paneles flotantes`;
  floatToggle.querySelector('input').addEventListener('change', (e) => { setFloatingPanels(e.target.checked); });
  viewMenu.appendChild(floatToggle);
  viewBtn.addEventListener('click', () => { viewMenu.style.display = viewMenu.style.display === 'none' ? 'block' : 'none'; });
  left.appendChild(viewBtn); left.appendChild(viewMenu);

  // Windows menu
  const winBtn = document.createElement('button'); winBtn.textContent = 'Ventanas'; winBtn.style.background='transparent'; winBtn.style.color='inherit'; winBtn.style.border='none'; winBtn.style.cursor='pointer'; winBtn.className = 'meso-menu-btn';
  const winMenu = document.createElement('div'); winMenu.style.position='absolute'; winMenu.style.top='34px'; winMenu.style.left='80px'; winMenu.style.background='rgba(18,18,18,0.98)'; winMenu.style.border='1px solid #333'; winMenu.style.display='none'; winMenu.style.padding='8px'; winMenu.style.maxHeight='260px'; winMenu.style.overflow='auto'; winMenu.className = 'meso-menu';
  function rebuildWindowMenu() {
    winMenu.innerHTML = '';
    Object.keys(window.FLOATING_PANELS).forEach(id => {
      const p = window.FLOATING_PANELS[id];
      const label = document.createElement('label'); label.style.display='block'; label.style.cursor='pointer';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = p.style.display !== 'none'; chk.style.marginRight='8px';
      chk.addEventListener('change', () => { p.style.display = chk.checked ? 'block' : 'none'; try { saveAppStateDebounced(); } catch (e) {} });
      label.appendChild(chk);
      const txt = document.createElement('span'); txt.textContent = p.getAttribute('data-title') || p.id; label.appendChild(txt);
      winMenu.appendChild(label);
    });
  }
  winBtn.addEventListener('click', () => { rebuildWindowMenu(); winMenu.style.display = winMenu.style.display === 'none' ? 'block' : 'none'; });
  left.appendChild(winBtn); left.appendChild(winMenu);

  // File / Save menu (Export / Import)
  const fileBtn = document.createElement('button'); fileBtn.textContent = 'Partida'; fileBtn.style.background='transparent'; fileBtn.style.color='inherit'; fileBtn.style.border='none'; fileBtn.style.cursor='pointer'; fileBtn.className = 'meso-menu-btn';
  const fileMenu = document.createElement('div'); fileMenu.style.position='absolute'; fileMenu.style.top='34px'; fileMenu.style.left='140px'; fileMenu.style.background='rgba(18,18,18,0.98)'; fileMenu.style.border='1px solid #333'; fileMenu.style.display='none'; fileMenu.style.padding='8px'; fileMenu.className = 'meso-menu';
  // hidden file input for import
  const _importInput = document.createElement('input'); _importInput.type = 'file'; _importInput.accept = 'application/json'; _importInput.style.display = 'none';
  _importInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const data = JSON.parse(String(r.result)); importGameFromObject(data); } catch (err) { notify('Archivo inválido'); } }; r.readAsText(f);
    // reset value so same file can be picked again
    setTimeout(() => { try { _importInput.value = ''; } catch (e) {} }, 200);
  });
  document.body.appendChild(_importInput);

  const exportBtnFile = document.createElement('button'); exportBtnFile.textContent = 'Exportar partida'; exportBtnFile.style.display='block'; exportBtnFile.style.marginBottom='6px';
  exportBtnFile.addEventListener('click', () => { try { saveAppState(); exportGameToFile(); } catch (e) { notify('Error exportando partida'); } });
  const importBtnFile = document.createElement('button'); importBtnFile.textContent = 'Importar partida'; importBtnFile.style.display='block';
  importBtnFile.className = 'tool-btn'; importBtnFile.style.marginBottom = '6px';
  importBtnFile.addEventListener('click', () => { try { _importInput.click(); } catch (e) { notify('Error importando partida'); } });
  fileMenu.appendChild(exportBtnFile); fileMenu.appendChild(importBtnFile);

  // Restart button (clears app state and runtime caches before reload)
  const restartBtnFile = document.createElement('button'); restartBtnFile.textContent = 'Reiniciar partida'; restartBtnFile.style.display='block'; restartBtnFile.style.marginBottom='6px'; restartBtnFile.className = 'tool-btn'; restartBtnFile.style.background = '#8B0000'; restartBtnFile.style.color = '#fff';
  restartBtnFile.addEventListener('click', async () => {
    try {
      if (!confirm('Reiniciar partida: se borrará el progreso local y recargará la página. ¿Continuar?')) return;
      // clear all storage (user requested full reset)
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      // clear runtime caches
      try { clearRuntimeCaches(); } catch (e) {}
    } catch (e) {}
    location.reload();
  });
  fileMenu.appendChild(restartBtnFile);
  fileBtn.addEventListener('click', () => { fileMenu.style.display = fileMenu.style.display === 'none' ? 'block' : 'none'; });
  left.appendChild(fileBtn); left.appendChild(fileMenu);

  // Settings menu
  const setBtn = document.createElement('button'); setBtn.textContent = 'Ajustes'; setBtn.style.background='transparent'; setBtn.style.color='inherit'; setBtn.style.border='none'; setBtn.style.cursor='pointer'; setBtn.className = 'meso-menu-btn';
  const setMenu = document.createElement('div'); setMenu.style.position='absolute'; setMenu.style.top='34px'; setMenu.style.left='170px'; setMenu.style.background='rgba(18,18,18,0.98)'; setMenu.style.border='1px solid #333'; setMenu.style.display='none'; setMenu.style.padding='8px'; setMenu.className = 'meso-menu';
  // Graphics options
  const gfxHdr = document.createElement('div'); gfxHdr.style.marginTop = '8px'; gfxHdr.style.fontWeight = '700'; gfxHdr.style.marginBottom = '6px'; gfxHdr.textContent = 'Gráficos'; setMenu.appendChild(gfxHdr);

  const qualityLabel = document.createElement('div'); qualityLabel.style.fontSize='12px'; qualityLabel.style.marginBottom='4px'; qualityLabel.textContent = 'Calidad:';
  const qualitySelect = document.createElement('select'); qualitySelect.style.width='100%'; qualitySelect.style.marginBottom='8px';
  ['high','balanced','performance'].forEach(q => { const opt = document.createElement('option'); opt.value=q; opt.textContent = q.charAt(0).toUpperCase()+q.slice(1); qualitySelect.appendChild(opt); });
  qualitySelect.value = GRAPHICS_CONFIG.quality;
  qualitySelect.addEventListener('change', () => { applyGraphicsPreset(qualitySelect.value); saveGraphicsConfig(); });
  setMenu.appendChild(qualityLabel); setMenu.appendChild(qualitySelect);

  const smoothingRow = document.createElement('div'); smoothingRow.style.display='flex'; smoothingRow.style.alignItems='center'; smoothingRow.style.gap='8px'; smoothingRow.style.marginBottom='6px';
  const smoothLabel = document.createElement('span'); smoothLabel.textContent = 'Suavizado'; smoothLabel.style.fontSize='12px';
  const smoothRange = document.createElement('input'); smoothRange.type='range'; smoothRange.min='0.75'; smoothRange.max='1.05'; smoothRange.step='0.01'; smoothRange.value = String(GRAPHICS_CONFIG.smoothingThreshold);
  smoothRange.style.flex='1'; smoothingRow.appendChild(smoothLabel); smoothingRow.appendChild(smoothRange);
  smoothRange.addEventListener('input', () => { GRAPHICS_CONFIG.smoothingThreshold = parseFloat(smoothRange.value); saveGraphicsConfig(); });
  setMenu.appendChild(smoothingRow);

  // Zoom smoothness control (lerp speed)
  const zoomRow = document.createElement('div'); zoomRow.style.display='flex'; zoomRow.style.alignItems='center'; zoomRow.style.gap='8px'; zoomRow.style.marginBottom='6px';
  const zoomLabel = document.createElement('span'); zoomLabel.textContent = 'Zoom suavizado'; zoomLabel.style.fontSize='12px';
  const zoomRange = document.createElement('input'); zoomRange.type='range'; zoomRange.min='0.02'; zoomRange.max='0.6'; zoomRange.step='0.01'; zoomRange.value = String(zoomLerpSpeed || 0.18);
  zoomRange.style.flex='1'; zoomRow.appendChild(zoomLabel); zoomRow.appendChild(zoomRange);
  zoomRange.addEventListener('input', () => { zoomLerpSpeed = parseFloat(zoomRange.value); try { localStorage.setItem('meso.zoomLerpSpeed', String(zoomLerpSpeed)); } catch (e) {} });
  setMenu.appendChild(zoomRow);
  // restore saved zoom lerp speed
  try { const zls = parseFloat(localStorage.getItem('meso.zoomLerpSpeed') || ''); if (!isNaN(zls) && zls > 0) zoomLerpSpeed = zls; } catch (e) {}

  const treeLabel = document.createElement('div'); treeLabel.style.fontSize='12px'; treeLabel.style.marginBottom='4px'; treeLabel.textContent = 'Detalle árboles:';
  const treeSelect = document.createElement('select'); treeSelect.style.width='100%'; treeSelect.style.marginBottom='6px';
  ['high','balanced','low'].forEach(t => { const opt = document.createElement('option'); opt.value=t; opt.textContent = t.charAt(0).toUpperCase()+t.slice(1); treeSelect.appendChild(opt); });
  // set based on current treeSkip
  treeSelect.value = GRAPHICS_CONFIG.quality === 'performance' ? 'low' : (GRAPHICS_CONFIG.quality === 'high' ? 'high' : 'balanced');
  treeSelect.addEventListener('change', () => { applyTreePreset(treeSelect.value); saveGraphicsConfig(); mapCacheDirty = true; rebuildMapCacheDebounced(); });
  setMenu.appendChild(treeLabel); setMenu.appendChild(treeSelect);

  // helper functions for presets
  function applyGraphicsPreset(name) {
    GRAPHICS_CONFIG.quality = name;
    if (name === 'high') {
      GRAPHICS_CONFIG.smoothingThreshold = 0.90;
      GRAPHICS_CONFIG.treeSkip = { near: 0.30, mid: 0.55, far: 0.80 };
      GRAPHICS_CONFIG.cacheRebuildDelay = 60;
    } else if (name === 'performance') {
      GRAPHICS_CONFIG.smoothingThreshold = 1.1; // effectively off
      GRAPHICS_CONFIG.treeSkip = { near: 0.55, mid: 0.8, far: 0.98 };
      GRAPHICS_CONFIG.cacheRebuildDelay = 220;
    } else {
      GRAPHICS_CONFIG.smoothingThreshold = 0.95;
      GRAPHICS_CONFIG.treeSkip = { near: 0.45, mid: 0.75, far: 0.95 };
      GRAPHICS_CONFIG.cacheRebuildDelay = 120;
    }
    // update UI elements
    smoothRange.value = String(GRAPHICS_CONFIG.smoothingThreshold);
    treeSelect.value = name === 'performance' ? 'low' : (name === 'high' ? 'high' : 'balanced');
    // apply changes
    mapCacheDirty = true; rebuildMapCacheDebounced(); render();
  }

  function applyTreePreset(name) {
    if (name === 'high') GRAPHICS_CONFIG.treeSkip = { near: 0.18, mid: 0.38, far: 0.65 };
    else if (name === 'low') GRAPHICS_CONFIG.treeSkip = { near: 0.45, mid: 0.7, far: 0.92 };
    else GRAPHICS_CONFIG.treeSkip = { near: 0.35, mid: 0.60, far: 0.80 };
    mapCacheDirty = true; rebuildMapCacheDebounced(); render();
  }

  function saveGraphicsConfig() {
    try { localStorage.setItem('meso.graphicsConfig', JSON.stringify(GRAPHICS_CONFIG)); } catch (e) {}
  }

  // Dev menu (debug options)
  const devBtn = document.createElement('button'); devBtn.textContent = 'Dev'; devBtn.style.background='transparent'; devBtn.style.color='inherit'; devBtn.style.border='none'; devBtn.style.cursor='pointer'; devBtn.className = 'meso-menu-btn';
  const devMenu = document.createElement('div'); devMenu.style.position='absolute'; devMenu.style.top='34px'; devMenu.style.left='230px'; devMenu.style.background='rgba(18,18,18,0.98)'; devMenu.style.border='1px solid #333'; devMenu.style.display='none'; devMenu.style.padding='8px'; devMenu.className = 'meso-menu';
  // debug options
  const optLogPlayer = document.createElement('label'); optLogPlayer.style.display='block'; optLogPlayer.style.cursor='pointer'; optLogPlayer.innerHTML = `<input type='checkbox'> Log player pos (console)`;
  optLogPlayer.querySelector('input').addEventListener('change', (e) => { window.DEBUG_LOG_PLAYER_POS = !!e.target.checked; });
  const optLogCam = document.createElement('label'); optLogCam.style.display='block'; optLogCam.style.cursor='pointer'; optLogCam.style.marginTop='6px'; optLogCam.innerHTML = `<input type='checkbox'> Log camera pos (console)`;
  optLogCam.querySelector('input').addEventListener('change', (e) => { window.DEBUG_LOG_CAMERA = !!e.target.checked; });
  const optOverlay = document.createElement('label'); optOverlay.style.display='block'; optOverlay.style.cursor='pointer'; optOverlay.style.marginTop='6px'; optOverlay.innerHTML = `<input type='checkbox' ${window.DEBUG_ISO ? 'checked' : ''}> Mostrar overlay debug`;
  optOverlay.querySelector('input').addEventListener('change', (e) => { window.DEBUG_ISO = !!e.target.checked; });
  devMenu.appendChild(optLogPlayer); devMenu.appendChild(optLogCam); devMenu.appendChild(optOverlay);
  // Auto-NPC speak config and dialogue loader
  try {
    window.AUTO_NPC_SPEAK = typeof window.AUTO_NPC_SPEAK === 'boolean' ? window.AUTO_NPC_SPEAK : true;
    window.NPC_SPEAK_INTERVAL = window.NPC_SPEAK_INTERVAL || 30000; // ms
    window._npcLastAutoSpeak = window._npcLastAutoSpeak || 0;
    window.loadNpcDialoguesFromData = function() {
      try {
        fetch('data/npc-dialogues.json').then(r => { if (!r.ok) throw new Error('no file'); return r.json(); }).then(obj => { try { window.loadNpcDialogues(obj); notify && notify('Diálogos cargados'); } catch (e) { console.warn(e); } }).catch(err => {
          console.warn('No se pudo cargar data/npc-dialogues.json', err);
          notify && notify('No se encontraron diálogos en data/');
        });
      } catch (e) { console.warn('loadNpcDialoguesFromData error', e); }
    };
    // try to load on startup (best-effort)
    try { window.loadNpcDialoguesFromData(); } catch (e) {}
  } catch (e) {}

  // Dev controls for auto-speak
  const autoSpeakLabel = document.createElement('label'); autoSpeakLabel.style.display='block'; autoSpeakLabel.style.cursor='pointer'; autoSpeakLabel.style.marginTop='8px';
  autoSpeakLabel.innerHTML = `<input type='checkbox' ${window.AUTO_NPC_SPEAK ? 'checked' : ''}> Auto NPC (cada ${Math.round(window.NPC_SPEAK_INTERVAL/1000)}s)`;
  autoSpeakLabel.querySelector('input').addEventListener('change', (e) => { window.AUTO_NPC_SPEAK = !!e.target.checked; });
  const reloadDlgBtn = document.createElement('button'); reloadDlgBtn.textContent = 'Recargar diálogos desde data'; reloadDlgBtn.style.display='block'; reloadDlgBtn.style.marginTop='6px';
  reloadDlgBtn.addEventListener('click', () => { try { window.loadNpcDialoguesFromData(); } catch (e) { notify && notify('Error recargando diálogos'); } });
  const showDlgBtn = document.createElement('button'); showDlgBtn.textContent = 'Mostrar diálogos cargados'; showDlgBtn.style.display='block'; showDlgBtn.style.marginTop='6px';
  showDlgBtn.addEventListener('click', () => { try { alert(JSON.stringify(window.NPC_DIALOGUES || {}, null, 2)); } catch (e) { notify && notify('Error mostrando diálogos'); } });
  devMenu.appendChild(autoSpeakLabel);
  devMenu.appendChild(reloadDlgBtn);
  devMenu.appendChild(showDlgBtn);
  // Dev quick actions: test dialogues and NPC helpers
  const sep = document.createElement('hr'); sep.style.border = 'none'; sep.style.borderTop = '1px solid rgba(255,255,255,0.04)'; sep.style.margin = '8px 0'; devMenu.appendChild(sep);
  const btnTestDialog = document.createElement('button'); btnTestDialog.textContent = 'Probar diálogo (player)'; btnTestDialog.style.display='block'; btnTestDialog.style.marginBottom='6px';
  btnTestDialog.addEventListener('click', () => {
    try {
      const wx = (player.x || 0) + 0.5; const wy = (player.y || 0) - 0.2;
      if (window.spawnFloatingText) window.spawnFloatingText(wx, wy, '¡Hola! Prueba de diálogo.', '#FFF');
      else if (window.floatingTexts) window.floatingTexts.push({ born: Date.now(), life: 2600, worldX: wx, worldY: wy, yv: -0.35, color: '#FFF', text: '¡Hola! Prueba de diálogo.' });
    } catch (e) { notify && notify('Error mostrando diálogo'); }
  });
  const btnSpawnNpc = document.createElement('button'); btnSpawnNpc.textContent = 'Generar NPC (cerca)'; btnSpawnNpc.style.display='block'; btnSpawnNpc.style.marginBottom='6px';
  btnSpawnNpc.addEventListener('click', () => {
    try { const nx = Math.max(0, Math.floor((player.x||0)+1)); const ny = Math.max(0, Math.floor((player.y||0))); const p = spawnNPC('DevNPC', nx, ny); if (p) notify && notify('NPC creado: ' + (p.name||p.id)); } catch (e) { notify && notify('Error generando NPC'); }
  });
  const btnSpawnNpcSpeak = document.createElement('button'); btnSpawnNpcSpeak.textContent = 'Generar NPC y hablar'; btnSpawnNpcSpeak.style.display='block'; btnSpawnNpcSpeak.style.marginBottom='6px';
  btnSpawnNpcSpeak.addEventListener('click', () => {
    try {
      const nx = Math.max(0, Math.floor((player.x||0)+1)); const ny = Math.max(0, Math.floor((player.y||0)));
      const p = spawnNPC('DevNPC', nx, ny);
      if (p) {
        const wx = (p.col || nx) + 0.5; const wy = (p.row || ny) - 0.2;
        if (window.spawnFloatingText) window.spawnFloatingText(wx, wy, '¡Hola! Soy un NPC de prueba.', '#FFF');
        else if (window.floatingTexts) window.floatingTexts.push({ born: Date.now(), life: 2600, worldX: wx, worldY: wy, yv: -0.35, color: '#FFF', text: '¡Hola! Soy un NPC de prueba.' });
      }
    } catch (e) { notify && notify('Error generando NPC hablador'); }
  });
  const btnAllNpcSpeak = document.createElement('button'); btnAllNpcSpeak.textContent = 'Forzar diálogo: todos NPCs'; btnAllNpcSpeak.style.display='block'; btnAllNpcSpeak.style.marginBottom='6px';
  btnAllNpcSpeak.addEventListener('click', () => {
    try {
      const nowt = Date.now();
      entities.forEach(en => { if (en && en.id && en.id.indexOf('npc-') === 0) {
        const wx = (en.col||0) + 0.5; const wy = (en.row||0) - 0.2;
        if (window.spawnFloatingText) window.spawnFloatingText(wx, wy, '¡Hola!', '#FFF');
        else if (window.floatingTexts) window.floatingTexts.push({ born: nowt, life: 2600, worldX: wx, worldY: wy, yv: -0.3, color: '#FFF', text: '¡Hola!' });
      }});
    } catch (e) { notify && notify('Error forzando diálogos'); }
  });
  const btnClearDialogs = document.createElement('button'); btnClearDialogs.textContent = 'Limpiar diálogos'; btnClearDialogs.style.display='block'; btnClearDialogs.style.marginBottom='6px';
  btnClearDialogs.addEventListener('click', () => { try { window.floatingTexts = []; notify && notify('Diálogos limpiados'); } catch (e) { notify && notify('Error limpiando diálogos'); } });
  devMenu.appendChild(btnTestDialog);
  devMenu.appendChild(btnSpawnNpc);
  devMenu.appendChild(btnSpawnNpcSpeak);
  devMenu.appendChild(btnAllNpcSpeak);
  devMenu.appendChild(btnClearDialogs);
  // Dev helpers: inventory and interior doors
  try {
    window.INTERIOR_DOORS = window.INTERIOR_DOORS || [];
    window.enterInterior = function(id) {
      try {
        fetch('data/interiors/' + id + '.json').then(r => { if (!r.ok) throw new Error('missing'); return r.json(); }).then(data => {
          window._savedExterior = { col: Math.floor(player.x), row: Math.floor(player.y) };
          window.currentInterior = data;
          player.col = data.entryCol || 1; player.row = data.entryRow || 1; player.x = player.col; player.y = player.row;
          notify && notify('Entrando en ' + id);
        }).catch(err => { notify && notify('No se pudo cargar interior: ' + id); });
      } catch (e) {}
    };
    window.exitInterior = function() {
      try {
        if (window._savedExterior) {
          player.col = window._savedExterior.col; player.row = window._savedExterior.row; player.x = player.col; player.y = player.row;
          window._savedExterior = null;
        }
        window.currentInterior = null;
        notify && notify('Saliendo del interior');
      } catch (e) {}
    };
  } catch (e) {}

  const btnAddFood = document.createElement('button'); btnAddFood.textContent = 'Añadir comida'; btnAddFood.style.display='block'; btnAddFood.style.marginTop='6px';
  btnAddFood.addEventListener('click', () => { try { addToInventory('food', 1); } catch (e) { notify && notify('Error'); } });
  const btnAddWater = document.createElement('button'); btnAddWater.textContent = 'Añadir agua'; btnAddWater.style.display='block'; btnAddWater.style.marginTop='6px';
  btnAddWater.addEventListener('click', () => { try { addToInventory('water', 1); } catch (e) { notify && notify('Error'); } });
  const btnAddSword = document.createElement('button'); btnAddSword.textContent = 'Añadir arma: Espada'; btnAddSword.style.display='block'; btnAddSword.style.marginTop='6px';
  btnAddSword.addEventListener('click', () => { try { addToInventory('sword', 1); notify && notify('Espada añadida'); } catch (e) { notify && notify('Error'); } });
  const btnAddItem = document.createElement('button'); btnAddItem.textContent = 'Añadir item (prompt)'; btnAddItem.style.display='block'; btnAddItem.style.marginTop='6px';
  btnAddItem.addEventListener('click', () => {
    try {
      const id = prompt('ID del item (ej: axe, spear, potion):', 'axe');
      if (!id) return; const qty = parseInt(prompt('Cantidad:', '1') || '1', 10) || 1;
      addToInventory(id, qty);
      notify && notify(`${qty}x ${id} añadidos`);
      try { updateInventory(); } catch (e) {}
    } catch (e) { notify && notify('Error añadiendo item'); }
  });
  const btnCreateDoor = document.createElement('button'); btnCreateDoor.textContent = 'Crear puerta -> house-small'; btnCreateDoor.style.display='block'; btnCreateDoor.style.marginTop='6px';
  btnCreateDoor.addEventListener('click', () => {
    try {
      const col = Math.floor(player.x), row = Math.floor(player.y);
      window.INTERIOR_DOORS.push({ col, row, interiorId: 'house-small' });
      notify && notify(`Puerta creada en ${col},${row} -> house-small`);
    } catch (e) { notify && notify('Error creando puerta'); }
  });
  const btnListDoors = document.createElement('button'); btnListDoors.textContent = 'Listar puertas interiores'; btnListDoors.style.display='block'; btnListDoors.style.marginTop='6px';
  btnListDoors.addEventListener('click', () => { try { alert(JSON.stringify(window.INTERIOR_DOORS || [], null, 2)); } catch (e) { notify && notify('Error'); } });
  devMenu.appendChild(btnAddFood); devMenu.appendChild(btnAddWater); devMenu.appendChild(btnAddSword); devMenu.appendChild(btnAddItem); devMenu.appendChild(btnCreateDoor); devMenu.appendChild(btnListDoors);
  const btnConsumeFood = document.createElement('button'); btnConsumeFood.textContent = 'Consumir comida'; btnConsumeFood.style.display='block'; btnConsumeFood.style.marginTop='6px';
  btnConsumeFood.addEventListener('click', () => {
    try {
      if ((inventory['food'] || 0) <= 0) { notify && notify('No tienes comida'); return; }
      inventory['food'] = Math.max(0, (inventory['food'] || 0) - 1);
      char.hunger = Math.min(char.maxHunger || 100, (char.hunger || 0) + 30);
      notify && notify('Comiste: +30 hambre'); updateInventory();
    } catch (e) { notify && notify('Error consumiendo'); }
  });
  const btnConsumeWater = document.createElement('button'); btnConsumeWater.textContent = 'Consumir agua'; btnConsumeWater.style.display='block'; btnConsumeWater.style.marginTop='6px';
  btnConsumeWater.addEventListener('click', () => {
    try {
      if ((inventory['water'] || 0) <= 0) { notify && notify('No tienes agua'); return; }
      inventory['water'] = Math.max(0, (inventory['water'] || 0) - 1);
      char.thirst = Math.min(char.maxThirst || 100, (char.thirst || 0) + 40);
      notify && notify('Bebiste: +40 sed'); updateInventory();
    } catch (e) { notify && notify('Error bebiendo'); }
  });
  devMenu.appendChild(btnConsumeFood); devMenu.appendChild(btnConsumeWater);
  devBtn.addEventListener('click', () => { devMenu.style.display = devMenu.style.display === 'none' ? 'block' : 'none'; });
  left.appendChild(devBtn); left.appendChild(devMenu);
  // try to restore graphics config from storage
  try {
    const raw = localStorage.getItem('meso.graphicsConfig');
    if (raw) {
      const g = JSON.parse(raw);
      if (g && typeof g === 'object') { Object.assign(GRAPHICS_CONFIG, g); qualitySelect.value = GRAPHICS_CONFIG.quality; smoothRange.value = String(GRAPHICS_CONFIG.smoothingThreshold); }
    }
  } catch (e) {}

  setBtn.addEventListener('click', () => { setMenu.style.display = setMenu.style.display === 'none' ? 'block' : 'none'; });
  left.appendChild(setBtn); left.appendChild(setMenu);

  bar.appendChild(left);
  // hide the bar by default; reveal when hovering at the very top of the window
  bar.style.transition = 'top 220ms ease, opacity 220ms ease';
  bar.style.top = '-44px';
  bar.style.opacity = '0';
  bar.style.pointerEvents = 'none';
  document.body.appendChild(bar);

  // show/hide helpers: reveal when mouse is near the top edge, keep visible while over bar
  let _topBarTimer = null;
  function showTopBar() {
    if (_topBarTimer) { clearTimeout(_topBarTimer); _topBarTimer = null; }
    bar.style.top = '0px';
    bar.style.opacity = '1';
    bar.style.pointerEvents = 'auto';
  }
  function hideTopBarSoon(delay = 800) {
    if (_topBarTimer) clearTimeout(_topBarTimer);
    _topBarTimer = setTimeout(() => {
      // only hide when the mouse is not over the bar
      try {
        const el = document.elementFromPoint(window._lastMouseX || 0, window._lastMouseY || 0);
        if (el && bar.contains(el)) return; // still over bar
      } catch (e) {}
      bar.style.top = '-44px'; bar.style.opacity = '0'; bar.style.pointerEvents = 'none';
    }, delay);
  }

  // track last mouse so hide logic can check if pointer is over bar
  document.addEventListener('mousemove', (ev) => { window._lastMouseX = ev.clientX; window._lastMouseY = ev.clientY; if (ev.clientY <= 8) showTopBar(); else if (ev.clientY > 48) hideTopBarSoon(600); });

  // keep bar visible while hovering it
  bar.addEventListener('mouseenter', () => { showTopBar(); });
  bar.addEventListener('mouseleave', () => { hideTopBarSoon(500); });

  // Close any open menu when clicking outside menus or menu buttons
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.closest && (target.closest('.meso-menu') || target.closest('.meso-menu-btn'))) {
      return; // clicked inside a menu or on a menu button
    }
    const openMenus = document.querySelectorAll('.meso-menu');
    openMenus.forEach(m => { if (m.style) m.style.display = 'none'; });
  });
}

// Task panel for assigning actions to NPCs (right-side action list)
function createTaskPanel() {
  if (document.getElementById('task-panel')) return;
  const panel = document.createElement('div'); panel.id = 'task-panel';
  panel.setAttribute('data-title', 'Acciones');
  panel.style.position = 'fixed'; panel.style.left = '12px'; panel.style.top = '80px'; panel.style.zIndex = 4000;
  stylePanel(panel);
  panel.style.minWidth = '180px';
  // actions list (from image)
  const actions = [
    { id: 'explore', title: 'Explorar', desc: 'Encuentra recursos o rutas ocultas.' },
    { id: 'gather', title: 'Recolectar', desc: 'Recolecta trigo o ladrillos cercanos.' },
    { id: 'build', title: 'Construir', desc: 'Activa el modo edición para construir.' },
    { id: 'trade', title: 'Comerciar', desc: 'Intercambia recursos en el mercado.' },
    { id: 'ritual', title: 'Ritual', desc: 'Realiza rituales para la aldea.' }
  ];
  let html = `<div style="font-weight:700;margin-bottom:8px">Acciones</div>`;
  actions.forEach(a => {
    html += `<div style="padding:8px;margin-bottom:8px;border-radius:4px;background:rgba(255,255,255,0.02)"><div style="font-weight:700">${a.title} <button data-action='${a.id}' style='float:right;background:#333;color:#FFD27A;border:none;padding:4px 6px;border-radius:6px'>Asignar</button></div><div style="font-size:12px;color:#ccc;margin-top:6px">${a.desc}</div></div>`;
  });

  html += `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:8px 0"><div style="font-weight:700;margin-bottom:6px">Aldeanos</div><div id="npc-list" style="max-height:180px;overflow:auto"></div>`;
  panel.innerHTML = html;
  document.body.appendChild(panel);
  // wire assign buttons
  panel.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const actionId = btn.getAttribute('data-action');
      // select NPCs via checkboxes below
      const checked = Array.from(document.querySelectorAll('#npc-list input[type=checkbox]:checked')).map(c => c.value);
      if (checked.length === 0) { notify('Selecciona al menos un aldeano.'); return; }
      const assigned = [];
      checked.forEach(id => {
        const npc = entities.find(en => en.id === id);
        if (npc) {
          npc.task = { id: actionId, progress: 0, assignedAt: Date.now() };
          assigned.push(npc.name || npc.id);
        }
      });
      notify(`Tarea ${actionId} asignada a ${assigned.length} aldeano(s)`);
      renderNPCList();
    });
  });

  function renderNPCList() {
    const list = document.getElementById('npc-list'); if (!list) return; list.innerHTML = '';
    // show entities that look like NPCs (id starts with 'npc-')
    const npcs = entities.filter(en => en.id && en.id.indexOf('npc-') === 0);
    if (npcs.length === 0) {
      list.innerHTML = '<div style="color:#ccc;font-size:13px">No hay aldeanos (aún).</div>';
      return;
    }
    npcs.forEach(n => {
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.padding = '6px 0';
      const left = document.createElement('div'); left.innerHTML = `<label style="font-weight:700"><input type='checkbox' value='${n.id}' style='margin-right:8px'> ${n.name || n.id}</label><div style='font-size:12px;color:#ccc'>HP: ${n.hp||0}/${n.maxHp||0}</div>`;
      const right = document.createElement('div'); right.style.fontSize='12px'; right.style.color='#9f9f9f'; right.textContent = n.task ? n.task.id : '—';
      row.appendChild(left); row.appendChild(right); list.appendChild(row);
    });
  }

  // expose for other code to refresh
  window.renderNPCList = renderNPCList;
  renderNPCList();
  enableFloatingBehavior(panel);
  try { registerPanel(panel); } catch (err) {}
}

// find entity (resource/player) or rabbit near world float coords (x,y in tiles)
function findEntityAtWorld(x, y) {
  // check entities
  for (let i = entities.length - 1; i >= 0; i--) {
    const ent = entities[i];
    if (!ent) continue;
    const dx = (ent.col + 0.5) - x; const dy = (ent.row + 0.5) - y;
    if (Math.hypot(dx, dy) < 0.7) return ent;
  }
  // check rabbits
  for (let i = rabbits.length - 1; i >= 0; i--) {
    const rab = rabbits[i];
    const dx = (rab.col + 0.5) - x; const dy = (rab.row + 0.5) - y;
    if (Math.hypot(dx, dy) < 0.8) return rab;
  }
  // check player
  const pdx = (player.x) - x; const pdy = (player.y) - y;
  if (Math.hypot(pdx, pdy) < 0.8) return { kind: 'player', name: player.name, col: Math.floor(player.x), row: Math.floor(player.y), hp: char.hp, maxHp: char.maxHp };
  return null;
}

function showEntityInfo(ent) {
  const panel = document.getElementById('entity-info');
  const body = document.getElementById('entity-info-body');
  const title = document.getElementById('entity-info-title');
  if (!panel || !body || !title) return;
  title.textContent = ent.name || (ent.kind === 'resource' ? ent.subtype : 'Entidad');
  const lines = [];
  // header details
  if (ent.kind === 'resource') {
    lines.push(`<div style="margin-bottom:6px"><b>Recurso:</b> ${ent.subtype}</div>`);
    lines.push(`<div>Ubicación: ${ent.col}, ${ent.row}</div>`);
  } else if (ent.kind === 'player') {
    lines.push(`<div style="display:flex;align-items:center;gap:8px"><div style="width:64px;height:64px;background:#222;padding:6px;border-radius:6px">`);
    lines.push(`</div><div><div style="font-weight:700">${ent.name || 'NPC'}</div><div style="font-size:12px;color:#ccc">Pos: ${ent.col}, ${ent.row}</div></div></div>`);
    lines.push(`<div style="margin-top:8px">HP: <b>${ent.hp}/${ent.maxHp}</b></div>`);
    if (ent.special) {
      lines.push('<div style="margin-top:6px"><b>Stats</b></div>');
      lines.push('<div style="display:flex;flex-wrap:wrap;gap:6px">');
      Object.entries(ent.special).forEach(([k,v]) => lines.push(`<div style="background:#222;padding:4px 6px;border-radius:4px"><b>${k}</b>: ${v}</div>`));
      lines.push('</div>');
    }
  } else {
    // rabbit or generic
    lines.push(`<div style="font-weight:700">Animal</div>`);
    lines.push(`<div>HP: ${ent.hp || 'N/A'}/${ent.maxHp || 'N/A'}</div>`);
    lines.push(`<div>Pos: ${ent.col},${ent.row}</div>`);
    if (ent.size) lines.push(`<div>Tamaño: ${ent.size}</div>`);
  }

  // action buttons when relevant
  const actionsHtml = [];
  if (ent.kind === 'player' || ent.kind === 'resource' || ent.kind === undefined) {
    actionsHtml.push(`<button id="ent-action-follow" style="margin-right:6px;padding:6px 8px;background:#222;color:#FFD27A;border-radius:6px;border:none">Seguir</button>`);
    actionsHtml.push(`<button id="ent-action-attack" style="padding:6px 8px;background:#8B0000;color:#fff;border-radius:6px;border:none">Atacar</button>`);
  }

  body.innerHTML = `<div>${lines.join('')}</div><div style="margin-top:10px">${actionsHtml.join('')}</div>`;
  panel.style.display = 'block';
  // wire action handlers
  setTimeout(() => {
    const fbtn = document.getElementById('ent-action-follow'); if (fbtn) fbtn.addEventListener('click', () => { followPlayer = true; notify('Siguiendo entidad'); panel.style.display='none'; });
    const abtn = document.getElementById('ent-action-attack'); if (abtn) abtn.addEventListener('click', () => { try { performAction('attack'); } catch (e) { notify('Atacar (error)'); } panel.style.display='none'; });
  }, 20);
}

// persistence: save player pos when it changes
let _lastSavedPos = null;
function savePlayerPos(force) {
  try {
    const pos = { x: player.x, y: player.y, col: player.col, row: player.row };
    const key = JSON.stringify([Math.round(pos.x*10), Math.round(pos.y*10)]);
    if (force || _lastSavedPos !== key) {
      try { console.log('savePlayerPos -> saving', JSON.stringify(pos)); } catch (e) { console.debug('savePlayerPos ->', JSON.stringify(pos)); }
      localStorage.setItem('meso.playerPos', JSON.stringify(pos));
      try { sessionStorage.setItem('meso.playerPos', JSON.stringify(pos)); } catch (e) {}
      _lastSavedPos = key;
      try { saveAppStateDebounced(); } catch (e) {}
    }
  } catch (err) { /* ignore */ }
}

function loadPlayerPos() {
  try {
    let raw = null;
    try { raw = sessionStorage.getItem('meso.playerPos'); } catch (e) { raw = null; }
    if (!raw) raw = localStorage.getItem('meso.playerPos');
    // if no direct playerPos key, try appState backup
    if (!raw) {
      try {
        const s = JSON.parse(localStorage.getItem(APP_STATE_KEY) || 'null');
        if (s && s.player) raw = JSON.stringify(s.player);
      } catch (e) { raw = null; }
    }
    if (!raw) return;
    let p = null;
    try { p = JSON.parse(raw); } catch (e) { p = null; }
    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      // clamp coordinates to valid world bounds
      const nx = Math.max(0, Math.min(COLS-1, p.x));
      const ny = Math.max(0, Math.min(ROWS-1, p.y));
      console.debug('loadPlayerPos -> restored pos raw=', p, 'clamped=', { x: nx, y: ny });
      player.x = nx; player.y = ny; player.col = Math.floor(nx); player.row = Math.floor(ny);
      try { centerCameraOnPlayer(); } catch (e) {}
    }
  } catch (err) { /* ignore */ }
}

// draw simple trees for forest biome within visible region
// Builtin fallback pixel templates for trees/vegetation (used if entity-pixels.json not provided)
const BUILTIN_TREE_TEMPLATES = [
  [
    [2,0,'#2F7B2F'],[3,0,'#2F7B2F'],[1,1,'#3A8E3A'],[2,1,'#3A8E3A'],[3,1,'#3A8E3A'],[4,1,'#3A8E3A'],[0,2,'#3A8E3A'],[1,2,'#4FB24F'],[2,2,'#4FB24F'],[3,2,'#4FB24F'],[4,2,'#4FB24F'],[5,2,'#3A8E3A'],[1,3,'#2F7B2F'],[2,3,'#2F7B2F'],[3,3,'#2F7B2F'],[4,3,'#2F7B2F'],[2,4,'#6B3F1A'],[3,4,'#6B3F1A']
  ],
  [
    [2,0,'#4FA24F'],[3,0,'#4FA24F'],[4,0,'#4FA24F'],[5,0,'#4FA24F'],[1,1,'#3A8E3A'],[2,1,'#59C259'],[3,1,'#59C259'],[4,1,'#59C259'],[5,1,'#3A8E3A'],[0,2,'#2F7B2F'],[1,2,'#3A8E3A'],[2,2,'#59C259'],[3,2,'#59C259'],[4,2,'#59C259'],[5,2,'#3A8E3A'],[6,2,'#2F7B2F'],[2,3,'#2F7B2F'],[3,3,'#6B3F1A'],[4,3,'#2F7B2F']
  ],
  [
    [1,0,'#3A8E3A'],[2,0,'#59C259'],[3,0,'#59C259'],[4,0,'#3A8E3A'],[0,1,'#2F7B2F'],[1,1,'#59C259'],[2,1,'#59C259'],[3,1,'#59C259'],[4,1,'#59C259'],[5,1,'#2F7B2F'],[2,2,'#6B3F1A'],[3,2,'#6B3F1A']
  ],
  [
    [2,0,'#4FA24F'],[3,0,'#4FA24F'],[4,0,'#4FA24F'],[1,1,'#3A8E3A'],[2,1,'#59C259'],[3,1,'#59C259'],[4,1,'#59C259'],[5,1,'#3A8E3A'],[2,2,'#3A8E3A'],[3,2,'#6B3F1A'],[4,2,'#6B3F1A'],[5,2,'#3A8E3A']
  ],
  [
    [2,0,'#2F7B2F'],[3,0,'#2F7B2F'],[2,1,'#3A8E3A'],[3,1,'#3A8E3A'],[1,2,'#4FB24F'],[2,2,'#4FB24F'],[3,2,'#4FB24F'],[4,2,'#4FB24F'],[2,3,'#2F7B2F'],[3,3,'#2F7B2F'],[2,4,'#6B3F1A'],[3,4,'#6B3F1A']
  ],
  [
    [0,0,'#59C259'],[1,0,'#59C259'],[2,0,'#59C259'],[3,0,'#59C259'],[4,0,'#59C259'],[0,1,'#3A8E3A'],[1,1,'#3A8E3A'],[2,1,'#3A8E3A'],[3,1,'#3A8E3A'],[4,1,'#3A8E3A']
  ],
  [
    [1,0,'#59C259'],[2,0,'#59C259'],[3,0,'#59C259'],[2,1,'#3A8E3A']
  ]
];

// Start with builtins; may be overridden by `data/entity-pixels.json` on load
let GLOBAL_TREE_TEMPLATES = BUILTIN_TREE_TEMPLATES.slice();

function drawTreesVisible() {
  const tileSize = getTileSize();
  // Use shared pixel templates declared globally
  const TREE_TEMPLATES = GLOBAL_TREE_TEMPLATES;
  const W = canvas.width, H = canvas.height;
  let minC, maxC, minR, maxR;
  if (viewMode === 'iso') {
    // compute visible tile rectangle in world coords using float math
    const tl = screenToWorldFloat(0, 0);
    const br = screenToWorldFloat(W, H);
    minC = Math.max(0, Math.floor(Math.min(tl.x, br.x) - 4));
    maxC = Math.min(COLS - 1, Math.ceil(Math.max(tl.x, br.x) + 4));
    minR = Math.max(0, Math.floor(Math.min(tl.y, br.y) - 4));
    maxR = Math.min(ROWS - 1, Math.ceil(Math.max(tl.y, br.y) + 4));
  } else {
    const minCx = Math.max(0, Math.floor((-camX) / tileSize) - 2);
    const maxCx = Math.min(COLS-1, Math.ceil((W - camX) / tileSize) + 2);
    const minRy = Math.max(0, Math.floor((-camY) / tileSize) - 2);
    const maxRy = Math.min(ROWS-1, Math.ceil((H - camY) / tileSize) + 2);
    minC = minCx; maxC = maxCx; minR = minRy; maxR = maxRy;
  }
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (tileBiome[r][c] !== 'forest') continue;
      const rnd = tileNoise(c, r, 0, 0);
      // adapt tree density based on zoom and configured skip thresholds
      if (zoom < 0.7) {
        if (rnd < GRAPHICS_CONFIG.treeSkip.far) continue; // much sparser
      } else if (zoom < 0.9) {
        if (rnd < GRAPHICS_CONFIG.treeSkip.mid) continue; // medium density
      } else {
        if (rnd < GRAPHICS_CONFIG.treeSkip.near) continue; // high density when zoomed in
      }
      const { x, y } = worldToScreen(c, r);
      // choose a template and draw scaled pixel-art tree
      const tpl = TREE_TEMPLATES[Math.floor(tileNoise(c, r, 3, 4) * TREE_TEMPLATES.length)];
      // scale for iso uses iso tile size; increase base scale so trees appear taller
      const iso = getIsoTileSize();
      const lodFactor = zoom >= GRAPHICS_CONFIG.smoothingThreshold ? 1 : 0.75;
      // base scale: use /3 divisor to make trees taller than before
      let scale = viewMode === 'iso' ? Math.max(1, Math.floor((iso.w / 3) * lodFactor)) : Math.max(1, Math.floor((tileSize / 3) * lodFactor));
      // if template is hedge or grass (small indices near end), reduce scale
      const tplIndex = TREE_TEMPLATES.indexOf(tpl);
      if (tplIndex === 5) scale = Math.max(1, Math.floor(scale * 0.95)); // hedge slightly smaller
      if (tplIndex === 6) scale = Math.max(1, Math.floor(scale * 0.6));  // grass tuft much smaller
      // compute sprite dimensions from template
      let maxX = 0, maxY = 0;
      for (const p of tpl) { if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
      const spriteW = (maxX + 1) * scale;
      const spriteH = (maxY + 1) * scale;
      // position so trunk base sits near tile bottom (works for iso and ortho)
      const jitterX = Math.floor((tileNoise(c, r, 5, 6) - 0.5) * (viewMode === 'iso' ? iso.w : tileSize) * 0.18);
      const cx = Math.floor(x + (viewMode === 'iso' ? 0 : tileSize * 0.5) + jitterX);
      const cy = Math.floor(y + (viewMode === 'iso' ? iso.h : tileSize) - 2);
      const sx = cx - Math.floor(spriteW / 2);
      const sy = cy - spriteH;
      // draw pixels
      for (const [px, py, color] of tpl) {
        ctx.fillStyle = color;
        ctx.fillRect(sx + px * scale, sy + py * scale, scale, scale);
      }
    }
  }
}

// Create larger coherent patches by seeded expansion to improve biome patterns
function refineBiomes() {
  const types = ['forest','hills','grass','sand'];
  const seeds = [];
  const seedCount = Math.max(12, Math.floor((COLS * ROWS) / 1200));
  for (let i = 0; i < seedCount; i++) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);
    if (isRiver(c)) continue;
    seeds.push({ c, r, type: types[Math.floor(Math.random() * types.length)], strength: 1 + Math.random() * 2 });
  }
  // expand seeds
  const work = [];
  seeds.forEach(s => work.push({ c: s.c, r: s.r, type: s.type, strength: s.strength }));
  const visited = new Set();
  while (work.length > 0) {
    const node = work.shift();
    const key = node.c + ',' + node.r;
    if (visited.has(key)) continue;
    visited.add(key);
    if (node.c < 0 || node.c >= COLS || node.r < 0 || node.r >= ROWS) continue;
    if (isRiver(node.c)) continue;
    // probabilistic overwrite to allow blending
    if (Math.random() < Math.min(0.9, 0.5 + node.strength * 0.15)) {
      tileBiome[node.r][node.c] = node.type;
    }
    // push neighbors with decayed strength
    const neigh = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx,dy] of neigh) {
      const nc = node.c + dx, nr = node.r + dy;
      const nk = nc + ',' + nr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (visited.has(nk)) continue;
      const nextStr = node.strength - (0.18 + Math.random() * 0.18);
      if (nextStr > 0) work.push({ c: nc, r: nr, type: node.type, strength: nextStr });
    }
  }
}

// Make a panel draggable, minimizable and closable
function enableFloatingBehavior(el) {
  if (!el) return el;
  // base floating styles
  el.style.position = el.style.position || 'absolute';
  el.style.zIndex = el.style.zIndex || 1900;
  stylePanel(el);
  // ensure header container
  let header = el.querySelector('.floating-header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'floating-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '6px';
    header.style.cursor = 'grab';
    header.style.marginBottom = '6px';
    if (!el.id) el.id = 'panel-' + Math.random().toString(36).slice(2,6);
    const title = document.createElement('strong');
    title.textContent = el.getAttribute('data-title') || el.id || 'Panel';
    header.appendChild(title);
    // insert header before current content
    el.insertBefore(header, el.firstChild);
  }

  // ensure a body wrapper we can hide/show independently of header
  let body = el.querySelector('.floating-body');
  if (!body) {
    body = document.createElement('div');
    body.className = 'floating-body';
    // move existing children (except header) into body
    const nodes = Array.from(el.children).filter(c => !c.classList || !c.classList.contains('floating-header'));
    nodes.forEach(n => body.appendChild(n));
    el.appendChild(body);
  }

  // register panel so menu can control visibility
  registerPanel(el);

  // create controls container
  let controls = header.querySelector('.float-controls');
  if (!controls) {
    controls = document.createElement('div'); controls.className = 'float-controls';
    controls.style.display = 'flex'; controls.style.gap = '6px';
    header.appendChild(controls);
  }

  // minimize button
  if (!header.querySelector('.btn-minimize')) {
    const min = document.createElement('button');
    min.className = 'btn-minimize';
    min.textContent = '—';
    min.title = 'Minimizar';
    min.style.background = '#444'; min.style.color = '#fff'; min.style.border = 'none'; min.style.borderRadius = '3px'; min.style.padding = '2px 6px';
    controls.appendChild(min);
    min.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'block' : 'none';
      min.textContent = hidden ? '—' : '+';
      try { saveAppStateDebounced(); } catch (e) {}
    });
  }

  // close button: try to reuse existing close button inside header
  const existingClose = el.querySelector('.btn-close') || el.querySelector('button[id$="-close"]');
  if (!existingClose) {
    const close = document.createElement('button');
    close.className = 'btn-close';
    close.textContent = '✕';
    close.title = 'Cerrar';
    close.style.background = '#8B0000'; close.style.color = '#fff'; close.style.border = 'none'; close.style.borderRadius = '3px'; close.style.padding = '2px 6px';
    controls.appendChild(close);
    close.addEventListener('click', (ev) => { ev.stopPropagation(); el.style.display = 'none'; try { saveAppStateDebounced(); } catch (e) {} });
  } else {
    existingClose.addEventListener('click', () => { el.style.display = 'none'; try { saveAppStateDebounced(); } catch (e) {} });
  }

  // draggable behavior
  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;
  header.addEventListener('mousedown', e => {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) return; // ignore clicks on buttons
    dragging = true;
    header.style.cursor = 'grabbing';
    startX = e.clientX; startY = e.clientY;
    const rect = el.getBoundingClientRect();
    // ensure element has left/top set
    if (!el.style.left) el.style.left = rect.left + 'px';
    if (!el.style.top) el.style.top = rect.top + 'px';
    origX = parseFloat(el.style.left || 0); origY = parseFloat(el.style.top || 0);
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    el.style.left = (origX + dx) + 'px';
    el.style.top = (origY + dy) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; header.style.cursor = 'grab'; document.body.style.userSelect = ''; } });
  return el;
}

// Create a small game guide panel with development reflections
function createGameGuideUI() {
  if (document.getElementById('game-guide')) return;
  const g = document.createElement('div');
  g.id = 'game-guide';
  g.setAttribute('data-title', 'Guía rápida');
  g.style.position = 'fixed'; g.style.left = '12px'; g.style.top = '12px'; g.style.zIndex = 1900;
  stylePanel(g);
  g.style.minWidth = '260px';
  g.innerHTML = `
    <div style="font-size:13px;line-height:1.3;max-height:280px;overflow:auto">
      <p><b>Controles:</b> Click izquierdo construir/mover, click derecho inspeccionar/mover (modo libre). Teclas: F seguir cámara, I inventario, Enter turno.</p>
      <p><b>Consejos rápidos:</b> Construye casas cerca del río para +25% producción. Usa graneros y mercados para balancear recursos.</p>
      <hr>
      <p><b>Ideas para una base estable de desarrollo:</b></p>
      <ul>
        <li>Modularizar la lógica (mapa, entidades, UI, render) y definir contratos claros.</li>
        <li>Agregar pruebas unitarias para pathfinding y generación procedimental.</li>
        <li>Separar modelo y vista; persistencia serializada y versionada.</li>
        <li>Pipeline de assets y un sistema simple de configuración (JSON) para tunear parámetros.</li>
        <li>Instrumentación básica (fps, ent count) y perfiles para detectar cuellos de botella.</li>
      </ul>
      <hr>
      <p style="font-size:12px;color:#ccc">¿Quieres que convierta esto en un markdown exportable o una pantalla de tutorial paso a paso?</p>
    </div>
  `;
  document.body.appendChild(g);
  enableFloatingBehavior(g);
}

// Start menu shown at game start (cooldown 1h)
function showStartMenu(force) {
  try {
    // Always show a single, clean main menu. 'force' can bypass the hourly cooldown.
    const last = parseInt(localStorage.getItem('meso.lastStartMenu') || '0', 10);
    const now = Date.now();
    const HOUR = 1000 * 60 * 60;
    if (!force && now - last < HOUR) return false;

    // remove any existing overlay
    try { const ex = document.getElementById('main-menu-overlay'); if (ex) ex.remove(); } catch (e) {}

    const overlay = document.createElement('div'); overlay.id = 'main-menu-overlay';
    overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.right = 0; overlay.style.bottom = 0;
    overlay.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0.85))'; overlay.style.zIndex = 99999; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

    const box = document.createElement('div');
    box.style.padding = '22px'; box.style.width = '640px'; box.style.color = '#fff'; box.style.display = 'flex'; box.style.flexDirection = 'row'; box.style.gap = '18px';
    // Use consistent panel styling
    try { stylePanel(box); } catch (e) { box.style.background = 'rgba(14,14,14,0.98)'; box.style.border = '1px solid #333'; box.style.borderRadius = '10px'; }

    const left = document.createElement('div'); left.style.flex = '1';
    const title = document.createElement('div'); title.innerHTML = '<h2 style="margin:0 0 8px 0">Mesopotamia</h2><div style="color:#ccc;font-size:13px">Construye, sobrevive y proclama tu reino</div>';
    left.appendChild(title);

    const actions = document.createElement('div'); actions.style.marginTop = '12px';
    const btnLoad = document.createElement('button'); btnLoad.textContent = 'Cargar partida'; btnLoad.style.display='block'; btnLoad.style.width='100%'; btnLoad.style.margin='8px 0';
    const btnNew = document.createElement('button'); btnNew.textContent = 'Nueva partida'; btnNew.style.display='block'; btnNew.style.width='100%'; btnNew.style.margin='8px 0';
    const btnImport = document.createElement('button'); btnImport.textContent = 'Importar partida'; btnImport.style.display='block'; btnImport.style.width='100%'; btnImport.style.margin='8px 0';
    const btnSettings = document.createElement('button'); btnSettings.textContent = 'Opciones'; btnSettings.style.display='block'; btnSettings.style.width='100%'; btnSettings.style.margin='8px 0';
    const btnCredits = document.createElement('button'); btnCredits.textContent = 'Créditos'; btnCredits.style.display='block'; btnCredits.style.width='100%'; btnCredits.style.margin='8px 0';
    actions.appendChild(btnLoad); actions.appendChild(btnNew); actions.appendChild(btnImport); actions.appendChild(btnSettings); actions.appendChild(btnCredits);
    left.appendChild(actions);

    const right = document.createElement('div'); right.style.width = '260px'; right.style.display = 'flex'; right.style.flexDirection = 'column'; right.style.gap = '10px';
    // portrait canvas (large preview)
    const portraitWrap = document.createElement('div'); portraitWrap.style.width = '100%'; portraitWrap.style.display = 'flex'; portraitWrap.style.justifyContent = 'center';
    const portraitCanvas = document.createElement('canvas'); portraitCanvas.id = 'main-menu-portrait'; portraitCanvas.width = 96; portraitCanvas.height = 96; portraitCanvas.style.width = '96px'; portraitCanvas.style.height = '96px'; portraitCanvas.style.imageRendering = 'pixelated'; portraitCanvas.style.borderRadius = '6px'; portraitCanvas.style.background = '#111'; portraitWrap.appendChild(portraitCanvas);
    right.appendChild(portraitWrap);
    const info = document.createElement('div'); info.style.fontSize = '12px'; info.style.color = '#ddd'; info.innerHTML = '<b>Última partida:</b><br/>' + (localStorage.getItem(APP_STATE_KEY) ? 'Guardada en local' : 'No hay partida guardada');
    right.appendChild(info);
    const quickTips = document.createElement('div'); quickTips.style.fontSize='12px'; quickTips.style.color='#bbb'; quickTips.innerHTML = '<b>Consejos</b><ul style="margin:6px 0 0 14px;padding:0;color:#bbb"><li>Construye cerca del río.</li><li>Crea graneros para almacenar trigo.</li></ul>';
    right.appendChild(quickTips);
    // cache preview list and precache button (ensure variables exist)
    const cacheList = document.createElement('div'); cacheList.id = 'main-menu-cachelist'; cacheList.style.display = 'flex'; cacheList.style.flexWrap = 'wrap'; cacheList.style.gap = '6px'; cacheList.style.marginTop = '8px'; cacheList.style.maxHeight = '160px'; cacheList.style.overflow = 'auto'; cacheList.style.padding = '6px'; cacheList.style.background = 'rgba(0,0,0,0.04)'; cacheList.style.borderRadius = '6px'; right.appendChild(cacheList);
    const precacheBtn = document.createElement('button'); precacheBtn.textContent = 'Precachear sprites'; precacheBtn.style.marginTop = '8px'; precacheBtn.style.fontSize = '12px'; right.appendChild(precacheBtn);

    box.appendChild(left); box.appendChild(right);
    overlay.appendChild(box); document.body.appendChild(overlay);
    // Hide the main game UI so the menu is a separate screen
    try { const top = document.getElementById('topbar'); if (top) top.style.display = 'none'; const toolbar = document.getElementById('toolbar'); if (toolbar) toolbar.style.display = 'none'; const mainEl = document.getElementById('main'); if (mainEl) mainEl.style.display = 'none'; } catch (e) {}
    // mark game as not started while menu is active to pause the render/logic loop
    try { window._gameStarted = false; window._showPanels = false; } catch (e) {}

    localStorage.setItem('meso.lastStartMenu', String(now));

    btnLoad.addEventListener('click', async () => {
      let prog = null;
      try {
        const raw = localStorage.getItem(APP_STATE_KEY);
        if (!raw) { notify('No hay partida guardada.'); return; }
        prog = showProgressOverlay('Preparando partida...');
        // small delay to ensure overlay renders
        await new Promise(res => setTimeout(res, 40));
        // restore saved state (grid, entities, player, etc.)
        loadAppState();
        // ensure sprite images are ready and show per-sprite progress
        try { await ensureEntityPixelsReady(1200); await generateSpriteImages(prog); } catch (e) { /* continue */ }
        prog.hide(); overlay.remove();
        // when loading a saved game, we want the full UI panels visible
        try { window._showPanels = true; } catch (e) {}
        try { if (window._showPanels) { const top = document.getElementById('topbar'); if (top) top.style.display = ''; const toolbar = document.getElementById('toolbar'); if (toolbar) toolbar.style.display = ''; const mainEl = document.getElementById('main'); if (mainEl) mainEl.style.display = ''; } } catch (e) {}
        mapCacheDirty = true; rebuildMapCacheDebounced(10);
        updateUI();
        try { window._gameStarted = true; requestAnimationFrame(render); } catch (e) {}
      } catch (e) { console.error(e); try { prog && prog.hide(); } catch (er) {} notify('Error cargando partida'); }
    });

    btnNew.addEventListener('click', () => {
      try {
        localStorage.removeItem(APP_STATE_KEY); localStorage.removeItem('meso.playerPos'); localStorage.removeItem('meso.spawned_npcs');
        localStorage.setItem('meso.forceNew','1');
        overlay.remove();
        showStartupParams();
        // Leave _gameStarted false; startup params flow will set it when generation completes
      } catch (e) { console.error(e); }
    });

    btnImport.addEventListener('click', () => {
      try { const f = document.querySelector('input[type="file"][accept="application/json"]'); if (f) f.click(); else notify('Import input no disponible'); overlay.remove(); } catch (e) { console.error(e); }
    });

    btnSettings.addEventListener('click', () => { try { overlay.remove(); createOptionsPanel && createOptionsPanel(); } catch (e) {} });
    btnCredits.addEventListener('click', () => { try { overlay.remove(); showCreditsSplash(1200); } catch (e) {} });

    // populate cache list preview (safe)
    try {
      const cacheKeys = Object.keys(window._ENTITY_BITMAPS || {});
      if (cacheKeys.length === 0) {
        const n = document.createElement('div'); n.style.fontSize='12px'; n.style.color='#bbb'; n.textContent = 'Sin sprites cacheados.'; cacheList.appendChild(n);
      } else {
        cacheKeys.slice(0,64).forEach(k => {
          try {
            const v = window._ENTITY_BITMAPS[k];
            const el = document.createElement('div'); el.title = k; el.style.width = '36px'; el.style.height = '36px'; el.style.background = '#121212'; el.style.border = '1px solid rgba(255,255,255,0.02)'; el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center'; el.style.borderRadius='4px';
            if (v) {
              try {
                const c = document.createElement('canvas'); c.width = v.width || 32; c.height = v.height || 32; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false; cc.clearRect(0,0,c.width,c.height); cc.drawImage(v,0,0,c.width,c.height);
                c.style.width = '32px'; c.style.height = '32px'; c.style.imageRendering = 'pixelated'; el.appendChild(c);
              } catch (e) { const t = document.createElement('div'); t.textContent = 'img'; t.style.fontSize='10px'; t.style.color='#ccc'; el.appendChild(t); }
            }
            cacheList.appendChild(el);
          } catch (e) {}
        });
      }
    } catch (e) {}

    precacheBtn.addEventListener('click', async () => {
      try {
        const prog = showProgressOverlay('Precacheando sprites...');
        await generateSpriteImages(prog);
        prog.hide();
        notify('Sprites precacheados. Inicio más rápido.');
        // refresh preview
        cacheList.innerHTML = '';
        const keys = Object.keys(window._ENTITY_BITMAPS || {}).slice(0,64);
        keys.forEach(k => { try { const v = window._ENTITY_BITMAPS[k]; const c = document.createElement('canvas'); c.width = v.width || 32; c.height = v.height || 32; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false; cc.clearRect(0,0,c.width,c.height); cc.drawImage(v,0,0,c.width,c.height); c.style.width='32px'; c.style.height='32px'; c.style.imageRendering='pixelated'; const el = document.createElement('div'); el.style.width='36px'; el.style.height='36px'; el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center'; el.style.borderRadius='4px'; el.appendChild(c); cacheList.appendChild(el); } catch (e) {} });
      } catch (e) { console.error(e); notify('Error precacheando sprites'); }
    });

    // draw portrait preview if drawing helper available
    try {
      const pc = document.getElementById('main-menu-portrait');
      if (pc && typeof drawPortrait === 'function') {
        const cc = pc.getContext('2d'); cc.imageSmoothingEnabled = false; drawPortrait(cc, pc.width, pc.height);
      } else if (pc && typeof drawCharacterPixels === 'function') {
        const cc = pc.getContext('2d'); cc.imageSmoothingEnabled = false; try { drawCharacterPixels(cc, pc.width, pc.height); } catch (e) {}
      }
    } catch (e) {}

    return true;
  } catch (err) { console.error('showStartMenu err', err); return false; }
}

// Startup params modal: choose densities and start a new game
function showStartupParams() {
  try {
    const modal = document.createElement('div'); modal.id = 'startup-params';
    modal.style.position = 'fixed'; modal.style.left = '0'; modal.style.top = '0'; modal.style.right = '0'; modal.style.bottom = '0'; modal.style.zIndex = 120000; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
    const box = document.createElement('div'); box.style.background = 'rgba(18,18,18,0.98)'; box.style.padding = '16px'; box.style.border = '1px solid #333'; box.style.borderRadius = '8px'; box.style.width = '520px'; box.style.color = '#fff';
    box.innerHTML = `<div style="font-weight:700;margin-bottom:8px">Parámetros de nueva partida</div>`;
    const form = document.createElement('div'); form.style.display='grid'; form.style.gridTemplateColumns='1fr 1fr'; form.style.gap='10px';
    const createRange = (id,label,def,min,max,step) => {
      const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column';
      const lab = document.createElement('div'); lab.style.fontSize='13px'; lab.style.marginBottom='4px'; lab.textContent = label;
      const inp = document.createElement('input'); inp.type='range'; inp.id = id; inp.min = String(min); inp.max = String(max); inp.step = String(step); inp.value = String(def); inp.style.width='100%';
      const val = document.createElement('div'); val.style.fontSize='12px'; val.style.color='#ccc'; val.textContent = inp.value;
      inp.addEventListener('input', () => { val.textContent = inp.value; });
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(val);
      return wrap;
    };
    const r1 = createRange('density-npcs','Densidad NPCs', window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.npc || 1.0, 0.2, 3.0, 0.1);
    const r2 = createRange('density-animals','Densidad animales', window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.animals || 1.0, 0.2, 3.0, 0.1);
    const r3 = createRange('density-vegetation','Densidad vegetación', window._DEFAULT_DENSITIES && window._DEFAULT_DENSITIES.vegetation || 1.0, 0.2, 3.0, 0.1);
    form.appendChild(r1); form.appendChild(r2); form.appendChild(r3);
    box.appendChild(form);
    const footer = document.createElement('div'); footer.style.display='flex'; footer.style.justifyContent='flex-end'; footer.style.gap='10px'; footer.style.marginTop='12px';
    const btnCancel = document.createElement('button'); btnCancel.textContent = 'Cancelar';
    const btnStart = document.createElement('button'); btnStart.textContent = 'Generar partida'; btnStart.style.background = '#2E6FA3'; btnStart.style.color='#fff';
    footer.appendChild(btnCancel); footer.appendChild(btnStart); box.appendChild(footer);
    modal.appendChild(box); document.body.appendChild(modal);

    btnCancel.addEventListener('click', () => { try { modal.remove(); } catch (e) {} });
    btnStart.addEventListener('click', async () => {
      let prog = null;
      try {
        const dn = parseFloat(document.getElementById('density-npcs').value || '1.0');
        const da = parseFloat(document.getElementById('density-animals').value || '1.0');
        const dv = parseFloat(document.getElementById('density-vegetation').value || '1.0');
        window._DEFAULT_DENSITIES = { npc: dn, animals: da, vegetation: dv };
        modal.remove();
        // first, convert/prepare sprites with visible progress so user sees them converted one-by-one
        try { prog = showProgressOverlay('Convirtiendo sprites...'); await new Promise(res => setTimeout(res, 40)); } catch (e) {}
        try { await ensureEntityPixelsReady(1200); await generateSpriteImages(prog); } catch (e) { console.warn('sprite gen err', e); }
        try { prog && prog.hide(); } catch (e) {}

        showLoadingOverlay('Generando mapa...');
        // reset state then generate map
        try { if (typeof grid !== 'undefined' && grid && grid.length) { for (let x = 0; x < grid.length; x++) for (let y = 0; y < (grid[x] || []).length; y++) grid[x][y] = null; } } catch (e) {}
        try { if (typeof entities !== 'undefined' && entities && entities.length) entities.length = 0; } catch (e) {}
        try { rabbits.length = 0; foxes.length = 0; } catch (e) {}
        try { mapCache = {}; window.MAP_CHUNKS = {}; mapCacheDirty = true; } catch (e) {}
        generateMap('random');
        saveAppStateDebounced();
        try { rebuildMapCache(); mapCacheDirty = false; } catch (e) {}
        hideLoadingOverlay();
        await preloadAllBeforeStart();
        postMapInit();
        // after map is ready, open character selection so player can choose design and name
        try { setupCharacterSelection(); openCharacterSelect(); } catch (e) { console.warn('character select open failed', e); }
        // when creating a new game, show full UI panels
        try { window._showPanels = true; } catch (e) {}
        try { if (window._showPanels) { const top = document.getElementById('topbar'); if (top) top.style.display = ''; const toolbar = document.getElementById('toolbar'); if (toolbar) toolbar.style.display = ''; const mainEl = document.getElementById('main'); if (mainEl) mainEl.style.display = ''; } } catch (e) {}
        // start the main game loop now that generation and UI restore are complete
        try { window._gameStarted = true; requestAnimationFrame(render); } catch (e) {}
      } catch (err) { try { prog && prog.hide(); } catch (e) {} hideLoadingOverlay(); console.error('start new err', err); }
    });
  } catch (e) { console.error('showStartupParams err', e); }
}

// Small credits splash shown at startup
function showCreditsSplash(ms, cb) {
  try {
    const overlay = document.createElement('div'); overlay.id = 'credits-splash';
    overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.right = 0; overlay.style.bottom = 0;
    overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.7)'; overlay.style.zIndex = 200000; overlay.style.color = '#FFD27A';
    const box = document.createElement('div'); box.style.padding = '18px'; box.style.borderRadius = '8px'; box.style.fontFamily = 'sans-serif'; box.style.fontWeight = '700'; box.style.fontSize = '18px';
    box.textContent = 'MesoBuilder by VSoftware';
    overlay.appendChild(box); document.body.appendChild(overlay);
    setTimeout(() => { try { overlay.remove(); } catch (e) {} if (typeof cb === 'function') cb(); }, ms || 900);
  } catch (e) { if (typeof cb === 'function') cb(); }
}

// -------------------- Enemy waves system --------------------
window._enemyWaves = window._enemyWaves || { running: false, timer: null, wave: 0 };
window.enemies = window.enemies || [];

function spawnEnemyAt(col, row) {
  try {
    const id = 'enemy-' + Date.now() + '-' + Math.random().toString(36).slice(2,4);
    const now = Date.now();
    const en = { id, kind: 'enemy', col, row, x: col, y: row, hp: 20, maxHp: 20, speed: 1.2 };
    window.enemies.push(en);
    return en;
  } catch (e) { return null; }
}

function _waveTick() {
  try {
    if (!window._enemyWaves.running) return;
    const w = ++window._enemyWaves.wave;
    const count = Math.min(20, Math.floor(2 + w * 1.2));
    // spawn near map edges randomly
    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random()*4);
      let col=0,row=0;
      if (edge===0) { col = 0; row = Math.floor(Math.random()*ROWS); }
      else if (edge===1) { col = COLS-1; row = Math.floor(Math.random()*ROWS); }
      else if (edge===2) { col = Math.floor(Math.random()*COLS); row = 0; }
      else { col = Math.floor(Math.random()*COLS); row = ROWS-1; }
      spawnEnemyAt(col, row);
    }
    // schedule next wave
    const next = Math.max(8000, 20000 - (w*800));
    window._enemyWaves.timer = setTimeout(_waveTick, next);
  } catch (e) {}
}

window.startEnemyWaves = function() {
  try {
    if (window._enemyWaves.running) return;
    window._enemyWaves.running = true; window._enemyWaves.wave = 0;
    window._enemyWaves.timer = setTimeout(_waveTick, 3000);
    notify && notify('Oleadas de enemigos activadas');
  } catch (e) {}
};

window.stopEnemyWaves = function() {
  try { window._enemyWaves.running = false; if (window._enemyWaves.timer) clearTimeout(window._enemyWaves.timer); window._enemyWaves.timer = null; notify && notify('Oleadas detenidas'); } catch (e) {}
};


// Simple building tutorial overlay
function showBuildTutorial() {
  try {
    if (document.getElementById('build-tutorial')) return;
    const t = document.createElement('div'); t.id = 'build-tutorial';
    t.style.position = 'fixed'; t.style.right = '12px'; t.style.bottom = '12px'; t.style.zIndex = 19000; t.style.width = '320px';
    t.style.background = 'rgba(24,24,24,0.98)'; t.style.border = '1px solid #333'; t.style.padding = '12px'; t.style.borderRadius = '6px'; t.style.color = '#fff';
    t.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">Tutorial: Construir</div>
      <ol style="padding-left:18px;margin:0 0 8px 0">
        <li>Selecciona una construcción desde el panel derecho.</li>
        <li>Haz clic en el mapa para colocarla (resaltado en verde si es válido).</li>
        <li>Usa el botón demolición para quitar edificios.</li>
      </ol>
      <button id="btn-tut-next" style="margin-right:8px">Entendido</button>
      <button id="btn-tut-dont" style="background:#333;color:#ccc">No mostrar</button>
    `;
    document.body.appendChild(t);
    document.getElementById('btn-tut-next').addEventListener('click', () => { try { t.remove(); } catch (e) {} });
    document.getElementById('btn-tut-dont').addEventListener('click', () => { try { localStorage.setItem('meso.noBuildTut','1'); t.remove(); } catch (e) {} });
    // visually highlight build panel briefly
    const panel = document.getElementById('panel'); if (panel) {
      const old = panel.style.boxShadow; panel.style.boxShadow = '0 0 0 3px rgba(200,168,75,0.18)'; setTimeout(() => { panel.style.boxShadow = old; }, 3000);
    }
  } catch (e) { console.error('showBuildTutorial err', e); }
}

// Make top bar icons visually distinct (badge + border)
function enhanceTopBarIcons() {
  const ids = ['icon-wheat','icon-brick','icon-pop','icon-house','icon-farm','icon-temple','icon-market','icon-granary','icon-ziggurat'];
  ids.forEach(id => {
    try {
      const c = document.getElementById(id);
      if (!c || !c.getContext) return;
      const cx = c.getContext('2d');
      // draw an outline frame
      cx.strokeStyle = 'rgba(0,0,0,0.6)'; cx.lineWidth = 2;
      cx.strokeRect(0.5,0.5,c.width-1,c.height-1);
      // small colored badge top-right
      cx.beginPath(); cx.fillStyle = '#DAA520'; cx.arc(c.width-6,6,4,0,Math.PI*2); cx.fill(); cx.strokeStyle='rgba(0,0,0,0.4)'; cx.stroke();
    } catch (err) { /* ignore */ }
  });
}

// Add a camera button to the topbar that hides UI and captures a screenshot
function createCameraButton() {
  try {
    if (document.getElementById('btn-camera')) return;
    const btn = document.createElement('button'); btn.id = 'btn-camera'; btn.title = 'Captura pantalla';
    btn.className = 'tool-btn'; btn.style.marginLeft = '8px'; btn.textContent = '📷';

    btn.addEventListener('click', async () => {
      try {
        // hide UI chrome for a clean screenshot
        try { document.getElementById('topbar') && (document.getElementById('topbar').style.visibility = 'hidden'); } catch (e) {}
        try { document.getElementById('toolbar') && (document.getElementById('toolbar').style.visibility = 'hidden'); } catch (e) {}
        await new Promise(res => setTimeout(res, 80));
        // capture canvas image
        try {
          const data = canvas.toDataURL('image/png');
          const a = document.createElement('a'); a.href = data; a.download = 'meso-screenshot-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove();
        } catch (errImg) {
          console.error('capture err', errImg);
          notify('Error generando imagen');
        }
      } catch (err) {
        console.error('camera click err', err);
        notify('No se pudo tomar captura');
      } finally {
        // restore UI visibility
        try { document.getElementById('topbar') && (document.getElementById('topbar').style.visibility = ''); } catch (e) {}
        try { document.getElementById('toolbar') && (document.getElementById('toolbar').style.visibility = ''); } catch (e) {}
      }
    });

    // Prefer inserting next to the top menubar left controls (near 'Ver' / 'Paneles flotantes')
    const menubar = document.getElementById('top-menubar');
    if (menubar) {
      const left = menubar.querySelector('div');
      if (left) { left.insertBefore(btn, left.children[1] || null); return; }
    }
    // fallback: append to topbar or body
    const top = document.getElementById('topbar');
    if (top) { top.appendChild(btn); return; }
    document.body.appendChild(btn);
  } catch (e) { /* ignore */ }
}

// Create small collapse/minimize controls for the build panel
function createBuildPanelControls() {
  try {
    const panel = document.getElementById('panel'); if (!panel) return;
    // find the first panel-section that has title text 'Construir'
    const sections = panel.querySelectorAll('.panel-section');
    let target = null;
    sections.forEach(s => {
      const t = s.querySelector('.panel-title'); if (t && t.textContent && t.textContent.trim().toLowerCase().startsWith('constru')) target = s;
    });
    if (!target) target = sections[0];
    if (!target) return;
    // avoid double-insert
    if (target.querySelector('.panel-controls')) return;
    const ctrl = document.createElement('div'); ctrl.className = 'panel-controls'; ctrl.style.float = 'right'; ctrl.style.display = 'inline-block'; ctrl.style.marginLeft = '8px';
    const collapse = document.createElement('button'); collapse.textContent = '—'; collapse.title = 'Contraer'; collapse.className = 'tool-btn'; collapse.style.padding='2px 6px'; collapse.style.fontSize='0.8rem';
    const minimize = document.createElement('button'); minimize.textContent = '▢'; minimize.title = 'Minimizar panel'; minimize.className = 'tool-btn'; minimize.style.padding='2px 6px'; minimize.style.fontSize='0.8rem'; minimize.style.marginLeft='6px';
    ctrl.appendChild(collapse); ctrl.appendChild(minimize);
    const title = target.querySelector('.panel-title'); if (title) title.appendChild(ctrl);

    collapse.addEventListener('click', () => {
      target.classList.toggle('collapsed');
    });
    minimize.addEventListener('click', () => {
      // hide the whole right panel and show restore button
      const p = document.getElementById('panel'); if (!p) return;
      p.style.display = 'none';
      const rb = document.getElementById('panel-restore-btn'); if (rb) rb.style.display = 'block';
    });
  } catch (e) { /* ignore */ }
}

// Draw a soft difuminado overlay when zoomed out (over the board, not the UI)
function drawCloudOverlay() {
  try {
    const W = canvas.width, H = canvas.height;
    // show overlay only when considerably zoomed out
    const threshold = 0.6;
    if (zoom >= threshold) return;
    // Use a cached cloud canvas to avoid generating gradients+blur each frame
    try {
      const alpha = Math.min(0.35, (threshold - zoom) * 0.45);
      // use a lower-resolution cached canvas for performance. Rebuild only on size change or periodically.
      const lowW = Math.max(64, Math.ceil(W / 2));
      const lowH = Math.max(64, Math.ceil(H / 2));
      const now = Date.now();
      const needRebuild = (!window._CLOUD_CANVAS) || window._CLOUD_CANVAS._w !== lowW || window._CLOUD_CANVAS._h !== lowH || (now - (window._CLOUD_CANVAS._lastBuild || 0) > 900);
      if (needRebuild) {
        const off = document.createElement('canvas'); off.width = lowW; off.height = lowH; const oc = off.getContext('2d');
        oc.clearRect(0,0,lowW,lowH);
        const t = Date.now() * 0.00012; // slower animation
        for (let i = 0; i < 3; i++) {
          const gx = (Math.sin(t + i * 0.7) * 0.25 + 0.5) * lowW;
          const gy = (Math.cos(t * 0.85 + i * 0.9) * 0.22 + 0.45) * lowH;
          const rg = oc.createRadialGradient(gx, gy, 8, gx, gy, Math.max(lowW, lowH) * 0.8);
          rg.addColorStop(0, 'rgba(255,255,255,0.65)');
          rg.addColorStop(0.6, 'rgba(250,250,250,0.18)');
          rg.addColorStop(1, 'rgba(250,250,250,0)');
          oc.fillStyle = rg; oc.fillRect(0,0,lowW,lowH);
        }
        off._w = lowW; off._h = lowH; off._lastBuild = now;
        window._CLOUD_CANVAS = off;
      }
      if (window._CLOUD_CANVAS) {
        ctx.save(); ctx.globalAlpha = alpha; // use computed alpha
        // draw low-res canvas stretched to screen for soft overlay (cheap)
        try { ctx.imageSmoothingEnabled = true; } catch (e) {}
        ctx.drawImage(window._CLOUD_CANVAS, 0, 0, window._CLOUD_CANVAS.width, window._CLOUD_CANVAS.height, 0, 0, W, H);
        ctx.restore();
      }
    } catch (errCloud) { /* ignore cloud build errors */ }
  } catch (err) { /* non-fatal */ }
}

canvas.addEventListener('mousemove', e => {
  if (startLocked) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (isZooming) {
    const delta = zoomStartY - e.clientY;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomStart * (1 + delta * 0.005)));
    clampCamera();
    return;
  }

  // update selection rectangle when ctrl-dragging
  if (_isSelecting && _selectStart) {
    try {
      const rectEl = canvas.getBoundingClientRect();
      const sx = Math.max(0, Math.min(canvas.width, e.clientX - rectEl.left));
      const sy = Math.max(0, Math.min(canvas.height, e.clientY - rectEl.top));
      const x = Math.min(_selectStart.sx, sx);
      const y = Math.min(_selectStart.sy, sy);
      const w = Math.abs(sx - _selectStart.sx);
      const h = Math.abs(sy - _selectStart.sy);
      _selectRect = { x, y, w, h };
      // live preview: count selectable entities inside current rect
      try {
        const tl = screenToWorldFloat(x, y);
        const br = screenToWorldFloat(x + w, y + h);
        const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x);
        const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y);
        let cnt = 0;
        for (const en of (entities || [])) { try { if (en && en.x !== undefined && en.id && en.id.indexOf('npc-') === 0) { if (en.x >= minX && en.x <= maxX && en.y >= minY && en.y <= maxY) cnt++; } } catch (e) {} }
        for (const rbt of (rabbits || [])) { try { if (rbt && rbt.x !== undefined) { if (rbt.x >= minX && rbt.x <= maxX && rbt.y >= minY && rbt.y <= maxY) cnt++; } } catch (e) {} }
        for (const fx of (foxes || [])) { try { if (fx && fx.x !== undefined) { if (fx.x >= minX && fx.x <= maxX && fx.y >= minY && fx.y <= maxY) cnt++; } } catch (e) {} }
        window._selectPreviewCount = cnt;
        try { _updateSelectionOverlay(_selectRect); } catch (e) {}
      } catch (ee) { window._selectPreviewCount = 0; }
    } catch (ex) {}
  }

  if (isPanning) {
    const now = Date.now();
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dt = Math.max(16, now - lastMouseTime);
    // apply per-axis sensitivity to correct perceived horizontal movement
    const deltaX = (e.clientX - panStartX) * PAN_SENSITIVITY_X;
    const deltaY = (e.clientY - panStartY) * PAN_SENSITIVITY_Y;
    camX = camStartX + deltaX;
    camY = camStartY + deltaY;
    // record last mouse movement for inertia
    camVX = dx / dt * 16;
    camVY = dy / dt * 16;
    lastMouseX = e.clientX; lastMouseY = e.clientY; lastMouseTime = now;
    clampCamera();
    return;
  }

  // detect right-button drag (for zoom) vs click
  if (rightDown) {
    const dx = e.clientX - rightDownX;
    const dy = e.clientY - rightDownY;
    if (Math.hypot(dx, dy) > 6) rightMoved = true;
  }

  hoverCell = screenToWorld(mx, my);
  showTooltip(hoverCell.col, hoverCell.row, mx, my);

  // update build drag selection when in edit mode
  if (isBuildDragging && buildDragStart) {
    const cur = screenToWorld(mx, my);
    const c = Math.floor(cur.col), r = Math.floor(cur.row);
    buildDragRect = {
      minC: Math.max(0, Math.min(buildDragStart.col, c)),
      maxC: Math.min(COLS-1, Math.max(buildDragStart.col, c)),
      minR: Math.max(0, Math.min(buildDragStart.row, r)),
      maxR: Math.min(ROWS-1, Math.max(buildDragStart.row, r))
    };
  }
});

canvas.addEventListener('mousedown', e => {
  if (startLocked) return;
  if (e.button === 1 || (e.button === 0 && panMode)) {
    isPanning = true;
    panStartX = e.clientX; panStartY = e.clientY;
    camStartX = camX; camStartY = camY;
    canvas.style.cursor = 'grabbing';
    lastMouseX = e.clientX; lastMouseY = e.clientY; lastMouseTime = Date.now();
    e.preventDefault();
  } else if (e.button === 2) {
    isZooming = true;
    rightDown = true; rightDownX = e.clientX; rightDownY = e.clientY; rightMoved = false;
    zoomStartY = e.clientY;
    zoomStart = zoom;
    canvas.style.cursor = 'ns-resize';
    e.preventDefault();
  } else if (e.button === 0) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { col, row } = screenToWorld(mx, my);
    // RTS-style selection: start a selection rectangle when Ctrl (or Meta) is held
    if ((e.ctrlKey || e.metaKey) && !isPanning && !isZooming) {
      try {
        _isSelecting = true;
        _selectStart = { sx: mx, sy: my };
        _selectRect = { x: mx, y: my, w: 0, h: 0 };
        try { _updateSelectionOverlay(_selectRect); } catch (e) {}
        // prevent browser text selection while dragging
        try { document.body.style.userSelect = 'none'; } catch (u) {}
        e.preventDefault();
        // clear previous selection unless Shift is held
        if (!e.shiftKey) try { window._selectedEntities = []; } catch (ee) {}
        canvas.style.cursor = 'crosshair';
      } catch (ex) {}
      return;
    }

    if (!editMode) {
      // If there is an active selection, interpret this left-click as a command target
      if (Array.isArray(window._selectedEntities) && window._selectedEntities.length > 0) {
        try {
          const pos = screenToWorldFloat(mx, my);
          // distribute targets to avoid stack overlap
          const n = window._selectedEntities.length;
          for (let i = 0; i < n; i++) {
            const ent = window._selectedEntities[i];
            if (!ent) continue;
            try {
              // small spread circle
              const angle = (i / Math.max(1, n)) * Math.PI * 2;
              const radius = 0.4; // tiles
              const tx = pos.x + Math.cos(angle) * radius;
              const ty = pos.y + Math.sin(angle) * radius;
              ent.moveTarget = { x: tx, y: ty };
            } catch (e) {}
          }
          // clear selection after issuing command
          try { window._selectedEntities = []; } catch (e) {}
        } catch (err) {}
        return;
      }
      // In free mode, left-click opens context info (auto-move removed)
      try {
        const pos = screenToWorldFloat(mx, my);
        const clicked = findEntityAtWorld(pos.x, pos.y);
        if (clicked) { showEntityInfo(clicked); } else { notify('No hay entidad en el punto'); }
      } catch (err) { /* ignore */ }
      return;
    }
    // In edit mode allow drag-to-place for repeated building
    if (selectedTool === 'demolish') {
      demolishCell(col, row);
    } else if (selectedTool) {
      // start potential drag selection; actual placement happens on mouseup
      isBuildDragging = true;
      buildDragStart = { col: Math.floor(col), row: Math.floor(row) };
      buildDragRect = { minC: buildDragStart.col, maxC: buildDragStart.col, minR: buildDragStart.row, maxR: buildDragStart.row };
    }
  }
});

// ensure mouseup clears panning/zooming even if released outside canvas
document.addEventListener('mouseup', (e) => {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = panMode ? 'grab' : 'crosshair';
    try { saveAppStateDebounced(); } catch (e) {}
  }
  if (isZooming) {
    isZooming = false;
    rightDown = false; rightMoved = false;
    canvas.style.cursor = panMode ? 'grab' : 'crosshair';
    try { saveAppStateDebounced(); } catch (e) {}
  }
  // finalize selection rectangle
  if (_isSelecting) {
    try {
      _isSelecting = false;
      canvas.style.cursor = panMode ? 'grab' : 'crosshair';
      if (_selectRect && (_selectRect.w > 4 || _selectRect.h > 4)) {
        // convert screen rect to world float bounds
        const r = _selectRect;
        const tl = screenToWorldFloat(r.x, r.y);
        const br = screenToWorldFloat(r.x + r.w, r.y + r.h);
        const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x);
        const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y);
        const sel = [];
        try {
          // collect NPCs (entities kind player), rabbits and foxes inside rect
          for (const en of (entities || [])) {
            try { if (en && en.kind === 'player' && en.x !== undefined) { if (en.x >= minX && en.x <= maxX && en.y >= minY && en.y <= maxY) sel.push(en); } } catch (e) {}
          }
          for (const rbt of (rabbits || [])) { try { if (rbt && rbt.x !== undefined) { if (rbt.x >= minX && rbt.x <= maxX && rbt.y >= minY && rbt.y <= maxY) sel.push(rbt); } } catch (e) {} }
          for (const fx of (foxes || [])) { try { if (fx && fx.x !== undefined) { if (fx.x >= minX && fx.x <= maxX && fx.y >= minY && fx.y <= maxY) sel.push(fx); } } catch (e) {} }
        } catch (e) {}
        try { window._selectedEntities = sel; } catch (e) {}
      }
      _selectStart = null; _selectRect = null;
      try { document.body.style.userSelect = ''; } catch (u) {}
      try { window._selectPreviewCount = 0; } catch (u) {}
      try { _updateSelectionOverlay(null); } catch (e) {}
    } catch (ee) {}
  }
});

// wheel zoom on canvas: zoom towards cursor
// smooth wheel zoom: set a target and animate in render loop
let targetZoom = zoom;
let zoomLerpSpeed = 0.18; // higher = faster
let zoomAnimating = false;

canvas.addEventListener('wheel', (ev) => {
  if (startLocked) return;
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  // capture world point under cursor before zoom
  const world = screenToWorldFloat(mx, my);
  // adjust target zoom factor (do not apply instantly)
  const delta = ev.deltaY;
  const factor = delta > 0 ? 0.92 : 1.08;
  const newTarget = Math.max(0.4, Math.min(2.5, targetZoom * factor));
  if (Math.abs(newTarget - targetZoom) < 0.0001) return;
  // compute an approximate camera adjustment so the cursor remains over the same world point
  // we estimate using ratio between target and current zoom to avoid calling worldToScreen with a custom zoom
  const ratio = newTarget / zoom;
  camX = mx - ((mx - camX) * ratio);
  camY = my - ((my - camY) * ratio);
  targetZoom = newTarget;
  clampCamera();
  // mark cache dirty and debounce heavy rebuild until animation settles
  mapCacheDirty = true; rebuildMapCacheDebounced(220);
  try { const s = document.getElementById('zoom-slider'); if (s) s.value = String(targetZoom); } catch (e) {}
}, { passive: false });

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (startLocked) return;
  // if user is zooming or panning, don't set move target
  if (isZooming || isPanning) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const pos = screenToWorldFloat(mx, my);
  // right-click entity info if clicking on an entity/animal
  try {
    const clicked = findEntityAtWorld(pos.x, pos.y);
    if (clicked && !rightMoved) { showEntityInfo(clicked); return; }
  } catch (errInfo) { /* ignore */ }
  // right-click movement target disabled (auto-move removed)
  if (!editMode && !rightMoved) {
    notify('Movimiento automático deshabilitado; usa WASD o Flechas.');
    return;
  }
});
canvas.addEventListener('mouseleave', () => {
  hoverCell = null;
  document.getElementById('tooltip').style.display = 'none';
  if (isPanning) { isPanning = false; canvas.style.cursor = panMode ? 'grab' : 'crosshair'; }
  if (isZooming) { isZooming = false; canvas.style.cursor = panMode ? 'grab' : 'crosshair'; }
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (startLocked) return;
  // if user is zooming or panning, don't set move target
  if (isZooming || isPanning) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const pos = screenToWorldFloat(mx, my);
  // right-click entity info if clicking on an entity/animal
  try {
    const clicked = findEntityAtWorld(pos.x, pos.y);
    if (clicked && !rightMoved) { showEntityInfo(clicked); return; }
  } catch (errInfo) { /* ignore */ }
  // right-click movement target disabled (auto-move removed)
  if (!editMode && !rightMoved) {
    notify('Movimiento automático deshabilitado; usa WASD o Flechas.');
    return;
  }
});

document.getElementById('btn-demolish').addEventListener('click', () => {
  if (!editMode) return;
  if (selectedTool === 'demolish') {
    selectedTool = null;
    document.getElementById('btn-demolish').classList.remove('selected');
  } else {
    selectedTool = 'demolish';
    document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-demolish').classList.add('selected');
    }
});

document.getElementById('btn-endturn').addEventListener('click', endTurn);

function setViewMode(mode) {
  viewMode = mode;
  const orthoBtn = document.getElementById('btn-view-ortho');
  const isoBtn = document.getElementById('btn-view-iso');
  if (orthoBtn && isoBtn) {
    orthoBtn.classList.toggle('active', mode === 'ortho');
    isoBtn.classList.toggle('active', mode === 'iso');
  }
  // when switching to iso, try to fit entire map; else just clamp
  if (mode === 'iso') {
    try { fitMapToViewSmooth(); } catch (err) { clampCamera(); }
  } else clampCamera();
}

// Smoothly fit and center the map for isometric view
function fitMapToViewSmooth(duration = 600) {
  // reuse fitMapToView math to compute target zoom and camera
  const margin = 0.78;
  const w1 = TILE;
  const h1 = TILE * ISO_RATIO;
  function proj1(col, row) { return { x: (col - row) * (w1 / 2), y: (col + row) * (h1 / 2) - h1 / 2 }; }
  const a = proj1(0,0), b = proj1(COLS-1,0), c = proj1(0,ROWS-1), d = proj1(COLS-1,ROWS-1);
  const minX1 = Math.min(a.x,b.x,c.x,d.x) - w1/2;
  const maxX1 = Math.max(a.x,b.x,c.x,d.x) + w1/2;
  const minY1 = Math.min(a.y,b.y,c.y,d.y);
  const maxY1 = Math.max(a.y,b.y,c.y,d.y) + h1;
  const mapW1 = maxX1 - minX1;
  const mapH1 = maxY1 - minY1;
  const panelEl = document.getElementById('panel');
  const taskEl = document.getElementById('task-panel');
  const topbar = document.getElementById('topbar');
  const floating = document.body.classList.contains('floating-panels');
  const ocLeft = (taskEl && floating && getComputedStyle(taskEl).display !== 'none') ? taskEl.offsetWidth : 0;
  const ocRight = (panelEl && floating && getComputedStyle(panelEl).display !== 'none') ? panelEl.offsetWidth : 0;
  const ocTop = (topbar && getComputedStyle(topbar).display !== 'none') ? topbar.offsetHeight : 0;
  const effectiveW = Math.max(100, canvas.width - ocLeft - ocRight - 16);
  const effectiveH = Math.max(100, canvas.height - ocTop - 16);
  let targetZoom = Math.min((effectiveW * margin) / mapW1, (effectiveH * margin) / mapH1);
  targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom));

  // compute desired camera to center bounds
  const bounds = (() => {
    // temporarily compute world bounds with the computed zoom
    const prevZoom = zoom;
    zoom = targetZoom;
    const b = getWorldBounds();
    zoom = prevZoom;
    return b;
  })();
  const mapW = bounds.maxX - bounds.minX;
  const mapH = bounds.maxY - bounds.minY;
  const visCenterX = (canvas.width + ocLeft - ocRight) / 2;
  const visCenterY = (ocTop + (canvas.height - ocTop) / 2);
  const desiredCamX = visCenterX - (bounds.minX + mapW / 2);
  const desiredCamY = visCenterY - (bounds.minY + mapH / 2);

  // set smoothing targets
  fitTransition = { startZoom: zoom, targetZoom, startTime: Date.now(), duration };
  targetCam = { x: desiredCamX, y: desiredCamY };
}

function setEditMode(enabled) {
  editMode = enabled;
  document.body.classList.toggle('free-mode', !editMode);
  const editBtn = document.getElementById('btn-mode-edit');
  const freeBtn = document.getElementById('btn-mode-free');
  if (editBtn && freeBtn) {
    editBtn.classList.toggle('active', editMode);
    freeBtn.classList.toggle('active', !editMode);
  }
  if (!editMode) {
    selectedTool = null;
    document.querySelectorAll('.build-btn, #btn-demolish').forEach(b => b.classList.remove('selected'));
  }
  if (!panMode) {
    canvas.style.cursor = editMode ? 'crosshair' : 'default';
  }
}

function setPanMode(enabled) {
  panMode = enabled;
  const panBtn = document.getElementById('btn-panmode');
  if (panBtn) panBtn.classList.toggle('active', panMode);
  canvas.style.cursor = panMode ? 'grab' : 'crosshair';
}

function setFloatingPanels(enabled) {
  document.body.classList.toggle('floating-panels', enabled);
  const floatBtn = document.getElementById('btn-floatpanels');
  if (floatBtn) floatBtn.classList.toggle('active', enabled);
  resizeCanvas();
  try { saveAppStateDebounced(); } catch (e) {}
}

// Compute the maximum zoom that still fits the whole isometric map into the visible canvas area
// (removed computeFitZoomIso helper — full-map rendering used instead)

function setAdvStatsVisible(visible) {
  const card = document.getElementById('char-card');
  const btn = document.getElementById('btn-advstats');
  if (!card) return;
  card.classList.toggle('hidden', !visible);
  if (btn) btn.classList.toggle('active', visible);
}

const btnModeEdit = document.getElementById('btn-mode-edit');
const btnModeFree = document.getElementById('btn-mode-free');
const btnCenterPlayer = document.getElementById('btn-center-player');

function centerCameraOnPlayer() {
  const tileSize = getTileSize();
  if (viewMode === 'iso') {
    const p = projectIso(player.x, player.y);
    const { w, h } = getIsoTileSize();
    // center camera on player's feet (bottom vertex of the iso diamond)
    camX = canvas.width / 2 - (p.x + w / 2);
    camY = canvas.height / 2 - (p.y + h);
  } else {
    // center on tile center in ortho mode
    camX = canvas.width / 2 - (player.x * tileSize + tileSize / 2);
    camY = canvas.height / 2 - (player.y * tileSize + tileSize / 2);
  }
  clampCamera();
}

// Fit the entire map into view (useful for isometric overview)
function fitMapToView() {
  // Estimate zoom to fit full projected map, then center based on actual world bounds
  const margin = 0.78; // leave extra room for UI chrome
  // compute bounds at zoom = 1
  const w1 = TILE;
  const h1 = TILE * ISO_RATIO;
  // proj1 returns x=centerX and y=topY for tile at zoom=1
  function proj1(col, row) { return { x: (col - row) * (w1 / 2), y: (col + row) * (h1 / 2) - h1 / 2 }; }
  const a = proj1(0,0), b = proj1(COLS-1,0), c = proj1(0,ROWS-1), d = proj1(COLS-1,ROWS-1);
  const minX1 = Math.min(a.x,b.x,c.x,d.x) - w1/2;
  const maxX1 = Math.max(a.x,b.x,c.x,d.x) + w1/2;
  const minY1 = Math.min(a.y,b.y,c.y,d.y);
  const maxY1 = Math.max(a.y,b.y,c.y,d.y) + h1;
  const mapW1 = maxX1 - minX1;
  const mapH1 = maxY1 - minY1;
  // compute occlusions from floating UI panels so we fit the visible area
  const panelEl = document.getElementById('panel');
  const taskEl = document.getElementById('task-panel');
  const topbar = document.getElementById('topbar');
  const floating = document.body.classList.contains('floating-panels');
  const ocLeft = (taskEl && floating && getComputedStyle(taskEl).display !== 'none') ? taskEl.offsetWidth : 0;
  const ocRight = (panelEl && floating && getComputedStyle(panelEl).display !== 'none') ? panelEl.offsetWidth : 0;
  const ocTop = (topbar && getComputedStyle(topbar).display !== 'none') ? topbar.offsetHeight : 0;
  const effectiveW = Math.max(100, canvas.width - ocLeft - ocRight - 16);
  const effectiveH = Math.max(100, canvas.height - ocTop - 16);
  // choose zoom to fit into available visible area with margin
  let targetZoom = Math.min((effectiveW * margin) / mapW1, (effectiveH * margin) / mapH1);
  targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom));
  zoom = targetZoom;
  // recompute exact world bounds at this zoom and center inside the visible area
  const bounds = getWorldBounds();
  const mapW = bounds.maxX - bounds.minX;
  const mapH = bounds.maxY - bounds.minY;
  // center inside visible region (account for occlusions)
  const visCenterX = (canvas.width + ocLeft - ocRight) / 2;
  const visCenterY = (ocTop + (canvas.height - ocTop) / 2);
  camX = visCenterX - (bounds.minX + mapW / 2);
  camY = visCenterY - (bounds.minY + mapH / 2);
  clampCamera();
  // update zoom slider UI if present
  try { const s = document.getElementById('zoom-slider'); if (s) s.value = String(zoom); } catch (e) {}
  try { console.log('fitMapToView:', { targetZoom, mapW1, mapH1, mapW, mapH, canvasW: canvas.width, canvasH: canvas.height }); } catch (e) {}
}
if (btnCenterPlayer) btnCenterPlayer.addEventListener('click', () => {
  if (!editMode) centerCameraOnPlayer();
});
if (btnModeEdit) btnModeEdit.addEventListener('click', () => setEditMode(true));
if (btnModeFree) btnModeFree.addEventListener('click', () => setEditMode(false));
// Top toolbar buttons
const orthoBtn = document.getElementById('btn-view-ortho');
const isoBtn = document.getElementById('btn-view-iso');
const fitMapBtn = document.getElementById('btn-fitmap');
const panBtn = document.getElementById('btn-panmode');
const resetCamBtn = document.getElementById('btn-resetcam');
const advBtn = document.getElementById('btn-advstats');
const floatBtn = document.getElementById('btn-floatpanels');
if (orthoBtn) orthoBtn.addEventListener('click', () => setViewMode('ortho'));
if (isoBtn) isoBtn.addEventListener('click', () => setViewMode('iso'));
if (fitMapBtn) {
  // remove the explicit "fit map" button — selecting Isométrica auto-fits the map now
  try { fitMapBtn.style.display = 'none'; } catch (e) { /* ignore */ }
}
if (panBtn) panBtn.addEventListener('click', () => setPanMode(!panMode));
if (resetCamBtn) resetCamBtn.addEventListener('click', () => centerCamera());
if (advBtn) advBtn.addEventListener('click', () => setAdvStatsVisible(!document.getElementById('char-card').classList.contains('hidden')));
if (floatBtn) floatBtn.addEventListener('click', () => setFloatingPanels(!document.body.classList.contains('floating-panels')));

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (!startLocked) {
    const moveMap = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0]
    };
    if (!editMode) {
      moveMap.d = [1, 0];
    }
    if (e.key in moveMap) {
      const [dx, dy] = moveMap[e.key];
      // In edit mode, disallow moving the player via keyboard
      if (editMode) {
        // ignore movement keys while editing
        return;
      }
      // in free mode we handle movement continuously via keyState
    }
  }
  if (editMode) {
    const map = { h:'house', f:'farm', t:'temple', m:'market', g:'granary', z:'ziggurat', d:'demolish', Escape:null };
    if (e.key in map) {
      const type = map[e.key];
      document.querySelectorAll('.build-btn, #btn-demolish').forEach(b => b.classList.remove('selected'));
      selectedTool = type;
      if (type) {
        const el = type === 'demolish' ? document.getElementById('btn-demolish') : document.querySelector(`[data-type="${type}"]`);
        if (el) el.classList.add('selected');
      }
    }
  }
  if (e.key === 'Enter') {
    // toggle guide instead of advancing classical turns
    const g = document.getElementById('game-guide'); if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none';
  }
  // toggle camera follow with 'f'
  if (e.key && e.key.toLowerCase() === 'f') {
    followPlayer = !followPlayer;
    notify(followPlayer ? 'Camara: siguiendo jugador' : 'Camara: libre');
    if (followPlayer) {
      // initialize smooth target immediately
      const tileSize = getTileSize();
      if (viewMode === 'iso') {
        const p = projectIso(player.x, player.y);
        targetCam = { x: canvas.width/2 - p.x, y: canvas.height/2 - p.y };
      } else {
        targetCam = { x: canvas.width/2 - player.x * tileSize, y: canvas.height/2 - player.y * tileSize };
      }
    } else {
      targetCam = null;
    }
  }
});

// Continuous movement key handling
document.addEventListener('keydown', e => {
  // movement keys (including Shift for sprint)
  if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(e.key)) {
    keyState[e.key] = true;
  }
});
document.addEventListener('keyup', e => {
  if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Shift'].includes(e.key)) {
    keyState[e.key] = false;
  }
});

// Toggle inventory with 'I'
document.addEventListener('keydown', e => {
  if (e.key && e.key.toLowerCase() === 'i') {
    try { toggleInventory(); } catch (err) {}
    e.preventDefault();
  }
});

// Interaction key: 'E' to interact with nearby trees (start chopping)
document.addEventListener('keydown', e => {
  if (!e.key) return;
  if (e.key.toLowerCase() !== 'e') return;
  // disable interactions while in edit mode
  if (editMode) { notify('Interacciones deshabilitadas en modo edición'); e.preventDefault(); return; }
  try {
    const it = window._interactionTarget;
    if (it) {
      if (it.kind === 'door' && it.ref && it.ref.interiorId) {
        try { if (window.enterInterior) window.enterInterior(it.ref.interiorId); } catch (ee) {}
        e.preventDefault();
        return;
      }
      if (it.kind === 'resource' && it.ref) {
        try {
          // find and remove the exact entity instance
          for (let i = entities.length - 1; i >= 0; i--) {
            if (entities[i] === it.ref) {
              const ent = entities[i];
              const map = { wood: 'wood', stone: 'stone', wheat: 'food', berry: 'food', bush: 'food', food: 'food', water: 'water' };
              const item = map[ent.subtype] || ent.subtype || 'item';
              addToInventory(item, 1);
              entities.splice(i, 1);
              notify(`Recolectaste: ${item}`);
              break;
            }
          }
          try { saveAppStateDebounced(); } catch (err) {}
          try { updateInventory(); } catch (err) {}
        } catch (err) {}
        e.preventDefault();
        return;
      }
      if (it.kind === 'tree' && it.ref) {
        try {
          const found = it.ref;
          const now = Date.now();
          if (!found._chopUntil) { found._chopStart = now; found._chopUntil = now + 2000; notify('Talas el árbol...'); }
          else { notify('Acción en progreso...'); }
        } catch (err) {}
        e.preventDefault();
        return;
      }
    }
  } catch (err) { /* ignore */ }
});

// Save player pos on unload/visibility change/blur so it's persisted reliably
window.addEventListener('beforeunload', () => { try { savePlayerPos(true); } catch (err) {} });
window.addEventListener('pagehide', () => { try { savePlayerPos(true); } catch (err) {} });
window.addEventListener('unload', () => { try { savePlayerPos(true); } catch (err) {} });
window.addEventListener('blur', () => { try { savePlayerPos(true); } catch (err) {} });
document.addEventListener('visibilitychange', () => { try { if (document.hidden) savePlayerPos(true); } catch (err) {} });

window.addEventListener('resize', resizeCanvas);

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
function init() {
  try { console.log('game-engine: init start'); if (window._onEngineProgress) try { window._onEngineProgress(3, 'Inicializando motor...'); } catch (e) {} } catch (e) {}
  resizeCanvas();
  setViewMode('ortho');
  setPanMode(false);
  setAdvStatsVisible(true);
  setEditMode(true);
  setFloatingPanels(false);
  // create overlay UI (follow button, inventory panel, settings)
  try { createOverlayUI(); } catch (err) { /* ignore */ }
  try { createAbilityBarAndMissions(); } catch (err) { /* ignore */ }

  // Enhance top icons and create the game guide; make panels floating
  try {
    enhanceTopBarIcons();
  } catch (err) {}
  try { createGameGuideUI(); } catch (err) {}
  // restore saved panels/map/player is deferred until player chooses 'Cargar partida'
  // (we avoid loading map/terrain automatically so the main menu is shown first)
  try { createTaskPanel(); } catch (err) {}
  try { enableFloatingBehavior(document.getElementById('inventory-panel')); } catch (err) {}
  try { enableFloatingBehavior(document.getElementById('entity-info')); } catch (err) {}
  try { enableFloatingBehavior(document.getElementById('settings-panel')); } catch (err) {}

  // Draw resource icons
  drawWheatIcon(document.getElementById('icon-wheat').getContext('2d'), 18, 18);
  drawBrickIcon(document.getElementById('icon-brick').getContext('2d'), 18, 18);
  drawPopIcon(document.getElementById('icon-pop').getContext('2d'), 18, 18);

  // Draw building icons in buttons
  try { drawRegisteredIcon(document.getElementById('icon-house').getContext('2d'), 'house', 22, 22); } catch (e) {}
  try { drawRegisteredIcon(document.getElementById('icon-farm').getContext('2d'), 'farm', 22, 22); } catch (e) {}
  try { drawRegisteredIcon(document.getElementById('icon-temple').getContext('2d'), 'temple', 22, 22); } catch (e) {}
  try { drawRegisteredIcon(document.getElementById('icon-market').getContext('2d'), 'market', 22, 22); } catch (e) {}
  try { drawRegisteredIcon(document.getElementById('icon-granary').getContext('2d'), 'granary', 22, 22); } catch (e) {}
  try { drawRegisteredIcon(document.getElementById('icon-ziggurat').getContext('2d'), 'ziggurat', 22, 22); } catch (e) {}
  // draw road icon
  try { drawRoadIcon(document.getElementById('icon-road').getContext('2d'), 22, 22); } catch (e) {}

  // Make the right panel behave like other floating windows (draggable/minimizable)
  try { const mainPanel = document.getElementById('panel'); if (mainPanel) { enableFloatingBehavior(mainPanel); registerPanel(mainPanel); } } catch (e) {}

  // Attach build button handlers so constructions can be selected from the menu
  try {
    document.querySelectorAll('.build-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!editMode) { notify('Activa el modo edición para construir.'); return; }
        const type = btn.dataset.type;
        if (!type) return;
        if (selectedTool === type) {
          selectedTool = null;
          btn.classList.remove('selected');
        } else {
          selectedTool = type;
          document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
          try { document.getElementById('btn-demolish').classList.remove('selected'); } catch (e) {}
          btn.classList.add('selected');
        }
      });
    });
  } catch (e) { /* ignore */ }

  // Draw character portrait
  drawCharacterPortrait(document.getElementById('char-portrait').getContext('2d'), 54, 54, player.palette);

  // Create build panel controls (collapse / minimize)
  try { createBuildPanelControls(); } catch (e) {}
  try { createCameraButton(); } catch (e) {}
  // Create restore button for minimized panel
  try {
    if (!document.getElementById('panel-restore-btn')) {
      const rb = document.createElement('button'); rb.id = 'panel-restore-btn'; rb.textContent = 'Abrir panel';
      rb.addEventListener('click', () => {
        const panel = document.getElementById('panel'); if (!panel) return; panel.style.display = 'flex'; rb.style.display = 'none';
      });
      document.body.appendChild(rb);
    }
  } catch (e) {}

  // Place some starter buildings
  // Procedural map generation with biomes, resources and animals
  // Try to restore a previously saved app state (map, player, panels)
  try {
    // if forced new game, generate fresh map and open char selection
    if (localStorage.getItem('meso.forceNew') === '1') {
      try { localStorage.removeItem('meso.forceNew'); } catch (e) {}
      // run async preload then generate map so sprites are ready before placement
      (async () => {
            try { console.log('game-engine: forced-new async start'); } catch (e) {}
          try {
            // report progress to external loader if present
            try { if (window._onEngineProgress) window._onEngineProgress(10, 'Preparando sprites...'); } catch (e) {}
            await ensureEntityPixelsReady(1400);
            // create a minimal progress proxy so generateSpriteImages can report back
            const prog = {
              update: function(p, msg) { try { if (window._onEngineProgress) window._onEngineProgress(10 + Math.round((p||0) * 0.5), msg || 'Procesando sprites...'); } catch (e) {} }
            };
            console.log && console.log('game-engine: generating sprite images');
            await generateSpriteImages(prog);
            console.log && console.log('game-engine: sprite images generation complete');
            try { if (window._onEngineProgress) window._onEngineProgress(55, 'Sprites listos'); } catch (e) {}
          } catch (e) {}
          try { if (window._onEngineProgress) window._onEngineProgress(60, 'Generando mapa...'); } catch (e) {}
          console.log && console.log('game-engine: generating map');
          generateMap('random'); saveAppStateDebounced();
          console.log && console.log('game-engine: map generation requested');
          try { if (window._onEngineProgress) window._onEngineProgress(80, 'Cargando entidades...'); } catch (e) {}
        // If an external menu handled the startup parameters/character selection,
        // do not open the engine's internal character selector or block the UI.
        if (!window._externalMenu) {
          try { setupCharacterSelection(); openCharacterSelect(); } catch (e) {}
          try { if (!localStorage.getItem('meso.noBuildTut')) showBuildTutorial(); } catch (e) {}
        } else {
          // external menu already provided initial params and won't need the internal modal
          try { /* skip internal character select when hosted by external menu */ } catch (e) {}
        }
        try { if (window._onEngineProgress) window._onEngineProgress(90, 'Finalizando...'); } catch (e) {}
          try { console.log && console.log('game-engine: finalizing new-game flow, calling postMapInit'); } catch (e) {}
          try { postMapInit(); } catch (e) { console.warn('postMapInit call failed', e); }
      })();
    }
    // If the host page is providing its own external menu, skip the built-in startup menu.
    if (!window._externalMenu) {
      // Always show credits splash then force the start menu as the default screen
      try { showCreditsSplash(900, function() { try { showStartMenu(true); } catch (e) { console.error('showStartMenu err', e); } }); } catch (e) {}
      // Stop further automatic generation/loading here; user will choose action from menu.
      return;
    }
  } catch (err) { generateMap('random'); }
  // if we have a saved player pos (legacy), load it (overrides spawn)
  try { loadPlayerPos(); } catch (err) { /* ignore */ }
  try { console.debug && console.debug('init -> player pos after loadPlayerPos', { x: player.x, y: player.y, col: player.col, row: player.row }); } catch (e) {}

  // if this is a loaded game and we haven't spawned initial NPCs yet, spawn 2 NPCs
  try {
    const hasSavedPos = !!localStorage.getItem('meso.playerPos');
    const spawnedFlag = localStorage.getItem('meso.spawned_npcs');
    if (hasSavedPos && spawnedFlag !== '1') {
      const baseCol = Math.min(COLS-3, Math.max(2, Math.floor(player.col)));
      const baseRow = Math.min(ROWS-3, Math.max(2, Math.floor(player.row)));
      spawnNPC('Karduk', baseCol + 2, baseRow);
      spawnNPC('Nabu',   baseCol - 2, baseRow);
      localStorage.setItem('meso.spawned_npcs', '1');
    }
  } catch (err) { /* ignore if spawn helper missing */ }

  updateUI();
  updateCharCard();
  renderActionList();
  updateInventory();
  setupCharacterSelection();

  // Center camera on river area
  centerCamera();

  addLog('Ciudad fundada en la orilla del Éufrates.');
  addLog('Atajos: H=Casa F=Granja T=Templo M=Mercado G=Granero Z=Zigurat D=Demoler');
  notify('¡Bienvenido a Mesopotamia! Construye tu ciudad.');
}

// Post-map initialization tasks used after generate/import/load flows
function postMapInit() {
  try { updateUI(); updateCharCard(); renderActionList(); updateInventory(); setupCharacterSelection(); } catch (e) {}
  try { updateBuildMenuFromGrid(); } catch (e) {}
  try { centerCamera(); } catch (e) {}
  addLog('Ciudad fundada en la orilla del Éufrates.');
  addLog('Atajos: H=Casa F=Granja T=Templo M=Mercado G=Granero Z=Zigurat D=Demoler');
  notify('¡Bienvenido a Mesopotamia! Construye tu ciudad.');
  try { render(); } catch (e) {}
  // signal to any external host that engine finished map initialization
  try { if (window._onEngineReady && typeof window._onEngineReady === 'function') { try { console.log && console.log('game-engine: calling _onEngineReady'); window._onEngineReady(); } catch (e) {} } } catch (e) {}
}

// Update build menu buttons based on current map (mark as 'built' when a type exists)
function updateBuildMenuFromGrid() {
  try {
    const types = ['house','farm','temple','market','granary','ziggurat','road'];
    const found = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r] && grid[r][c];
        if (!cell) continue;
        let t = null;
        if (typeof cell === 'string') t = cell;
        else if (cell.type) t = cell.type;
        if (t && types.includes(t)) found[t] = (found[t]||0) + 1;
      }
    }
    types.forEach(t => {
      const btn = document.querySelector(`.build-btn[data-type="${t}"]`);
      if (!btn) return;
      if (found[t]) btn.classList.add('built'); else btn.classList.remove('built');
      // optionally show a small count badge
      let badge = btn.querySelector('.built-count');
      if (!badge) { badge = document.createElement('span'); badge.className = 'built-count'; badge.style.fontSize='0.7rem'; badge.style.color='#C8A84B'; badge.style.marginLeft='6px'; btn.querySelector('.bname') && btn.querySelector('.bname').appendChild(badge); }
      badge.textContent = found[t] ? ` (${found[t]})` : '';
    });
  } catch (e) { /* ignore */ }
}

try {
  // autosave every 5 seconds and on unload/visibility change to persist full runtime state
  try {
    setInterval(() => { try { saveAppState(); } catch (e) {} }, 5000);
    window.addEventListener('beforeunload', () => { try { saveAppState(); } catch (e) {} });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') try { saveAppState(); } catch (e) {} });
  } catch (e) {}
  init();
  console.log('game-engine: init complete');
} catch (err) {
  console.error('game-engine init error', err);
  try {
    const el = document.getElementById('fatal-error-overlay') || document.createElement('div');
    el.id = 'fatal-error-overlay';
    el.style.position = 'fixed'; el.style.left = '8px'; el.style.top = '8px'; el.style.right = '8px';
    el.style.padding = '10px'; el.style.background = 'rgba(80,0,0,0.95)'; el.style.color = '#fff'; el.style.zIndex = 99999;
    el.style.fontFamily = 'monospace'; el.style.whiteSpace = 'pre-wrap';
    el.textContent = 'INIT ERROR: ' + (err && err.stack ? err.stack : String(err));
    document.body.appendChild(el);
  } catch (err2) { console.error('Error showing init overlay', err2); }
}

