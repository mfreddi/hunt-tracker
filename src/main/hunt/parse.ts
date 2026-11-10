// Pure line parsers for Hunt's Game.log and the NVIDIA GfeSDK HuntGame_<pid>.log.
// Patterns are copied from the reference tracker (HuntTrack.ps1) - PowerShell's
// -match is case-insensitive, hence /i everywhere.

// Short names: this is what the overlay prints as the current map.
export const MAP_NAMES: Record<string, string> = {
  cemetery: 'Stillwater',
  civilwar: 'Lawson',
  creek: 'DeSalle',
  colorado: 'Mammon',
  shooting: 'Shooting Range',
  tutorial_scripted: 'Tutorial'
}

// Not real matches: never count them as a game, a map or a result.
export const IGNORED_MAP_IDS = new Set(['shooting', 'tutorial_scripted'])

export const getMapName = (mapId: string): string => MAP_NAMES[mapId.toLowerCase()] || mapId

export function modeFromLine(line: string): string | null {
  if (/(SelectDeepLinkingTarget|GotoDeepLinkingTarget)\(BountyClashLobby/i.test(line))
    return 'Bounty Clash'
  if (/(SelectDeepLinkingTarget|GotoDeepLinkingTarget)\(BountyHuntLobby/i.test(line))
    return 'Bounty Hunt'
  if (/(SelectDeepLinkingTarget|GotoDeepLinkingTarget)\(QuickplayLobby/i.test(line))
    return 'Soul Survivor'
  return null
}

export interface Disconnect {
  cause: number
  reason: string
  // Hunt destroys the menu network context while connecting to a mission. This
  // happens on EVERY match start and is not a disconnect from the mission.
  isLoadingTransition: boolean
}

export function parseDisconnect(line: string, phase: string): Disconnect | null {
  const m = /Client_OnDisconnect\(cause=(\d+),.*reasonType='([^']+)'/i.exec(line)
  if (!m) return null
  const cause = parseInt(m[1], 10)
  const reason = m[2]
  const isLoadingTransition =
    phase === 'loading' &&
    cause === 11 &&
    reason === 'Unknown' &&
    line.includes("desc='Nub destroyed'")
  return { cause, reason, isLoadingTransition }
}

export const RE = {
  doConfirmReady: /CGameLobby::DoConfirmReady\(\)/i,
  responseStartSession: /response StartSession/i,
  setReadinessOff: /CGameLobby::DoSetReadiness\(\).*ready=0/i,
  matchFound: /Starting UI state machine 'profilecards_showcase\/StateMachine'/i,
  loading: /Starting UI state machine 'loading\/StateMachine'|CGameLobby::OnGameStarting\(\)/i,
  prepareLevel: /PrepareLevel 'levels\/([^']+)' \(client\)/i,
  missionLoaded:
    /transition from state\(eLS_Loading\) to \(eLS_Game\)|entering state eLS_Game\(7\) from eLS_Loading/i,
  // Snapshot variant also accepts any "entering state eLS_Game(".
  missionLoadedSnapshot:
    /entering state eLS_Game\(|transition from state\(eLS_Loading\) to \(eLS_Game\)/i,
  deathOpen: /Starting UI state machine 'death\/StateMachine'/i,
  deathClose: /Stopping UI state machine 'death\/StateMachine'/i,
  leave: /PauseMenuQuit with reason: OnLeaveMission/i,
  menu: /PrepareLevel 'menu' \(server\)/i,
  postMatch: /Starting UI state machine 'post_match_summary\/StateMachine'/i,
  teamDetails: /Starting UI state machine 'teamdetails\/StateMachine'/i,

  sdkConfigure: /Posted Request HLConfigure\[([0-9a-zA-Z]+)\]/i,
  sdkOpenGroup: /Posted Request HLOpenGroup\[([0-9a-zA-Z]+)\]/i,
  sdkCloseGroup: /Posted Request HLCloseGroup\[([0-9a-zA-Z]+)\]/i,
  sdkSetVideo: /Posted Request HLSetVideo\[([0-9a-zA-Z]+)\]/i,
  // The game's own connection to NVIDIA Highlights at launch: SUCCESS, or an error
  // (NVGSDK_ERR_IPC_FAILED = the NVIDIA service never answered). Never retried by the game.
  sdkCreate: /Message Create\[[0-9a-zA-Z]+\] return value: (NVGSDK_[A-Z_]+)\((-?\d+)\)/i,
  sdkNotInterested:
    /Message HLSetVideo\[([0-9a-zA-Z]+)\] return value: NVGSDK_SUCCESS_USER_NOT_INTERESTED\(1004\)/i
}

const DAY_MS = 86_400_000

/** UTC milliseconds-of-day of an epoch timestamp. */
export const utcTimeOfDay = (epochMs: number): number => ((epochMs % DAY_MS) + DAY_MS) % DAY_MS

/**
 * NVIDIA SDK lines start with a LOCAL time "2026-10-03T23:39:04.606". Returns
 * the epoch milliseconds of that instant (null when the line has no prefix).
 */
export function parseSdkTimestamp(line: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(line)
  if (!m) return null
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]).getTime()
  return Number.isFinite(t) ? t : null
}

/** Game.log lines may start with "<21:39:04>" - UTC time of day, 1s resolution. */
export function parseGameTimeOfDay(line: string): number | null {
  const m = /^<(\d{2}):(\d{2}):(\d{2})>/.exec(line)
  if (!m) return null
  return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000
}

export { DAY_MS }
