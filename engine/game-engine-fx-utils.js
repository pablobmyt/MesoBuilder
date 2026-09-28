// engine/game-engine-fx-utils.js
// ─────────────────────────────────────────────────────────────────────────────
// PARTÍCULAS Y SACUDIDAS (feedback visual inmediato)
//
// Antes no había ninguna reacción al golpear o talar: el árbol desaparecía y
// aparecía el recurso, sin más. Aquí se generan partículas en coordenadas de
// MUNDO (se proyectan al dibujar, así que siguen a la cámara y al zoom) para:
//
//   * golpes con arma .......... chispas + polvo, y el objetivo se sacude
//   * talar un árbol ........... virutas de madera + hojas que caen
//   * romper un hierbajo ....... briznas verdes + alguna semilla
//   * recoger un recurso ....... destello corto
//   * caminar .................. pequeñas nubes de polvo del color del terreno
//
// El módulo es independiente del motor: recibe deps mínimas y no toca el mundo.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 420;
const GRAVITY_DEFAULT = 0.055;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Colores por tipo de material
const PALETTE = {
  wood: ['#8B5A2B', '#A9743C', '#6B4226', '#C89B6A'],
  leaf: ['#4A7C3F', '#6FA84E', '#8DC96A', '#3C6B33'],
  grass: ['#6FA84E', '#8DC96A', '#C9D98A', '#4A7C3F'],
  seed: ['#E8D5A3', '#DAA520', '#FFF6E0'],
  stone: ['#9A9EA3', '#BEC4CB', '#6E7075', '#D5D7DA'],
  dust: ['#C2B184', '#A89468', '#D8C9A0'],
  water: ['#5FB6E8', '#2A6FA3', '#BEE6FF'],
  spark: ['#FFD24A', '#FFF0B0', '#FF9F40'],
  blood: ['#B03A3A', '#8A2626', '#D46A6A']
};

// Color del polvo según el bioma que se pisa
const BIOME_DUST = {
  water: PALETTE.water, deep_water: PALETTE.water, riparian: ['#5E7A4A', '#7A9460', '#B9C79A'],
  alluvial: PALETTE.dust, sand: ['#D8C9A0', '#C2B184', '#E8DCB8'], steppe: ['#B8AC84', '#9A8F6A', '#D2C79E'],
  grass: ['#7FA85A', '#9AC070', '#C2D6A0'], hills: ['#A79C86', '#8E8574', '#C4BBA6'],
  saline: ['#D8D6CC', '#BFC0B8', '#EDEDE6'], marsh: ['#6A8A6A', '#84A284', '#AFC4AF'],
  forest: ['#4A6B3F', '#5E8A4C', '#8DB070'], road: ['#C2B184', '#A89468', '#D8C9A0'],
  concrete_road: ['#B9BDC4', '#9AA0A6', '#D5D9DE'], canal_road: ['#9FB4C0', '#7E97A6', '#C8D6DE']
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function createFx(deps) {
  const worldToScreen = (deps && typeof deps.worldToScreen === 'function') ? deps.worldToScreen : (c, r) => ({ x: c, y: r });
  const getTileSize = (deps && typeof deps.getTileSize === 'function') ? deps.getTileSize : () => 24;
  const getBiomeAt = (deps && typeof deps.getBiomeAt === 'function') ? deps.getBiomeAt : () => null;

  const parts = [];
  let lastNow = 0;
  // Contador acumulativo: sirve para comprobar en pruebas que un suceso genera
  // partículas aunque ya se hayan desvanecido cuando se lee el estado.
  let spawnedTotal = 0;

  // ── Partículas ────────────────────────────────────────────────────────────
  // x,y en coordenadas de mundo (mismo sistema que ent.x/ent.y).
  function spawn(x, y, opts) {
    const o = opts || {};
    if (parts.length >= MAX_PARTICLES) parts.shift();
    spawnedTotal++;
    parts.push({
      x: Number(x) || 0,
      y: Number(y) || 0,
      vx: Number(o.vx) || 0,
      vy: Number(o.vy) || 0,
      g: Number.isFinite(o.gravity) ? o.gravity : GRAVITY_DEFAULT,
      drag: Number.isFinite(o.drag) ? o.drag : 0.985,
      life: Math.max(60, Number(o.life) || 520),
      born: Date.now(),
      color: o.color || '#ffffff',
      size: Math.max(1, Number(o.size) || 1.6),
      kind: o.kind || 'dust',
      phase: Math.random() * Math.PI * 2,
      wobble: Number.isFinite(o.wobble) ? o.wobble : 0
    });
  }

  function burst(x, y, opts) {
    const o = opts || {};
    const n = Math.max(1, Math.round(Number(o.count) || 8));
    const colors = Array.isArray(o.colors) && o.colors.length ? o.colors : ['#ffffff'];
    const spread = Number.isFinite(o.spread) ? o.spread : Math.PI * 2;
    const dir = Number.isFinite(o.dir) ? o.dir : Math.random() * Math.PI * 2;
    const speed = Number.isFinite(o.speed) ? o.speed : 0.05;
    for (let i = 0; i < n; i++) {
      const ang = dir + (Math.random() - 0.5) * spread;
      const sp = speed * (0.45 + Math.random() * 0.85);
      spawn(x + (Math.random() - 0.5) * (o.jitter || 0.18), y + (Math.random() - 0.5) * (o.jitter || 0.18), {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - (o.lift || 0),
        gravity: o.gravity,
        drag: o.drag,
        life: (Number(o.life) || 520) * (0.7 + Math.random() * 0.6),
        color: pick(colors),
        size: (Number(o.size) || 1.6) * (0.7 + Math.random() * 0.6),
        kind: o.kind || 'dust',
        wobble: o.wobble
      });
    }
  }

  // ── Presets por acción ───────────────────────────────────────────────────
  // Golpe con arma: chispas y polvo hacia atrás respecto al objetivo.
  function onWeaponHit(target, opts) {
    try {
      if (!target) return;
      const o = opts || {};
      const tx = (typeof target.x === 'number' ? target.x : target.col) + 0.5;
      const ty = (typeof target.y === 'number' ? target.y : target.row) + 0.5;
      const bucket = String(o.bucket || '');
      const colors = bucket === 'enemies' || bucket === 'player' ? PALETTE.blood
        : bucket === 'rabbits' || bucket === 'foxes' ? PALETTE.blood
        : (target.kind === 'resource' ? PALETTE.stone : PALETTE.dust);
      burst(tx, ty - 0.15, { count: 7, colors, speed: 0.055, lift: 0.05, spread: Math.PI * 0.9, life: 430, size: 1.7, jitter: 0.3 });
      burst(tx, ty - 0.1, { count: 3, colors: PALETTE.spark, speed: 0.07, lift: 0.06, life: 260, size: 1.2, jitter: 0.2 });
      shake(target, { amp: 2.4, ms: 260 });
    } catch (e) {}
  }

  // Empieza el tala: el árbol tiembla y suelta unas hojas.
  function onChopStart(ent) {
    try {
      if (!ent) return;
      const x = (typeof ent.x === 'number' ? ent.x : ent.col) + 0.5;
      const y = (typeof ent.y === 'number' ? ent.y : ent.row) + 0.5;
      const isWeed = String(ent.variant || '') === 'weed' || String(ent.variant || '') === 'tallgrass';
      burst(x, y - 0.35, isWeed
        ? { count: 4, colors: PALETTE.grass, speed: 0.035, life: 420, size: 1.4, jitter: 0.25 }
        : { count: 5, colors: PALETTE.leaf, speed: 0.03, life: 900, size: 1.6, gravity: 0.02, wobble: 1, jitter: 0.5 });
      shake(ent, { amp: isWeed ? 2.5 : 1.6, ms: 200 });
    } catch (e) {}
  }

  // Termina de talar / se rompe el hierbajo: el estallido grande.
  function onChopped(ent) {
    try {
      if (!ent) return;
      const x = (typeof ent.x === 'number' ? ent.x : ent.col) + 0.5;
      const y = (typeof ent.y === 'number' ? ent.y : ent.row) + 0.5;
      const variant = String(ent.variant || 'oak');
      const isWeed = variant === 'weed' || variant === 'tallgrass';
      const isBush = variant === 'bush' || variant === 'shrub';
      if (isWeed) {
        burst(x, y - 0.2, { count: 14, colors: PALETTE.grass, speed: 0.06, lift: 0.05, life: 520, size: 1.7, jitter: 0.3 });
        burst(x, y - 0.25, { count: 3, colors: PALETTE.seed, speed: 0.05, lift: 0.08, life: 900, size: 1.3, gravity: 0.07 });
      } else if (isBush) {
        burst(x, y - 0.3, { count: 12, colors: PALETTE.grass.concat(PALETTE.leaf), speed: 0.055, life: 700, size: 1.6, gravity: 0.03, wobble: 1, jitter: 0.4 });
      } else {
        // Árbol: virutas al tronco y hojas que caen desde la copa
        burst(x, y - 0.25, { count: 12, colors: PALETTE.wood, speed: 0.075, lift: 0.06, life: 620, size: 1.9, jitter: 0.22 });
        burst(x, y - 0.9, { count: 16, colors: PALETTE.leaf, speed: 0.05, life: 1100, size: 1.7, gravity: 0.03, wobble: 1.4, jitter: 0.7 });
      }
      // Nube de polvo en la base
      burst(x, y + 0.1, { count: 8, colors: PALETTE.dust, speed: 0.03, life: 700, size: 2.2, gravity: 0.012, jitter: 0.35 });
    } catch (e) {}
  }

  // Recoger un recurso del suelo.
  function onPickup(ent) {
    try {
      if (!ent) return;
      const x = (typeof ent.x === 'number' ? ent.x : ent.col) + 0.5;
      const y = (typeof ent.y === 'number' ? ent.y : ent.row) + 0.5;
      const sub = String(ent.subtype || '');
      const colors = sub === 'stone' ? PALETTE.stone : sub === 'wood' ? PALETTE.wood
        : sub === 'seed' || sub === 'wheat' || sub === 'food' ? PALETTE.seed : PALETTE.dust;
      burst(x, y - 0.15, { count: 5, colors, speed: 0.03, lift: 0.06, life: 380, size: 1.3, gravity: 0.02 });
    } catch (e) {}
  }

  // Pisada: nube de polvo del color del terreno.
  function onFootstep(col, row, opts) {
    try {
      const o = opts || {};
      const biome = o.biome || getBiomeAt(Math.floor(col), Math.floor(row));
      const colors = BIOME_DUST[biome] || PALETTE.dust;
      burst(col + (o.offsetX || 0), row + 0.28, {
        count: o.sprint ? 4 : 2,
        colors,
        speed: o.sprint ? 0.03 : 0.018,
        life: o.sprint ? 460 : 380,
        size: o.sprint ? 1.9 : 1.5,
        gravity: 0.008,
        jitter: 0.12
      });
    } catch (e) {}
  }

  // ── Sacudida de entidades ────────────────────────────────────────────────
  function shake(ent, opts) {
    try {
      if (!ent) return;
      const o = opts || {};
      const amp = Number.isFinite(o.amp) ? o.amp : 2;
      const ms = Math.max(60, Number(o.ms) || 220);
      ent._fxShake = { born: Date.now(), ms, amp };
    } catch (e) {}
  }

  // Desplazamiento (en píxeles de pantalla) de una entidad sacudida.
  function shakeOffset(ent, now) {
    try {
      const s = ent && ent._fxShake;
      if (!s) return null;
      const t = (now - s.born) / s.ms;
      if (t >= 1 || t < 0) { ent._fxShake = null; return null; }
      const decay = 1 - t;
      // vaivén rápido y amortiguado: lee como un golpe, no como un temblor
      const w = Math.sin(t * Math.PI * 6.5) * s.amp * decay * decay;
      return { x: Math.round(w), y: Math.round(-Math.abs(w) * 0.35) };
    } catch (e) { return null; }
  }

  // ── Bucle ────────────────────────────────────────────────────────────────
  function update(now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const dt = lastNow ? clamp((t - lastNow) / 16.667, 0.25, 3) : 1;   // pasos de ~1 fotograma
    lastNow = t;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (t - p.born >= p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt);
      p.vy *= Math.pow(p.drag, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.wobble) {
        p.phase += 0.22 * dt;
        p.x += Math.sin(p.phase) * 0.012 * p.wobble * dt;
      }
    }
  }

  function draw(ctx, W, H) {
    if (!ctx || !parts.length) return;
    const tile = getTileSize();
    const now = Date.now();
    ctx.save();
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const t = Math.min(1, (now - p.born) / p.life);
      let sc;
      try { sc = worldToScreen(p.x, p.y); } catch (e) { continue; }
      if (!sc) continue;
      if (sc.x < -32 || sc.x > (W + 32) || sc.y < -32 || sc.y > (H + 32)) continue;
      const alpha = Math.max(0, 1 - t * t);
      const size = Math.max(1, p.size * (1 - t * 0.45) * clamp(tile / 24, 0.6, 2.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'dust') {
        ctx.beginPath();
        ctx.arc(Math.round(sc.x), Math.round(sc.y), Math.max(1, size * 0.9), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // virutas, hojas y briznas: rectángulos cortos que giran al caer
        const w = Math.max(1, Math.round(size));
        const h = Math.max(1, Math.round(size * (p.kind === 'leaf' ? 0.6 : 0.85)));
        ctx.fillRect(Math.round(sc.x - w / 2), Math.round(sc.y - h / 2), w, h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function clear() { parts.length = 0; }

  return {
    spawn, burst, update, draw, clear,
    shake, shakeOffset,
    onWeaponHit, onChopStart, onChopped, onPickup, onFootstep,
    get count() { return parts.length; },
    get spawnedTotal() { return spawnedTotal; },
    palette: PALETTE
  };
}
