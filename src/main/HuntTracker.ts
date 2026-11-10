// Hunt: Showdown tracker - Game.log + NVIDIA SDK log -> session stats for the stream.
// The match/kill/death logic lives in ./hunt/engine.ts (a port of the reference
// tracker, see docs/hunt-tracker.md). This file is the I/O shell around it:
// finds the game process, tails the two logs, persists, and feeds the overlay
// (resources/overlay/hunt.html) through `hunt_update`.
//
// Windows only: the game, its process and the NVIDIA logs only exist there.

import { promises as fs, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { execFile, execFileSync } from 'child_process'
import { HuntEngine, configFor, emptyCurrent, emptySession } from './hunt/engine'
import { goalProgress, normalizeGoals } from './hunt/goals'
import { HuntHistory } from './hunt/history'
import { LogTail } from './hunt/logTail'
import { summarizeMaps } from './hunt/maps'
import { RECENT_KEEP, summarizeRecent } from './hunt/recent'
import {
  EngineCurrent,
  HuntLook,
  HuntMatchEntry,
  HUNT_THEMES,
  HuntPersisted,
  HuntState,
  HuntTheme,
  MapRate,
  MapSample,
  PRO_THEMES,
  RecentSummary,
  SessionMatch,
  LatencyMode,
  SessionCounters
} from './hunt/types'

export type { HuntRow, HuntLook, HuntState, LatencyMode } from './hunt/types'

const DISCOVERY_MS = 2000 // looking for HuntGame.exe while it is not running
const ALIVE_CHECK_MS = 500 // is the known pid still alive
const REVALIDATE_MS = 5000 // did HuntGame.exe get replaced by another pid
const IDLE_POLL_MS = 500 // loop period while the game is not running
const SAVE_DEBOUNCE_MS = 500
const FRESH_LOG_MS = 30_000 // a log created this recently belongs to the game we just saw start
const SESSION_GAPS = [0, 3, 6, 12] // hours without the game before a new session; 0 = never
const HOUR_MS = 60 * 60 * 1000
const PLAY_SAVE_MS = 60_000 // persist the game-time clock this often while playing
const DEMO_MS = 20_000

const POSITIONS = ['top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right']

const DEFAULT_LOOK: HuntLook = {
  position: 'top-left',
  bg: '#0a0a0f',
  text: '#e0e0e0',
  accent: '#ffd700',
  scale: 1,
  bgOpacity: 1,
  theme: 'classic',
  scope: 'mode',
  mapsPeriod: 'all',
  rows: { duration: true, survival: true, combat: true, modes: true, current: true, recent: true }
}

const num = (v: any, lo: number, hi: number, dflt: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
const count = (v: any): number => Math.floor(num(v, 0, 1_000_000_000, 0))
const str = (v: any, dflt: string): string => (typeof v === 'string' && v ? v : dflt)
const bool = (v: any, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt)

const pickPath = (...candidates: any[]): string | null => {
  const v = candidates.find((c) => typeof c === 'string' && c)
  return v ? String(v) : null
}

function normalizeLook(raw: any): HuntLook {
  const rl = raw && typeof raw === 'object' ? raw : {}
  const rows = rl.rows || {}
  return {
    position: POSITIONS.includes(rl.position) ? rl.position : DEFAULT_LOOK.position,
    bg: str(rl.bg, DEFAULT_LOOK.bg),
    text: str(rl.text, DEFAULT_LOOK.text),
    accent: str(rl.accent, DEFAULT_LOOK.accent),
    scale: num(rl.scale, 0.6, 2, 1),
    // Older stores have no bgOpacity: keep their fully opaque panel.
    bgOpacity: num(rl.bgOpacity, 0, 1, 1),
    // Older stores: the classic look.
    theme: HUNT_THEMES.includes(rl.theme) ? rl.theme : 'classic',
    scope: rl.scope === 'session' ? 'session' : 'mode',
    // Older stores: the whole history (it fills up from the first match on).
    mapsPeriod: rl.mapsPeriod === 'session' ? 'session' : 'all',
    rows: {
      duration: bool(rows.duration, true),
      survival: bool(rows.survival, true),
      combat: bool(rows.combat, true),
      modes: bool(rows.modes, true),
      current: bool(rows.current, true),
      recent: bool(rows.recent, true)
    }
  }
}

function normalizeSession(raw: any, now: number): SessionCounters {
  const s = raw && typeof raw === 'object' ? raw : {}
  const maps: Record<string, number> = {}
  if (s.maps && typeof s.maps === 'object') {
    for (const [k, v] of Object.entries(s.maps)) maps[k] = count(v)
  }
  const modes: SessionCounters['modes'] = {}
  if (s.modes && typeof s.modes === 'object') {
    for (const [k, v] of Object.entries<any>(s.modes)) {
      // Older stores only had kills/deaths per mode.
      modes[k] = {
        games: count(v?.games),
        survived: count(v?.survived),
        lost: count(v?.lost),
        kills: count(v?.kills),
        deaths: count(v?.deaths)
      }
    }
  }
  return {
    startedAt: num(s.startedAt, 0, Number.MAX_SAFE_INTEGER, now),
    lastPayloadAt: num(s.lastPayloadAt, 0, Number.MAX_SAFE_INTEGER, now),
    games: count(s.games),
    survived: count(s.survived),
    lost: count(s.lost),
    kills: count(s.kills),
    deaths: count(s.deaths),
    trades: count(s.trades),
    unclassified: count(s.unclassified),
    maps,
    modes,
    // Older stores have no game time.
    playedMs: num(s.playedMs, 0, Number.MAX_SAFE_INTEGER, 0),
    recent: normalizeRecent(s.recent),
    streak: count(s.streak),
    bestStreak: count(s.bestStreak),
    bestKills: count(s.bestKills)
  }
}

// Older stores have no finished-match list; a damaged entry is dropped, not guessed.
function normalizeRecent(raw: any): SessionMatch[] {
  if (!Array.isArray(raw)) return []
  const out: SessionMatch[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    out.push({
      outcome: m.outcome === 'survived' || m.outcome === 'lost' ? m.outcome : '',
      kills: count(m.kills),
      deaths: count(m.deaths),
      mode: typeof m.mode === 'string' ? m.mode : '',
      mapName: typeof m.mapName === 'string' ? m.mapName : '',
      endedAt: num(m.endedAt, 0, Number.MAX_SAFE_INTEGER, 0)
    })
  }
  return out.slice(-RECENT_KEEP)
}

function normalizeMatch(raw: any): EngineCurrent {
  const c = raw && typeof raw === 'object' ? raw : {}
  const status = ['idle', 'loading', 'active', 'complete'].includes(c.status) ? c.status : 'idle'
  return {
    status,
    missionId: typeof c.missionId === 'string' ? c.missionId : '',
    mapId: typeof c.mapId === 'string' ? c.mapId : '',
    mapName: typeof c.mapName === 'string' ? c.mapName : '',
    mode: typeof c.mode === 'string' ? c.mode : '',
    outcome: c.outcome === 'survived' || c.outcome === 'lost' ? c.outcome : '',
    skulls: Array.isArray(c.skulls)
      ? c.skulls.filter((x: any) => x === 'kill' || x === 'death')
      : [],
    // Older stores have no per-match counters.
    startedAt: num(c.startedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    kills: count(c.kills),
    deaths: count(c.deaths),
    trades: count(c.trades),
    unclassified: count(c.unclassified)
  }
}

// Backward compatible with the first (pre-engine) persisted shape: it had no
// latencyMode / trades / match, and kept a transient `current` view we ignore.
function normalize(raw: any, now = Date.now()): HuntPersisted {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    // Older stores used other key names for these two paths.
    gamePath: pickPath(r.gamePath, r.gameLogPath),
    eventsPath: pickPath(r.eventsPath, r.nvidiaLogsPath),
    enabled: bool(r.enabled, false),
    // 'instant' was removed: a store that still has it loads as fast.
    latencyMode: ['normal', 'fast'].includes(r.latencyMode) ? r.latencyMode : 'fast',
    look: normalizeLook(r.look),
    // Older stores: the fixed 3 h break it always was.
    sessionGapHours: SESSION_GAPS.includes(r.sessionGapHours) ? r.sessionGapHours : 3,
    // Older stores have no challenge goals.
    goals: normalizeGoals(r.goals),
    session: normalizeSession(r.session, now),
    match: normalizeMatch(r.match)
  }
}

export interface HuntDeps {
  findPid: () => Promise<number | null>
  isAlive: (pid: number) => boolean
  // Where the match history goes; null = no history (tests).
  historyDir: string | null
  // Whether the Pro-only overlay themes are unlocked (always true in the standalone build).
  isPro: () => boolean
  // A kill of the current match was counted (`kills` = the count of the match now): the kill streak announcer follows it.
  onKill?: (e: { kills: number; matchId: string }) => void
  onDeath?: (e: { matchId: string }) => void
}

function findHuntPid(): Promise<number | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq HuntGame.exe', '/FO', 'CSV', '/NH'],
      { windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null)
        let best = 0
        for (const m of String(stdout).matchAll(/"HuntGame\.exe","(\d+)"/gi)) {
          best = Math.max(best, parseInt(m[1], 10))
        }
        resolve(best || null)
      }
    )
  })
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e: any) {
    return e?.code === 'EPERM'
  }
}

const statOrNull = async (p: string): Promise<import('fs').Stats | null> => {
  try {
    return await fs.stat(p)
  } catch {
    return null
  }
}

export class HuntTracker {
  private cfg: Omit<HuntPersisted, 'session' | 'match'>
  private engine: HuntEngine
  private save: (s: HuntPersisted) => void
  private emit: (msg: any) => void
  private deps: HuntDeps
  private history: HuntHistory

  private gameTail = new LogTail()
  private sdkTail = new LogTail()
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false

  private firstDiscovery = true
  private gamePid: number | null = null
  private discoveredAt = 0
  private snapshotMode = false
  private lastDiscovery = 0
  private lastAliveCheck = 0
  private lastRevalidate = 0
  private gameAttached = false
  private sdkAttached = false
  private gameGen = -1
  private gameHealth: boolean | null = null
  private sdkHealth: boolean | null = null

  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private demoView: HuntState | null = null
  private demoTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    initial: any,
    save: (s: HuntPersisted) => void,
    emit: (msg: any) => void,
    deps?: Partial<HuntDeps>
  ) {
    const p = normalize(initial)
    this.cfg = {
      gamePath: p.gamePath,
      eventsPath: p.eventsPath,
      enabled: p.enabled,
      latencyMode: p.latencyMode,
      look: p.look,
      sessionGapHours: p.sessionGapHours,
      goals: p.goals
    }
    this.save = save
    this.emit = emit
    this.deps = {
      findPid: deps?.findPid ?? findHuntPid,
      isAlive: deps?.isAlive ?? isPidAlive,
      historyDir: deps?.historyDir ?? null,
      // The class itself knows nothing of "pro": the standalone app always passes () => true.
      isPro: deps?.isPro ?? (() => false),
      onKill: deps?.onKill,
      onDeath: deps?.onDeath
    }
    this.history = new HuntHistory(this.deps.historyDir)
    this.engine = new HuntEngine({
      config: configFor(p.latencyMode),
      session: p.session,
      current: p.match,
      onChange: () => this.commit(),
      onEvent: (e) => this.onEngineEvent(e),
      onMatchFinished: (r) => {
        const entry = this.history.append(r, this.cfg.latencyMode)
        if (entry) this.emit({ type: 'hunt_match', entry })
        this.rememberResult({ id: r.id, outcome: r.outcome, mode: r.mode, mapName: r.mapName })
      }
    })
    void this.loadResults()
    // The app may start days after the last game: an old session must not greet the
    // user. (A match that was in progress when the app last ran may still be going on:
    // that one is left to handleGameStarted, which sees the game itself.)
    if (!this.engine.inMatch && p.match.status !== 'loading' && p.match.status !== 'active') {
      this.expireIdleSession(Date.now())
    }
    if (this.cfg.enabled) this.start()
  }

  // The last kill / death of the match, for the log: a death screen that opens long after a "kill" is how a self-inflicted
  // death (or any death the highlight does not mark) shows up, and the log is what tells it.
  private lastHighlight: { name: string; at: number } | null = null
  private traceEvent(e: { name: string; at?: number; data: Record<string, any> }): void {
    const at = typeof e.at === 'number' ? e.at : Date.now()
    const iso = new Date(at).toISOString()
    if (e.name === 'kill' || e.name === 'death') {
      const c = this.engine.current
      const delta = e.data.deltaMs != null ? ` deathScreenDelta=${e.data.deltaMs}ms` : ''
      console.log(
        `[hunt] ${iso} ${e.name} certainty=${e.data.certainty}${delta} (kills ${c.kills}, deaths ${c.deaths})`
      )
      this.lastHighlight = { name: e.name, at }
    } else if (e.name === 'death_screen_opened') {
      const l = this.lastHighlight
      const ago = l ? `; the last ${l.name} was ${Math.round((at - l.at) / 100) / 10} s before` : ''
      console.log(`[hunt] ${iso} death screen opened${ago}`)
    } else if (e.name === 'mission_loading_started' || e.name === 'game_started') {
      this.lastHighlight = null
    }
  }

  private onEngineEvent(e: { name: string; at?: number; data: Record<string, any> }): void {
    try {
      this.traceEvent(e)
    } catch {
      /* the log must never stop the tracker */
    }
    if (e.name !== 'kill' && e.name !== 'death') return
    const c = this.engine.current
    // a kill / death classified late can belong to the match before: it is not part of this one
    if (e.data.missionId && e.data.missionId !== c.missionId) return
    const matchId = c.missionId || String(c.startedAt || 'match')
    try {
      if (e.name === 'kill') this.deps.onKill?.({ kills: c.kills, matchId })
      else this.deps.onDeath?.({ matchId })
    } catch (err) {
      console.error('[hunt] kill streak failed', String((err as any)?.message || err).slice(0, 120))
    }
  }

  // Results of every match in the history, kept in memory for the win-rate widget
  // (a few dozen bytes per match; ~1000 matches a year). Loaded once at start; matches
  // that finish meanwhile are merged by id, so none is lost or counted twice.
  private results: Array<MapSample & { id: string }> = []
  private resultIds = new Set<string>()

  private rememberResult(r: MapSample & { id: string }): void {
    if (this.resultIds.has(r.id)) return
    this.resultIds.add(r.id)
    this.results.push(r)
  }

  private async loadResults(): Promise<void> {
    try {
      const all = await this.history.list() // newest first
      const live = this.results // finished while we were reading
      this.results = []
      this.resultIds = new Set()
      for (const e of all.reverse()) {
        this.rememberResult({ id: e.id, outcome: e.outcome, mode: e.mode, mapName: e.mapName })
      }
      for (const r of live) this.rememberResult(r)
      this.commit(false)
    } catch {
      /* no history yet: the list simply stays empty */
    }
  }

  /** Win rate per map (Pro): this session's matches or the whole history, like the overlay's scope. */
  private mapsSummary(s: SessionCounters): MapRate[] | null {
    if (!this.isPro()) return null
    const mode = this.engine.activeMode
    const byMode = this.cfg.look.scope !== 'session' && !!mode
    const source = this.cfg.look.mapsPeriod === 'session' ? (s.recent ?? []) : this.results
    return summarizeMaps(source, byMode ? mode : '')
  }

  /**
   * "New session after N hours without the game": the break counts from the last game
   * event. Checked while the game is NOT running - at launch of the game, and here:
   * before this, a session was only renewed when the game started, so after days away
   * the old numbers stayed on the overlay and in the settings.
   */
  private expireIdleSession(now: number): void {
    const gap = this.cfg.sessionGapHours * HOUR_MS
    const s = this.engine.session
    if (gap <= 0 || this.gamePid !== null || now - s.lastPayloadAt <= gap) return
    // An empty session has nothing to lose: leave it (no needless saves every tick).
    const hasData =
      s.games > 0 || s.kills > 0 || s.deaths > 0 || s.playedMs > 0 || (s.recent?.length ?? 0) > 0
    if (!hasData) return
    console.log('[HuntTracker] the game has not been played for a long time - new session')
    this.engine.resetSession(now)
    this.commit()
  }

  // ------------------------------------------------------------- state view

  // While the game runs, the time since this moment is not in session.playedMs yet.
  private runStart: number | null = null
  private lastPlaySave = 0

  /** Moves the running game time into session.playedMs. */
  private foldPlay(now: number): void {
    if (this.runStart === null) return
    this.engine.session.playedMs += Math.max(0, now - this.runStart)
    this.runStart = now
  }

  private isPro(): boolean {
    try {
      return this.deps.isPro()
    } catch {
      return false // Pro not ready yet
    }
  }

  private effectiveTheme(): HuntTheme {
    const t = this.cfg.look.theme
    return PRO_THEMES.includes(t) && !this.isPro() ? 'classic' : t
  }

  /** The recent-matches block (Pro): scoped like the rest of the overlay. */
  private recentSummary(s: SessionCounters): RecentSummary | null {
    if (!this.isPro()) return null
    const mode = this.engine.activeMode
    const byMode = this.cfg.look.scope !== 'session' && !!mode
    return summarizeRecent(s.recent ?? [], byMode ? mode : '')
  }

  /** Pro status changed: redraw the overlay (theme may switch). */
  refresh(): void {
    this.commit(false)
  }

  private view(): HuntState {
    if (this.demoView) return { ...this.demoView, theme: this.effectiveTheme() }
    const now = Date.now()
    this.foldPlay(now)
    const s = this.engine.session
    const rest: Partial<SessionCounters> = { ...s }
    delete rest.recent
    const c = this.engine.current
    return {
      gamePath: this.cfg.gamePath,
      eventsPath: this.cfg.eventsPath,
      enabled: this.cfg.enabled,
      connected: this.gamePid !== null,
      activeMode: this.engine.activeMode,
      playingSince: this.runStart !== null ? now : null,
      sessionGapHours: this.cfg.sessionGapHours,
      theme: this.effectiveTheme(),
      latencyMode: this.cfg.latencyMode,
      look: this.cfg.look,
      // Infinity does not survive JSON, so with 0 deaths K/D is just the kill count.
      // The raw match list stays out of the payload: `recent` below is its summary.
      session: {
        ...(rest as Omit<SessionCounters, 'recent'>),
        kd: s.deaths > 0 ? Number((s.kills / s.deaths).toFixed(2)) : s.kills
      },
      current: {
        inMatch: this.engine.inMatch,
        map: c.mapName,
        mode: c.mode,
        skulls: [...c.skulls]
      },
      statuses: { ...this.engine.statuses },
      sdk: this.engine.sdkInfo,
      recent: this.recentSummary(s),
      goals: goalProgress(this.cfg.goals, s),
      proActive: this.isPro(),
      maps: this.mapsSummary(s)
    }
  }

  get(): HuntState {
    return this.view()
  }

  /** Finished matches, newest first. */
  getHistory(): Promise<HuntMatchEntry[]> {
    return this.history.list()
  }

  // Deep copy: the engine keeps mutating its objects after the save call.
  private persisted(): HuntPersisted {
    this.foldPlay(Date.now())
    return JSON.parse(
      JSON.stringify({ ...this.cfg, session: this.engine.session, match: this.engine.current })
    )
  }

  private commit(persist = true): void {
    if (persist) {
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null
        this.save(this.persisted())
      }, SAVE_DEBOUNCE_MS)
    }
    this.emit({ type: 'hunt_update', state: this.view() })
  }

  // -------------------------------------------------------- settings actions

  patchLook(values: any): void {
    this.cfg.look = normalizeLook({ ...this.cfg.look, ...values })
    this.commit()
  }

  setLatencyMode(mode: LatencyMode): void {
    if (!['normal', 'fast'].includes(mode)) return
    this.cfg.latencyMode = mode
    this.engine.setConfig(configFor(mode))
    this.commit()
  }

  setGamePath(path: string | null): void {
    this.cfg.gamePath = path ? String(path) : null
    this.restart()
    this.commit()
  }

  setEventsPath(path: string | null): void {
    this.cfg.eventsPath = path ? String(path) : null
    this.restart()
    this.commit()
  }

  setEnabled(enabled: boolean): void {
    this.cfg.enabled = enabled
    if (enabled) this.start()
    else this.stop()
    this.commit()
  }

  resetSession(): void {
    this.clearDemo()
    const now = Date.now()
    this.engine.resetSession(now)
    if (this.runStart !== null) this.runStart = now
    this.commit()
  }

  /** The settings send the whole goal list; it is cleaned here and the result is broadcast. */
  setGoals(raw: unknown): void {
    this.cfg.goals = normalizeGoals(raw)
    this.commit()
  }

  setSessionGap(hours: number): void {
    if (!SESSION_GAPS.includes(hours)) return
    this.cfg.sessionGapHours = hours
    this.expireIdleSession(Date.now()) // a shorter break may already be over
    this.commit()
  }

  /** Shows made-up stats on the overlay for a few seconds; the real session is never touched. */
  demo(): void {
    const now = Date.now()
    this.demoView = {
      gamePath: this.cfg.gamePath,
      eventsPath: this.cfg.eventsPath,
      enabled: this.cfg.enabled,
      connected: true,
      activeMode: 'Bounty Hunt',
      playingSince: now,
      sessionGapHours: this.cfg.sessionGapHours,
      theme: 'classic', // replaced in view()
      latencyMode: this.cfg.latencyMode,
      look: this.cfg.look,
      session: {
        ...emptySession(now - 2 * 60 * 60 * 1000),
        lastPayloadAt: now,
        playedMs: 95 * 60 * 1000,
        games: 5,
        survived: 3,
        lost: 2,
        kills: 20,
        deaths: 11,
        trades: 2,
        kd: 1.82,
        maps: { cemetery: 3, civilwar: 2 },
        modes: {
          'Bounty Hunt': { games: 3, survived: 2, lost: 1, kills: 14, deaths: 7 },
          'Bounty Clash': { games: 2, survived: 1, lost: 1, kills: 6, deaths: 4 }
        }
      },
      current: {
        inMatch: true,
        map: 'Stillwater',
        mode: 'Bounty Hunt',
        skulls: ['kill', 'kill', 'death', 'kill']
      },
      statuses: { game: 'online', events: 'online' },
      sdk: { state: 'unknown', error: '', received: 0 },
      // A preview of the block for everyone: it shows what Pro adds.
      proActive: true,
      maps: [
        { name: 'Stillwater', games: 14, survived: 9, rate: 64 },
        { name: 'Lawson', games: 11, survived: 5, rate: 45 },
        { name: 'DeSalle', games: 8, survived: 6, rate: 75 },
        { name: 'Mammon', games: 3, survived: 1, rate: 33 }
      ],
      goals: goalProgress(
        [
          { id: 'd1', metric: 'kills', target: 10, title: '', enabled: true },
          { id: 'd2', metric: 'streak', target: 3, title: 'Три выживания подряд', enabled: true },
          { id: 'd3', metric: 'bestKills', target: 8, title: '', enabled: true }
        ],
        { ...emptySession(now), kills: 7, survived: 4, games: 7, bestStreak: 3, bestKills: 6 }
      ),
      recent: summarizeRecent(
        [
          ['survived', 4, 1],
          ['lost', 1, 2],
          ['survived', 3, 0],
          ['survived', 6, 1],
          ['survived', 2, 0],
          ['lost', 0, 1],
          ['survived', 5, 1]
        ].map(([outcome, kills, deaths], i) => ({
          outcome: outcome as 'survived' | 'lost',
          kills: kills as number,
          deaths: deaths as number,
          mode: 'Bounty Hunt',
          mapName: ['Stillwater', 'Lawson', 'DeSalle', 'Mammon'][i % 4],
          endedAt: now - (7 - i) * 25 * 60_000
        })),
        ''
      )
    }
    if (this.demoTimer) clearTimeout(this.demoTimer)
    this.demoTimer = setTimeout(() => {
      this.clearDemo()
      this.commit(false)
    }, DEMO_MS)
    this.commit(false)
  }

  private clearDemo(): void {
    this.demoView = null
    if (this.demoTimer) clearTimeout(this.demoTimer)
    this.demoTimer = null
  }

  // --------------------------------------------------------- path detection

  async detectPaths(): Promise<{ gamePath: string | null; eventsPath: string | null }> {
    const installDir = await this.findHuntInstallation()
    const gamePath: string | null = installDir ? join(installDir, 'USER', 'Game.log') : null

    let eventsPath: string | null = null
    if (process.env.LOCALAPPDATA) {
      const nvidiaDefault = join(process.env.LOCALAPPDATA, 'NVIDIA Corporation', 'GfeSDK')
      try {
        statSync(nvidiaDefault)
        eventsPath = nvidiaDefault
      } catch {
        // directory not found
      }
    }

    if (gamePath) this.setGamePath(gamePath)
    if (eventsPath) this.setEventsPath(eventsPath)
    return { gamePath, eventsPath }
  }

  async findHuntInstallation(): Promise<string | null> {
    if (process.platform !== 'win32') return null

    const steamRoots = await this.getSteamRoots()
    const candidates: string[] = []

    for (const steamRoot of steamRoots) {
      candidates.push(join(steamRoot, 'steamapps', 'common', 'Hunt Showdown 1896'))
      candidates.push(join(steamRoot, 'steamapps', 'common', 'Hunt Showdown'))

      try {
        const content = readFileSync(join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf-8')
        const pathRegex = /"path"\s+"([^"]+)"/g
        let match
        while ((match = pathRegex.exec(content)) !== null) {
          const libPath = match[1].replace(/\\\\/g, '\\')
          candidates.push(join(libPath, 'steamapps', 'common', 'Hunt Showdown 1896'))
          candidates.push(join(libPath, 'steamapps', 'common', 'Hunt Showdown'))
        }
      } catch {
        // libraryfolders.vdf not found
      }
    }

    for (const gamePath of candidates) {
      try {
        if (statSync(join(gamePath, 'bin', 'win_x64', 'HuntGame.exe'))) return gamePath
      } catch {
        // try next
      }
    }
    return null
  }

  async getSteamRoots(): Promise<string[]> {
    const roots = new Set<string>()
    if (process.env['ProgramFiles(x86)']) roots.add(join(process.env['ProgramFiles(x86)'], 'Steam'))
    if (process.env['ProgramFiles']) roots.add(join(process.env['ProgramFiles'], 'Steam'))

    if (process.platform === 'win32') {
      // Static import above: a dynamic import() throws "Invalid host defined
      // options" once the main process is bytecode-compiled (release builds only).
      const regPaths = [
        'HKCU\\Software\\Valve\\Steam',
        'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam',
        'HKLM\\SOFTWARE\\Valve\\Steam'
      ]
      for (const regPath of regPaths) {
        try {
          const output = execFileSync('reg', ['query', regPath, '/v', 'InstallPath'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          })
          const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/)
          if (match) roots.add(match[1].trim())
        } catch {
          // key not found
        }
      }
    }

    return Array.from(roots).filter((root) => {
      try {
        return !!statSync(root)
      } catch {
        return false
      }
    })
  }

  // ------------------------------------------------------- polling lifecycle

  /** Starts tracking. Safe to call repeatedly. */
  start(): void {
    this.stop()
    if (!this.cfg.gamePath) {
      this.engine.setStatus('game', 'missing')
      return
    }
    this.running = true
    this.firstDiscovery = true
    this.engine.resetTransient()
    this.engine.setStatus('game', 'waiting')
    this.engine.setStatus('events', this.cfg.eventsPath ? 'waiting' : 'missing')
    this.schedule(0)
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.gamePid !== null) this.handleGameStopped(Date.now())
  }

  private restart(): void {
    if (this.cfg.enabled) this.start()
    else this.stop()
  }

  /**
   * Call when the app quits. Saves BEFORE stopping: stopping closes the match in
   * progress, and a match that was still running when the app quit must be saved
   * as running so the next start keeps counting it as the same match.
   */
  dispose(): void {
    this.engine.flushHistory()
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    this.save(this.persisted())
    this.clearDemo()
    this.stop()
  }

  private schedule(delay: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => void this.loop(), delay)
  }

  private async loop(): Promise<void> {
    if (!this.running) return
    try {
      await this.step()
    } catch (e) {
      console.error('[HuntTracker] loop error:', e)
    }
    this.schedule(this.gamePid !== null ? this.engine.cfg.pollMs : IDLE_POLL_MS)
  }

  private async step(): Promise<void> {
    await this.checkProcess(Date.now())
    if (this.gamePid === null) {
      this.expireIdleSession(Date.now())
      return
    }
    await this.ensureTails(Date.now())

    // Game.log first, then the SDK log - same order as the reference: a death
    // screen line must already be known when its highlight shows up.
    if (this.gameTail.attached) {
      const lines = await this.gameTail.read()
      const t = Date.now()
      this.trackHealth('game', this.gameTail)
      if (this.gameGen === -1) this.gameGen = this.gameTail.generation
      else if (this.gameTail.generation !== this.gameGen) {
        this.gameGen = this.gameTail.generation
        this.engine.gameLogReplaced()
      }
      this.engine.setGameLogHealthy(this.gameTail.healthy)
      for (const line of lines) this.engine.feedGameLine(line, t)
    }
    if (this.sdkTail.attached) {
      const lines = await this.sdkTail.read()
      const t = Date.now()
      this.trackHealth('events', this.sdkTail)
      for (const line of lines) this.engine.feedSdkLine(line, t)
    }
    this.engine.tick(Date.now(), this.gameTail.healthy)
    // Quiet stretches have no events to trigger a save: keep the game time safe.
    if (Date.now() - this.lastPlaySave > PLAY_SAVE_MS) {
      this.lastPlaySave = Date.now()
      this.commit()
    }
  }

  // ----------------------------------------------------------- game process

  private async checkProcess(now: number): Promise<void> {
    if (this.gamePid !== null) {
      if (now - this.lastAliveCheck >= ALIVE_CHECK_MS) {
        this.lastAliveCheck = now
        if (!this.deps.isAlive(this.gamePid)) {
          this.handleGameStopped(now)
          return
        }
      }
      if (now - this.lastRevalidate >= REVALIDATE_MS) {
        this.lastRevalidate = now
        const pid = await this.deps.findPid()
        if (pid !== null && pid !== this.gamePid) {
          this.handleGameStopped(now)
          this.handleGameStarted(pid, Date.now())
        }
      }
      return
    }
    if (now - this.lastDiscovery >= DISCOVERY_MS) {
      this.lastDiscovery = now
      const pid = await this.deps.findPid()
      if (pid !== null) this.handleGameStarted(pid, Date.now())
    }
  }

  private handleGameStarted(pid: number, now: number): void {
    // First sighting after tracking began = the game was already running: the
    // match state has to be rebuilt from the existing logs instead of from nothing.
    this.snapshotMode = this.firstDiscovery
    this.firstDiscovery = false
    this.gamePid = pid
    this.discoveredAt = now
    this.lastAliveCheck = now
    this.lastRevalidate = now
    this.gameAttached = false
    this.sdkAttached = false
    this.gameGen = -1
    this.gameHealth = null
    this.sdkHealth = null
    this.gameTail.reset()
    this.sdkTail.reset()
    this.engine.resetTransient()
    const gap = this.cfg.sessionGapHours * HOUR_MS
    if (gap > 0 && now - this.engine.session.lastPayloadAt > gap) {
      console.log('[HuntTracker] long break since the last event - starting a new session')
      this.engine.resetSession(now)
    }
    this.runStart = now
    console.log(
      `[HuntTracker] game started pid=${pid}${this.snapshotMode ? ' (already running)' : ''}`
    )
    this.engine.gameStarted(pid, now)
    this.commit()
  }

  private handleGameStopped(now: number): void {
    console.log('[HuntTracker] game stopped')
    this.foldPlay(now)
    this.runStart = null
    this.engine.gameStopped(now)
    this.gamePid = null
    this.gameAttached = false
    this.sdkAttached = false
    this.gameHealth = null
    this.sdkHealth = null
    this.gameTail.reset()
    this.sdkTail.reset()
    this.commit()
  }

  // -------------------------------------------------------------- log files

  private trackHealth(kind: 'game' | 'events', tail: LogTail): void {
    const prev = kind === 'game' ? this.gameHealth : this.sdkHealth
    if (tail.healthy === prev) return
    if (kind === 'game') this.gameHealth = tail.healthy
    else this.sdkHealth = tail.healthy
    this.engine.setStatus(kind, tail.healthy ? 'online' : 'missing')
  }

  private async ensureTails(now: number): Promise<void> {
    const pid = this.gamePid
    if (pid === null) return

    if (!this.gameAttached && this.cfg.gamePath) {
      const st = await statOrNull(this.cfg.gamePath)
      if (st) {
        if (this.snapshotMode) {
          await this.gameTail.attach(this.cfg.gamePath, false)
          const lines = await this.gameTail.read()
          this.gameGen = this.gameTail.generation
          this.engine.restoreFromGameLines(lines, Date.now())
        } else {
          // A log created right after the game started is this game's. An older
          // one is the previous run's: skip it, the rewrite will be picked up.
          const fresh = st.birthtimeMs >= this.discoveredAt - FRESH_LOG_MS
          await this.gameTail.attach(this.cfg.gamePath, !fresh)
        }
        this.gameAttached = true
      } else {
        this.engine.warnMissing('game', this.discoveredAt, now)
      }
    }

    if (!this.sdkAttached && this.cfg.eventsPath) {
      const path = join(this.cfg.eventsPath, `HuntGame_${pid}.log`)
      const st = await statOrNull(path)
      if (st) {
        await this.sdkTail.attach(path, false)
        if (this.snapshotMode) {
          const lines = await this.sdkTail.read()
          this.engine.restoreFromSdkLines(lines, Date.now())
        }
        this.sdkAttached = true
      } else {
        this.engine.warnMissing('events', this.discoveredAt, now)
      }
    }
  }
}

export { emptyCurrent }
