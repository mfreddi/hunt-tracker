import type { HuntTracker } from '../HuntTracker'

// The websocket side of the overlay server on :1040: what a client that just connected is brought up to date with,
// and what the overlay pages may send back. Pure of electron and sockets - startOverlayServer (server.ts) does the
// actual wiring.

export interface OverlayWsDeps {
  hunt: HuntTracker
  /** The /killstreak overlay reports whether an alert is on screen (so the app can queue the next one). */
  alertsStatus?: (msg: any) => void
}

/** The state a just-connected overlay gets, one message at a time. */
export function* replayOnConnect(d: OverlayWsDeps): Generator<any, void, undefined> {
  yield { type: 'hunt_update', state: d.hunt.get() }
}

/** A message an overlay page sent back over the socket. */
export function handleClientMessage(d: OverlayWsDeps, parsed: any): void {
  if (parsed?.type === 'alerts_status') d.alertsStatus?.(parsed)
}
