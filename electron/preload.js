// electron/preload.js
// Reads JSON data files from disk and exposes them to the renderer process.
// This works around the fact that fetch() fails for file:// URLs in Electron/Chromium.
const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * Resolve the project root directory.
 * In dev mode (MESOBUILDER_EXTERNAL_PATH), use the external project folder.
 * In packaged mode, files are relative to the app root.
 */
function getProjectRoot() {
  const envPath = process.env.MESOBUILDER_EXTERNAL_PATH;
  if (envPath) return envPath;
  // Packaged: __dirname is electron/, go up one level
  return path.join(__dirname, '..');
}

/**
 * Safely read and parse a JSON file, returning null on any error.
 */
function readJsonFile(relativePath) {
  try {
    const fullPath = path.join(getProjectRoot(), relativePath);
    if (!fs.existsSync(fullPath)) {
      console.warn('[preload] File not found:', fullPath);
      return null;
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[preload] Error reading', relativePath, e.message);
    return null;
  }
}

// Read all JSON data files
const entityPixels = readJsonFile('data/entity-pixels.json');
const entityDefs = readJsonFile('data/entities-defs.json');
const npcDialogues = readJsonFile('data/npc-dialogues.json');

// Preload all interior JSON files so enterInterior() works without fetch()
const interiors = {};
try {
  const interiorsDir = path.join(getProjectRoot(), 'data', 'interiors');
  if (fs.existsSync(interiorsDir)) {
    const files = fs.readdirSync(interiorsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const id = file.replace(/\.json$/, '');
      interiors[id] = readJsonFile('data/interiors/' + file);
    }
  }
} catch (e) {
  console.warn('[preload] Could not preload interiors:', e.message);
}

// Expose to the renderer via contextBridge
contextBridge.exposeInMainWorld('__mesoPreload', {
  entityPixels,
  entityDefs,
  npcDialogues,
  interiors,
  // Flag so the engine knows it's running in Electron with preloaded data
  isElectron: true
});
