// engine/game-engine-icons.js
// ─────────────────────────────────────────────────────────────────────────────
// ICONOS DIBUJADOS EN LIENZO.
//
// Estas dos funciones salieron de `game-engine.js` (29.000 líneas) porque son
// PURAS: sólo dependen de su `ctx` y de los caches globales de sprites
// (`window.ENTITY_PIXEL_LIBRARY`, `window._ICON_BITMAPS`, `window._ENTITY_BITMAPS`,
// `window._SPRITE_IMAGES`). No tocan NI UNA variable de estado del motor, así que
// se pueden mover sin `deps`, sin fábrica y sin riesgo.
//
// Es el primer paso del plan de partir el monolito (`docs/REFACTOR-MONOLITO.md`):
// se empieza por lo que no tiene estado compartido. Herramienta para medir las
// dependencias antes de mover algo:
//   node tools/refactor-deps.mjs engine/game-engine.js --faciles
// ─────────────────────────────────────────────────────────────────────────────

// Draw an icon by name using loaded pixel-library or cached icon canvases
export function drawRegisteredIcon(ctx, name, w, h) {
  try {
    const hasLibDef = !!(window.ENTITY_PIXEL_LIBRARY && window.ENTITY_PIXEL_LIBRARY[name]);
    if (hasLibDef) {
      const liveCanvas = (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS[name]) || (window._ICON_BITMAPS && window._ICON_BITMAPS[name]) || window.createCanvasFromPixelDef(window.ENTITY_PIXEL_LIBRARY[name], name, Math.min(w, h));
      if (liveCanvas) {
        ctx.clearRect(0,0,w,h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(liveCanvas, 0, 0, w, h);
        return;
      }
    }
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
    // HARD FALLBACK: draw pixels with fillRect (bypasses drawImage for Electron GPU compat)
    if (window.ENTITY_PIXEL_LIBRARY && window.ENTITY_PIXEL_LIBRARY[name]) {
      try {
        const def = window.ENTITY_PIXEL_LIBRARY[name];
        const grid = def.grid || 9;
        const pixels = def.pixels || [];
        const scale = Math.max(1, Math.floor(Math.min(w, h) / grid));
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < pixels.length; i++) {
          const p = pixels[i];
          if (p && p[2]) {
            ctx.fillStyle = p[2];
            ctx.fillRect(p[0] * scale, p[1] * scale, scale, scale);
          }
        }
        return;
      } catch (e) {}
    }
    // fallback: clear
    ctx.clearRect(0,0,w,h);
  } catch (e) { console.warn('drawRegisteredIcon err', name, e); ctx.clearRect(0,0,w,h); }
}

// Icono de un objeto del inventario (o de un objeto colocado en el mundo). Dibuja
// formas a mano: no depende de ningún sprite cargado.
export function drawItemIcon(ctx, itemId, w = 28, h = 28) {
  if (!ctx) return;
  const id = String(itemId || '').toLowerCase();
  ctx.clearRect(0, 0, w, h);

  if (id === 'wheat') {
    try {
      const hudWheat = document.getElementById('icon-wheat');
      if (hudWheat && hudWheat.tagName === 'CANVAS') {
        ctx.drawImage(hudWheat, 0, 0, hudWheat.width, hudWheat.height, 0, 0, w, h);
        return;
      }
    } catch (e) {}
    ctx.fillStyle = '#DAA520'; ctx.fillRect(6, 8, 16, 12);
    ctx.fillStyle = '#4A7C3F'; ctx.fillRect(12, 4, 3, 11);
    return;
  }
  if (id === 'brick' || id === 'brick-block') {
    ctx.fillStyle = '#B04A2D'; ctx.fillRect(4, 8, 20, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(7, 10, 5, 3); ctx.fillRect(14, 10, 5, 3); ctx.fillRect(10, 14, 5, 3);
    return;
  }
  if (id === 'wood' || id === 'plank') {
    ctx.fillStyle = '#8B5A38'; ctx.fillRect(4, 8, 20, 12);
    ctx.fillStyle = '#7A4A2A';
    for (let i = 0; i < 3; i++) ctx.fillRect(6 + i * 6, 9 + (i % 2), 1, 10);
    return;
  }
  if (id === 'stone') {
    const stoneSprite = (window._ENTITY_BITMAPS && window._ENTITY_BITMAPS['stone']) || (window._SPRITE_IMAGES && window._SPRITE_IMAGES['stone']);
    if (stoneSprite) { try { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(stoneSprite, 0, 0, w, h); ctx.restore(); } catch(e) {} }
    else { ctx.fillStyle = '#808080'; ctx.fillRect(5, 8, 18, 12); ctx.fillStyle = '#6b6b6b'; ctx.fillRect(7, 11, 5, 6); }
    return;
  }
  if (id === 'food' || id === 'berry' || id === 'bush') {
    ctx.fillStyle = '#7A3B1E'; ctx.fillRect(12, 6, 3, 5);
    ctx.fillStyle = '#D14A3A'; ctx.beginPath(); ctx.arc(10, 14, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(16, 14, 4, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (id === 'water') {
    ctx.fillStyle = '#2E8BFF';
    ctx.beginPath(); ctx.moveTo(14, 5); ctx.bezierCurveTo(19, 11, 21, 14, 21, 18); ctx.bezierCurveTo(21, 22, 18, 25, 14, 25); ctx.bezierCurveTo(10, 25, 7, 22, 7, 18); ctx.bezierCurveTo(7, 14, 9, 11, 14, 5); ctx.fill();
    return;
  }
  if (id === 'meat') {
    ctx.fillStyle = '#A84C3A'; ctx.fillRect(7, 10, 14, 10);
    ctx.fillStyle = '#F0E5D8'; ctx.fillRect(5, 12, 2, 6); ctx.fillRect(21, 12, 2, 6);
    return;
  }
  if (id === 'stick') {
    ctx.fillStyle = '#8B5A38'; ctx.fillRect(13, 6, 2, 16);
    return;
  }
  if (id === 'stone-axe' || id === 'axe') {
    ctx.fillStyle = '#6b6b6b'; ctx.fillRect(5, 9, 15, 6);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(15, 12, 3, 12);
    return;
  }
  if (id === 'stone-pick') {
    ctx.fillStyle = '#6b6b6b'; ctx.fillRect(5, 8, 14, 5);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(15, 11, 3, 12);
    return;
  }
  if (id === 'stone-hoe') {
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(13, 7, 2, 15);
    ctx.fillStyle = '#8f8f8f'; ctx.fillRect(8, 8, 10, 3);
    return;
  }
  if (id === 'stone-sword' || id === 'sword') {
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(6, 7, 14, 4);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(16, 11, 3, 12);
    return;
  }
  if (id === 'spear') {
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(13, 6, 2, 15);
    ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(17, 8); ctx.lineTo(11, 8); ctx.closePath(); ctx.fill();
    return;
  }
  if (id === 'club') {
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(13, 7, 2, 14);
    ctx.fillStyle = '#6b4a2f'; ctx.beginPath(); ctx.arc(14, 6, 4, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (id === 'makarov_pm') {
    // Body
    ctx.fillStyle = '#343236'; ctx.fillRect(4, 8, 18, 7);
    ctx.fillStyle = '#1a1919'; ctx.fillRect(5, 9, 16, 5);
    // Barrel tip
    ctx.fillStyle = '#0a0707'; ctx.fillRect(20, 10, 4, 3);
    // Grip
    ctx.fillStyle = '#4f2c25'; ctx.fillRect(10, 15, 8, 10);
    ctx.fillStyle = '#693e36'; ctx.fillRect(11, 16, 6, 8);
    // Trigger guard
    ctx.fillStyle = '#121111'; ctx.fillRect(8, 14, 3, 4);
    return;
  }
  if (id === 'campfire') {
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(7, 16, 14, 2); ctx.fillRect(9, 14, 10, 2);
    ctx.fillStyle = '#E67E22'; ctx.beginPath(); ctx.moveTo(14, 8); ctx.lineTo(18, 15); ctx.lineTo(10, 15); ctx.closePath(); ctx.fill();
    return;
  }
  if (id === 'furnace') {
    ctx.fillStyle = '#6f6f6f'; ctx.fillRect(6, 7, 16, 16);
    ctx.fillStyle = '#c85'; ctx.fillRect(11, 13, 6, 5);
    return;
  }
  if (id === 'beacon') {
    ctx.fillStyle = '#8B5A38'; ctx.fillRect(13, 14, 2, 10);
    ctx.fillStyle = '#FFD27A'; ctx.fillRect(11, 8, 6, 6);
    return;
  }
  if (id === 'potion') {
    ctx.fillStyle = '#9a6bd6'; ctx.fillRect(10, 10, 8, 10);
    ctx.fillStyle = '#ddd'; ctx.fillRect(12, 7, 4, 3);
    return;
  }

  ctx.fillStyle = '#666'; ctx.fillRect(6, 6, 16, 16);
}
