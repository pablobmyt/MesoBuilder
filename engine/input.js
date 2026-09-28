// engine/input.js
// ⚠️ PLACEHOLDER — NO IMPLEMENTADO. Nadie importa este archivo.
//
// El input real está dentro de engine/game-engine.js:
//   getCanvasPointerPosition() + canvas.addEventListener('mousemove' | 'mousedown'
//   | 'mouseup' | 'wheel' | 'contextmenu' | 'pointerdown')
//   document.addEventListener('keydown' | 'keyup' | 'mouseup')
//
// No llames a estas funciones: no hacen nada útil.

export function setupInput(canvas, handlers = {}) {
  console.warn('engine/input.setupInput() stub — wire canvas events here');
  // handlers: { onClick, onRightClick, onPan, onZoom }
}

export function setEditMode(flag) {
  console.warn('engine/input.setEditMode() stub — update input mode');
}
