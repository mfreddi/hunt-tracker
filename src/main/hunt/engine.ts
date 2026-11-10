// Hunt match/kill/death state machine. A faithful port of the reference
// tracker: HuntTrack.ps1 (log events -> match state, highlight classification)
// plus OverlayState.ps1 (events -> session counters). Pure: no files, no
// timers, no Electron - time is passed in, so it is deterministic and testable
// (see __tests__/replay.test.ts, which replays a real session journal).

import { randomUUID } from 'crypto'
import {
  ClassifiedHighlight,
  DeathSignal,
  PendingHighlight,
  resolveHighlight,
  resolveTrades
} from './classify'
import {
  IGNORED_MAP_IDS,
  RE,
  getMapName,
  modeFromLine,
  parseDisconnect,
  parseGameTimeOfDay,
  parseSdkTimestamp
} from './parse'
import { RECENT_KEEP } from './recent'
import {
  EngineCurrent,
  HuntStatuses,
  LatencyMode,
  LogStatus,
  MatchRecord,
  SdkInfo,
  SdkState,
  SessionCounters
} from './types'

export interface EngineConfig {
  // How long a highlight waits for a death-screen line before it is called a kill.
  classificationDelayMs: number
  // Max distance between a highlight and a death screen to correlate them.
  matchWindowMs: number
  // Kill + death closer than this are one trade; 0 disables trades.
  tradeWindowMs: number
  // How often the logs are polled while the game runs.
  pollMs: number
}

export function configFor(mode: LatencyMode): EngineConfig {
  if (mode === 'normal')
    return { classificationDelayMs: 3000, matchWindowMs: 2000, tradeWindowMs: 500, pollMs: 100 }
  return { classificationDelayMs: 300, matchWindowMs: 2000, tradeWindowMs: 0, pollMs: 25 }
}

export interface EngineEvent {
  name: string
  at: number
  data: Record<string, any>
}

export const emptySession = (now: number): SessionCounters => ({
  startedAt: now,
  lastPayloadAt: now,
  games: 0,
  survived: 0,
  lost: 0,
  kills: 0,
  deaths: 0,
  trades: 0,
  unclassified: 0,
  maps: {},
  modes: {},
  playedMs: 0,
  recent: [],
  streak: 0,
  bestStreak: 0,
  bestKills: 0
})

export const emptyCurrent = (): EngineCurrent => ({
  status: 'idle',
  missionId: '',
  mapId: '',
  mapName: '',
  mode: '',
  outcome: '',
  skulls: [],
  startedAt: 0,
  kills: 0,
  deaths: 0,
  trades: 0,
  unclassified: 0
})

type FinishingMatch = MatchRecord & { missionId: string }

const MAX_SEEN_REQUESTS = 8192
const MAX_KNOWN_MISSIONS = 256
// How much older than the game process start an SDK line may be and still count (clock jitter, a slow discovery).
const STALE_HIGHLIGHT_MS = 120_000
const LOG_WARN_AFTER_MS = 15_000

interface Options {
  config: EngineConfig
  session?: SessionCounters
  current?: EngineCurrent
  now?: number
  onEvent?: (e: EngineEvent) => void
  onChange?: () => void
  // A match is over and none of its highlights is still being classified.
  onMatchFinished?: (r: MatchRecord) => void
  newId?: () => string
}

export class HuntEngine {
  session: SessionCounters
  current: EngineCurrent
  statuses: HuntStatuses = { game: 'waiting', events: 'waiting' }
  cfg: EngineConfig

  // --- transient state mirrored from HuntTrack.ps1 ---
  private selectedMode = 'Unknown'
  private missionMode = 'Unknown'
  private mapId = ''
  private mapName = ''
  private phase = 'idle'
  private matchmakingActive = false
  private matchFound = false
  private missionLoading = false
  private missionLoaded = false
  private missionObservedFromLoading = false
  private matchActive = false
  private activeGroupId = ''
  private missionId = ''
  private sdkMission: { id: string; mode: string; mapId: string; mapName: string } | null = null
  private deathScreenOpen = false
  private deathScreenOpenCount = 0
  private captureWarningShown = false
  private sdkState: SdkState = 'unknown'
  private sdkError = ''
  private highlightsReceived = 0

  private pending: PendingHighlight[] = []
  private classified: ClassifiedHighlight[] = []
  private deathSignals: DeathSignal[] = []
  private seenRequestIds = new Set<string>()
  private seenOrder: string[] = []
  private stopping = false
  private gameLogHealthy = false

  // --- counters bookkeeping mirrored from OverlayState.ps1 ---
  private known = new Set<string>()
  private knownOrder: string[] = []
  private ignored = new Set<string>()
  private overlayMissionId = ''
  private matchCounted = false
  private mapCounted = false
  // When (engine clock) the last NEW game was counted, and when the running game process was seen to start.
  // Guards against a log that is read again from its start (see startMatch / feedSdkLine).
  private lastNewGameAt = -1
  private gameStartedAt = 0
  private outcomeCounted = false
  private seenHighlights = new Set<string>()
  // Mission the persisted counters were last attached to; lets a restart in the
  // middle of a match keep counting it as the same match.
  private resumeMissionId: string
  // Matches that are over but may still get late highlights (normal mode
  // classifies up to 3.5s after the disconnect). Handed out once settled.
  private finishing: FinishingMatch[] = []

  private onEvent?: (e: EngineEvent) => void
  private onChange?: () => void
  private onMatchFinished?: (r: MatchRecord) => void
  private newId: () => string
  private now: number

  constructor(opts: Options) {
    this.cfg = opts.config
    this.now = opts.now ?? Date.now()
    this.session = opts.session ?? emptySession(this.now)
    this.current = opts.current ?? emptyCurrent()
    this.onEvent = opts.onEvent
    this.onChange = opts.onChange
    this.onMatchFinished = opts.onMatchFinished
    this.newId = opts.newId ?? (() => randomUUID().replace(/-/g, ''))
    // A match that was "in progress" when we last ran is not necessarily still
    // running. It only becomes active again if the game log snapshot says so -
    // and only then is its id reused (a finished match must never be resumed).
    const wasInProgress = this.current.status === 'loading' || this.current.status === 'active'
    this.resumeMissionId = wasInProgress ? this.current.missionId : ''
    if (wasInProgress) this.current.status = 'complete'
    this.overlayMissionId = this.current.missionId
    if (this.current.missionId) this.rememberMission(this.current.missionId)
    this.outcomeCounted = this.current.outcome === 'survived' || this.current.outcome === 'lost'
  }

  // ------------------------------------------------------------------ config

  setConfig(cfg: EngineConfig): void {
    this.cfg = cfg
  }

  setStatus(kind: keyof HuntStatuses, status: LogStatus): void {
    if (this.statuses[kind] === status) return
    this.statuses = { ...this.statuses, [kind]: status }
    this.onChange?.()
  }

  /** Mode the overlay scopes its stats to: in play, else picked in the lobby, else the last played. */
  get activeMode(): string {
    const known = (m: string): boolean => !!m && m !== 'Unknown'
    if (this.inMatch && known(this.current.mode)) return this.current.mode
    if (known(this.selectedMode)) return this.selectedMode
    return known(this.current.mode) ? this.current.mode : ''
  }

  // Per-mode counters only exist for real modes ('Unknown' = mode was never seen in the log).
  private bumpMode(
    mode: string | undefined,
    field: 'games' | 'survived' | 'lost' | 'kills' | 'deaths',
    by: number
  ): void {
    if (!mode || mode === 'Unknown') return
    const m = (this.session.modes[mode] ??= { games: 0, survived: 0, lost: 0, kills: 0, deaths: 0 })
    m[field] = Math.max(0, m[field] + by)
  }

  /** NVIDIA Highlights link of this game run, for the settings screen. */
  get sdkInfo(): SdkInfo {
    return { state: this.sdkState, error: this.sdkError, received: this.highlightsReceived }
  }

  /** The game's NVGSDK_Create result line -> link state. True if the state changed. */
  private noteSdkConnection(line: string): boolean {
    const m = RE.sdkCreate.exec(line)
    if (!m) return false
    const ok = m[1].toUpperCase() === 'NVGSDK_SUCCESS'
    const state: SdkState = ok ? 'connected' : 'failed'
    const error = ok ? '' : m[1].toUpperCase()
    if (state === this.sdkState && error === this.sdkError) return false
    this.sdkState = state
    this.sdkError = error
    return true
  }

  get inMatch(): boolean {
    return this.current.status === 'loading' || this.current.status === 'active'
  }

  // ----------------------------------------------------------------- lifecycle

  /** Drop everything transient (not the counters). Used on (re)start of tracking. */
  resetTransient(): void {
    this.selectedMode = 'Unknown'
    this.missionMode = 'Unknown'
    this.mapId = ''
    this.mapName = ''
    this.phase = 'idle'
    this.matchmakingActive = false
    this.matchFound = false
    this.missionLoading = false
    this.missionLoaded = false
    this.missionObservedFromLoading = false
    this.matchActive = false
    this.activeGroupId = ''
    this.missionId = ''
    this.sdkMission = null
    this.deathScreenOpen = false
    this.deathScreenOpenCount = 0
    this.captureWarningShown = false
    this.sdkState = 'unknown'
    this.sdkError = ''
    this.highlightsReceived = 0
    this.pending = []
    this.classified = []
    this.deathSignals = []
    this.seenRequestIds = new Set()
    this.seenOrder = []
    this.stopping = false
  }

  gameStarted(pid: number, now: number): void {
    this.now = now
    this.gameStartedAt = now
    this.emit('game_started', { pid })
  }

  /** Game process is gone: classify what is pending right now, then reset. */
  gameStopped(now: number): void {
    this.now = now
    this.stopping = true
    this.processPending(now)
    this.emit('game_stopped', {})
    this.resetTransient()
    this.statuses = { game: 'waiting', events: 'waiting' }
    this.onChange?.()
  }

  /** Game.log was rewritten while the game kept running. */
  gameLogReplaced(): void {
    this.deathScreenOpen = false
  }

  resetSession(now: number): void {
    this.now = now
    this.session = emptySession(now)
    this.current.skulls = []
    // The match in progress is part of the fresh session.
    this.session.games = this.inMatch ? 1 : 0
    if (this.inMatch) this.bumpMode(this.current.mode, 'games', 1)
    this.onChange?.()
  }

  // ------------------------------------------------------------- game snapshot

  /**
   * The tracker started while the game was already running: rebuild the match
   * state from the whole Game.log (HuntTrack.ps1: Get-GameSnapshot). Does not
   * count anything on its own.
   */
  restoreFromGameLines(lines: string[], now: number): void {
    this.now = now
    let mode = 'Unknown'
    let mapId = ''
    let mapName = ''
    let phase = 'unknown'
    let deathOpen = false
    for (const line of lines) {
      const m = modeFromLine(line)
      if (m) mode = m
      if (RE.loading.test(line) && phase !== 'loading' && phase !== 'mission_loaded') {
        phase = 'loading'
        mapId = ''
        mapName = ''
        deathOpen = false
      }
      const d = parseDisconnect(line, phase)
      if (d && !d.isLoadingTransition) phase = 'complete'
      const lv = RE.prepareLevel.exec(line)
      if (lv) {
        mapId = lv[1]
        mapName = getMapName(mapId)
        phase = 'loading'
      }
      if (RE.missionLoadedSnapshot.test(line)) phase = 'mission_loaded'
      if (RE.deathOpen.test(line)) deathOpen = true
      if (RE.deathClose.test(line)) deathOpen = false
      if (RE.postMatch.test(line)) phase = 'post_match'
      if (RE.teamDetails.test(line)) phase = 'team_details'
      if (RE.menu.test(line)) phase = 'returning_to_menu'
    }
    this.selectedMode = mode
    this.missionMode = mode
    this.mapId = mapId
    this.mapName = mapName
    this.phase = phase
    this.deathScreenOpen = deathOpen
    this.deathScreenOpenCount = Math.max(this.deathScreenOpenCount, deathOpen ? 1 : 0)
    this.missionLoading = phase === 'loading' || phase === 'mission_loaded' || phase === 'gameplay'
    this.missionLoaded = phase === 'mission_loaded' || phase === 'gameplay'
    if (this.missionLoading && !this.missionId) {
      this.missionId = this.resumeMissionId || this.newId()
      if (this.missionId === this.current.missionId) {
        // Same match the persisted counters already include: keep counting it.
        this.current.status = phase === 'loading' ? 'loading' : 'active'
        this.matchCounted = true
        this.mapCounted = !!this.current.mapId
      }
    }
    this.emit('state_restored', { mode, mapId, mapName, phase })
    // Outside a match apply() changes nothing, but the restored mode is the active one now.
    this.onChange?.()
  }

  /** HLOpenGroup without a matching HLCloseGroup = a match is being recorded right now. */
  restoreFromSdkLines(lines: string[], now: number): void {
    this.now = now
    let active = false
    let groupId = ''
    const seen: string[] = []
    this.sdkState = 'unknown'
    this.sdkError = ''
    for (const line of lines) {
      this.noteSdkConnection(line)
      let m = RE.sdkOpenGroup.exec(line)
      if (m) {
        groupId = m[1]
        active = true
        continue
      }
      if (RE.sdkCloseGroup.test(line)) {
        if (active) {
          active = false
          groupId = ''
        }
        continue
      }
      m = RE.sdkSetVideo.exec(line)
      if (m) seen.push(m[1])
    }
    this.seenRequestIds = new Set()
    this.seenOrder = []
    for (const id of seen) this.rememberRequest(id)
    this.highlightsReceived = seen.length
    this.onChange?.()
    this.matchActive = active
    this.activeGroupId = groupId
    if (active) {
      if (!this.missionId) {
        this.missionId = this.resumeMissionId || this.newId()
        if (this.missionId === this.current.missionId) {
          this.current.status = 'active'
          this.matchCounted = true
          this.mapCounted = !!this.current.mapId
        }
      }
      this.phase = 'gameplay'
      this.sdkMission = {
        id: this.missionId,
        mode: this.missionMode,
        mapId: this.mapId,
        mapName: this.mapName
      }
      this.emit('state_restored', {
        mode: this.missionMode,
        mapId: this.mapId,
        mapName: this.mapName,
        phase: 'gameplay'
      })
    }
  }

  // ----------------------------------------------------------------- Game.log

  feedGameLine(line: string, now: number): void {
    this.now = now

    const mode = modeFromLine(line)
    if (mode && mode !== this.selectedMode) {
      this.selectedMode = mode
      this.emit('mode_selected', { mode })
      // Counts nothing, but activeMode follows the lobby pick: push it to the overlay.
      this.onChange?.()
    }

    if (RE.doConfirmReady.test(line) && !RE.responseStartSession.test(line)) {
      if (!this.matchmakingActive) {
        this.matchmakingActive = true
        this.matchFound = false
        this.missionMode = this.selectedMode
        this.phase = 'matchmaking'
        this.emit('matchmaking_started', { mode: this.missionMode })
      }
      return
    }

    if (
      RE.setReadinessOff.test(line) &&
      this.matchmakingActive &&
      !this.matchFound &&
      !this.missionLoading
    ) {
      this.matchmakingActive = false
      this.phase = 'lobby'
      this.emit('matchmaking_cancelled', { mode: this.missionMode })
      return
    }

    if (RE.matchFound.test(line)) {
      if (!this.matchFound) {
        this.matchFound = true
        this.phase = 'match_found'
        this.emit('match_found', { mode: this.missionMode })
      }
      return
    }

    if (RE.loading.test(line)) {
      if (!this.missionLoading) {
        this.missionId = this.newId()
        this.missionLoading = true
        this.missionLoaded = false
        this.missionObservedFromLoading = true
        this.phase = 'loading'
        this.mapId = ''
        this.mapName = ''
        this.deathScreenOpen = false
        this.deathScreenOpenCount = 0
        this.missionMode = this.selectedMode
        this.emit('mission_loading_started', { mode: this.missionMode })
      }
      return
    }

    const level = RE.prepareLevel.exec(line)
    if (level) {
      const newMapId = level[1]
      if (newMapId !== this.mapId) {
        this.mapId = newMapId
        this.mapName = getMapName(newMapId)
        this.emit('map_detected', {
          mapId: this.mapId,
          mapName: this.mapName,
          mode: this.missionMode
        })
      }
      return
    }

    if (RE.missionLoaded.test(line)) {
      if (!this.missionLoaded) {
        this.missionLoaded = true
        this.phase = 'mission_loaded'
        this.emit('mission_loaded', {
          mapId: this.mapId,
          mapName: this.mapName,
          mode: this.missionMode
        })
      }
      return
    }

    if (RE.deathOpen.test(line)) {
      const wasAlreadyOpen = this.deathScreenOpen
      this.deathScreenOpen = true
      this.deathScreenOpenCount++
      this.deathSignals.push({
        observedAt: now,
        utcTimeOfDay: parseGameTimeOfDay(line),
        used: false,
        missionId: this.missionId
      })
      this.emit('death_screen_opened', {
        wasAlreadyOpen,
        screenOpenCount: this.deathScreenOpenCount
      })
      return
    }

    if (RE.deathClose.test(line)) {
      this.deathScreenOpen = false
      this.emit('death_screen_closed', {})
      return
    }

    if (RE.leave.test(line)) {
      this.phase = 'leaving'
      this.emit('mission_leave_requested', { mode: this.missionMode, mapId: this.mapId })
      return
    }

    const disc = parseDisconnect(line, this.phase)
    if (disc && this.phase !== 'idle') {
      if (disc.isLoadingTransition) {
        this.emit('loading_connection_transition', { cause: disc.cause, reasonType: disc.reason })
        return
      }
      this.emit('mission_disconnected', {
        cause: disc.cause,
        reasonType: disc.reason,
        phase: this.phase,
        hadDeathScreen: this.deathScreenOpenCount > 0,
        deathScreenOpen: this.deathScreenOpen,
        fullMatchObserved: this.missionObservedFromLoading
      })
      this.missionObservedFromLoading = false
      this.matchmakingActive = false
      this.matchFound = false
      this.missionLoading = false
      this.missionLoaded = false
      return
    }

    if (RE.menu.test(line)) {
      this.phase = 'returning_to_menu'
      this.missionLoading = false
      this.missionLoaded = false
      this.matchFound = false
      this.matchmakingActive = false
      this.emit('returning_to_menu', { mode: this.missionMode, mapId: this.mapId })
      return
    }

    if (RE.postMatch.test(line)) {
      this.phase = 'post_match'
      this.emit('post_match_summary_opened', {})
      return
    }

    if (RE.teamDetails.test(line)) {
      this.phase = 'team_details'
      this.emit('team_details_opened', {})
    }
  }

  // ---------------------------------------------------------------- SDK log

  feedSdkLine(line: string, now: number): void {
    this.now = now

    if (this.noteSdkConnection(line)) {
      this.onChange?.()
      return
    }

    if (RE.sdkConfigure.test(line)) {
      this.emit('sdk_configured', {})
      return
    }

    const open = RE.sdkOpenGroup.exec(line)
    if (open) {
      this.activeGroupId = open[1]
      if (
        !this.missionId ||
        (!this.matchActive && this.phase !== 'loading' && this.phase !== 'mission_loaded')
      ) {
        this.missionId = this.newId()
      }
      this.sdkMission = {
        id: this.missionId,
        mode: this.missionMode,
        mapId: this.mapId,
        mapName: this.mapName
      }
      this.matchActive = true
      this.matchmakingActive = false
      this.phase = 'gameplay'
      this.emit('gameplay_started', {
        groupRequestId: this.activeGroupId,
        mode: this.missionMode,
        mapId: this.mapId,
        mapName: this.mapName
      })
      return
    }

    if (RE.sdkCloseGroup.test(line)) {
      if (this.matchActive) {
        this.emit('returned_to_lobby', { groupRequestId: this.activeGroupId })
        this.matchActive = false
        this.activeGroupId = ''
      }
      return
    }

    const video = RE.sdkSetVideo.exec(line)
    if (video) {
      const requestId = video[1]
      if (this.seenRequestIds.has(requestId)) return
      // A highlight stamped well before this game process started is a leftover of an earlier run (an old log file
      // that was read again), not something that happened in this one.
      const stamped = parseSdkTimestamp(line)
      if (
        this.gameStartedAt &&
        stamped !== null &&
        stamped < this.gameStartedAt - STALE_HIGHLIGHT_MS
      )
        return
      this.rememberRequest(requestId)
      this.highlightsReceived++
      this.onChange?.()
      const m = this.sdkMission
      this.pending.push({
        requestId,
        missionId: m ? m.id : this.missionId,
        gameLogAvailable: this.gameLogHealthy,
        detectedAt: now,
        sdkTimestamp: parseSdkTimestamp(line),
        mode: m ? m.mode : this.missionMode,
        mapId: m ? m.mapId : this.mapId,
        mapName: m ? m.mapName : this.mapName
      })
      this.emit('highlight_detected', { requestId })
      return
    }

    if (RE.sdkNotInterested.test(line) && !this.captureWarningShown) {
      this.captureWarningShown = true
      this.emit('nvidia_capture_disabled', {})
    }
  }

  // -------------------------------------------------------- classification

  /** Set right after reading Game.log, BEFORE the SDK log is read (highlights remember it). */
  setGameLogHealthy(healthy: boolean): void {
    this.gameLogHealthy = healthy
  }

  /** Call after every read of both logs. */
  tick(now: number, gameLogHealthy: boolean): void {
    this.now = now
    this.gameLogHealthy = gameLogHealthy
    this.processPending(now)
  }

  private processPending(now: number): void {
    const { classificationDelayMs: delay, matchWindowMs, tradeWindowMs } = this.cfg

    const remaining: PendingHighlight[] = []
    for (const p of this.pending) {
      const waited = now - p.detectedAt
      if (!this.stopping && waited < delay) {
        remaining.push(p)
        continue
      }
      const available = this.gameLogHealthy && (!this.stopping || waited >= delay)
      const c = resolveHighlight(p, this.deathSignals, matchWindowMs, available)
      this.classified.push({
        event: c.event,
        certainty: c.certainty,
        requestId: p.requestId,
        missionId: p.missionId,
        mode: p.mode,
        mapId: p.mapId,
        mapName: p.mapName,
        sdkTimestamp: p.sdkTimestamp,
        readyAt: p.detectedAt + delay + tradeWindowMs,
        deltaMs: c.delta
      })
    }
    this.pending = remaining

    const { pairs, remaining: rest } = resolveTrades(this.classified, tradeWindowMs)
    for (const pair of pairs) {
      const ordered = [pair.kill, pair.death].sort(
        (a, b) => (a.sdkTimestamp ?? 0) - (b.sdkTimestamp ?? 0)
      )
      for (const ev of ordered) this.emitHighlight(ev, true)
      this.emit('trade', {
        killRequestId: pair.kill.requestId,
        deathRequestId: pair.death.requestId,
        missionId: pair.kill.missionId,
        gapMs: Math.round(pair.gapMs)
      })
    }
    this.classified = []
    for (const ev of rest) {
      if (!this.stopping && ev.event !== 'unknown_highlight' && now < ev.readyAt) {
        this.classified.push(ev)
        continue
      }
      this.emitHighlight(ev, false)
    }

    const keepFor = delay + matchWindowMs + 5000
    this.deathSignals = this.deathSignals.filter((s) => !s.used && now - s.observedAt <= keepFor)
    this.flushFinished()
  }

  // ---------------------------------------------------------- match history

  private closeMatch(): void {
    const c = this.current
    this.finishing.push({
      missionId: c.missionId,
      id: c.missionId || this.newId(),
      startedAt: c.startedAt || this.now,
      endedAt: this.now,
      mode: c.mode,
      mapId: c.mapId,
      mapName: c.mapName,
      outcome: c.outcome,
      kills: c.kills,
      deaths: c.deaths,
      trades: c.trades,
      unclassified: c.unclassified,
      skulls: [...c.skulls]
    })
    this.flushFinished()
  }

  private finishingFor(missionId: string | undefined): FinishingMatch | undefined {
    return this.finishing.find((r) => r.missionId === (missionId || ''))
  }

  /** Hands out the finished matches none of whose highlights is still waiting. */
  private flushFinished(force = false): void {
    if (!this.finishing.length) return
    const waiting = new Set([...this.pending, ...this.classified].map((p) => p.missionId || ''))
    const keep: FinishingMatch[] = []
    for (const r of this.finishing) {
      if (!force && waiting.has(r.missionId)) {
        keep.push(r)
        continue
      }
      const record: MatchRecord & { missionId?: string } = { ...r }
      delete record.missionId
      this.rememberInSession(record)
      this.onMatchFinished?.(record)
    }
    this.finishing = keep
  }

  /** The session keeps its finished matches for the overlay's recent-matches block. */
  private rememberInSession(r: MatchRecord): void {
    const kept = this.session.recent ?? []
    this.session.recent = [
      ...kept,
      {
        outcome: r.outcome,
        kills: r.kills,
        deaths: r.deaths,
        mode: r.mode,
        mapName: r.mapName,
        endedAt: r.endedAt
      }
    ].slice(-RECENT_KEEP)
    // Records: a lost match ends the run; a match with no result (game closed) neither
    // extends nor breaks it - the same rule as the strip's streak (recent.ts).
    const s = this.session
    if (r.outcome === 'survived') {
      s.streak = (s.streak ?? 0) + 1
      s.bestStreak = Math.max(s.bestStreak ?? 0, s.streak)
    } else if (r.outcome === 'lost') {
      s.streak = 0
    }
    s.bestKills = Math.max(s.bestKills ?? 0, r.kills)
    this.onChange?.()
  }

  /** App is quitting: hand out the finished matches now instead of losing them. */
  flushHistory(): void {
    this.flushFinished(true)
  }

  private emitHighlight(ev: ClassifiedHighlight, suppressSound: boolean): void {
    this.emit(ev.event, {
      requestId: ev.requestId,
      missionId: ev.missionId,
      mode: ev.mode,
      mapId: ev.mapId,
      mapName: ev.mapName,
      certainty: ev.certainty,
      deltaMs: ev.deltaMs ?? null,
      suppressSound
    })
  }

  /** True while a highlight still waits for classification (UI "pending" hint, tests). */
  get hasPending(): boolean {
    return this.pending.length > 0 || this.classified.length > 0
  }

  // ----------------------------------------------------------------- warnings

  /** Called by the tracker when a log never showed up. */
  warnMissing(kind: keyof HuntStatuses, sinceMs: number, now: number): void {
    if (this.statuses[kind] === 'waiting' && now - sinceMs >= LOG_WARN_AFTER_MS) {
      this.setStatus(kind, 'missing')
    }
  }

  // ------------------------------------------------------------------ events

  private emit(name: string, data: Record<string, any>): void {
    if (data.missionId === undefined) data.missionId = this.missionId
    this.apply(name, data)
    this.onEvent?.({ name, at: this.now, data })
  }

  private rememberRequest(id: string): void {
    this.seenRequestIds.add(id)
    this.seenOrder.push(id)
    if (this.seenOrder.length > MAX_SEEN_REQUESTS) {
      this.seenRequestIds.delete(this.seenOrder.shift() as string)
    }
  }

  private rememberMission(id: string): void {
    if (this.known.has(id)) return
    this.known.add(id)
    this.knownOrder.push(id)
    if (this.knownOrder.length > MAX_KNOWN_MISSIONS) {
      this.known.delete(this.knownOrder.shift() as string)
    }
  }

  // Port of OverlayState.ps1: Start-OverlayMatch.
  private startMatch(data: Record<string, any>, status: 'loading' | 'active'): boolean {
    const id: string = data.missionId || ''
    if (
      id &&
      this.known.has(id) &&
      (id !== this.overlayMissionId || this.current.status === 'complete')
    ) {
      return false
    }
    const isNew = id ? !this.known.has(id) : !this.matchCounted
    // Mission ids are made up here, not read from the log, so a log that is read again from its start (a rewrite
    // that looked like a new file, a leftover file) would count every old match as a new game. One poll reads
    // everything it finds at one instant, and a real second game cannot begin in the same poll: refuse it, so such a
    // re-read adds at most one game instead of one per old match.
    if (isNew && this.lastNewGameAt === this.now) return false
    if (isNew) {
      this.lastNewGameAt = this.now
      this.current = {
        ...emptyCurrent(),
        status,
        mode: data.mode || this.missionMode,
        startedAt: this.now
      }
      this.session.games++
      this.bumpMode(this.current.mode, 'games', 1)
      this.matchCounted = true
      this.mapCounted = false
      this.outcomeCounted = false
    }
    if (id) {
      this.overlayMissionId = id
      this.rememberMission(id)
      this.current.missionId = id
    }
    this.current.status = status
    return true
  }

  // Port of OverlayState.ps1: Set-OverlayMap, plus the "not a real match" filter.
  private setMap(data: Record<string, any>): void {
    const id: string = data.mapId || ''
    if (!id) return
    if (IGNORED_MAP_IDS.has(id.toLowerCase())) {
      this.ignoreMission(data.missionId)
      return
    }
    this.current.mapId = id
    this.current.mapName = data.mapName || getMapName(id)
    if (!this.mapCounted) {
      this.session.maps[id] = (this.session.maps[id] || 0) + 1
      this.mapCounted = true
    }
  }

  // Shooting Range / Tutorial: undo the game that loading already counted and
  // swallow everything else that mission produces.
  private ignoreMission(id: string | undefined): void {
    if (!id || this.ignored.has(id)) return
    this.ignored.add(id)
    if (this.current.missionId === id && this.matchCounted) {
      this.session.games = Math.max(0, this.session.games - 1)
      this.bumpMode(this.current.mode, 'games', -1)
    }
    this.matchCounted = false
    this.mapCounted = false
    this.outcomeCounted = false
    this.overlayMissionId = ''
    this.current = emptyCurrent()
  }

  // Port of OverlayState.ps1: Update-HuntOverlay.
  private apply(name: string, data: Record<string, any>): void {
    const s = this.session
    // Shooting Range / Tutorial missions produce no stats at all.
    if (data.missionId && this.ignored.has(data.missionId) && name !== 'game_stopped') return

    switch (name) {
      case 'mission_loading_started':
        if (!data.missionId) this.matchCounted = false
        if (!this.startMatch(data, 'loading')) return
        break
      case 'map_detected':
        if (!this.startMatch(data, 'loading')) return
        this.setMap(data)
        break
      case 'mission_loaded':
      case 'gameplay_started':
        if (!this.startMatch(data, 'active')) return
        this.setMap(data)
        break
      case 'state_restored':
        if (
          data.phase === 'loading' ||
          data.phase === 'mission_loaded' ||
          data.phase === 'gameplay'
        ) {
          if (!this.startMatch(data, data.phase === 'loading' ? 'loading' : 'active')) return
          this.setMap(data)
        } else return
        break
      case 'mission_disconnected': {
        if (data.missionId && data.missionId !== this.overlayMissionId) return
        if (this.current.status === 'complete') return
        const wasInMatch = this.inMatch
        if (!this.outcomeCounted && this.inMatch) {
          const reason: string = data.reasonType
          const deathScreenClosed = !data.deathScreenOpen
          let outcome: '' | 'survived' | 'lost' = ''
          // A death screen earlier in the match does not rule out extraction:
          // what matters is whether it is still open at the disconnect.
          if (reason === 'MissionRequested' && data.fullMatchObserved && deathScreenClosed) {
            outcome = 'survived'
          } else if (
            reason === 'UserRequested' ||
            (reason === 'GameSessionEnded' && data.deathScreenOpen)
          ) {
            outcome = 'lost'
          }
          if (outcome) {
            s[outcome]++
            this.bumpMode(this.current.mode, outcome, 1)
            this.current.outcome = outcome
            this.outcomeCounted = true
          }
        }
        this.current.status = 'complete'
        this.matchCounted = false
        this.mapCounted = false
        if (wasInMatch) this.closeMatch()
        break
      }
      case 'kill':
      case 'death':
      case 'unknown_highlight': {
        const key: string = data.requestId
        if (key) {
          if (this.seenHighlights.has(key)) return
          this.seenHighlights.add(key)
        }
        // Classification can finish after the next match already started.
        const ofCurrent = !data.missionId || data.missionId === this.overlayMissionId
        const rec = this.finishingFor(data.missionId)
        if (name === 'unknown_highlight') {
          s.unclassified++
          if (ofCurrent) this.current.unclassified++
          if (rec) rec.unclassified++
        } else {
          const field = name === 'kill' ? 'kills' : 'deaths'
          s[field]++
          this.bumpMode(data.mode, field, 1)
          if (ofCurrent) {
            this.current.skulls = [...this.current.skulls, name]
            this.current[field]++
          }
          if (rec) {
            rec.skulls.push(name)
            rec[field]++
          }
        }
        break
      }
      case 'trade': {
        if (!data.killRequestId || !data.deathRequestId) return
        const key = `trade:${data.killRequestId}:${data.deathRequestId}`
        if (this.seenHighlights.has(key)) return
        this.seenHighlights.add(key)
        s.trades++
        if (!data.missionId || data.missionId === this.overlayMissionId) this.current.trades++
        const rec = this.finishingFor(data.missionId)
        if (rec) rec.trades++
        break
      }
      case 'game_stopped': {
        // Everything pending was classified just before this event.
        const wasInMatch = this.inMatch
        this.current.status = this.current.status === 'idle' ? 'idle' : 'complete'
        this.matchCounted = false
        this.mapCounted = false
        this.seenHighlights = new Set()
        if (wasInMatch) this.closeMatch()
        break
      }
      default:
        return
    }
    s.lastPayloadAt = this.now
    this.onChange?.()
  }
}
