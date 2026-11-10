import { describe, expect, it } from 'vitest'
import type { AlertPayload } from '../../alertBox/model'
import { HuntEngine, configFor } from '../engine'
import { KillStreakAlerts } from '../KillStreakAlerts'
import { L, T0 } from './helpers'

function setup(over: { pro?: boolean; shown?: boolean; saved?: any } = {}) {
  const data: Record<string, any> = { huntStreak: over.saved ?? { enabled: true } }
  const shown: AlertPayload[] = []
  let pro = over.pro ?? true
  const k = new KillStreakAlerts({
    store: { get: (key) => data[key], set: (key, v) => (data[key] = v) },
    isPro: () => pro,
    show: (p) => (shown.push(p), over.shown ?? true),
    now: () => 1000
  })
  return { k, shown, data, setPro: (v: boolean) => (pro = v) }
}
const kills = (k: KillStreakAlerts, ids: string, ...counts: number[]): void =>
  counts.forEach((n) => k.handleKill({ kills: n, matchId: ids }))

describe('kill streak announcer', () => {
  it('shows the rule at the kill it is set for, once per match', () => {
    const { k, shown } = setup()
    kills(k, 'm1', 1, 2)
    expect(shown).toEqual([])
    kills(k, 'm1', 3)
    expect(shown.map((p) => p.caption.split('\n')[0])).toEqual(['Серия убийств'])
    kills(k, 'm1', 4, 5)
    expect(shown.map((p) => p.caption.split('\n')[0])).toEqual(['Серия убийств', 'Доминатор'])
    kills(k, 'm1', 5) // the same count again: nothing
    expect(shown).toHaveLength(2)
    expect(shown[1].caption).toBe('Доминатор\n5 убийств в матче')
  })

  it('a new match starts over', () => {
    const { k, shown } = setup()
    kills(k, 'm1', 1, 2, 3)
    kills(k, 'm2', 1, 2, 3)
    expect(shown).toHaveLength(2)
  })

  it('kills counted together skip no rule', () => {
    const { k, shown } = setup()
    kills(k, 'm1', 1, 6)
    expect(shown.map((p) => p.caption.split('\n')[0])).toEqual(['Серия убийств', 'Доминатор'])
  })

  it('the built-in chime rises with the rule; an own sound replaces it', () => {
    const { k, shown } = setup({
      saved: {
        enabled: true,
        rules: [
          { id: 'a', kills: 2, title: 'А' },
          { id: 'b', kills: 4, title: 'Б', soundUrl: 'http://localhost:1040/media/b.mp3' },
          { id: 'c', kills: 6, title: 'В' }
        ]
      }
    })
    kills(k, 'm1', 2, 4, 6)
    expect(shown.map((p) => p.chime)).toEqual([1, undefined, 3])
    expect(shown[1].soundUrl).toBe('http://localhost:1040/media/b.mp3')
  })

  it('nothing without Pro, nothing when switched off; switching on in the middle of a match does not announce what is behind', () => {
    const free = setup({ pro: false })
    kills(free.k, 'm1', 1, 2, 3, 4, 5)
    expect(free.shown).toEqual([])
    const off = setup({ saved: { enabled: false } })
    kills(off.k, 'm1', 1, 2, 3)
    expect(off.shown).toEqual([])
    const mid = setup({ saved: { enabled: false } })
    kills(mid.k, 'm1', 1, 2, 3, 4)
    mid.k.save({ enabled: true })
    kills(mid.k, 'm1', 5)
    expect(mid.shown.map((p) => p.caption.split('\n')[0])).toEqual(['Доминатор']) // the 3rd is not told afterwards
  })

  it('a switched-off rule is skipped', () => {
    const { k, shown } = setup({
      saved: {
        enabled: true,
        rules: [
          { id: 'a', kills: 3, title: 'А', enabled: false },
          { id: 'b', kills: 3, title: 'Б' }
        ]
      }
    })
    kills(k, 'm1', 3)
    expect(shown.map((p) => p.caption.split('\n')[0])).toEqual(['Б'])
  })

  it('save() stores a safe state', () => {
    const { k, data } = setup()
    const s = k.save({ enabled: true, duration: 999, rules: [{ id: 'x', kills: 0, title: 'T' }] })
    expect(s.duration).toBe(15)
    expect(s.rules[0].kills).toBe(1)
    expect(data.huntStreak).toEqual(s)
  })

  it('the test button needs Pro and an open alerts overlay', () => {
    const a = setup({ pro: false })
    expect(a.k.test('r5')).toBe('pro')
    expect(a.shown).toEqual([])
    const b = setup({ shown: false })
    expect(b.k.test('r5')).toBe('no-overlay')
    const c = setup()
    expect(c.k.test('nope')).toBe('no-rule')
    expect(c.k.test('r5')).toBe('ok')
    expect(c.shown[0].caption).toBe('Доминатор\n5 убийств в матче')
  })

  it('the preview works without Pro and for a rule that is not saved yet', () => {
    const { k, shown } = setup({ pro: false })
    const p = k.preview({ id: 'new', kills: 8, title: 'Новое', color: '#ff0000' })!
    expect(p.caption).toBe('Новое\n8 убийств в матче')
    expect(p.captionStyle.userColor).toBe('#ff0000')
    expect(shown).toEqual([]) // nothing is sent to the overlay
  })

  it('a handler that throws does not stop the others (the tracker catches it)', () => {
    const { k } = setup()
    expect(() => kills(k, 'm1', 3)).not.toThrow()
  })
})

describe('death alert', () => {
  const saved = { enabled: true, death: { enabled: true, title: 'Минус' } }
  it('shows on a death when the feature and the death alert are on, with Pro', () => {
    const a = setup({ saved })
    a.k.handleDeath({ matchId: 'm1' })
    expect(a.shown.map((p) => p.caption)).toEqual(['Минус'])
    expect(setup({ saved, pro: false }).shown).toEqual([])
    for (const off of [
      { enabled: false, death: { enabled: true } },
      { enabled: true, death: { enabled: false } }
    ]) {
      const b = setup({ saved: off })
      b.k.handleDeath({ matchId: 'm1' })
      expect(b.shown).toEqual([])
    }
    const c = setup({ saved, pro: false })
    c.k.handleDeath({ matchId: 'm1' })
    expect(c.shown).toEqual([])
  })

  it('test button and preview', () => {
    expect(setup({ saved, pro: false }).k.testDeath()).toBe('pro')
    expect(setup({ saved, shown: false }).k.testDeath()).toBe('no-overlay')
    const a = setup({ saved })
    expect(a.k.testDeath()).toBe('ok')
    expect(a.k.previewDeath({ death: { title: 'Новая' }, font: 'Impact' })).toMatchObject({
      caption: 'Новая',
      font: 'Impact'
    })
  })
})

describe('the engine gives the announcer the count of the match when the kill is counted', () => {
  it('kills 1, 2, 3 in a match: the count is already up to date inside the kill event', () => {
    let n = 0
    const counts: number[] = []
    const engine: HuntEngine = new HuntEngine({
      config: configFor('fast'),
      now: T0,
      newId: () => `mission${++n}`,
      onEvent: (e) => {
        if (e.name === 'kill') counts.push(engine.current.kills)
      }
    })
    engine.setGameLogHealthy(true)
    let t = T0
    const game = (l: string): void => engine.feedGameLine(l, t)
    game(L.loading)
    game(L.nub)
    game(L.level('creek'))
    game(L.loaded)
    engine.feedSdkLine(L.open(), t)
    for (let i = 1; i <= 3; i++) {
      engine.feedSdkLine(L.video(`k${i}`), t)
      t += 400
      engine.tick(t, true)
    }
    expect(counts).toEqual([1, 2, 3])
  })
})
