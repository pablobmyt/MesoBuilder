// Lightweight spatial grid for fast entity queries and simple culling
(function(){
  const SceneManager = {
    _grid: Object.create(null),
    _cellSize: 1.0, // in world tiles
    _builtForCount: -1,
    _lastRebuildAt: 0,
    _rebuildCooldownMs: 160,
    init(cellSize) { this._cellSize = Math.max(0.5, cellSize || 1.0); this._grid = Object.create(null); this._builtForCount = -1; this._lastRebuildAt = 0; },
    ensureInit(cellSize) { try { const cs = Math.max(0.5, cellSize || this._cellSize); if (Math.abs(cs - this._cellSize) > 0.0001) { this._cellSize = cs; this._grid = Object.create(null); this._builtForCount = -1; this._lastSampleHash = 0; } } catch (e) {} },
    _lastSampleHash: 0,
    _keyFor(col, row) { return col + ',' + row; },
    ensureBuilt(entities, opts) {
      opts = opts || {};
      try {
        const now = Date.now();
        const len = Array.isArray(entities) ? entities.length : 0;
        // quick sample-based hash to detect movement/position changes without scanning all entities
        let sampleHash = 0;
        if (len > 0) {
          const maxSamples = 48;
          const step = Math.max(1, Math.floor(len / maxSamples));
          for (let i = 0; i < len; i += step) {
            const ent = entities[i]; if (!ent) continue;
            const x = Math.floor(((typeof ent.x === 'number') ? ent.x : (typeof ent.col === 'number' ? ent.col : 0)) * 100);
            const y = Math.floor(((typeof ent.y === 'number') ? ent.y : (typeof ent.row === 'number' ? ent.row : 0)) * 100);
            // simple mixing
            sampleHash = (sampleHash * 31 + x) ^ (y * 13);
            sampleHash = sampleHash >>> 0;
          }
        }
        // rebuild if counts differ or sampled positions changed
        const needsRebuild = (this._builtForCount !== len) || (this._lastSampleHash !== sampleHash) || opts.force;
        if (!needsRebuild) return;
        // throttle rebuilds when entity count is fluctuating rapidly
        if (!opts.force && (now - this._lastRebuildAt) < this._rebuildCooldownMs) return;
        this.rebuild(entities || []);
        this._lastRebuildAt = now;
        this._lastSampleHash = sampleHash;
      } catch (e) { this._grid = Object.create(null); this._builtForCount = -1; }
    },
    rebuild(entities) {
      this._grid = Object.create(null);
      for (let i = 0; i < entities.length; i++) {
        const ent = entities[i];
        if (!ent) continue;
        const x = (typeof ent.x === 'number') ? ent.x : (typeof ent.col === 'number' ? ent.col : null);
        const y = (typeof ent.y === 'number') ? ent.y : (typeof ent.row === 'number' ? ent.row : null);
        if (x === null || y === null) continue;
        const gx = Math.floor(x / this._cellSize);
        const gy = Math.floor(y / this._cellSize);
        const key = this._keyFor(gx, gy);
        let set = this._grid[key]; if (!set) { set = []; this._grid[key] = set; }
        set.push(ent);
      }
      this._builtForCount = entities.length;
    },
    _collectNeighborhood(col, row, radius) {
      const out = [];
      for (let ry = row - radius; ry <= row + radius; ry++) {
        for (let cx = col - radius; cx <= col + radius; cx++) {
          const s = this._grid[this._keyFor(cx, ry)]; if (!s) continue;
          for (let i = 0; i < s.length; i++) out.push(s[i]);
        }
      }
      return out;
    },
    queryNearby(x, y, radiusTiles) {
      try {
        const gx = Math.floor(x / this._cellSize);
        const gy = Math.floor(y / this._cellSize);
        const rad = Math.max(0, Math.ceil((radiusTiles || 1) / Math.max(1, this._cellSize)));
        const list = this._collectNeighborhood(gx, gy, rad);
        return list;
      } catch (e) { return []; }
    },
    // find top-most candidate at point using a small search radius; callback used by engine
    findAtPoint(x,y, opts) {
      opts = opts || {};
      const radius = opts.radius || 0.8;
      const cand = this.queryNearby(x, y, Math.max(1, Math.ceil(radius)));
      if (!cand || cand.length === 0) return null;
      // evaluate distance and return closest within threshold (prefer later items)
      let best = null; let bestD = Infinity;
      for (let i = 0; i < cand.length; i++) {
        const ent = cand[i]; if (!ent) continue;
        const ex = (typeof ent.x === 'number') ? ent.x : (typeof ent.col === 'number' ? (ent.col + 0.5) : null);
        const ey = (typeof ent.y === 'number') ? ent.y : (typeof ent.row === 'number' ? (ent.row + 0.5) : null);
        if (ex === null || ey === null) continue;
        const dx = ex - x, dy = ey - y; const d = Math.hypot(dx, dy);
        const sizeFactor = Math.max(0.6, (ent.size || 1));
        if (d < (0.6 * sizeFactor) && d < bestD) { best = ent; bestD = d; }
      }
      return best;
    }
  };
  // expose globally so legacy code can call without changing many files
  try { window.SceneManager = SceneManager; } catch (e) { /* ignore */ }
})();
