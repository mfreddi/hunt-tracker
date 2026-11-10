// Replays two REAL sessions recorded by the reference tracker (its ndjson event
// journals, trimmed to the fields below) through the new engine, as raw log
// lines fed at the exact times the reference observed them, and checks that
// every kill/death decision and the match/outcome counters come out the same.
//
// session-fast.json   - 12 matches, latency "fast" (300ms wait), revives and respawns
// session-normal.json - 15 matches, older "normal" mode (3s wait, trade window)

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { HuntEngine, EngineEvent, configFor } from '../engine'
import { utcTimeOfDay } from '../parse'
import { LatencyMode } from '../types'
import { L, gameClock, stamp } from './helpers'

interface J {
  e: string
  t: number
  m?: string
  r?: string
  g?: string
  map?: string
  mode?: string
  reason?: string
  cause?: number
  phase?: string
  hd?: boolean
  do?: boolean
  fm?: boolean
  gt?: string
  ts?: number
}

const load = (name: string): J[] =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as J[]

const LOBBY: Record<string, string> = {
  'Bounty Hunt': 'BountyHuntLobby',
  'Bounty Clash': 'BountyClashLobby',
  'Soul Survivor': 'QuickplayLobby'
}

// What the reference tracker concluded (outputs) - everything else is input.
const OUTPUTS = new Set(['kill', 'death', 'trade', 'unknown_highlight'])

function feed(engine: HuntEngine, j: J): void {
  const game = (line: string): void => engine.feedGameLine(line, j.t)
  const sdk = (line: string): void => engine.feedSdkLine(line, j.t)
  switch (j.e) {
    case 'game_started':
      engine.gameStarted(1, j.t)
      break
    case 'game_stopped':
      engine.gameStopped(j.t)
      break
    case 'state_restored':
      if (j.mode && LOBBY[j.mode]) game(L.mode(LOBBY[j.mode]))
      break
    case 'mode_selected':
      if (j.mode && LOBBY[j.mode]) game(L.mode(LOBBY[j.mode]))
      break
    case 'matchmaking_started':
      game('CGameLobby::DoConfirmReady()')
      break
    case 'matchmaking_cancelled':
      game('CGameLobby::DoSetReadiness() ready=0')
      break
    case 'match_found':
      game("Starting UI state machine 'profilecards_showcase/StateMachine'")
      break
    case 'mission_loading_started':
      game(L.loading)
      break
    case 'loading_connection_transition':
      game(L.nub)
      break
    case 'map_detected':
      game(L.level(j.map as string))
      break
    case 'mission_loaded':
      game(L.loaded)
      break
    case 'death_screen_opened':
      game(
        `<${(j.gt as string) ?? gameClock(j.t).slice(1, -1)}> Starting UI state machine 'death/StateMachine'...`
      )
      break
    case 'death_screen_closed':
      game(L.deathClose)
      break
    case 'mission_leave_requested':
      game(L.leave)
      break
    case 'mission_disconnected':
      game(L.disconnect(j.reason as string, j.cause))
      break
    case 'returning_to_menu':
      game(L.menu)
      break
    case 'post_match_summary_opened':
      game("Starting UI state machine 'post_match_summary/StateMachine'")
      break
    case 'team_details_opened':
      game("Starting UI state machine 'teamdetails/StateMachine'")
      break
    case 'gameplay_started':
      sdk(L.open(j.g))
      break
    case 'returned_to_lobby':
      sdk(L.close(j.g))
      break
    case 'highlight_detected':
      sdk(L.video(j.r as string, j.ts))
      break
  }
}

function replay(events: J[], mode: LatencyMode) {
  const got: EngineEvent[] = []
  const cfg = configFor(mode)
  let ids = 0
  const engine = new HuntEngine({
    config: cfg,
    now: events[0].t,
    newId: () => `replay${++ids}`,
    onEvent: (e) => got.push(e)
  })
  engine.setGameLogHealthy(true)

  const inputs = events.filter((j) => !OUTPUTS.has(j.e))
  if (!events.some((j) => j.e === 'death_screen_opened')) {
    // Journals recorded before the reference logged death-screen diagnostics
    // have the deaths but not the screen lines that proved them: rebuild those
    // lines from the reference's own verdicts (open right behind the highlight,
    // closed shortly after). Kills sitting close to a death must still stay kills.
    const byRequest = new Map(
      events.filter((j) => j.e === 'highlight_detected').map((j) => [j.r as string, j])
    )
    for (const d of events.filter((j) => j.e === 'death')) {
      const h = byRequest.get(d.r as string)
      if (!h) continue
      const sec = Math.floor(utcTimeOfDay(h.ts ?? h.t) / 1000)
      const hh = String(Math.floor(sec / 3600)).padStart(2, '0')
      const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
      const ss = String(sec % 60).padStart(2, '0')
      inputs.push(
        { e: 'death_screen_opened', t: h.t + 90, gt: `${hh}:${mm}:${ss}` },
        { e: 'death_screen_closed', t: h.t + 600 }
      )
    }
    inputs.sort((a, b) => a.t - b.t)
  }
  const dues: number[] = [] // when each highlight becomes classifiable, like the 25ms poll would notice
  for (const j of inputs) {
    dues.sort((a, b) => a - b)
    while (dues.length && dues[0] <= j.t) engine.tick(dues.shift() as number, true)
    engine.tick(j.t, true)
    feed(engine, j)
    if (j.e === 'highlight_detected')
      dues.push(
        j.t + cfg.classificationDelayMs,
        j.t + cfg.classificationDelayMs + cfg.tradeWindowMs
      )
    engine.tick(j.t, true)
  }
  const end = inputs[inputs.length - 1].t + 60_000
  engine.tick(end, true)
  return { engine, got }
}

// Independent re-derivation of games / survived / lost straight from the journal's
// own recorded fields (not from engine internals).
function expectedMatchTotals(events: J[]) {
  let games = 0
  let survived = 0
  let lost = 0
  let current = ''
  const done = new Set<string>()
  for (const j of events) {
    if (j.e === 'mission_loading_started' && j.m) {
      games++
      current = j.m
    }
    if (j.e === 'mission_disconnected' && j.m === current && !done.has(j.m as string)) {
      done.add(j.m as string)
      if (j.reason === 'MissionRequested' && j.fm && !j.do) survived++
      else if (j.reason === 'UserRequested' || (j.reason === 'GameSessionEnded' && j.do)) lost++
    }
  }
  return { games, survived, lost }
}

function expectedTrades(events: J[], windowMs: number): number {
  if (windowMs <= 0) return 0
  const stampOf = new Map(
    events.filter((j) => j.e === 'highlight_detected').map((j) => [j.r as string, j.ts as number])
  )
  const kills = events.filter((j) => j.e === 'kill')
  const deaths = events.filter((j) => j.e === 'death')
  const pairs: Array<{ k: string; d: string; gap: number }> = []
  for (const k of kills) {
    for (const d of deaths) {
      if (!k.m || k.m !== d.m) continue
      const gap = Math.abs(stampOf.get(k.r as string)! - stampOf.get(d.r as string)!)
      if (gap <= windowMs) pairs.push({ k: k.r as string, d: d.r as string, gap })
    }
  }
  pairs.sort((a, b) => a.gap - b.gap)
  const used = new Set<string>()
  let n = 0
  for (const p of pairs) {
    if (used.has(p.k) || used.has(p.d)) continue
    used.add(p.k)
    used.add(p.d)
    n++
  }
  return n
}

describe.each([
  ['session-fast.json', 'fast' as LatencyMode],
  ['session-normal.json', 'normal' as LatencyMode]
])('replay of the reference journal %s', (file, mode) => {
  const events = load(file)
  const { engine, got } = replay(events, mode)
  const expected = new Map<string, string>()
  for (const j of events) if (j.e === 'kill' || j.e === 'death') expected.set(j.r as string, j.e)

  it('has real data to compare against', () => {
    expect(expected.size).toBeGreaterThan(10)
  })

  it('classifies every highlight exactly like the reference', () => {
    const mine = new Map<string, string>()
    for (const e of got) {
      if (e.name === 'kill' || e.name === 'death') mine.set(e.data.requestId, e.name)
    }
    const wrong = [...expected].filter(([id, kind]) => mine.get(id) !== kind)
    expect(wrong).toEqual([])
    expect(mine.size).toBe(expected.size)
    expect(got.some((e) => e.name === 'unknown_highlight')).toBe(false)
  })

  it('kill and death totals match', () => {
    const kills = [...expected.values()].filter((v) => v === 'kill').length
    const deaths = [...expected.values()].filter((v) => v === 'death').length
    expect(engine.session.kills).toBe(kills)
    expect(engine.session.deaths).toBe(deaths)
  })

  it('games, survived and lost match the journal-derived totals', () => {
    const exp = expectedMatchTotals(events)
    expect({
      games: engine.session.games,
      survived: engine.session.survived,
      lost: engine.session.lost
    }).toEqual(exp)
  })

  it('trades are exactly the kill+death pairs within the window', () => {
    const recorded = events.filter((j) => j.e === 'trade').length
    // Older journals predate the reference's trade feature (nothing recorded),
    // so re-derive the pairs from the journal's own kill/death verdicts and SDK stamps.
    const derived = expectedTrades(events, configFor(mode).tradeWindowMs)
    expect(engine.session.trades).toBe(recorded || derived)
  })

  it('per-mode counters add up to the session totals', () => {
    const s = engine.session
    const sum = (f: 'games' | 'survived' | 'lost' | 'kills' | 'deaths') =>
      Object.values(s.modes).reduce((a, m) => a + m[f], 0)
    // a match whose mode was never seen is in the totals but in no mode
    expect(sum('games')).toBeLessThanOrEqual(s.games)
    expect(sum('kills')).toBeLessThanOrEqual(s.kills)
    expect(sum('survived') + sum('lost')).toBeLessThanOrEqual(s.survived + s.lost)
    // these journals pick their mode before the first match, so nothing is left out
    expect(sum('games')).toBe(s.games)
    expect(sum('kills')).toBe(s.kills)
    expect(sum('deaths')).toBe(s.deaths)
    expect(sum('survived')).toBe(s.survived)
    expect(sum('lost')).toBe(s.lost)
  })

  it('every match ends complete and every map is a real one', () => {
    expect(engine.current.status).toBe('complete')
    expect(Object.keys(engine.session.maps).length).toBeGreaterThan(0)
    expect(Object.values(engine.session.maps).reduce((a, b) => a + b, 0)).toBe(engine.session.games)
  })
})

describe('timestamps used by the replay', () => {
  it('stamp() round-trips an instant', () => {
    expect(stamp(Date.UTC(2026, 9, 3, 21, 39, 4, 606))).toMatch(/^2026-10-0[34]T\d{2}:39:04\.606$/)
  })
})
