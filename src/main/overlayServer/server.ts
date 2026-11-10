import { createServer, type Server } from 'http'
import { WebSocketServer } from 'ws'
import { createOverlayHandler, type OverlayRoutesDeps } from './routes'
import { handleClientMessage, replayOnConnect, type OverlayWsDeps } from './ws'

// The overlay server on :1040: the GET routes (routes.ts) and the websocket feed share one port, so the overlay link
// and the app's own ws://localhost:1040 connection both "just work" off a single origin. Moved out of
// src/main/index.ts without changes (docs/main-index-refactor.md, step 5b).

export interface OverlayServer {
  http: Server
  wss: WebSocketServer
}

export function startOverlayServer(opts: {
  routes: OverlayRoutesDeps
  ws: OverlayWsDeps
  /** 1040; tests use another. */
  port?: number
  /** How long to wait before trying a port that is still held again (default 1500 ms). */
  retryMs?: number
  /** A client connected or went away (the app starts / stops what only an open overlay needs). */
  onClientsChange?: () => void
}): OverlayServer {
  const port = opts.port ?? 1040
  const http = createServer(createOverlayHandler(opts.routes))
  const wss = new WebSocketServer({ server: http })

  // A zombie previous instance can still hold the port. Don't let that throw and wedge startup - warn and keep
  // retrying; it usually frees up in a few sec.
  let portRetries = 0
  http.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE' && portRetries++ < 20) {
      console.warn(`[overlay] :${port} busy (retry ${portRetries})`)
      setTimeout(() => {
        try {
          http.close()
          http.listen(port)
        } catch {
          /* next tick */
        }
      }, opts.retryMs ?? 1500)
    } else {
      console.error('[overlay] http server error:', err?.message || err)
    }
  })
  http.listen(port)

  wss.on('connection', function connection(ws: any, req: any) {
    ws.on('error', (err) => {
      console.error('ws err: ', err)
    })
    // a page says which overlay it is in the ws address (`/?overlay=alerts`), so the app knows whether one is open
    try {
      ws.overlay = new URL(String(req?.url || '/'), 'http://x').searchParams.get('overlay') || ''
    } catch {
      ws.overlay = ''
    }
    ws.on('close', () => opts.onClientsChange?.())
    // Bring a just-connected overlay up to date with the current track, tournament and everything else.
    try {
      for (const m of replayOnConnect(opts.ws)) ws.send(JSON.stringify(m))
    } catch (err) {
      console.error('ws replay err: ', err)
    }
    // The jump / race overlay and the phone deck are the clients that send messages back over this socket.
    ws.on('message', (data: any) => {
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch (err) {
        console.error('ws message parse err: ', err)
        return
      }
      // an overlay page says whether it is on screen (OBS: the scene it is in is live): the app pauses what only a visible
      // overlay needs. A page that never says is taken as visible.
      if (parsed?.type === 'overlay_visible') {
        ws.visible = parsed.visible !== false
        opts.onClientsChange?.()
        return
      }
      handleClientMessage(opts.ws, parsed)
    })
    console.log('Local Socket connection')
    opts.onClientsChange?.()
  })

  return { http, wss }
}
