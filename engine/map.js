// engine/map.js — map-related helpers (placeholder)
export function generateMap() {
  console.warn('engine/map.generateMap() stub — implement extraction here');
}

export function isRiver(col) {
  // placeholder; real implementation lives currently in engine/game-engine.js
  return false;
}

export function isNearRiver(col) {
  return false;
}

export function isWalkable(col, row) {
  return true;
}

export function findNearestWalkable(c, r, maxRadius = 4) {
  return { c, r };
}

export function aStar(startC, startR, goalC, goalR) {
  return [];
}
