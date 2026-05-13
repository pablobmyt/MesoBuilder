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
      isInitialized = true;
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not available:', e);
      isInitialized = false;
    }
  }

  // Create and play a simple beep tone using Web Audio API
  function playBeep(frequency = 800, duration = 100, volume = 0.3) {
    if (!config.enableSFX) return;
    
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
      osc.type = 'sine';
      
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
      pickup: { freq: 600, duration: 80, vol: 0.35 }           // B4
    };
    
    const pattern = patterns[soundId] || patterns.click;
    
    // For mission complete, play two tones
    if (soundId === 'missionComplete') {
      playBeep(pattern.freq, pattern.duration, pattern.vol);
      setTimeout(() => playBeep(pattern.freq + 100, pattern.duration, pattern.vol * 0.8), 120);
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
    config.muted = muted;
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
