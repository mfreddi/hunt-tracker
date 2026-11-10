// Win rate per map: counts, order, mode scope and what is left out.

import { describe, expect, it } from 'vitest'
import { MAPS_SHOWN, summarizeMaps } from '../maps'
import { MapSample } from '../types'

const m = (mapName: string, outcome: MapSample['outcome'], mode = 'Bounty Hunt'): MapSample => ({
  mapName,
  outcome,
  mode
})

describe('summarizeMaps', () => {
  it('nothing played, nothing to show', () => {
    expect(summarizeMaps([], '')).toEqual([])
  })

  it('win rate = survived / matches on that map, rounded', () => {
    const r = summarizeMaps(
      [m('Stillwater', 'survived'), m('Stillwater', 'lost'), m('Stillwater', 'survived')],
      ''
    )
    expect(r).toEqual([{ name: 'Stillwater', games: 3, survived: 2, rate: 67 }])
  })

  it('most played first, ties by name', () => {
    const r = summarizeMaps(
      [m('Mammon', 'lost'), m('Lawson', 'survived'), m('DeSalle', 'lost'), m('DeSalle', 'lost')],
      ''
    )
    expect(r.map((x) => x.name)).toEqual(['DeSalle', 'Lawson', 'Mammon'])
  })

  it('a match with no result or no map says nothing and is left out', () => {
    const r = summarizeMaps([m('Lawson', ''), m('', 'survived'), m('Lawson', 'survived')], '')
    expect(r).toEqual([{ name: 'Lawson', games: 1, survived: 1, rate: 100 }])
  })

  it('looks at one mode when asked', () => {
    const all = [
      m('Lawson', 'survived', 'Bounty Hunt'),
      m('Lawson', 'lost', 'Bounty Clash'),
      m('Lawson', 'lost', 'Bounty Clash')
    ]
    expect(summarizeMaps(all, 'Bounty Hunt')).toEqual([
      { name: 'Lawson', games: 1, survived: 1, rate: 100 }
    ])
    expect(summarizeMaps(all, 'Bounty Clash')[0]).toMatchObject({ games: 2, survived: 0, rate: 0 })
  })

  it('shows at most MAPS_SHOWN maps', () => {
    const many = Array.from({ length: MAPS_SHOWN + 3 }, (_, i) => m(`Map ${i}`, 'survived'))
    expect(summarizeMaps(many, '')).toHaveLength(MAPS_SHOWN)
  })
})
