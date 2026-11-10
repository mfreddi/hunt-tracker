// "Recent matches" block of the overlay: the last matches of the session as chips,
// the current survival streak, the best streak and the best match by kills.
// Pure (no I/O), so it is unit-tested; the tracker calls it when it builds the state.

import { RecentSummary, SessionMatch } from './types'

// How many finished matches the session remembers / how many chips the overlay draws.
export const RECENT_KEEP = 60
export const RECENT_SHOWN = 8

/**
 * `mode` = '' for the whole session, a mode name to look at that mode only (the
 * overlay shows the stats of the mode being played by default).
 *
 * Streak: survived matches in a row. A lost match ends it; a match with no clear
 * result (the game was closed mid-match) neither extends nor breaks it.
 */
export function summarizeRecent(all: SessionMatch[], mode: string): RecentSummary {
  const list = mode ? all.filter((m) => m.mode === mode) : all
  let run = 0
  let bestStreak = 0
  let bestKills = 0
  for (const m of list) {
    if (m.outcome === 'survived') {
      run++
      bestStreak = Math.max(bestStreak, run)
    } else if (m.outcome === 'lost') {
      run = 0
    }
    bestKills = Math.max(bestKills, m.kills)
  }
  return {
    matches: list.slice(-RECENT_SHOWN),
    streak: run,
    bestStreak,
    bestKills,
    total: list.length
  }
}
