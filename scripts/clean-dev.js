// scripts/clean-dev.js — Clean temp files and Electron caches before dev launch
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
let cleaned = 0;

// ── 1. Clean temp_*.txt debug files in project root ──
try {
  const files = fs.readdirSync(ROOT).filter(f => /^temp_.*\.txt$/i.test(f));
  for (const f of files) {
    try { fs.unlinkSync(path.join(ROOT, f)); cleaned++; } catch (e) {}
  }
} catch (e) {}

// ── 2. Clean Electron user data (localStorage, IndexedDB, cache) ──
try {
  const electronDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'mesobuilder');
  if (fs.existsSync(electronDataDir)) {
    try {
      fs.rmSync(electronDataDir, { recursive: true, force: true });
      cleaned++;
      console.log('[clean-dev] Removed Electron user data: ' + electronDataDir);
    } catch (e) {
      console.warn('[clean-dev] Could not fully remove Electron data: ' + e.message);
      // Try individual subdirs
      const subdirs = ['Cache', 'Code Cache', 'GPUCache', 'Local Storage', 'Session Storage', 'IndexedDB', 'blob_storage'];
      for (const sub of subdirs) {
        try {
          const subPath = path.join(electronDataDir, sub);
          if (fs.existsSync(subPath)) { fs.rmSync(subPath, { recursive: true, force: true }); cleaned++; }
        } catch (e2) {}
      }
    }
  }
} catch (e) {}

// ── 3. Clean any dist artifacts from previous builds ──
try {
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true });
      cleaned++;
      console.log('[clean-dev] Removed dist directory');
    } catch (e) { console.warn('[clean-dev] Could not remove dist: ' + e.message); }
  }
} catch (e) {}

console.log('[clean-dev] Cleaned ' + cleaned + ' items. Ready for fresh launch.');
