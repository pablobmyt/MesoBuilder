export function initializeEntityRuntimeCaches() {
  window._ICON_BITMAPS = window._ICON_BITMAPS || {};
  window.MAP_CHUNKS = window.MAP_CHUNKS || {};
  window._ENTITY_BITMAPS = window._ENTITY_BITMAPS || {};
  try {
    window._SPRITE_IMAGES = window._SPRITE_IMAGES || {};
    const raw = localStorage.getItem('meso.spriteCache');
    if (raw) {
      try {
        const cache = JSON.parse(raw || '{}');
        const sprites = cache.sprites || {};
        for (const k of Object.keys(sprites)) {
          try {
            const dataURI = sprites[k];
            if (!dataURI) continue;
            const img = new Image(); img.src = dataURI; img.dataset.spriteName = k;
            window._SPRITE_IMAGES[k] = img;
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
  window._DEFAULT_DENSITIES = window._DEFAULT_DENSITIES || { npc: 1.0, animals: 1.0, vegetation: 0.6 };
  window._gameStarted = window._gameStarted || false;
  window._showPanels = window._showPanels || false;
  window._selectedEntities = window._selectedEntities || [];
  window._unitCommandTarget = window._unitCommandTarget || null;
}

export async function loadEntityDefinitions(progress, deps) {
  const {
    BUILDINGS,
    DEFAULT_ENEMY_DEFS,
    DEFAULT_RESOURCE_DEFS
  } = deps;
  try {
    if (progress && progress.update) progress.update(2, 'Cargando definiciones...');
    const path = 'data/entities-defs.json';
    let resp = null;
    try { resp = await fetch(path, { cache: 'no-store' }); } catch (e) { resp = null; }
    if (!resp || !resp.ok) {
      if (progress && progress.update) progress.update(6, 'Defs: fallback');
      window._ENTITY_DEFS = window._ENTITY_DEFS || { buildings: BUILDINGS, enemies: DEFAULT_ENEMY_DEFS, resources: DEFAULT_RESOURCE_DEFS };
      return;
    }
    const j = await resp.json();
    window._ENTITY_DEFS = window._ENTITY_DEFS || {};
    window._ENTITY_DEFS.buildings = Object.assign({}, BUILDINGS, j.buildings || {});
    window._ENTITY_DEFS.trees = Array.isArray(j.trees) ? j.trees.slice() : (window._ENTITY_DEFS.trees || []);
    window._ENTITY_DEFS.animals = Object.assign({}, j.animals || {});
    window._ENTITY_DEFS.enemies = Object.assign({}, DEFAULT_ENEMY_DEFS, j.enemies || {});
    window._ENTITY_DEFS.resources = Object.assign({}, DEFAULT_RESOURCE_DEFS, j.resources || {});
    try { for (const k in window._ENTITY_DEFS.buildings) BUILDINGS[k] = window._ENTITY_DEFS.buildings[k]; } catch (e) {}
    if (progress && progress.update) progress.update(8, 'Defs cargadas');
  } catch (e) { console.warn('loadEntityDefinitions err', e); }
}

export function importEntityDefinitionsFromObject(obj, deps) {
  const {
    BUILDINGS,
    DEFAULT_ENEMY_DEFS,
    DEFAULT_RESOURCE_DEFS
  } = deps;
  try {
    if (!obj) return false;
    window._ENTITY_DEFS = window._ENTITY_DEFS || {};
    if (obj.buildings) window._ENTITY_DEFS.buildings = Object.assign({}, window._ENTITY_DEFS.buildings || {}, obj.buildings);
    if (obj.trees) window._ENTITY_DEFS.trees = Array.isArray(obj.trees) ? obj.trees.slice() : (window._ENTITY_DEFS.trees || []);
    if (obj.animals) window._ENTITY_DEFS.animals = Object.assign({}, window._ENTITY_DEFS.animals || {}, obj.animals);
    if (obj.enemies) window._ENTITY_DEFS.enemies = Object.assign({}, DEFAULT_ENEMY_DEFS, window._ENTITY_DEFS.enemies || {}, obj.enemies);
    if (obj.resources) window._ENTITY_DEFS.resources = Object.assign({}, DEFAULT_RESOURCE_DEFS, window._ENTITY_DEFS.resources || {}, obj.resources);
    try { for (const k in window._ENTITY_DEFS.buildings) BUILDINGS[k] = window._ENTITY_DEFS.buildings[k]; } catch (e) {}
    return true;
  } catch (e) { console.warn('importEntityDefinitionsFromObject err', e); return false; }
}

export function exportEntityDefinitionsToJSON(deps) {
  const {
    BUILDINGS,
    DEFAULT_ENEMY_DEFS,
    DEFAULT_RESOURCE_DEFS
  } = deps;
  try {
    const defs = window._ENTITY_DEFS || { buildings: BUILDINGS, trees: null, animals: null, enemies: DEFAULT_ENEMY_DEFS, resources: DEFAULT_RESOURCE_DEFS };
    const data = {
      buildings: defs.buildings || BUILDINGS,
      trees: defs.trees || null,
      animals: defs.animals || null,
      enemies: defs.enemies || DEFAULT_ENEMY_DEFS,
      resources: defs.resources || DEFAULT_RESOURCE_DEFS
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'entities-defs.json'; document.body.appendChild(a); a.click(); setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch (e) {} }, 200);
  } catch (e) { console.warn('exportEntityDefinitionsToJSON err', e); }
}

export async function ensureEntityPixelsReady(timeoutMs = 1200) {
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

export function installEntityEditorMessageHandlers(importHandler) {
  window.addEventListener('message', (ev) => {
    try {
      const d = ev.data; if (!d) return;
      if (d.type === 'meso.importEntityDefs' && d.data) {
        const ok = importHandler(d.data);
        try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'meso.importResult', ok: !!ok, msg: ok ? 'Imported' : 'Failed' }, '*'); } catch (e) {}
        return;
      }
      if (d.type === 'requestEntityPixels') {
        const data = window.ENTITY_PIXEL_LIBRARY || {};
        try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsData', data }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsData', data }, '*'); }
        return;
      }
      if (d.type === 'listEntityPixels') {
        const keys = Object.keys(window.ENTITY_PIXEL_LIBRARY || {});
        try { if (ev.source && ev.source.postMessage) ev.source.postMessage({ type: 'entityPixelsList', list: keys }, '*'); } catch (e) { window.postMessage({ type: 'entityPixelsList', list: keys }, '*'); }
        return;
      }
      if (d.type === 'saveEntityPixels' && d.data) {
        try {
          const newData = d.data || {};
          try {
            const oldData = JSON.stringify(window.ENTITY_PIXEL_LIBRARY || {}, null, 2);
            const blobOld = new Blob([oldData], { type: 'application/json' });
            const aOld = document.createElement('a');
            aOld.href = URL.createObjectURL(blobOld);
            aOld.download = 'entity-pixels.bck.' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
            document.body.appendChild(aOld); aOld.click(); aOld.remove();
          } catch (e) { console.warn('Could not create backup download', e); }

          window.ENTITY_PIXEL_LIBRARY = newData.icons || newData;
          for (const k in window.ENTITY_PIXEL_LIBRARY) {
            try { window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[k], k); } catch (e) { console.warn('rebuild icon', k, e); }
          }

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
      }
    } catch (e) { console.error('message handler error', e); }
  });
}
