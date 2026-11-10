import { describe, expect, it } from 'vitest'
import {
  deathPayload,
  defaultRules,
  killsWord,
  normalizeStreak,
  rulesToFire,
  streakPayload
} from '../killStreak'

describe('normalizeStreak', () => {
  it('nothing saved: the default rules, switched off', () => {
    const s = normalizeStreak(undefined)
    expect(s.enabled).toBe(false)
    expect(s.rules.map((r) => [r.kills, r.title])).toEqual([
      [3, 'Серия убийств'],
      [5, 'Доминатор'],
      [7, 'Неудержимый'],
      [10, 'Богоподобный']
    ])
    expect(s).toMatchObject({ duration: 4, position: 'mc', widthPct: 20, volume: 70 })
    expect(normalizeStreak('junk')).toEqual(s)
  })

  it('a saved empty list stays empty (the streamer deleted the rules), it is not refilled', () => {
    expect(normalizeStreak({ rules: [] }).rules).toEqual([])
  })

  it('makes every value safe: clamps, checks colour and links, unique ids, at most 12 rules', () => {
    const s = normalizeStreak({
      enabled: true,
      duration: 99,
      position: 'zz',
      volume: -5,
      rules: [
        {
          id: 'a',
          kills: 0,
          title: '  Дабл   кил ',
          color: 'red',
          mediaUrl: 'javascript:1',
          soundUrl: 'file:///x.mp3'
        },
        {
          id: 'a',
          kills: 500,
          title: '',
          mediaUrl: 'http://localhost:1040/media/a.png',
          soundUrl: 'http://localhost:1040/media/a.mp3',
          enabled: false
        },
        null
      ]
    })
    expect(s).toMatchObject({ enabled: true, duration: 15, position: 'mc', volume: 0 })
    expect(s.rules).toHaveLength(2)
    expect(s.rules[0]).toMatchObject({
      id: 'a',
      kills: 1,
      title: 'Дабл кил',
      mediaUrl: '',
      soundUrl: ''
    })
    expect(s.rules[0].color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(s.rules[1]).toMatchObject({
      id: 'a_',
      kills: 50,
      title: 'Серия убийств',
      enabled: false
    })
    expect(s.rules[1].mediaUrl).toBe('http://localhost:1040/media/a.png')
    const many = normalizeStreak({
      rules: Array.from({ length: 40 }, (_, i) => ({ kills: i + 2 }))
    })
    expect(many.rules).toHaveLength(12)
  })

  it('a saved state survives normalizing again unchanged', () => {
    const once = normalizeStreak({ enabled: true, rules: defaultRules() })
    expect(normalizeStreak(once)).toEqual(once)
  })
})

describe('killsWord', () => {
  it('agrees with the number', () => {
    const f = (n: number): string => `${n} ${killsWord(n)}`
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25].map(f)).toEqual([
      '1 убийство',
      '2 убийства',
      '4 убийства',
      '5 убийств',
      '11 убийств',
      '12 убийств',
      '14 убийств',
      '21 убийство',
      '22 убийства',
      '25 убийств'
    ])
  })
})

describe('rulesToFire', () => {
  const rules = normalizeStreak({ rules: defaultRules() }).rules

  it('fires the rule of exactly this kill, once per match', () => {
    expect(rulesToFire(rules, 4, 5, new Set()).map((r) => r.kills)).toEqual([5])
    expect(rulesToFire(rules, 4, 5, new Set(['r5']))).toEqual([])
    expect(rulesToFire(rules, 1, 2, new Set())).toEqual([])
  })

  it('a rule of the first kill (first blood) fires on the first kill of a match only', () => {
    const first = normalizeStreak({ rules: [{ id: 'fb', kills: 1, title: 'Первая кровь' }] }).rules
    expect(rulesToFire(first, 0, 1, new Set()).map((r) => r.id)).toEqual(['fb'])
    expect(rulesToFire(first, 0, 1, new Set(['fb']))).toEqual([])
    expect(rulesToFire(first, 1, 2, new Set())).toEqual([])
  })

  it('kills counted together skip no rule: those passed fire, the lowest first', () => {
    expect(rulesToFire(rules, 2, 8, new Set()).map((r) => r.kills)).toEqual([3, 5, 7])
    expect(rulesToFire(rules, 2, 8, new Set(['r3', 'r5'])).map((r) => r.kills)).toEqual([7])
  })

  it('a switched-off rule and a count that did not grow fire nothing', () => {
    const off = rules.map((r) => (r.kills === 5 ? { ...r, enabled: false } : r))
    expect(rulesToFire(off, 4, 5, new Set())).toEqual([])
    expect(rulesToFire(rules, 5, 5, new Set())).toEqual([])
    expect(rulesToFire(rules, 6, 5, new Set())).toEqual([]) // a count that went down (a new match)
  })
})

describe('streakPayload', () => {
  const state = normalizeStreak({ duration: 5, position: 'tc', widthPct: 30, volume: 60 })
  const rule = state.rules[1]

  it('the title in the colour of the rule, the count under it, the look of the feature', () => {
    const p = streakPayload(rule, state, 5, 2, 'id1')
    expect(p).toMatchObject({
      id: 'id1',
      kind: 'image',
      duration: 5,
      position: 'tc',
      widthPct: 30,
      volume: 60
    })
    expect(p.caption).toBe('Доминатор\n5 убийств в матче')
    expect(p.captionParts).toEqual([
      { t: 'Доминатор', k: 'user' },
      { t: '\n', k: '' },
      { t: '5 убийств в матче', k: 'text' }
    ])
    expect(p.captionStyle).toMatchObject({
      userColor: rule.color,
      bg: false,
      size: 76,
      textSize: 34
    })
  })

  it('the built-in chime only when the rule has no sound of its own; its rank is kept in 1..4', () => {
    expect(streakPayload(rule, state, 5, 2, 'x').chime).toBe(2)
    expect(streakPayload(rule, state, 5, 99, 'x').chime).toBe(4)
    expect(streakPayload(rule, state, 5, 0, 'x').chime).toBe(1)
    const own = { ...rule, soundUrl: 'http://localhost:1040/media/s.mp3' }
    const p = streakPayload(own, state, 5, 2, 'x')
    expect(p.soundUrl).toBe('http://localhost:1040/media/s.mp3')
    expect(p).not.toHaveProperty('chime')
  })

  it('a video link makes a video', () => {
    expect(
      streakPayload({ ...rule, mediaUrl: 'http://localhost:1040/media/a.webm' }, state, 5, 1, 'x')
        .kind
    ).toBe('video')
  })
})

describe('death alert and font', () => {
  it('defaults: death switched off, no font; values made safe', () => {
    const s = normalizeStreak(undefined)
    expect(s.death).toMatchObject({ enabled: false, title: 'Вы погибли', soundUrl: '' })
    expect(s.font).toBe('')
    const t = normalizeStreak({
      font: "Bad';Font{}",
      death: { enabled: true, title: '  ', color: 'red', soundUrl: 'file:///x.mp3' }
    })
    expect(t.font).toBe('BadFont')
    expect(t.death).toMatchObject({ enabled: true, title: 'Вы погибли', soundUrl: '' })
    expect(t.death.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(normalizeStreak(t)).toEqual(t)
  })

  it('the font goes to every alert; a death alert is the title alone, with no chime', () => {
    const state = normalizeStreak({
      font: 'Impact',
      death: { enabled: true, title: 'Минус', soundUrl: 'http://localhost:1040/media/d.mp3' }
    })
    expect(streakPayload(state.rules[0], state, 3, 1, 'a').font).toBe('Impact')
    const d = deathPayload(state, 'd1')
    expect(d).toMatchObject({
      font: 'Impact',
      caption: 'Минус',
      soundUrl: 'http://localhost:1040/media/d.mp3'
    })
    expect(d.captionParts).toEqual([{ t: 'Минус', k: 'user' }])
    expect(d).not.toHaveProperty('chime')
  })
})

describe('showText', () => {
  it('off = no text at all (picture alone); old saves without it show the text', () => {
    const s = normalizeStreak({
      rules: [
        { id: 'a', kills: 3, title: 'T', showText: false },
        { id: 'b', kills: 4 }
      ],
      death: { showText: false }
    })
    expect(s.rules.map((r) => r.showText)).toEqual([false, true])
    expect(s.death.showText).toBe(false)
    const p = streakPayload(s.rules[0], s, 3, 1, 'x')
    expect(p.caption).toBe('')
    expect(p.captionParts).toEqual([])
    expect(streakPayload(s.rules[1], s, 4, 1, 'x').caption).toContain('4 убийства')
    expect(deathPayload(s, 'd').caption).toBe('')
    expect(normalizeStreak({}).death.showText).toBe(true)
  })
})

describe('death fullscreen', () => {
  it('off by default; on = the payload says fullscreen; rules never do', () => {
    expect(normalizeStreak({}).death.fullscreen).toBe(false)
    expect(deathPayload(normalizeStreak({}), 'd')).not.toHaveProperty('fullscreen')
    const s = normalizeStreak({ death: { fullscreen: true } })
    expect(deathPayload(s, 'd').fullscreen).toBe(true)
    expect(streakPayload(s.rules[0], s, 3, 1, 'x')).not.toHaveProperty('fullscreen')
  })
})
