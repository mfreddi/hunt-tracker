// Challenge goals (Pro): "10 kills this stream", "3 survivals in a row", ... The user
// builds the list in the settings; the overlay widget (?show=goal) draws a progress bar
// per goal. Progress comes from the session counters, so it resets with a new session.
// Pure (no I/O): normalizing what the user typed and counting progress are unit-tested.

import { randomUUID } from 'crypto'
import { GoalProgress, HuntGoal, GoalMetric, SessionCounters } from './types'

export const GOAL_METRICS: GoalMetric[] = ['kills', 'survived', 'games', 'streak', 'bestKills']
export const MAX_GOALS = 5
export const MAX_GOAL_TARGET = 9999
const MAX_TITLE = 40

/** What each metric counts, for the default title and the settings. */
export const GOAL_LABELS: Record<GoalMetric, string> = {
  kills: 'Убийств за эфир',
  survived: 'Выживаний за эфир',
  games: 'Каток за эфир',
  streak: 'Выживаний подряд',
  bestKills: 'Убийств за одну катку'
}

/**
 * The goal list as stored / typed -> a clean one. Never throws: a damaged goal is
 * dropped, a missing field gets a default (older stores have no goals at all).
 */
export function normalizeGoals(raw: unknown): HuntGoal[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: HuntGoal[] = []
  for (const g of raw) {
    if (out.length >= MAX_GOALS) break
    if (!g || typeof g !== 'object') continue
    const o = g as Record<string, unknown>
    if (!GOAL_METRICS.includes(o.metric as GoalMetric)) continue
    const target = Math.floor(Number(o.target))
    if (!Number.isFinite(target) || target < 1) continue
    let id = typeof o.id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(o.id) ? o.id : ''
    if (!id || seen.has(id)) id = `g_${randomUUID().slice(0, 8)}`
    seen.add(id)
    out.push({
      id,
      metric: o.metric as GoalMetric,
      target: Math.min(MAX_GOAL_TARGET, target),
      title: typeof o.title === 'string' ? o.title.trim().slice(0, MAX_TITLE) : '',
      enabled: o.enabled !== false
    })
  }
  return out
}

/**
 * Current value of a metric. All of them only grow during a session (the streak
 * metric is the BEST run, not the current one), so a reached goal stays reached.
 */
export function goalValue(metric: GoalMetric, s: SessionCounters): number {
  switch (metric) {
    case 'kills':
      return s.kills
    case 'survived':
      return s.survived
    case 'games':
      return s.games
    case 'streak':
      return s.bestStreak ?? 0
    case 'bestKills':
      return s.bestKills ?? 0
  }
}

export function goalProgress(goals: HuntGoal[], s: SessionCounters): GoalProgress[] {
  return goals.map((g) => {
    const value = goalValue(g.metric, s)
    return { ...g, value, done: value >= g.target }
  })
}
