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

  // Create and play a simple beep tone using Web Audio API
  function playBeep(frequency = 800, duration = 100, volume = 0.3, waveform = 'sine') {
    if (!config.enableSFX || config.muted || config.volume <= 0) return;
    
    try {
      if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          console.warn('[SoundManager] No audio support');
          return;
        }
        audioContext = new AudioContext();
      }

      // Browsers suspend AudioContext until a user gesture — resume if needed
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = frequency;
      osc.type = waveform || 'sine';
      
      gain.gain.setValueAtTime(volume * config.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);
      
      osc.start(now);
      osc.stop(now + duration / 1000);
    } catch (e) {
      console.warn('[SoundManager] Beep failed:', e);
    }
  }

  // Play a sound effect (using beep patterns)
  function playSFX(soundId, options = {}) {
    if (!config.enableSFX) return;
    
    const patterns = {
      build: { freq: 523, duration: 80, vol: 0.4 },           // C5
      buildComplete: { freq: 659, duration: 120, vol: 0.5 },  // E5
      click: { freq: 400, duration: 50, vol: 0.25 },           // G3
      error: { freq: 200, duration: 150, vol: 0.4 },           // G3 low
      missionComplete: { freq: 784, duration: 200, vol: 0.6 }, // G5 - two tone
      levelUp: { freq: 880, duration: 100, vol: 0.5 },         // A5
      footstep: { freq: 150, duration: 40, vol: 0.2 },         // Low
      damage: { freq: 300, duration: 100, vol: 0.35 },         // D4
      heal: { freq: 659, duration: 120, vol: 0.4 },            // E5
      pickup: { freq: 600, duration: 80, vol: 0.35 },          // B4
      gunshot: { freq: 180, duration: 90, vol: 0.55 },         // layered shot
      gunreload: { freq: 520, duration: 120, vol: 0.35 },      // magazine reload
      gunjam: { freq: 120, duration: 180, vol: 0.3 }           // dry-click / jam
    };
    
    const pattern = patterns[soundId] || patterns.click;
    
    // For mission complete, play two tones
    if (soundId === 'missionComplete') {
      playBeep(pattern.freq, pattern.duration, pattern.vol);
      setTimeout(() => playBeep(pattern.freq + 100, pattern.duration, pattern.vol * 0.8), 120);
    } else if (soundId === 'gunshot') {
      const mulVol = options.volume || 1;
      const mulDur = options.duration || 1;
      playBeep(180, 55 * mulDur, pattern.vol * 1.1 * mulVol, 'square');
      setTimeout(() => playBeep(110, 90 * mulDur, pattern.vol * 0.7 * mulVol, 'sawtooth'), 12);
      setTimeout(() => playBeep(260, 35 * mulDur, pattern.vol * 0.35 * mulVol, 'triangle'), 26);
    } else if (soundId === 'gunreload') {
      playBeep(520, 70, 0.25, 'triangle');
      setTimeout(() => playBeep(740, 45, 0.18, 'triangle'), 55);
      setTimeout(() => playBeep(640, 35, 0.12, 'triangle'), 105);
    } else if (soundId === 'gunjam') {
      playBeep(160, 110, 0.22, 'square');
      setTimeout(() => playBeep(110, 70, 0.16, 'square'), 70);
    } else {
      playBeep(pattern.freq, pattern.duration * (options.duration || 1), pattern.vol * (options.volume || 1));
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
    playSFX,
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
}
