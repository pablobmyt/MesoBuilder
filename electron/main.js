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
// Este permite que fetch() funcione en el renderer incluso desde file:// origin,
// proporcionando un respaldo cuando el preload falla o no tiene los datos.
//
// IMPORTANTE (dos pasos obligatorios):
//   1) registerSchemesAsPrivileged() DEBE llamarse antes de app.whenReady(),
//      si no, el renderer no puede usar el esquema con fetch()
//      ("URL scheme \"meso-local\" is not supported").
//   2) protocol.handle() debe llamarse DESPUÉS de app.whenReady() para tener sesión.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'meso-local',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

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
    protocol.handle('meso-local', async (request) => {
      try {
        const url = new URL(request.url);
        // Con esquemas "standard" el primer segmento se interpreta como host:
        // meso-local://data/entity-pixels.json → host='data', pathname='/entity-pixels.json'.
        // Si el esquema se tratara como opaco, host='' y pathname='//data/...'.
        // Esta construcción funciona en ambos casos.
        let filePath = decodeURIComponent((url.host || '') + url.pathname).replace(/^\/+/, '');
        if (!filePath) filePath = 'index.html';
        const raiz = resolveProjectRoot();
        const fullPath = path.join(raiz, filePath);
        // Sin esta comprobación, un fichero que no existe (p. ej. una hoja de sprites
        // que falta) hacía que `net.fetch` reventara con ERR_FILE_NOT_FOUND y ensuciara
        // la consola con un error en vez de un 404 normal. Es un 404 y ya está.
        if (!fullPath.startsWith(raiz) || !fs.existsSync(fullPath)) {
          console.warn('[meso-local] no existe en el proyecto:', filePath);
          return new Response('Not found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
          });
        }
        console.log('[meso-local] serving:', filePath, '→', fullPath);
        const res = await net.fetch('file:///' + fullPath.replace(/\\/g, '/'));
        // CABECERAS CORS, imprescindibles: el motor carga las hojas de sprites con
        // `img.crossOrigin = 'anonymous'` (para poder leer los píxeles con
        // getImageData y recortar las vistas del editor de entidades). Sin
        // `Access-Control-Allow-Origin` la imagen no carga (o el lienzo queda
        // «tainted» y getImageData lanza), así que en Electron NO se veía nada del
        // arte nuevo: ni los árboles del PNG, ni las vistas recortadas. En el
        // navegador no pasaba porque allí las hojas se sirven por http normal.
        const cabeceras = new Headers(res.headers);
        cabeceras.set('Access-Control-Allow-Origin', '*');
        cabeceras.set('Cross-Origin-Resource-Policy', 'cross-origin');
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers: cabeceras });
      } catch (e) {
        console.warn('[meso-local] error:', e.message);
        return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
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

  app.whenReady().then(() => {
    // El protocolo debe registrarse DESPUÉS de que la app esté lista:
    // protocol.handle() necesita una sesión válida (antes fallaba con
    // "Session can only be received when app is ready" y el fallback
    // meso-local:// nunca quedaba disponible).
    registerLocalProtocol();
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
