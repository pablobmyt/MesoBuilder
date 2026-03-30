// Simple Event Manager for hybrid city-builder / survival events
// Exposes init(), tick(dt), and triggerEvent(name, payload)

let _lastTick = 0;
let _acc = 0;
let _nextIn = 20; // seconds until next random event

const POSSIBLE_EVENTS = [
  { id: 'drought', title: 'Sequía', desc: 'Una sequía reduce la producción de cultivos por unos días.', impact: { resource: 'wheat', factor: 0.6, duration: 30 } },
  { id: 'locusts', title: 'Langostas', desc: 'Langostas devoran parte de la cosecha local.', impact: { resource: 'wheat', amount: 10 } },
  { id: 'raiders', title: 'Saqueadores', desc: 'Bandidos atacan los almacenes; pérdidas materiales.', impact: { resource: 'brick', amount: 8 } },
  { id: 'festival', title: 'Festival', desc: 'La ciudad celebra: felicidad y poblaci\u00f3n crece ligeramente.', impact: { population: 2 } }
];

function randInt(max) { return Math.floor(Math.random() * max); }

const EventManager = {
  init() {
    _lastTick = performance.now();
    _acc = 0;
    _nextIn = 18 + Math.random() * 18; // 18-36s
    if (window && typeof window.__eventManagerInit === 'function') window.__eventManagerInit();
  },
  tick(dtSeconds) {
    _acc += dtSeconds;
    if (_acc >= _nextIn) {
      _acc = 0;
      _nextIn = 20 + Math.random() * 30;
      const ev = POSSIBLE_EVENTS[randInt(POSSIBLE_EVENTS.length)];
      try { this.triggerEvent(ev.id, ev); } catch (e) { console.warn('EventManager trigger failed', e); }
    }
  },
  triggerEvent(name, payload) {
    const ev = payload || POSSIBLE_EVENTS.find(e => e.id === name);
    if (!ev) return;
    // Broadcast to game via window so engine/UI can respond
    if (typeof window !== 'undefined') {
      try {
        const msg = { type: 'game-event', event: ev, time: Date.now() };
        window.dispatchEvent(new CustomEvent('meso:game-event', { detail: msg }));
      } catch (e) { console.warn('EventManager dispatch failed', e); }
    }
  }
};

export default EventManager;
