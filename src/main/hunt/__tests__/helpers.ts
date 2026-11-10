import { EngineEvent, HuntEngine, configFor } from '../engine'
import { EngineCurrent, LatencyMode, MatchRecord, SessionCounters } from '../types'

const pad = (n: number, len = 2): string => String(n).padStart(len, '0')

/** Local-time SDK line prefix for an epoch timestamp (round-trips through parseSdkTimestamp in any TZ). */
export function stamp(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

/** Game.log "<HH:MM:SS>" prefix (UTC time of day). */
export function gameClock(ms: number): string {
  const d = new Date(ms)
  return `<${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}>`
}

export const L = {
  loading: "Starting UI state machine 'loading/StateMachine'",
  nub: "Client_OnDisconnect(cause=11, reasonType='Unknown' desc='Nub destroyed')",
  level: (id: string) => `PrepareLevel 'levels/${id}' (client)`,
  loaded: 'transition from state(eLS_Loading) to (eLS_Game)',
  deathOpen: (at?: number) =>
    `${at === undefined ? '' : gameClock(at) + ' '}Starting UI state machine 'death/StateMachine'...`,
  deathClose: "Stopping UI state machine 'death/StateMachine'",
  disconnect: (reason: string, cause = 17) =>
    `Client_OnDisconnect(cause=${cause}, reasonType='${reason}')`,
  menu: "PrepareLevel 'menu' (server)",
  leave: 'PauseMenuQuit with reason: OnLeaveMission',
  mode: (lobby: string) => `GotoDeepLinkingTarget(${lobby})`,
  open: (g = 'g1') => `Posted Request HLOpenGroup[${g}]`,
  close: (g = 'g1') => `Posted Request HLCloseGroup[${g}]`,
  video: (id: string, at?: number) =>
    `${at === undefined ? '' : stamp(at) + ' '}Posted Request HLSetVideo[${id}]`
}

export const T0 = Date.UTC(2026, 9, 3, 21, 0, 0)

export function setup(
  mode: LatencyMode = 'fast',
  persisted?: { session: SessionCounters; current: EngineCurrent },
  idPrefix = 'mission'
) {
  let n = 0
  let t = T0
  const events: EngineEvent[] = []
  const changes = { count: 0 }
  const finished: MatchRecord[] = []
  const engine = new HuntEngine({
    config: configFor(mode),
    now: t,
    newId: () => `${idPrefix}${++n}`,
    onEvent: (e) => events.push(e),
    onChange: () => changes.count++,
    onMatchFinished: (r) => finished.push(r),
    session: persisted?.session,
    current: persisted?.current
  })
  engine.setGameLogHealthy(true)
  const h = {
    engine,
    events,
    changes,
    finished,
    now: () => t,
    game: (line: string) => engine.feedGameLine(line, t),
    sdk: (line: string) => engine.feedSdkLine(line, t),
    /** Moves the clock and lets pending highlights classify. */
    advance: (ms: number) => {
      t += ms
      engine.tick(t, true)
    },
    /** loading -> menu/network switch -> map -> loaded -> SDK group opened. */
    beginMatch: (map = 'creek') => {
      h.game(L.loading)
      h.game(L.nub)
      h.game(L.level(map))
      h.game(L.loaded)
      h.sdk(L.open())
    },
    names: () => events.map((e) => e.name)
  }
  return h
}
