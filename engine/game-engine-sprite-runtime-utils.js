export function showLoadingOverlay(text) {
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
  } catch (e) {}
}

export async function generateSpriteImages(progress) {
  try {
    const cache = window._ENTITY_BITMAPS || {};
    window._SPRITE_URLS = window._SPRITE_URLS || {};
    window._SPRITE_IMAGES = window._SPRITE_IMAGES || {};
    const SPRITE_CACHE_KEY = 'meso.spriteCache';
    const SPRITE_CACHE_LIMIT_BYTES = 3 * 1024 * 1024;
    let spriteCache = { ts: Date.now(), sprites: {}, size: 0 };
    try {
      const raw = localStorage.getItem(SPRITE_CACHE_KEY);
      if (raw) spriteCache = Object.assign(spriteCache, JSON.parse(raw));
    } catch (e) { spriteCache = { ts: Date.now(), sprites: {}, size: 0 }; }
    window._spriteServerAvailable = (window._spriteServerAvailable === undefined) ? true : window._spriteServerAvailable;
    const keys = Object.keys(cache);
    if (keys.length === 0) { if (progress && progress.update) progress.update(60, 'Sprites: none'); return; }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      try {
        if (!cache[k]) continue;
        if (window._SPRITE_IMAGES[k]) continue;
        if (progress && progress.update) progress.update(Math.floor(60 + (i / Math.max(1, keys.length)) * 30), `Generando sprites... (${i+1}/${keys.length})`);
        const v = cache[k];
        const tmp = document.createElement('canvas'); tmp.width = v.width || 32; tmp.height = v.height || 32;
        const tc = tmp.getContext('2d'); tc.clearRect(0,0,tmp.width,tmp.height);
        try { tc.drawImage(v, 0, 0, tmp.width, tmp.height); } catch (e) {}

        try {
          if (window.createImageBitmap) {
            const bmp = await createImageBitmap(tmp);
            window._SPRITE_IMAGES[k] = bmp;
            try { const blob = await new Promise((resolve) => tmp.toBlob(resolve, 'image/png')); if (blob) window._SPRITE_URLS[k] = URL.createObjectURL(blob); } catch (e) {}
          } else {
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

        (async () => {
          try {
            try {
              if (!spriteCache.sprites[k]) {
                const dataURI = tmp.toDataURL('image/png');
                const approxSize = dataURI.length * 2;
                if ((spriteCache.size + approxSize) <= SPRITE_CACHE_LIMIT_BYTES) {
                  spriteCache.sprites[k] = dataURI;
                  spriteCache.size += approxSize;
                  spriteCache.ts = Date.now();
                }
              }
            } catch (e) {}
            const server = (window.SPRITE_SERVER_URL || 'http://localhost:3001/save-sprite');
            if (window._spriteServerAvailable && server && server.indexOf('http') === 0) {
              try {
                const dataURI = spriteCache.sprites[k] || tmp.toDataURL('image/png');
                const res = await fetch(server, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: k + '.png', dataURI })
                });
                if (!res.ok) {
                  console.warn('sprite save failed', k, res.status);
                  window._spriteServerAvailable = false;
                }
              } catch (e) {
                window._spriteServerAvailable = false;
              }
            }
            try { localStorage.setItem(SPRITE_CACHE_KEY, JSON.stringify(spriteCache)); } catch (e) {}
          } catch (e) {}
        })();

      } catch (e) { console.warn('generateSpriteImages error', k, e); }
    }
    if (progress && progress.update) progress.update(95, 'Sprites generados');
    try { localStorage.setItem(SPRITE_CACHE_KEY, JSON.stringify(spriteCache)); } catch (e) {}
  } catch (e) { console.warn('generateSpriteImages err', e); }
}

export function hideLoadingOverlay() {
  try { const el = document.getElementById('loading-overlay'); if (el) el.style.display = 'none'; } catch (e) {}
}

try { window.showLoadingOverlay = showLoadingOverlay; } catch (e) {}
try { window.generateSpriteImages = generateSpriteImages; } catch (e) {}
try { window.hideLoadingOverlay = hideLoadingOverlay; } catch (e) {}
