// engine/entities.js — entities and NPCs
export const entities = [];
export const rabbits = [];
export const foxes = [];

// NPC dialogue configuration (type -> { phrases: [], mood?: string })
window.NPC_DIALOGUES = window.NPC_DIALOGUES || {};
window.loadNpcDialogues = function(obj) { try { Object.assign(window.NPC_DIALOGUES, obj || {}); console.debug('NPC dialogues loaded', Object.keys(window.NPC_DIALOGUES)); } catch(e) {} };

export function placeResource(col, row, type) {
  entities.push({ id: 'res-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), kind: 'resource', subtype: type, col, row, _born: Date.now(), _dropSeed: Math.random() });
}

export function placeStone(col, row) {
  // convenience wrapper for stone resources
  try {
    placeResource(col, row, 'stone');
  } catch (err) { /* ignore */ }
}
export function placeTree(col, row, variant) {
  // Mesopotamian flora types (primary) + legacy types for backward compat
  const types = [
    'date_palm','reed_cluster','gallery_tree','tamarisk','euphrates_poplar',
    'steppe_shrub','barley','typha','scrub','bush','shrub','tallgrass'
  ];
  const chosen = variant || types[Math.floor(Math.random() * types.length)];
  const id = 'tree-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
  // Render size hints (tile-relative)
  let size = 1.0;
  if (chosen === 'date_palm') size = 2.2;
  else if (chosen === 'reed_cluster') size = 1.6;
  else if (chosen === 'gallery_tree') size = 1.9;
  else if (chosen === 'tamarisk') size = 1.8;
  else if (chosen === 'euphrates_poplar') size = 2.4;
  else if (chosen === 'steppe_shrub') size = 1.1;
  else if (chosen === 'barley') size = 0.9;
  else if (chosen === 'typha') size = 1.3;
  else if (chosen === 'tallgrass' || chosen === 'weed') size = 0.6;
  else if (chosen === 'shrub') size = 1.4;
  else if (chosen === 'bush') size = 1.6;
  entities.push({ id, kind: 'tree', col, row, variant: chosen, hp: 10, size });
}

export function placeRabbit(col, row) {
  const now = Date.now();
  // give rabbits HP and small attributes for richer behaviour
  rabbits.push({
    id: 'rabbit-' + Date.now() + '-' + Math.random().toString(36).slice(2,4),
    col, row,
    x: col, y: row,
    t: now,
    nextMove: now + 1000 + Math.floor(Math.random()*3500),
    hp: 6,
    maxHp: 6,
    speed: 1.0,
    // smaller default size (tiles) so rabbits look less huge on the map
    size: 0.45
  });
}

export function placeFox(col, row) {
  const now = Date.now();
  // small wild fox — a bit faster and slightly larger than rabbits
  foxes.push({
    id: 'fox-' + Date.now() + '-' + Math.random().toString(36).slice(2,4),
    col, row,
    x: col, y: row,
    t: now,
    nextMove: now + 800 + Math.floor(Math.random()*3000),
    hp: 10,
    maxHp: 10,
    speed: 1.4,
    // slightly reduced size for foxes
    size: 0.7
  });
}

export function tickEntities(now) {
  // NPC roaming inside villages and periodic chatter
  try {
    if (!window._VILLAGES || window._VILLAGES.length === 0) return;
    for (let i = entities.length - 1; i >= 0; i--) {
      const en = entities[i];
      if (!en || en.kind !== 'player' || !en.id || en.id.indexOf('npc-') !== 0) continue;
      // ensure NPC movement timers
      if (!en.nextMove) en.nextMove = now + 1000 + Math.floor(Math.random() * 4000);
      if (now >= en.nextMove) {
        en.nextMove = now + 1500 + Math.floor(Math.random() * 5000);
        // pick a small random step but keep inside village bounds if assigned
        let minC = 0, maxC = COLS-1, minR = 0, maxR = ROWS-1;
        if (en.villageId && window._VILLAGES) {
          const v = window._VILLAGES.find(x => x.id === en.villageId);
          if (v) { minC = v.minC; maxC = v.maxC; minR = v.minR; maxR = v.maxR; }
        }
        // try a few random steps
        for (let t = 0; t < 6; t++) {
          const dcol = Math.floor(Math.random() * 3) - 1;
          const drow = Math.floor(Math.random() * 3) - 1;
          const nc = en.col + dcol;
          const nr = en.row + drow;
          if (nc >= minC && nc <= maxC && nr >= minR && nr <= maxR && nc >= 0 && nr >= 0 && nc < COLS && nr < ROWS && !grid[nr][nc] && !isRiver(nc)) {
            // set a smooth move target instead of teleporting
            try { en.moveTarget = { x: nc + 0.5, y: nr + 0.5 }; } catch (e) { en.col = nc; en.row = nr; }
            break;
          }
        }
        // occasional speech
        if (Math.random() < 0.12) {
          try {
            const dlgType = en.npcType || 'villager';
            const cfg = window.NPC_DIALOGUES[dlgType] || null;
            if (cfg && Array.isArray(cfg.phrases) && cfg.phrases.length > 0) {
              const ph = cfg.phrases[Math.floor(Math.random() * cfg.phrases.length)];
              // floating text near NPC
              if (window.spawnFloatingText) window.spawnFloatingText(en.col + 0.5, en.row - 0.1, ph, '#FFF');
              else if (window.floatingTexts) window.floatingTexts.push({ born: now, life: 2600, x: 0, y: 0, yv: -0.3, color: '#FFF', text: ph, col: en.col, row: en.row });
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

export function spawnNPC(name, col, row) {
  const npc = { id: 'npc-' + Date.now() + '-' + Math.random().toString(36).slice(2,4), kind: 'player', name: name || 'Habitante', col, row, hp: 40, maxHp: 40, npcType: 'villager' };
  // copy player-like appearance when possible
  try { npc.palette = (window.player && window.player.palette) ? window.player.palette : null; } catch (e) { npc.palette = null; }
  try { npc.presetId = (window.player && window.player.presetId) ? window.player.presetId : 'villager'; } catch (e) { npc.presetId = 'villager'; }
  // allow village assignment
  try { if (window._LAST_VILLAGE_ID) npc.villageId = window._LAST_VILLAGE_ID; } catch (e) {}
  // continuous position for smoother movement
  npc.x = col; npc.y = row;
  // give random appearance so villagers look different
  try { randomizeNpcAppearance(npc); } catch (e) {}
  entities.push(npc);
  return npc;
}

// helper to randomize NPC appearance (palettes/presets)
export function randomizeNpcAppearance(npc) {
  try {
    if (!npc) return;
    // simple set of palette tints for variety
    const palettes = [
      { skin:'#d3a57a', hair:'#2b170b', cloth:'#7a2e1c', trim:'#d4b76a' },
      { skin:'#f0d2b4', hair:'#4b2f1a', cloth:'#3a6f3a', trim:'#f0e3b2' },
      { skin:'#c69066', hair:'#1f1f1f', cloth:'#2b5f7a', trim:'#d9c48f' },
      { skin:'#e6c9a3', hair:'#6b3f1f', cloth:'#7a3a2a', trim:'#ffe6a3' }
    ];
    const presets = ['villager','villager2','merchant','guard'];
    const idx = Math.floor(Math.random() * palettes.length);
    npc.palette = palettes[idx];
    npc.presetId = presets[Math.floor(Math.random() * presets.length)];
  } catch (e) {}
}
