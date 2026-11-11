import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import os from 'os'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { HuntTracker } from './HuntTracker'
import { KillStreakAlerts } from './hunt/KillStreakAlerts'
import { startOverlayServer, type OverlayServer } from './overlayServer/server'
import { DEFAULT_LANG, isLang, langFromLocale, type Lang } from '@shared/i18n'

// The app: one window with the settings, plus the overlay server on :1040 that feeds the OBS browser
// sources and the app's own live state (the window listens on the same websocket).

const OVERLAY_PORT = 1040

/** A bundled resource: ('overlay', 'hunt.html'). Packaged next to the exe, in dev under resources/. */
const resource = (...parts: string[]): string =>
  is.dev ? join(__dirname, '../../resources', ...parts) : join(process.resourcesPath, ...parts)

const store = new Store({ name: 'hunt-tracker' })

const getLang = (): Lang => {
  const saved = store.get('lang')
  return isLang(saved) ? saved : langFromLocale(app.getLocale()) || DEFAULT_LANG
}

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

// --- Overlay window over the game -------------------------------------------
// The same overlay page (:1040/hunt) drawn in a transparent, click-through, always-on-top
// window, so the panel can sit over Hunt without OBS. Nothing is injected into the game: it
// is a plain top-most window, which the game only shows in a windowed / borderless mode.

type OverlaySource = 'panel' | 'recent' | 'goal' | 'maps'

const OVERLAY_SOURCES: OverlaySource[] = ['panel', 'recent', 'goal', 'maps']
const OVERLAY_HOTKEY = 'Alt+Shift+O'

let overlayWindow: BrowserWindow | null = null

interface OverlaySettings {
  // Reopen over the game on the next launch.
  visible: boolean
  // Which of the overlay views the window draws (?show=... on the page).
  source: OverlaySource
}

const getOverlaySettings = (): OverlaySettings => {
  const raw = (store.get('overlayWindow') as Partial<OverlaySettings>) || {}
  const source = OVERLAY_SOURCES.includes(raw.source as OverlaySource)
    ? (raw.source as OverlaySource)
    : 'panel'
  return { visible: !!raw.visible, source }
}
const saveOverlaySettings = (patch: Partial<OverlaySettings>): OverlaySettings => {
  const next = { ...getOverlaySettings(), ...patch }
  store.set('overlayWindow', next as never)
  return next
}

const overlayUrl = (source: OverlaySource): string =>
  `http://localhost:${OVERLAY_PORT}/hunt${source === 'panel' ? '' : `?show=${source}`}`

/** What the settings window shows: is the window open, what it draws, the hotkey. */
const overlayWindowInfo = (): any => ({
  open: !!overlayWindow,
  hotkey: OVERLAY_HOTKEY,
  ...getOverlaySettings()
})

const notifyOverlayWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('overlayWindowState', overlayWindowInfo())
}

function createOverlayWindow(): void {
  if (overlayWindow) return
  const { bounds } = screen.getPrimaryDisplay()
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Never take focus or the mouse: the panel is meant to be read, the game keeps the input.
    focusable: false,
    show: false,
    title: 'Hunt Tracker — окно поверх игры',
    webPreferences: { backgroundThrottling: false }
  })
  // Above the game (and most other windows) without stealing clicks.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.webContents.setWindowOpenHandler((d) => {
    shell.openExternal(d.url)
    return { action: 'deny' }
  })
  // The overlay server may still be coming up (a busy port is retried): reload until it answers.
  overlayWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      if (overlayWindow)
        overlayWindow.loadURL(overlayUrl(getOverlaySettings().source)).catch(() => {})
    }, 2000)
  })
  overlayWindow.once('ready-to-show', () => overlayWindow?.showInactive())
  overlayWindow.on('closed', () => {
    overlayWindow = null
    notifyOverlayWindow()
  })
  overlayWindow.loadURL(overlayUrl(getOverlaySettings().source)).catch(() => {})
  notifyOverlayWindow()
}

function setOverlayVisible(visible: boolean): void {
  saveOverlaySettings({ visible })
  if (visible) createOverlayWindow()
  else overlayWindow?.close()
  notifyOverlayWindow()
}

function setOverlaySource(source: OverlaySource): void {
  saveOverlaySettings({ source })
  if (overlayWindow) overlayWindow.loadURL(overlayUrl(source)).catch(() => {})
  notifyOverlayWindow()
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
  ipcMain.handle('getLang', getLang)
  ipcMain.on('setLang', (_e, value: unknown) => {
    if (!isLang(value)) return
    store.set('lang', value)
    broadcast({ type: 'lang', lang: value })
  })
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

  // --- Overlay window over the game --------------------------------------
  ipcMain.handle('overlayWindowGet', () => overlayWindowInfo())
  ipcMain.on('overlayWindowAction', (_e, a: any) => {
    if (!a || typeof a !== 'object') return
    switch (a.type) {
      case 'open':
        setOverlayVisible(true)
        break
      case 'close':
        setOverlayVisible(false)
        break
      case 'toggle':
        setOverlayVisible(!overlayWindow)
        break
      case 'source':
        if (OVERLAY_SOURCES.includes(a.value)) setOverlaySource(a.value)
        break
    }
  })

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
  mainWindow.on('closed', () => {
    mainWindow = null
    // The overlay window is not a standalone app window: it goes away with the settings.
    overlayWindow?.close()
  })
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
    ws: { hunt, lang: getLang }
  })

  hunt.start()
  createWindow()

  // The overlay-over-the-game window: reopen it only if the user left it on last run.
  if (getOverlaySettings().visible) createOverlayWindow()
  // Show/hide the overlay window from inside the game (another app may already hold it).
  if (!globalShortcut.register(OVERLAY_HOTKEY, () => setOverlayVisible(!overlayWindow))) {
    console.warn(`[overlay] hotkey ${OVERLAY_HOTKEY} is already taken by another app`)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  overlayWindow?.destroy()
  hunt.dispose()
  server?.http.close()
})
