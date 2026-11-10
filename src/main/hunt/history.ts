// Hunt match history: one JSON line per finished match, append-only, in
// <userData>/hunt-history/matches.ndjson. Plain files on purpose (not SQLite):
// the volume is tiny and a native module would complicate the wine release
// build - see docs/hunt-tracker.md.

import { appendFileSync, mkdirSync, promises as fs } from 'fs'
import { join } from 'path'
import { HuntMatchEntry, LatencyMode, MatchRecord } from './types'

const FILE = 'matches.ndjson'

const int = (v: any): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}
const text = (v: any): string => (typeof v === 'string' ? v : '')

/** One stored line -> entry; null for a line that is not a match record. */
export function parseEntry(line: string): HuntMatchEntry | null {
  let r: any
  try {
    r = JSON.parse(line)
  } catch {
    return null
  }
  if (!r || typeof r !== 'object' || !r.id || !int(r.endedAt)) return null
  return {
    v: 1,
    id: String(r.id),
    startedAt: int(r.startedAt),
    endedAt: int(r.endedAt),
    mode: text(r.mode),
    mapId: text(r.mapId),
    mapName: text(r.mapName),
    outcome: r.outcome === 'survived' || r.outcome === 'lost' ? r.outcome : '',
    kills: int(r.kills),
    deaths: int(r.deaths),
    trades: int(r.trades),
    unclassified: int(r.unclassified),
    skulls: Array.isArray(r.skulls)
      ? r.skulls.filter((x: any) => x === 'kill' || x === 'death')
      : [],
    latencyMode: r.latencyMode === 'normal' ? 'normal' : 'fast'
  }
}

export class HuntHistory {
  constructor(private dir: string | null) {}

  private get file(): string | null {
    return this.dir ? join(this.dir, FILE) : null
  }

  /** Sync on purpose: one short line per match, and it must survive an app quit right after. */
  append(r: MatchRecord, latencyMode: LatencyMode): HuntMatchEntry | null {
    const file = this.file
    if (!file) return null
    const entry: HuntMatchEntry = { v: 1, ...r, latencyMode }
    try {
      mkdirSync(this.dir as string, { recursive: true })
      appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
      return entry
    } catch (err) {
      console.error('hunt history append failed', err)
      return null
    }
  }

  /** All matches, newest first. A broken line (crash mid-write) is skipped, not fatal. */
  async list(): Promise<HuntMatchEntry[]> {
    const file = this.file
    if (!file) return []
    let raw: string
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      return []
    }
    const out: HuntMatchEntry[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      const e = parseEntry(line)
      if (e) out.push(e)
    }
    return out.reverse()
  }
}
