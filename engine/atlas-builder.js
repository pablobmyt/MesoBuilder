// Simple atlas builder for tree templates
// Builds a single canvas with each GLOBAL_TREE_TEMPLATES rendered at a base scale

export function buildTreeAtlas(tileSize) {
  try {
    const templates = (typeof GLOBAL_TREE_TEMPLATES !== 'undefined' && Array.isArray(GLOBAL_TREE_TEMPLATES)) ? GLOBAL_TREE_TEMPLATES : [];
    if (!templates.length) return null;
    const baseScale = Math.max(2, Math.floor((tileSize || 32) / 4));
    // render each template into its own canvas, measure widths
    const entries = [];
    let totalW = 0, maxH = 0;
    const rendered = templates.map((tpl, idx) => {
      // compute max coords
      let maxX = 0, maxY = 0;
      for (const p of tpl) { if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
      const w = (maxX + 1) * baseScale;
      const h = (maxY + 1) * baseScale;
      const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.clearRect(0,0,w,h);
      for (const [px, py, color] of tpl) {
        try { cx.fillStyle = color; cx.fillRect(px * baseScale, py * baseScale, baseScale, baseScale); } catch (e) {}
      }
      entries.push({ idx, w, h }); totalW += w; maxH = Math.max(maxH, h);
      return c;
    });
    // pack horizontally into one atlas
    const atlas = document.createElement('canvas'); atlas.width = totalW; atlas.height = maxH;
    const actx = atlas.getContext('2d'); actx.imageSmoothingEnabled = false; let ox = 0; const mapping = {};
    for (let i = 0; i < rendered.length; i++) {
      const c = rendered[i]; const meta = entries[i]; actx.drawImage(c, 0, 0);
      mapping[i] = { x: ox, y: 0, w: meta.w, h: meta.h, baseScale };
      ox += meta.w;
    }
    // store on window for engine to use
    try { window._TREE_ATLAS = { canvas: atlas, map: mapping, baseScale }; } catch (e) {}
    return window._TREE_ATLAS;
  } catch (e) { console.warn('buildTreeAtlas err', e); return null; }
}
