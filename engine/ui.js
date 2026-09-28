// engine/ui.js
// ⚠️ PLACEHOLDER — NO IMPLEMENTADO. Nadie importa este archivo.
//
// La UI real está dentro de engine/game-engine.js:
//   updateUI(), notify(), renderActionList(), updateInventory(), createCraftingPanel(),
//   createTimeControlWidget(), más los paneles flotantes de index.html y styles.css.

export function updateUI() {
  console.warn('engine/ui.updateUI() stub');
}

export function notify(msg) {
  const el = document.getElementById && document.getElementById('notif');
  if (el) el.textContent = msg;
  console.warn('engine/ui.notify:', msg);
}
