const { app, BrowserWindow, Menu, globalShortcut, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Chromium GPU / rendering switches ──────────────────────────────
// Conservative GPU tuning for Electron game canvas.
// Previous aggressive switches (disable-software-rasterizer, enable-zero-copy)
// were causing silent canvas drawImage failures on many systems.
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// Only use zero-copy if available; don't force it as it can break on some drivers
// app.commandLine.appendSwitch('enable-zero-copy')
// DO NOT disable software rasterizer — it's the fallback that saves us when GPU ops fail

// ── Custom protocol: meso-local:// → serves local project files ─────
// This allows fetch() to work in the renderer even from file:// origin,
// providing a fallback when preload fails or data isn't preloaded.
let _projectRoot = null;
function resolveProjectRoot() {
  if (_projectRoot) return _projectRoot;
  const envPath = process.env.MESOBUILDER_EXTERNAL_PATH;
  if (envPath && fs.existsSync(path.join(envPath, 'index.html'))) {
    _projectRoot = envPath;
    return _projectRoot;
  }
  // Try cwd, then electron app root
  for (const candidate of [process.cwd(), path.join(__dirname, '..')]) {
    try { if (fs.existsSync(path.join(candidate, 'index.html'))) { _projectRoot = candidate; return _projectRoot; } } catch (e) {}
  }
  _projectRoot = process.cwd();
  return _projectRoot;
}

function registerLocalProtocol() {
  try {
    protocol.handle('meso-local', (request) => {
      try {
        const url = new URL(request.url);
        // Remove leading slash to get relative path
        let filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if (!filePath) filePath = 'index.html';
        const fullPath = path.join(resolveProjectRoot(), filePath);
        console.log('[meso-local] serving:', filePath, '→', fullPath);
        return net.fetch('file:///' + fullPath.replace(/\\/g, '/'));
      } catch (e) {
        console.warn('[meso-local] error:', e.message);
        return new Response('Not found', { status: 404 });
      }
    });
    console.log('[meso-local] Custom protocol registered: meso-local://');
  } catch (e) {
    console.warn('[meso-local] Failed to register custom protocol:', e.message);
  }
}

function findExternalIndex() {
  // Priority: environment variable MESOBUILDER_EXTERNAL_PATH
  const envPath = process.env.MESOBUILDER_EXTERNAL_PATH
  if (envPath) {
    const candidate = path.join(envPath, 'index.html')
    if (fs.existsSync(candidate)) return candidate
  }

  // Common candidate locations relative to current working directory or exec path
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), '..', 'index.html'),
    path.join(process.execPath, '..', '..', 'index.html')
  ]
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c } catch (e) {}
  }
  return null
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,                // frameless / borderless window
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),  // inject JSON data for file:// compatibility
      nodeIntegration: false,    // security & performance
      contextIsolation: true,    // isolate renderer context (required for contextBridge)
      sandbox: false,
      backgroundThrottling: false // prevent slowdown when app loses focus (important for games)
    }
  })

  // Remove the native menu bar entirely
  Menu.setApplicationMenu(null)

  // Start maximized so the game fills the screen
  win.maximize()

  // Prefer an external index.html when available (so packaged app can reference project files)
  const external = findExternalIndex()
  if (external) {
    console.log('Loading external index.html from', external)
    win.loadFile(external)
  } else {
    const indexPath = path.join(__dirname, '..', 'index.html')
    console.log('Loading bundled index.html from', indexPath)
    win.loadFile(indexPath)
  }

  // Register Alt+F4 / Cmd+Q as a safe quit shortcut for frameless window
  try {
    globalShortcut.register('Alt+F4', () => { app.quit() })
  } catch (e) {}

  if (process.env.MESOBUILDER_DEBUG) {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {})

  // Register custom protocol BEFORE app is ready (required by Electron)
  registerLocalProtocol();

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
