import { readFileSync } from 'fs'
import { basename, join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'

// The GET routes of the overlay server on :1040 - the OBS browser sources. The websocket feed (ws.ts) shares the same
// port, so an overlay link and the app's own ws://localhost:1040 connection both work off a single origin.
//
// Pure of electron: the resource directory and the media directory come in through `deps`.

export interface OverlayRoutesDeps {
  /** Absolute path of a bundled resource: ('overlay', 'hunt.html'). Packaged: next to the exe, dev: ../../resources. */
  resource: (...parts: string[]) => string
  /** Where the media a user attached to an alert (custom sound / image / video) lives. */
  mediaDir: string
  readFile?: (path: string) => Buffer
}

// Overlay pages: URL -> file in resources/overlay. Served with `no-store` so a changed overlay is picked up on the
// next refresh in OBS.
const PAGES: Record<string, string> = {
  '/hunt': 'hunt.html',
  // the kill streak announcer: the alerts page, with its own connection and queue (?overlay=killstreak)
  '/killstreak': 'alerts.html',
  // the alerts page itself, used by the settings' live preview (iframe, ?preview=1)
  '/alerts': 'alerts.html'
}
const NO_STORE = 'no-cache, no-store, must-revalidate'

const MEDIA_MIME: Record<string, string> = {
  gif: 'image/gif',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  m4a: 'audio/mp4'
}

export function mediaMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (name.toLowerCase().endsWith('.video.webm')) return 'video/webm'
  return MEDIA_MIME[ext] || 'application/octet-stream'
}

export function createOverlayHandler(
  d: OverlayRoutesDeps
): (req: IncomingMessage, res: ServerResponse) => void {
  const read = d.readFile ?? ((p: string) => readFileSync(p))

  return (req, res) => {
    const notFound = (): void => {
      res.writeHead(404)
      res.end()
    }
    // Read first, answer after: a file that cannot be read is a plain 404.
    const send = (file: string, headers: Record<string, string>): void => {
      let body: Buffer
      try {
        body = read(file)
      } catch {
        notFound()
        return
      }
      res.writeHead(200, headers)
      res.end(body)
    }
    const html = (file: string): void =>
      send(d.resource('overlay', file), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': NO_STORE
      })

    if (req.method !== 'GET') return notFound()
    const tPath = req.url?.split('?')[0] || ''

    if (PAGES[tPath]) return html(PAGES[tPath])

    // Media a user attached to an alert. basename() blocks path traversal.
    if (tPath.startsWith('/media/')) {
      const name = basename(tPath.slice('/media/'.length))
      return send(join(d.mediaDir, name), {
        'Content-Type': mediaMime(name),
        'Cache-Control': 'public, max-age=86400'
      })
    }
    // Bundled overlay assets (e.g. images referenced by a page).
    if (tPath.startsWith('/assets/')) {
      const name = basename(tPath)
      return send(d.resource('overlay', 'assets', name), {
        'Content-Type': 'application/octet-stream'
      })
    }
    notFound()
  }
}
