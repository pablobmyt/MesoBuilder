export function showProgressOverlay(title) {
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

export async function exportEntitySpritesToJSON(download = true) {
  try {
    const cache = window._ENTITY_BITMAPS || {};
    const out = {};
    for (const k of Object.keys(cache)) {
      try {
        const v = cache[k];
        const tmp = document.createElement('canvas');
        const w = (v && v.width) ? v.width : 64;
        const h = (v && v.height) ? v.height : 64;
        tmp.width = w; tmp.height = h;
        const tc = tmp.getContext('2d'); tc.clearRect(0,0,w,h);
        try { tc.drawImage(v, 0, 0, w, h); } catch (e) {}
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

export async function exportEntitySpritesPixelsJSON(download = true) {
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

export async function exportEntitySpritesPNGs(names, options = {}) {
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
        if (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS[name]) {
          const bmp = window._ENTITY_BITMAPS[name];
          canvas = document.createElement('canvas'); canvas.width = bmp.width || 32; canvas.height = bmp.height || 32;
          const ctxc = canvas.getContext('2d'); try { ctxc.drawImage(bmp, 0, 0); } catch (e) {}
        } else if (lib[name]) {
          canvas = window.createCanvasFromPixelDef(lib[name], name, lib[name].grid || 16);
        }
        if (!canvas) continue;
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) continue;
        const dataURI = await new Promise((res) => {
          try { const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height; tmp.getContext('2d').drawImage(canvas,0,0); res(tmp.toDataURL('image/png')); } catch (e) { res(null); }
        });
        let posted = false;
        if (doPost && server && server.indexOf('http') === 0) {
          try {
            await fetch(server, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name + '.png', dataURI }) });
            posted = true;
          } catch (e) { posted = false; }
        }
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

try { window.showProgressOverlay = showProgressOverlay; } catch (e) {}
try { window.exportEntitySpritesToJSON = exportEntitySpritesToJSON; } catch (e) {}
try { window.exportEntitySpritesPixelsJSON = exportEntitySpritesPixelsJSON; } catch (e) {}
try { window.exportEntitySpritesPNGs = exportEntitySpritesPNGs; } catch (e) {}
