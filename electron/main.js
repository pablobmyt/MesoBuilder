const { app, BrowserWindow, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Chromium GPU / rendering switches ──────────────────────────────
// Force GPU acceleration even on hardware that Chromium would blacklist.
// This fixes missing sprites (NPCs, trees, weeds, etc.) in Electron.
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-software-rasterizer')

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
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
