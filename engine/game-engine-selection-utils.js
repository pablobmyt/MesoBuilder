function _notify(msg) {
  try {
    if (typeof window.notify === 'function') {
      window.notify(msg);
      return;
    }
  } catch (e) {}
}

function _entityCollections() {
  try {
    return {
      entities: Array.isArray(window.entities) ? window.entities : [],
      rabbits: Array.isArray(window.rabbits) ? window.rabbits : [],
      foxes: Array.isArray(window.foxes) ? window.foxes : [],
      enemies: Array.isArray(window.enemies) ? window.enemies : (Array.isArray(window._ENEMIES) ? window._ENEMIES : [])
    };
  } catch (e) {
    return { entities: [], rabbits: [], foxes: [], enemies: [] };
  }
}

export function _isControllableUnit(ent) {
  try {
    if (!ent) return false;
    const id = String(ent.id || '');
    return id.startsWith('npc-') || id.startsWith('rabbit-') || id.startsWith('fox-');
  } catch (e) { return false; }
}

export function _isEntityReferenceFromCollections(ent) {
  try {
    if (!ent) return false;
    const col = _entityCollections();
    if (col.entities.includes(ent)) return true;
    if (col.rabbits.includes(ent)) return true;
    if (col.foxes.includes(ent)) return true;
    if (col.enemies.includes(ent)) return true;
    return false;
  } catch (e) { return false; }
}

export function _isSelectableEntity(ent) {
  try {
    if (!ent || typeof ent !== 'object') return false;
    if (ent.kind === 'building' || ent.nonInteractive || ent.kind === 'ambient' || ent.kind === 'pet') return false;
    return _isEntityReferenceFromCollections(ent);
  } catch (e) { return false; }
}

export function _entitySelectionKey(ent) {
  try {
    if (!ent) return 'null';
    if (ent.id) return String(ent.id);
    const kind = String(ent.kind || 'entity');
    const col = (typeof ent.col === 'number') ? ent.col : (typeof ent.x === 'number' ? Math.floor(ent.x) : -1);
    const row = (typeof ent.row === 'number') ? ent.row : (typeof ent.y === 'number' ? Math.floor(ent.y) : -1);
    return `${kind}:${col},${row}`;
  } catch (e) { return 'entity:unknown'; }
}

export function _getSelectedEntities() {
  try {
    const list = Array.isArray(window._selectedEntities) ? window._selectedEntities : [];
    const seen = new Set();
    const out = [];
    for (const ent of list) {
      if (!ent || !_isSelectableEntity(ent)) continue;
      const key = _entitySelectionKey(ent);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ent);
    }
    window._selectedEntities = out;
    return out;
  } catch (e) { return []; }
}

export function _setSelectedEntities(list, append = false) {
  try {
    const base = append ? _getSelectedEntities().slice() : [];
    const incoming = Array.isArray(list) ? list : [];
    const merged = base.concat(incoming);
    const seen = new Set();
    const out = [];
    for (const ent of merged) {
      if (!ent || !_isSelectableEntity(ent)) continue;
      const key = _entitySelectionKey(ent);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ent);
    }
    window._selectedEntities = out;
    window._selectPreviewCount = out.length;
    try { if (window.renderNPCList) window.renderNPCList(); } catch (e) {}
    return out;
  } catch (e) { return []; }
}

export function _toggleSelectedEntity(ent) {
  try {
    if (!ent || !_isSelectableEntity(ent)) return _getSelectedEntities();
    const list = _getSelectedEntities();
    const key = _entitySelectionKey(ent);
    const exists = list.some(item => _entitySelectionKey(item) === key);
    if (exists) return _setSelectedEntities(list.filter(item => _entitySelectionKey(item) !== key), false);
    return _setSelectedEntities(list.concat([ent]), false);
  } catch (e) { return _getSelectedEntities(); }
}

export function _collectSelectableEntitiesInRect(minX, minY, maxX, maxY) {
  const selected = [];
  const pushIfInside = (ent) => {
    try {
      if (!ent || !_isSelectableEntity(ent)) return;
      const ex = (typeof ent.x === 'number') ? ent.x : ent.col;
      const ey = (typeof ent.y === 'number') ? ent.y : ent.row;
      if (typeof ex !== 'number' || typeof ey !== 'number') return;
      if (ex >= minX && ex <= maxX && ey >= minY && ey <= maxY) selected.push(ent);
    } catch (e) {}
  };
  const col = _entityCollections();
  try { for (const ent of col.entities) pushIfInside(ent); } catch (e) {}
  try { for (const ent of col.rabbits) pushIfInside(ent); } catch (e) {}
  try { for (const ent of col.foxes) pushIfInside(ent); } catch (e) {}
  try { for (const ent of col.enemies) pushIfInside(ent); } catch (e) {}
  return selected;
}

export function _getSelectedNPCs() {
  try {
    return _getSelectedEntities().filter(en => String(en.id || '').startsWith('npc-'));
  } catch (e) { return []; }
}

export function _assignTaskToNPCs(npcs, actionId) {
  try {
    const arr = Array.isArray(npcs) ? npcs : [];
    let assigned = 0;
    for (const npc of arr) {
      if (!npc) continue;
      npc.task = { id: actionId, progress: 0, assignedAt: Date.now() };
      assigned++;
    }
    if (assigned > 0) {
      _notify(`Tarea ${actionId} asignada a ${assigned} aldeano(s)`);
      try { if (window.renderNPCList) window.renderNPCList(); } catch (e) {}
    }
    return assigned;
  } catch (e) { return 0; }
}

export function _issueGroupMoveCommand(tx, ty, opts = {}) {
  try {
    const units = _getSelectedEntities().filter(_isControllableUnit);
    if (!units.length) return 0;
    const radius = opts.radius || 0.75;
    const n = units.length;
    for (let i = 0; i < n; i++) {
      const ent = units[i];
      if (!ent) continue;
      const angle = (i / Math.max(1, n)) * Math.PI * 2;
      const spread = n <= 1 ? 0 : radius;
      const targetX = tx + Math.cos(angle) * spread;
      const targetY = ty + Math.sin(angle) * spread;
      ent.moveTarget = { x: targetX, y: targetY };
      try {
        if (Math.abs(targetX - ent.x) > Math.abs(targetY - ent.y)) ent.dir = (targetX < ent.x) ? 'left' : 'right';
        else ent.dir = (targetY < ent.y) ? 'up' : 'down';
      } catch (e) {}
    }
    window._unitCommandTarget = { x: tx, y: ty, until: Date.now() + 1200, color: 'rgba(80,170,255,0.95)' };
    _notify(`Orden de movimiento: ${units.length} unidad(es)`);
    return units.length;
  } catch (e) { return 0; }
}

export function _sendSelectedNPCsToGather() {
  try {
    const npcs = _getSelectedNPCs();
    if (!npcs.length) { _notify('Selecciona aldeanos para recolectar.'); return 0; }
    const resources = (Array.isArray(window.entities) ? window.entities : []).filter(ent => ent && (ent.kind === 'resource' || ent.kind === 'tree'));
    if (!resources.length) { _notify('No hay recursos cercanos disponibles.'); return 0; }
    for (const npc of npcs) {
      let nearest = null;
      let best = Infinity;
      for (const res of resources) {
        const rx = (res.x !== undefined ? res.x : (res.col + 0.5));
        const ry = (res.y !== undefined ? res.y : (res.row + 0.5));
        const dist = Math.hypot((npc.x || npc.col) - rx, (npc.y || npc.row) - ry);
        if (dist < best) { best = dist; nearest = { x: rx, y: ry }; }
      }
      if (nearest) {
        npc.moveTarget = { x: nearest.x, y: nearest.y };
        npc.task = { id: 'gather', progress: 0, assignedAt: Date.now() };
      }
    }
    try { if (window.renderNPCList) window.renderNPCList(); } catch (e) {}
    _notify(`Recolectar cercano: ${npcs.length} aldeano(s)`);
    return npcs.length;
  } catch (e) { return 0; }
}
