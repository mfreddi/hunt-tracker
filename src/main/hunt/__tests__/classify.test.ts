import { describe, expect, it } from 'vitest'
import {
  ClassifiedHighlight,
  DeathSignal,
  PendingHighlight,
  resolveHighlight,
  resolveTrades
} from '../classify'
import { DAY_MS } from '../parse'

const pending = (over: Partial<PendingHighlight> = {}): PendingHighlight => ({
  requestId: 'h1',
  missionId: 'm1',
  gameLogAvailable: true,
  detectedAt: 10_000,
  sdkTimestamp: null,
  mode: 'Bounty Hunt',
  mapId: 'creek',
  mapName: 'DeSalle',
  ...over
})

const signal = (over: Partial<DeathSignal> = {}): DeathSignal => ({
  observedAt: 10_090,
  utcTimeOfDay: null,
  used: false,
  missionId: 'm1',
  ...over
})

describe('resolveHighlight', () => {
  it('calls it a death when a death screen opened right next to the highlight', () => {
    const s = signal()
    const c = resolveHighlight(pending(), [s], 2000, true)
    expect(c.event).toBe('death')
    expect(c.certainty).toBe('correlated')
    expect(c.delta).toBe(90)
    expect(s.used).toBe(true)
  })

  it('calls it a kill when there is no death screen', () => {
    expect(resolveHighlight(pending(), [], 2000, true).event).toBe('kill')
  })

  it('ignores a death screen outside the window', () => {
    expect(resolveHighlight(pending(), [signal({ observedAt: 13_000 })], 2000, true).event).toBe(
      'kill'
    )
  })

  it('ignores a death screen of another mission', () => {
    expect(resolveHighlight(pending(), [signal({ missionId: 'other' })], 2000, true).event).toBe(
      'kill'
    )
  })

  it('uses each death screen only once', () => {
    const s = signal()
    expect(resolveHighlight(pending({ requestId: 'a' }), [s], 2000, true).event).toBe('death')
    expect(resolveHighlight(pending({ requestId: 'b' }), [s], 2000, true).event).toBe('kill')
  })

  it('picks the closest of several death screens', () => {
    const far = signal({ observedAt: 11_500 })
    const near = signal({ observedAt: 10_200 })
    const c = resolveHighlight(pending(), [far, near], 2000, true)
    expect(c.delta).toBe(200)
    expect(near.used).toBe(true)
    expect(far.used).toBe(false)
  })

  it('compares the SDK clock to the game-log clock when both are known', () => {
    // wall-clock distance is huge, but the log timestamps are 606ms apart
    const sdk = Date.UTC(2026, 9, 3, 21, 39, 4, 606)
    const c = resolveHighlight(
      pending({ detectedAt: 0, sdkTimestamp: sdk }),
      [signal({ observedAt: 999_999, utcTimeOfDay: (21 * 3600 + 39 * 60 + 4) * 1000 })],
      2000,
      true
    )
    expect(c.event).toBe('death')
    expect(c.delta).toBe(606)
  })

  it('wraps around midnight', () => {
    const sdk = Date.UTC(2026, 9, 3, 23, 59, 59, 900)
    const c = resolveHighlight(
      pending({ sdkTimestamp: sdk }),
      [signal({ utcTimeOfDay: 0 })],
      2000,
      true
    )
    expect(c.event).toBe('death')
    expect(c.delta).toBe(DAY_MS - (sdk % DAY_MS))
  })

  it('is unknown when the game log was not readable', () => {
    expect(resolveHighlight(pending(), [], 2000, false).event).toBe('unknown_highlight')
    expect(resolveHighlight(pending({ gameLogAvailable: false }), [], 2000, true).event).toBe(
      'unknown_highlight'
    )
  })
})

const ev = (over: Partial<ClassifiedHighlight>): ClassifiedHighlight => ({
  event: 'kill',
  certainty: 'inferred',
  requestId: 'x',
  missionId: 'm1',
  mode: 'Bounty Hunt',
  mapId: 'creek',
  mapName: 'DeSalle',
  sdkTimestamp: 1000,
  readyAt: 0,
  ...over
})

describe('resolveTrades', () => {
  it('pairs a kill and a death within the window', () => {
    const k = ev({ requestId: 'k', event: 'kill', sdkTimestamp: 1000 })
    const d = ev({ requestId: 'd', event: 'death', sdkTimestamp: 1300 })
    const { pairs, remaining } = resolveTrades([k, d], 500)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].gapMs).toBe(300)
    expect(remaining).toHaveLength(0)
  })

  it('does not pair outside the window, across missions, or when disabled', () => {
    const k = ev({ requestId: 'k', event: 'kill', sdkTimestamp: 1000 })
    expect(
      resolveTrades([k, ev({ requestId: 'd', event: 'death', sdkTimestamp: 1600 })], 500).pairs
    ).toHaveLength(0)
    expect(
      resolveTrades(
        [k, ev({ requestId: 'd', event: 'death', sdkTimestamp: 1100, missionId: 'm2' })],
        500
      ).pairs
    ).toHaveLength(0)
    expect(
      resolveTrades([k, ev({ requestId: 'd', event: 'death', sdkTimestamp: 1100 })], 0).pairs
    ).toHaveLength(0)
  })

  it('needs SDK timestamps on both sides', () => {
    const k = ev({ requestId: 'k', event: 'kill', sdkTimestamp: null })
    const d = ev({ requestId: 'd', event: 'death', sdkTimestamp: 1100 })
    expect(resolveTrades([k, d], 500).pairs).toHaveLength(0)
  })

  it('pairs the closest couple first and uses each event once', () => {
    const k1 = ev({ requestId: 'k1', event: 'kill', sdkTimestamp: 1000 })
    const k2 = ev({ requestId: 'k2', event: 'kill', sdkTimestamp: 1400 })
    const d = ev({ requestId: 'd', event: 'death', sdkTimestamp: 1450 })
    const { pairs, remaining } = resolveTrades([k1, k2, d], 500)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].kill.requestId).toBe('k2')
    expect(remaining.map((r) => r.requestId)).toEqual(['k1'])
  })
})
