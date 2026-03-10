// engine/ui.js — UI helpers (placeholder)
export function updateUI() {
  console.warn('engine/ui.updateUI() stub');
}

export function notify(msg) {
  const el = document.getElementById && document.getElementById('notif');
  if (el) el.textContent = msg;
  console.warn('engine/ui.notify:', msg);
}
