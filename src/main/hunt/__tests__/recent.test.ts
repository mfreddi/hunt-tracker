// Recent-matches block: streak, best streak, best match, mode scope.

import { describe, expect, it } from 'vitest'
import { RECENT_SHOWN, summarizeRecent } from '../recent'
import { SessionMatch } from '../types'

const m = (outcome: SessionMatch['outcome'], kills = 0, mode = 'Bounty Hunt'): SessionMatch => ({
  outcome,
  kills,
  deaths: 0,
  mode,
  mapName: 'Stillwater',
  endedAt: 1
})

describe('summarizeRecent', () => {
  it('an empty session has nothing', () => {
    expect(summarizeRecent([], '')).toEqual({
      matches: [],
      streak: 0,
      bestStreak: 0,
      bestKills: 0,
      total: 0
    })
  })

  it('counts the survival streak up to now, and the best one', () => {
    const r = summarizeRecent(
      [m('survived'), m('survived'), m('survived'), m('lost'), m('survived'), m('survived')],
      ''
    )
    expect(r.streak).toBe(2)
    expect(r.bestStreak).toBe(3)
  })

  it('a lost match ends the streak right now', () => {
    expect(summarizeRecent([m('survived'), m('survived'), m('lost')], '').streak).toBe(0)
  })

  it('a match with no result neither extends nor breaks the streak', () => {
    const r = summarizeRecent([m('survived'), m(''), m('survived')], '')
    expect(r.streak).toBe(2)
    expect(r.bestStreak).toBe(2)
  })

  it('best match by kills', () => {
    expect(summarizeRecent([m('survived', 3), m('lost', 9), m('survived', 4)], '').bestKills).toBe(
      9
    )
  })

  it('shows only the last few matches, newest last, but counts all of them', () => {
    const all = Array.from({ length: 12 }, (_, i) => m('survived', i))
    const r = summarizeRecent(all, '')
    expect(r.matches).toHaveLength(RECENT_SHOWN)
    expect(r.matches.at(-1)?.kills).toBe(11)
    expect(r.total).toBe(12)
    expect(r.streak).toBe(12)
  })

  it('looks at one mode when asked: chips, streak and records of that mode only', () => {
    const all = [
      m('survived', 2, 'Bounty Hunt'),
      m('lost', 7, 'Bounty Clash'),
      m('survived', 3, 'Bounty Hunt'),
      m('survived', 1, 'Bounty Clash')
    ]
    const hunt = summarizeRecent(all, 'Bounty Hunt')
    expect(hunt).toMatchObject({ streak: 2, bestStreak: 2, bestKills: 3, total: 2 })
    const clash = summarizeRecent(all, 'Bounty Clash')
    expect(clash).toMatchObject({ streak: 1, bestStreak: 1, bestKills: 7, total: 2 })
  })
})
