// engine/map.js
// ⚠️ PLACEHOLDER — NO IMPLEMENTADO. Nadie importa este archivo.
//
// Las funciones reales están dentro de engine/game-engine.js:
//   generateMap(), isRiver(), isNearRiver(), movementMultiplier(),
//   findNearestWalkable(), canWalkTo(), y la búsqueda de caminos del jugador.
//
// OJO: estas versiones devuelven valores falsos (isRiver → false, aStar → []).
// Si alguien las importase, el juego parecería funcionar pero sin lógica de mapa.

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
