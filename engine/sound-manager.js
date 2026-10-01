// Sound Manager - Manages game audio using Web Audio API
// Fallback: creates simple beep sounds if no external audio available

let SoundManager = (() => {
  let isInitialized = false;
  let audioContext = null;
  const config = {
    volume: 0.6,
    muted: false,
    enableSFX: true
  };

  // Initialize audio context
  function init() {
    if (isInitialized) return;
    
    try {
      // Try to create Web Audio API context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContext = new AudioContext();
        console.log('[SoundManager] Web Audio API initialized');
      }
      try {
        if (typeof localStorage !== 'undefined') {
          const rawMaster = parseFloat(localStorage.getItem('meso.audio.master') || '');
          if (Number.isFinite(rawMaster)) config.volume = Math.max(0, Math.min(1, rawMaster / 100));
          const rawSfx = localStorage.getItem('meso.audio.sfx');
          if (rawSfx === '0' || rawSfx === 'false') config.enableSFX = false;
          else if (rawSfx === '1' || rawSfx === 'true') config.enableSFX = true;
          config.muted = config.volume <= 0 || !config.enableSFX;
        }
      } catch (e) {}
      isInitialized = true;
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not available:', e);
      isInitialized = false;
    }
  }

  // ¿Se puede sonar ahora mismo? (y contexto listo / reanudado tras un gesto)
  function ready() {
    if (!config.enableSFX || config.muted || config.volume <= 0) return false;
    try {
      if (!audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { console.warn('[SoundManager] No audio support'); return false; }
        audioContext = new AC();
      }
      if (audioContext.state === 'suspended') audioContext.resume();
      return true;
    } catch (e) { return false; }
  }

  // Un tono con envolvente (ataque corto + caída exponencial) y glissando opcional.
  function tone(freq, dur, type, vol, glide, delay) {
    try {
      const now = audioContext.currentTime + (delay || 0) / 1000;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (glide && glide !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), now + dur / 1000);
      const v = Math.max(0.0001, (vol || 0.2) * config.volume);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(v, now + Math.min(0.03, dur / 3000));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur / 1000);
      osc.start(now);
      osc.stop(now + dur / 1000 + 0.02);
    } catch (e) {}
  }

  // Ruido blanco filtrado: golpes, pasos, agua, viento, explosiones.
  function noise(dur, vol, freq, q, delay, type) {
    try {
      const now = audioContext.currentTime + (delay || 0) / 1000;
      const len = Math.max(1, Math.floor(audioContext.sampleRate * (dur / 1000)));
      const buf = audioContext.createBuffer(1, len, audioContext.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = audioContext.createBufferSource();
      src.buffer = buf;
      const filter = audioContext.createBiquadFilter();
      filter.type = type || 'lowpass';
      filter.frequency.setValueAtTime(Math.max(60, freq || 1200), now);
      if (q) filter.Q.value = q;
      const gain = audioContext.createGain();
      src.connect(filter); filter.connect(gain); gain.connect(audioContext.destination);
      const v = Math.max(0.0001, (vol || 0.2) * config.volume);
      gain.gain.setValueAtTime(v, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur / 1000);
      src.start(now);
      src.stop(now + dur / 1000 + 0.02);
    } catch (e) {}
  }

  // Compatibilidad con la versión anterior (tono simple).
  function playBeep(frequency = 800, duration = 100, volume = 0.3, waveform = 'sine') {
    if (!ready()) return;
    tone(frequency, duration, waveform, volume);
  }

  // ── CATÁLOGO DE EFECTOS ───────────────────────────────────────────────────
  // Cada sonido es una receta: lista de pasos, cada uno
  //   ['t', freq, dur, tipo, vol, glide]        → tono
  //   ['n', dur, vol, filtro, q, , tipoFiltro]  → ruido filtrado
  // y un objeto final opcional `{at: ms}` para retrasarlo. `min` es el tiempo
  // mínimo (ms) entre dos reproducciones del mismo efecto, para no ametrallar
  // cuando un suceso se dispara en cascada.
  const SFX = {
    // Interfaz
    click:       { r: [['t', 620, 45, 'triangle', 0.20], ['t', 880, 35, 'triangle', 0.10, 660, 25]], min: 40 },
    clickSoft:   { r: [['t', 420, 40, 'sine', 0.16]], min: 40 },
    hover:       { r: [['t', 900, 25, 'sine', 0.06]], min: 90 },
    open:        { r: [['t', 380, 60, 'triangle', 0.18, 620], ['t', 760, 70, 'sine', 0.12, 900, 55]], min: 120 },
    close:       { r: [['t', 620, 60, 'triangle', 0.18, 340], ['t', 300, 70, 'sine', 0.10, 200, 55]], min: 120 },
    tab:         { r: [['t', 520, 35, 'square', 0.10], ['t', 700, 35, 'square', 0.08, 700, 45]], min: 60 },
    toggle:      { r: [['t', 540, 50, 'square', 0.14, 900]], min: 80 },
    error:       { r: [['t', 220, 130, 'square', 0.22, 150], ['t', 165, 160, 'sawtooth', 0.16, 120, 90]], min: 150 },
    deny:        { r: [['t', 300, 90, 'square', 0.18, 200]], min: 150 },
    notify:      { r: [['t', 900, 90, 'sine', 0.16, 1200]], min: 150 },
    notifyBad:   { r: [['t', 380, 190, 'sine', 0.18, 240]], min: 200 },
    log:         { r: [['n', 40, 0.07, 1600]], min: 90 },
    turn:        { r: [['t', 420, 110, 'triangle', 0.16, 520], ['t', 620, 150, 'triangle', 0.14, 780, 120]], min: 400 },
    // Construcción y mundo
    build:       { r: [['n', 90, 0.30, 900, 1], ['t', 180, 120, 'triangle', 0.22, 120, 40], ['t', 340, 90, 'sine', 0.12, 260, 90]], min: 120 },
    buildComplete:{ r: [['t', 520, 100, 'triangle', 0.20], ['t', 660, 100, 'triangle', 0.18, 660, 90], ['t', 880, 180, 'sine', 0.20, 880, 190]], min: 200 },
    demolish:    { r: [['n', 260, 0.30, 520, 0.7], ['t', 140, 220, 'sawtooth', 0.14, 90, 40]], min: 150 },
    hammer:      { r: [['n', 60, 0.28, 2400, 1], ['t', 240, 70, 'square', 0.16, 140, 20]], min: 90 },
    door:        { r: [['n', 220, 0.16, 700, 3], ['t', 160, 160, 'sine', 0.10, 110, 60]], min: 200 },
    gate:        { r: [['n', 420, 0.20, 420, 2], ['t', 120, 380, 'sawtooth', 0.12, 90, 120]], min: 400 },
    // Agricultura
    till:        { r: [['n', 130, 0.26, 1300, 0.8], ['t', 220, 90, 'triangle', 0.14, 160, 40]], min: 120 },
    plant:       { r: [['n', 70, 0.14, 2000], ['t', 760, 70, 'sine', 0.12, 980, 30]], min: 100 },
    water:       { r: [['n', 260, 0.16, 2600, 0.6, 0, 'bandpass'], ['t', 640, 120, 'sine', 0.08, 520, 60]], min: 200 },
    grow:        { r: [['t', 660, 80, 'sine', 0.07, 820], ['t', 990, 90, 'sine', 0.05, 1180, 70]], min: 900 },
    harvest:     { r: [['n', 110, 0.20, 2200, 0.6], ['t', 880, 90, 'triangle', 0.16], ['t', 1180, 110, 'sine', 0.12, 1180, 70]], min: 150 },
    seed:        { r: [['t', 1100, 40, 'sine', 0.10], ['t', 1460, 45, 'sine', 0.08, 1460, 40]], min: 90 },
    // Recogida y objetos
    pickup:      { r: [['t', 700, 60, 'triangle', 0.18], ['t', 1050, 80, 'sine', 0.14, 1050, 45]], min: 80 },
    coin:        { r: [['t', 1240, 50, 'square', 0.12], ['t', 1660, 90, 'square', 0.10, 1660, 50]], min: 90 },
    equip:       { r: [['n', 80, 0.18, 1800], ['t', 520, 70, 'triangle', 0.14, 700, 30]], min: 120 },
    chest:       { r: [['n', 180, 0.20, 800, 2], ['t', 300, 150, 'triangle', 0.14, 620, 120]], min: 200 },
    drop:        { r: [['t', 320, 80, 'triangle', 0.16, 180]], min: 80 },
    // Combate y daño
    hit:         { r: [['n', 90, 0.30, 1500, 1], ['t', 200, 90, 'square', 0.20, 120, 30]], min: 70 },
    hitFlesh:    { r: [['n', 120, 0.30, 600, 1.4], ['t', 150, 110, 'sawtooth', 0.16, 90, 30]], min: 90 },
    hitTree:     { r: [['n', 110, 0.28, 900, 3], ['t', 300, 80, 'triangle', 0.16, 200, 40]], min: 90 },
    hitStone:    { r: [['n', 80, 0.26, 3200, 2], ['t', 520, 60, 'square', 0.12, 380, 20]], min: 90 },
    damage:      { r: [['t', 260, 170, 'sawtooth', 0.24, 150], ['n', 130, 0.20, 900, 1]], min: 120 },
    wound:       { r: [['t', 220, 260, 'sawtooth', 0.20, 120], ['n', 200, 0.16, 500, 1]], min: 200 },
    death:       { r: [['t', 300, 500, 'triangle', 0.24, 90], ['t', 180, 700, 'sine', 0.18, 70, 320]], min: 400 },
    heal:        { r: [['t', 620, 120, 'sine', 0.18, 780], ['t', 900, 180, 'sine', 0.16, 1100, 140]], min: 200 },
    bandage:     { r: [['n', 150, 0.16, 1400, 1], ['t', 700, 110, 'sine', 0.12, 520, 80]], min: 200 },
    gunshot:     { r: [['n', 120, 0.55, 2600, 0.8, 0, 'highpass'], ['t', 150, 90, 'square', 0.34, 60, 10]], min: 90 },
    gunreload:   { r: [['t', 520, 70, 'triangle', 0.20], ['t', 740, 45, 'triangle', 0.16, 740, 55], ['t', 640, 35, 'triangle', 0.12, 640, 105]], min: 120 },
    gunjam:      { r: [['t', 160, 110, 'square', 0.20], ['t', 110, 70, 'square', 0.14, 110, 70]], min: 150 },
    // Progreso
    xp:          { r: [['t', 880, 70, 'sine', 0.12, 1180]], min: 120 },
    levelUp:     { r: [['t', 660, 110, 'triangle', 0.20], ['t', 880, 110, 'triangle', 0.20, 880, 110], ['t', 1320, 260, 'sine', 0.22, 1320, 220]], min: 500 },
    missionStart:{ r: [['t', 520, 140, 'triangle', 0.18], ['t', 780, 200, 'sine', 0.16, 780, 150]], min: 400 },
    missionComplete:{ r: [['t', 660, 130, 'triangle', 0.20], ['t', 990, 130, 'sine', 0.18, 990, 130], ['t', 1320, 300, 'sine', 0.20, 1320, 260]], min: 500 },
    missionFail: { r: [['t', 420, 200, 'triangle', 0.20, 300], ['t', 260, 300, 'sine', 0.16, 180, 220]], min: 500 },
    quest:       { r: [['t', 1040, 90, 'sine', 0.14], ['t', 1560, 160, 'sine', 0.12, 1560, 120]], min: 400 },
    // Animales y montura
    step_grass:  { r: [['n', 70, 0.10, 1200, 1]], min: 110 },
    step_sand:   { r: [['n', 80, 0.09, 900, 0.8]], min: 110 },
    step_stone:  { r: [['n', 60, 0.11, 2400, 1]], min: 110 },
    step_wood:   { r: [['n', 90, 0.12, 700, 2]], min: 110 },
    footstep:    { r: [['n', 70, 0.10, 1100, 1]], min: 110 },
    mount:       { r: [['t', 300, 120, 'triangle', 0.18, 460], ['n', 160, 0.14, 800, 1, 60]], min: 200 },
    dismount:    { r: [['n', 150, 0.16, 700, 1], ['t', 460, 120, 'triangle', 0.14, 300, 80]], min: 200 },
    whinny:      { r: [['t', 620, 260, 'sawtooth', 0.16, 340], ['t', 480, 300, 'sawtooth', 0.12, 260, 120]], min: 600 },
    // Caballo: los aires y sus acciones (relincho largo, piafar, masticar y
    // resoplido). El relincho de `whinny` es corto (montar); `horseNeigh` es el
    // relincho largo de la acción.
    horseNeigh:  { r: [['t', 700, 300, 'sawtooth', 0.18, 300], ['t', 520, 340, 'sawtooth', 0.15, 240, 180], ['t', 420, 260, 'sawtooth', 0.10, 180, 380]], min: 900 },
    horseSnort:  { r: [['n', 220, 0.20, 700, 1.2], ['n', 180, 0.16, 500, 1.0, 120]], min: 400 },
    horsePaw:    { r: [['n', 120, 0.16, 500, 1.4], ['n', 90, 0.12, 420, 1.2, 180], ['n', 90, 0.10, 380, 1.2, 340]], min: 300 },
    horseChew:   { r: [['n', 110, 0.10, 1600, 0.8], ['n', 90, 0.08, 1400, 0.8, 150], ['n', 100, 0.07, 1200, 0.8, 290]], min: 400 },
    gallop:      { r: [['n', 90, 0.14, 380, 1.0], ['n', 80, 0.12, 340, 1.0, 150], ['n', 80, 0.11, 320, 1.0, 300], ['n', 80, 0.10, 300, 1.0, 450]], min: 300 },
    dogBark:     { r: [['t', 420, 90, 'square', 0.22, 260], ['t', 380, 70, 'square', 0.18, 240, 130]], min: 300 },
    // Ladrido grave (perro grande): más cuerpo y cola de espectro.
    dogBark2:    { r: [['t', 300, 130, 'sawtooth', 0.24, 170], ['n', 90, 0.16, 900, 1], ['t', 240, 90, 'square', 0.14, 150, 150]], min: 350 },
    dogBark3:    { r: [['t', 520, 60, 'square', 0.18, 380], ['t', 460, 55, 'square', 0.14, 340, 80], ['t', 400, 60, 'square', 0.12, 300, 150]], min: 500 },
    dogGrowl:    { r: [['t', 120, 420, 'sawtooth', 0.16, 90], ['n', 380, 0.10, 300, 2]], min: 600 },
    dogPant:     { r: [['n', 90, 0.06, 1400, 1], ['n', 110, 0.05, 1200, 1, 130]], min: 600 },
    dogWhimper:  { r: [['t', 900, 200, 'sine', 0.14, 620], ['t', 720, 240, 'sine', 0.11, 480, 130]], min: 500 },
    dogHappy:    { r: [['t', 760, 90, 'sine', 0.14, 1100], ['t', 1100, 80, 'sine', 0.11, 1400, 90], ['t', 1500, 120, 'sine', 0.08, 1700, 170]], min: 350 },
    dogSniff:    { r: [['n', 70, 0.07, 2600, 1.2], ['n', 70, 0.06, 2200, 1.2, 110], ['n', 60, 0.05, 2000, 1.2, 200]], min: 500 },
    dogHowl:     { r: [['t', 320, 520, 'sawtooth', 0.16, 420], ['t', 420, 620, 'sawtooth', 0.13, 300, 300]], min: 2000 },
    dogPet:      { r: [['t', 700, 120, 'sine', 0.14, 980], ['t', 1100, 90, 'sine', 0.10, 1300, 110]], min: 300 },
    sheep:       { r: [['t', 520, 260, 'sawtooth', 0.12, 420], ['t', 600, 200, 'sawtooth', 0.10, 480, 150]], min: 500 },
    chicken:     { r: [['t', 1400, 60, 'square', 0.10], ['t', 1000, 50, 'square', 0.08, 900, 40]], min: 300 },
    bird:        { r: [['t', 2200, 60, 'sine', 0.07, 2800], ['t', 2600, 70, 'sine', 0.06, 2100, 80]], min: 400 },
    // Comer, beber, descanso
    eat:         { r: [['n', 90, 0.18, 900, 1.4], ['n', 90, 0.14, 700, 1.4, 140]], min: 200 },
    drink:       { r: [['t', 300, 120, 'sine', 0.16, 220], ['t', 260, 140, 'sine', 0.12, 180, 150]], min: 200 },
    sleep:       { r: [['t', 400, 400, 'sine', 0.16, 220], ['t', 280, 600, 'sine', 0.12, 160, 350]], min: 800 },
    wake:        { r: [['t', 520, 200, 'sine', 0.14, 780], ['t', 880, 240, 'sine', 0.12, 1100, 200]], min: 600 },
    dayChange:   { r: [['t', 520, 180, 'triangle', 0.16], ['t', 780, 180, 'sine', 0.14, 780, 180], ['t', 1040, 320, 'sine', 0.14, 1040, 260]], min: 1000 },
    night:       { r: [['t', 440, 500, 'sine', 0.14, 300], ['t', 300, 700, 'sine', 0.10, 200, 400]], min: 1000 },
    // Interacción con el mundo
    chop:        { r: [['n', 120, 0.30, 1100, 2], ['t', 260, 110, 'triangle', 0.18, 150, 30]], min: 120 },
    mine:        { r: [['n', 90, 0.28, 2800, 2], ['t', 460, 80, 'square', 0.14, 320, 20]], min: 120 },
    splash:      { r: [['n', 260, 0.24, 1800, 0.7, 0, 'bandpass'], ['t', 520, 120, 'sine', 0.10, 340, 40]], min: 200 },
    swim:        { r: [['n', 200, 0.10, 1200, 0.6, 0, 'bandpass']], min: 400 },
    wind:        { r: [['n', 700, 0.10, 800, 0.5]], min: 3000 },
    rain:        { r: [['n', 900, 0.09, 3000, 0.4, 0, 'highpass']], min: 3000 },
    fire:        { r: [['n', 500, 0.12, 1400, 0.5]], min: 600 },
    // Estado del jugador
    hunger:      { r: [['t', 300, 200, 'sine', 0.16, 220], ['t', 220, 240, 'sine', 0.12, 170, 160]], min: 900 },
    thirst:      { r: [['t', 340, 220, 'sine', 0.14, 260]], min: 900 },
    stamina:     { r: [['t', 420, 260, 'sine', 0.12, 300]], min: 900 },
    heart:       { r: [['t', 120, 120, 'sine', 0.20], ['t', 100, 160, 'sine', 0.16, 90, 180]], min: 600 },
    save:        { r: [['t', 660, 110, 'sine', 0.14], ['t', 990, 170, 'sine', 0.12, 990, 140]], min: 400 },
    load:        { r: [['t', 990, 110, 'sine', 0.14], ['t', 660, 170, 'sine', 0.12, 660, 140]], min: 400 },
    pause:       { r: [['t', 700, 90, 'sine', 0.12, 500]], min: 200 },
    unpause:     { r: [['t', 500, 90, 'sine', 0.12, 700]], min: 200 }
  };

  // Reproduce los pasos de una receta.
  function playSteps(steps, mulVol, mulDur) {
    steps.forEach(step => {
      const last = step[step.length - 1];
      const at = (last && typeof last === 'object') ? step[step.length - 1].at : 0;
      if (step[0] === 't') {
        tone(step[1], (step[2] || 100) * (mulDur || 1), step[3], (step[4] || 0.2) * (mulVol || 1), step[5], at);
      } else {
        noise((step[1] || 100) * (mulDur || 1), (step[2] || 0.2) * (mulVol || 1), step[3], step[4], at, step[6]);
      }
    });
  }

  // Antirrepetición: evita el metralleo cuando un suceso se dispara en cascada.
  const _lastPlayed = {};
  function playSFX(soundId, options = {}) {
    if (!config.enableSFX || config.muted || config.volume <= 0) return false;
    try {
      const def = SFX[soundId];
      if (!def) {
        // Nombre antiguo o desconocido: no rompemos, suena un clic suave.
        if (soundId && !options.silent) playSFX('clickSoft', Object.assign({}, options, { silent: true }));
        return false;
      }
      const now = Date.now();
      const min = Number.isFinite(options.min) ? options.min : (def.min || 0);
      if (!options.force && min && (now - (_lastPlayed[soundId] || 0)) < min) return false;
      _lastPlayed[soundId] = now;
      if (!ready()) return false;
      playSteps(def.r.map(s => s.slice()), options.volume || 1, options.duration || 1);
      return true;
    } catch (e) {
      console.warn('[SoundManager] playSFX failed:', e);
      return false;
    }
  }

  // Set master volume
  function setVolume(vol) {
    config.volume = Math.max(0, Math.min(1, vol));
  }

  // Mute/unmute
  function setMuted(muted) {
    config.muted = !!muted;
  }

  // Enable/disable SFX
  function setSFXEnabled(enabled) {
    config.enableSFX = enabled;
  }

  return {
    init,
    resume: () => { try { if (audioContext && audioContext.state === 'suspended') audioContext.resume(); } catch (e) {} },
    playSFX,
    playSfx: playSFX,
    playBeep,
    catalog: () => Object.keys(SFX),
    has: (id) => !!SFX[id],
    stopAll: () => { try { if (audioContext) audioContext.close(); } catch (e) {} },
    setVolume,
    setMuted,
    setSFXEnabled,
    getConfig: () => config
  };
})();

// Auto-initialize when document is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { SoundManager.init(); } catch (e) {}
    });
  } else {
    try { SoundManager.init(); } catch (e) {}
  }
  // Los navegadores bloquean el audio hasta el primer gesto del usuario: aquí se
  // reanuda el contexto en cuanto llega (una vez por gesto, es barato).
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => {
    try {
      document.addEventListener(ev, () => { try { SoundManager.resume(); } catch (e) {} }, { passive: true });
    } catch (e) {}
  });
}

if (typeof window !== 'undefined') { try { window.SoundManager = SoundManager; } catch (e) {} }
