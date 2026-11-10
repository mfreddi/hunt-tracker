import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import os from 'os'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { HuntTracker } from './HuntTracker'
import { KillStreakAlerts } from './hunt/KillStreakAlerts'
import { startOverlayServer, type OverlayServer } from './overlayServer/server'

// The app: one window with the settings, plus the overlay server on :1040 that feeds the OBS browser
// sources and the app's own live state (the window listens on the same websocket).

const OVERLAY_PORT = 1040

/** A bundled resource: ('overlay', 'hunt.html'). Packaged next to the exe, in dev under resources/. */
const resource = (...parts: string[]): string =>
  is.dev ? join(__dirname, '../../resources', ...parts) : join(process.resourcesPath, ...parts)

const store = new Store({ name: 'hunt-tracker' })

let mainWindow: BrowserWindow | null = null
let server: OverlayServer | null = null

/** Send a message to every connected overlay page (and to the settings window, which shares the socket). */
const broadcast = (msg: any): void => {
  if (!server) return
  const text = JSON.stringify(msg)
  server.wss.clients.forEach((c: any) => {
    if (c.readyState === 1) c.send(text)
  })
}

/** Is the named overlay page open (in OBS or shown in a browser)? A page that never says it is taken as visible. */
const overlayOpen = (name: string): boolean => {
  let open = false
  server?.wss.clients.forEach((c: any) => {
    if (c.overlay === name && c.visible !== false) open = true
  })
  return open
}

const historyDir = join(app.getPath('userData'), 'hunt-history')
const mediaDir = join(app.getPath('userData'), 'media')
for (const dir of [historyDir, mediaDir]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

const killStreak = new KillStreakAlerts({
  store: {
    get: (k: string) => store.get(k),
    set: (k: string, v: unknown) => store.set(k, v as never)
  },
  isPro: () => true,
  show: (payload) => {
    if (!overlayOpen('killstreak')) return false
    broadcast({ type: 'streak_alert', payload })
    return true
  }
})

const hunt = new HuntTracker(
  store.get('hunt'),
  (s) => store.set('hunt', s as never),
  (msg) => broadcast(msg),
  {
    historyDir,
    // Standalone build: every feature is free.
    isPro: () => true,
    onKill: (e) => killStreak.handleKill(e),
    onDeath: (e) => killStreak.handleDeath(e)
  }
)

function registerIpc(): void {
  // --- Hunt state ---------------------------------------------------------
  ipcMain.handle('getHunt', () => hunt.get())
  ipcMain.handle('getHuntHistory', () => hunt.getHistory())
  ipcMain.handle('huntDetectPaths', () => hunt.detectPaths())
  ipcMain.on('huntAction', (_e, a: any) => {
    if (!a || typeof a !== 'object') return
    switch (a.type) {
      case 'enabled':
        hunt.setEnabled(!!a.value)
        break
      case 'latencyMode':
        hunt.setLatencyMode(a.value)
        break
      case 'sessionGap':
        hunt.setSessionGap(Number(a.value))
        break
      case 'goals':
        hunt.setGoals(a.value)
        break
      case 'patch':
        hunt.patchLook(a.values)
        break
      case 'reset':
        hunt.resetSession()
        break
      case 'test':
        hunt.demo()
        break
      case 'paths':
        if ('gamePath' in a) hunt.setGamePath(a.gamePath ?? null)
        if ('eventsPath' in a) hunt.setEventsPath(a.eventsPath ?? null)
        break
    }
  })

  // --- Kill streak / death alert -----------------------------------------
  ipcMain.handle('getHuntStreak', () => killStreak.get())
  ipcMain.handle('huntStreakSave', (_e, state: unknown) => killStreak.save(state))
  ipcMain.handle('huntStreakTest', (_e, id: unknown) => killStreak.test(String(id)))
  ipcMain.handle('huntDeathTest', () => killStreak.testDeath())
  ipcMain.handle('huntStreakPreview', (_e, raw: unknown) => killStreak.preview(raw))
  ipcMain.handle('huntDeathPreview', (_e, raw: unknown) => killStreak.previewDeath(raw))
  // Features are free: the settings never hide anything behind "pro".
  ipcMain.handle('alertsProActive', () => true)

  // --- Files & network ----------------------------------------------------
  ipcMain.handle('saveTextFile', async (_e, payload: any) => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: String(payload?.defaultName || 'export.txt')
    })
    if (res.canceled || !res.filePath) return { canceled: true }
    await writeFile(res.filePath, String(payload?.content ?? ''), 'utf8')
    return { filePath: res.filePath }
  })

  ipcMain.handle('saveOverlayMedia', async (_e, payload: any) => {
    try {
      const rawName = String(payload?.name || 'file')
      const isVideo = payload?.kind === 'video' || /\.video\.webm$/i.test(rawName)
      const base = rawName.replace(/[^\w.-]+/g, '_').replace(/\.video\.webm$/i, '')
      const name = isVideo
        ? `${base.replace(/\.[a-z0-9]+$/i, '')}.video.webm`
        : `${Date.now().toString(36)}-${base}`
      const buf = Buffer.isBuffer(payload?.data)
        ? payload.data
        : Buffer.from(
            payload?.data instanceof ArrayBuffer ? new Uint8Array(payload.data) : payload?.data
          )
      await writeFile(join(mediaDir, name), buf)
      return { url: `http://localhost:${OVERLAY_PORT}/media/${name}` }
    } catch (error: any) {
      return {
        error: 'Не удалось сохранить файл',
        error_description: String(error?.message || error)
      }
    }
  })

  ipcMain.handle('lanAddresses', () => {
    const out: Array<{ ip: string; label: string; virtual: boolean }> = []
    const virtualRe = /virtual|vmware|vethernet|hyper-v|loopback|tailscale|zerotier|wsl|docker/i
    for (const [label, addrs] of Object.entries(os.networkInterfaces())) {
      for (const a of addrs || []) {
        if (a.family === 'IPv4' && !a.internal) {
          out.push({ ip: a.address, label, virtual: virtualRe.test(label) })
        }
      }
    }
    return out.sort((x, y) => Number(x.virtual) - Number(y.virtual))
  })

  ipcMain.on('app-close', () => mainWindow?.close())
  ipcMain.on('app-minimize', () => mainWindow?.minimize())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Hunt Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hunttracker.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  registerIpc()

  server = startOverlayServer({
    port: OVERLAY_PORT,
    routes: { resource, mediaDir },
    ws: { hunt }
  })

  hunt.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  hunt.dispose()
  server?.http.close()
})
