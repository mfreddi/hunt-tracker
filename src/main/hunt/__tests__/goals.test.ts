// Challenge goals: what the user typed -> a clean list, and progress per metric.

import { describe, expect, it } from 'vitest'
import { MAX_GOALS, goalProgress, goalValue, normalizeGoals } from '../goals'
import { emptySession } from '../engine'

const session = (over: Record<string, number> = {}) => ({ ...emptySession(0), ...over })

describe('normalizeGoals', () => {
  it('older stores and junk give an empty list, never an error', () => {
    for (const junk of [undefined, null, 'x', 42, {}, [null, 'a', 1, {}]]) {
      expect(normalizeGoals(junk)).toEqual([])
    }
  })

  it('keeps a good goal, fills defaults, clamps the target', () => {
    const [g] = normalizeGoals([{ id: 'a1', metric: 'kills', target: 10.9 }])
    expect(g).toEqual({ id: 'a1', metric: 'kills', target: 10, title: '', enabled: true })
    expect(normalizeGoals([{ metric: 'games', target: 99999 }])[0].target).toBe(9999)
  })

  it('drops goals with an unknown metric or a target below 1', () => {
    expect(normalizeGoals([{ metric: 'wins', target: 5 }])).toEqual([])
    expect(normalizeGoals([{ metric: 'kills', target: 0 }])).toEqual([])
    expect(normalizeGoals([{ metric: 'kills', target: 'many' }])).toEqual([])
  })

  it('gives every goal its own id, also when ids are missing, bad or repeated', () => {
    const list = normalizeGoals([
      { id: 'same', metric: 'kills', target: 1 },
      { id: 'same', metric: 'kills', target: 2 },
      { metric: 'games', target: 3 },
      { id: '<script>', metric: 'streak', target: 4 }
    ])
    const ids = list.map((g) => g.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids.every((i) => /^[A-Za-z0-9_-]{1,32}$/.test(i))).toBe(true)
    expect(ids[0]).toBe('same')
  })

  it('at most MAX_GOALS, a trimmed and cut title, enabled unless switched off', () => {
    const many = Array.from({ length: MAX_GOALS + 3 }, (_, i) => ({
      metric: 'kills',
      target: i + 1
    }))
    expect(normalizeGoals(many)).toHaveLength(MAX_GOALS)
    const [g] = normalizeGoals([
      { metric: 'kills', target: 1, title: `  ${'x'.repeat(80)}  `, enabled: false }
    ])
    expect(g.title).toHaveLength(40)
    expect(g.enabled).toBe(false)
  })
})

describe('goal progress', () => {
  it('reads each metric from the session', () => {
    const s = session({ kills: 7, survived: 3, games: 5, bestStreak: 2, bestKills: 4 })
    expect(goalValue('kills', s)).toBe(7)
    expect(goalValue('survived', s)).toBe(3)
    expect(goalValue('games', s)).toBe(5)
    expect(goalValue('streak', s)).toBe(2)
    expect(goalValue('bestKills', s)).toBe(4)
  })

  it('done at the target and beyond; shows the value either way', () => {
    const goals = normalizeGoals([
      { id: 'k', metric: 'kills', target: 10 },
      { id: 's', metric: 'survived', target: 3 }
    ])
    const p = goalProgress(goals, session({ kills: 4, survived: 3 }))
    expect(p.find((g) => g.id === 'k')).toMatchObject({ value: 4, done: false })
    expect(p.find((g) => g.id === 's')).toMatchObject({ value: 3, done: true })
  })

  it('an old session without records reads 0, not NaN', () => {
    const old = { ...emptySession(0) } as Record<string, unknown>
    delete old.bestStreak
    delete old.bestKills
    expect(goalValue('streak', old as never)).toBe(0)
    expect(goalValue('bestKills', old as never)).toBe(0)
  })
})
