// Win rate per map (Pro): of the matches played on a map, how many were survived.
// Pure (no I/O) and unit-tested; the tracker feeds it either the session's matches or
// every match of the history.

import { MapRate, MapSample } from './types'

export const MAPS_SHOWN = 6

/**
 * `mode` = '' for all modes, else only that mode's matches. A match with no result (the
 * game was closed mid-match) or no map name says nothing about a win rate and is skipped.
 * Most played maps first; ties by name so the order does not jump around.
 */
export function summarizeMaps(all: MapSample[], mode: string): MapRate[] {
  const byMap = new Map<string, { games: number; survived: number }>()
  for (const m of all) {
    if (mode && m.mode !== mode) continue
    if (!m.mapName || (m.outcome !== 'survived' && m.outcome !== 'lost')) continue
    const r = byMap.get(m.mapName) ?? { games: 0, survived: 0 }
    r.games++
    if (m.outcome === 'survived') r.survived++
    byMap.set(m.mapName, r)
  }
  return [...byMap.entries()]
    .map(([name, r]) => ({
      name,
      games: r.games,
      survived: r.survived,
      rate: Math.round((r.survived * 100) / r.games)
    }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, MAPS_SHOWN)
}
