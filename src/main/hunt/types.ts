export type HuntRow = 'duration' | 'survival' | 'combat' | 'modes' | 'current' | 'recent'

// Overlay themes. The Pro ones are gated by the isPro flag (always on in the standalone build).
export type HuntTheme = 'classic' | 'slate' | 'wood' | 'blood'
export const HUNT_THEMES: HuntTheme[] = ['classic', 'slate', 'wood', 'blood']
export const PRO_THEMES: HuntTheme[] = ['slate', 'wood', 'blood']

// normal: 3s classification wait + 500ms trade window (trades detected, slowest).
// fast: 300ms wait, no trades. The reference also has "instant" (no wait at all, late
// death records show up as false kills) - dropped on purpose, stores holding it load as fast.
export type LatencyMode = 'normal' | 'fast'

export interface HuntLook {
  position: 'top-left' | 'top' | 'top-right' | 'bottom-left' | 'bottom' | 'bottom-right'
  bg: string
  text: string
  accent: string
  scale: number
  // Background opacity 0..1 (text stays solid); 1 = the original look.
  bgOpacity: number
  // The theme the user picked (kept while Pro lapses, so it comes back).
  theme: HuntTheme
  // mode: the stats of the mode being played right now; session: everything.
  scope: 'mode' | 'session'
  // What the win-rate-per-map widget counts: this session's matches or the whole history.
  mapsPeriod: 'session' | 'all'
  rows: Record<HuntRow, boolean>
}

// Per game mode (Bounty Hunt / Bounty Clash / Soul Survivor), same meaning as the session totals.
export interface ModeCounters {
  games: number
  survived: number
  lost: number
  kills: number
  deaths: number
}

// What a win rate needs to know about a match (SessionMatch and the history both fit).
export interface MapSample {
  outcome: '' | 'survived' | 'lost'
  mode: string
  mapName: string
}

export interface MapRate {
  name: string
  games: number
  survived: number
  // 0..100, survived / games
  rate: number
}

// A finished match of the session, kept for the "recent matches" block (Pro).
export interface SessionMatch {
  // '' = no clear result (the game was closed mid-match).
  outcome: '' | 'survived' | 'lost'
  kills: number
  deaths: number
  mode: string
  mapName: string
  endedAt: number
}

// What the overlay draws for the recent-matches block (already scoped to the mode).
export interface RecentSummary {
  // The last few matches, newest last.
  matches: SessionMatch[]
  // Survived matches in a row right now / the best run / the most kills in one match.
  streak: number
  bestStreak: number
  bestKills: number
  total: number
}

export interface SessionCounters {
  startedAt: number
  lastPayloadAt: number
  games: number
  survived: number
  lost: number
  kills: number
  deaths: number
  trades: number
  // Highlights we could not classify as kill or death (game log unreadable).
  unclassified: number
  maps: Record<string, number>
  modes: Record<string, ModeCounters>
  // Time the game was running during this session (ms). The run in progress is
  // folded in by the tracker; older stores load it as 0.
  playedMs: number
  // Finished matches of this session, oldest first (RECENT_KEEP at most). Not sent
  // to the overlay as is: state.recent is the summary. Older stores load it empty.
  recent: SessionMatch[]
  // Session records (all modes), kept apart from `recent` because that list is capped
  // and a record must never fall out of it: survived matches in a row right now, the
  // best such run, the most kills in one match. Older stores load them as 0.
  streak: number
  bestStreak: number
  bestKills: number
}

export interface HuntSession extends Omit<SessionCounters, 'recent'> {
  kd: number
}

export type MatchStatus = 'idle' | 'loading' | 'active' | 'complete'

// The match the counters are currently attached to. Persisted so a restart in
// the middle of a match does not count the same match twice.
export interface EngineCurrent {
  status: MatchStatus
  missionId: string
  mapId: string
  mapName: string
  mode: string
  outcome: '' | 'survived' | 'lost'
  skulls: Array<'kill' | 'death'>
  // Per-match counters for the match history (older stores load them as 0).
  startedAt: number
  kills: number
  deaths: number
  trades: number
  unclassified: number
}

// One finished match, as the engine hands it to the match history.
export interface MatchRecord {
  id: string
  startedAt: number
  endedAt: number
  mode: string
  mapId: string
  mapName: string
  // '' = left without a clear result (crash, game closed, reason not recognised).
  outcome: '' | 'survived' | 'lost'
  kills: number
  deaths: number
  trades: number
  unclassified: number
  skulls: Array<'kill' | 'death'>
}

// A line of the history file. `v` lets a later format read older lines.
export interface HuntMatchEntry extends MatchRecord {
  v: 1
  latencyMode: LatencyMode
}

// What the overlay renders as "current match".
export interface HuntCurrentMatch {
  inMatch: boolean
  map: string
  mode: string
  skulls: Array<'kill' | 'death'>
}

export type LogStatus = 'waiting' | 'online' | 'missing'

// Challenge goals (Pro). Progress counts the session, so a new session starts it over.
// streak = the BEST survival run of the session (not the current one), bestKills = the
// most kills in one match: both only grow, so a reached goal stays reached.
export type GoalMetric = 'kills' | 'survived' | 'games' | 'streak' | 'bestKills'

export interface HuntGoal {
  id: string
  metric: GoalMetric
  target: number
  // Empty = the metric's default label.
  title: string
  enabled: boolean
}

export interface GoalProgress extends HuntGoal {
  value: number
  done: boolean
}

// Did the game connect to NVIDIA Highlights when it started? Without that no kill or
// death event exists at all, whatever the log files look like.
export type SdkState = 'unknown' | 'connected' | 'failed'

export interface SdkInfo {
  state: SdkState
  // NVIDIA's error name when state is 'failed' (e.g. NVGSDK_ERR_IPC_FAILED).
  error: string
  // Highlight events received from NVIDIA in this game run.
  received: number
}

export interface HuntStatuses {
  game: LogStatus
  events: LogStatus
}

export interface HuntState {
  gamePath: string | null
  eventsPath: string | null
  enabled: boolean
  connected: boolean
  // Mode the stats are scoped to: the one being played, else the one picked in the lobby, else the last played ('' = unknown).
  activeMode: string
  // session.playedMs is up to this moment; while the game runs the overlay adds
  // (now - playingSince) itself so the clock moves between updates. null = not running.
  playingSince: number | null
  // New session after a break without the game this long (hours); 0 = never.
  sessionGapHours: number
  // Theme the overlay actually draws: look.theme, or classic without Pro.
  theme: HuntTheme
  latencyMode: LatencyMode
  look: HuntLook
  session: HuntSession
  current: HuntCurrentMatch
  statuses: HuntStatuses
  sdk: SdkInfo
  // Recent matches block; null when the Pro flag is off (the overlay draws nothing then).
  recent: RecentSummary | null
  // The user's goals with live progress (the settings edit them whatever the plan);
  // the overlay widget draws them only while proActive.
  goals: GoalProgress[]
  proActive: boolean
  // Win rate per map (the widget ?show=maps); null when the Pro flag is off.
  maps: MapRate[] | null
}

// What actually goes to electron-store (view-only fields are rebuilt on load).
export interface HuntPersisted {
  gamePath: string | null
  eventsPath: string | null
  enabled: boolean
  latencyMode: LatencyMode
  look: HuntLook
  sessionGapHours: number
  goals: HuntGoal[]
  session: SessionCounters
  match: EngineCurrent
}
