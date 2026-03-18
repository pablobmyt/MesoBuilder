const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

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
    autoHideMenuBar: true, // hide native Electron menu bar
    webPreferences: {
      contextIsolation: true,
      sandbox: false
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
