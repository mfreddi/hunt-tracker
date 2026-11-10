// Kill-vs-death classification and trade pairing, ported from the reference
// tracker (TrackerIO.ps1: Resolve-Highlight / Resolve-HuntTrades).
//
// NVIDIA writes one "HLSetVideo" highlight per kill AND per death. Only the
// game log tells them apart: a death screen opening right next to the highlight
// means the highlight was a death. Everything else is a kill.

import { DAY_MS, utcTimeOfDay } from './parse'

export interface DeathSignal {
  observedAt: number
  // UTC time of day from the "<HH:MM:SS>" prefix of the Game.log line (1s resolution).
  utcTimeOfDay: number | null
  used: boolean
  missionId: string
}

export interface PendingHighlight {
  requestId: string
  missionId: string
  gameLogAvailable: boolean
  detectedAt: number
  sdkTimestamp: number | null
  mode: string
  mapId: string
  mapName: string
}

export type HighlightKind = 'kill' | 'death' | 'unknown_highlight'

export interface Classification {
  event: HighlightKind
  certainty: 'correlated' | 'inferred' | 'direct_unclassified'
  delta: number | null
}

export function resolveHighlight(
  pending: PendingHighlight,
  signals: DeathSignal[],
  windowMs: number,
  gameLogAvailable: boolean
): Classification {
  let best: DeathSignal | null = null
  let bestDiff = Number.MAX_VALUE
  for (const s of signals) {
    if (s.used || s.missionId !== pending.missionId) continue
    let diff = Math.abs(pending.detectedAt - s.observedAt)
    if (pending.sdkTimestamp != null && s.utcTimeOfDay != null) {
      diff = Math.abs(utcTimeOfDay(pending.sdkTimestamp) - s.utcTimeOfDay)
      diff = Math.min(diff, DAY_MS - diff)
    }
    if (diff <= windowMs && diff < bestDiff) {
      best = s
      bestDiff = diff
    }
  }
  if (best) {
    best.used = true
    return { event: 'death', certainty: 'correlated', delta: Math.round(bestDiff) }
  }
  if (!gameLogAvailable || !pending.gameLogAvailable) {
    return { event: 'unknown_highlight', certainty: 'direct_unclassified', delta: null }
  }
  return { event: 'kill', certainty: 'inferred', delta: null }
}

export interface ClassifiedHighlight {
  event: HighlightKind
  certainty: Classification['certainty']
  requestId: string
  missionId: string
  mode: string
  mapId: string
  mapName: string
  sdkTimestamp: number | null
  readyAt: number
  suppressSound?: boolean
  /** How far the death screen was from the highlight (ms) when it was called a death; for the log. */
  deltaMs?: number | null
}

export interface Trade {
  kill: ClassifiedHighlight
  death: ClassifiedHighlight
  gapMs: number
}

/** A kill and a death of the same mission within windowMs of each other (SDK clock) is a trade. */
export function resolveTrades(
  events: ClassifiedHighlight[],
  windowMs: number
): { pairs: Trade[]; remaining: ClassifiedHighlight[] } {
  const candidates: Trade[] = []
  if (windowMs > 0) {
    for (const kill of events.filter((e) => e.event === 'kill')) {
      for (const death of events.filter((e) => e.event === 'death')) {
        if (!kill.missionId || kill.missionId !== death.missionId) continue
        if (kill.sdkTimestamp == null || death.sdkTimestamp == null) continue
        const gap = Math.abs(kill.sdkTimestamp - death.sdkTimestamp)
        if (gap <= windowMs) candidates.push({ kill, death, gapMs: gap })
      }
    }
  }
  const used = new Set<string>()
  const pairs: Trade[] = []
  // Array.prototype.sort is stable: equal gaps keep discovery order.
  for (const c of [...candidates].sort((a, b) => a.gapMs - b.gapMs)) {
    if (used.has(c.kill.requestId) || used.has(c.death.requestId)) continue
    used.add(c.kill.requestId)
    used.add(c.death.requestId)
    pairs.push(c)
  }
  return { pairs, remaining: events.filter((e) => !used.has(e.requestId)) }
}
