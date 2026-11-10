// Match history: what the engine hands out per finished match, and the file store.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { HuntHistory, parseEntry } from '../history'
import { RECENT_KEEP } from '../recent'
import { L, setup } from './helpers'

const play = (h: ReturnType<typeof setup>, lobby: string, result: string, kills = 1): void => {
  h.game(L.mode(lobby))
  h.game('CGameLobby::DoConfirmReady()')
  h.beginMatch()
  for (let i = 0; i < kills; i++) {
    h.sdk(L.video(`k${h.now()}${i}`))
    h.advance(400)
  }
  h.game(L.disconnect(result))
  h.game(L.menu)
  h.sdk(L.close())
  h.advance(500)
}

describe('match records from the engine', () => {
  it('one record per finished match, with its own mode, map, result and kills', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested', 2)
    play(h, 'QuickplayLobby', 'UserRequested', 1)

    expect(h.finished).toHaveLength(2)
    const [a, b] = h.finished
    expect(a).toMatchObject({ mode: 'Bounty Hunt', outcome: 'survived', kills: 2, deaths: 0 })
    expect(a.mapName).toBeTruthy()
    expect(a.skulls).toEqual(['kill', 'kill'])
    expect(a.endedAt).toBeGreaterThan(a.startedAt)
    expect(b).toMatchObject({ mode: 'Soul Survivor', outcome: 'lost', kills: 1 })
    expect(a.id).not.toBe(b.id)
  })

  it('every finished match also lands in the session, oldest first', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested', 2)
    play(h, 'QuickplayLobby', 'UserRequested', 1)
    expect(h.engine.session.recent.map((r) => [r.mode, r.outcome, r.kills])).toEqual([
      ['Bounty Hunt', 'survived', 2],
      ['Soul Survivor', 'lost', 1]
    ])
  })

  it('a new session forgets them, a match closed by quitting the game has no result', () => {
    const h = setup()
    h.game(L.mode('BountyHuntLobby'))
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(400)
    h.engine.gameStopped(h.now() + 50)
    expect(h.engine.session.recent).toMatchObject([{ outcome: '', kills: 1 }])
    h.engine.resetSession(h.now())
    expect(h.engine.session.recent).toEqual([])
  })

  it('keeps the session records: streak, best streak, most kills in one match', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested', 2)
    play(h, 'BountyHuntLobby', 'MissionRequested', 5)
    expect(h.engine.session).toMatchObject({ streak: 2, bestStreak: 2, bestKills: 5 })
    play(h, 'BountyHuntLobby', 'UserRequested', 1) // lost: the run ends, the records stay
    expect(h.engine.session).toMatchObject({ streak: 0, bestStreak: 2, bestKills: 5 })
    play(h, 'BountyHuntLobby', 'MissionRequested', 1)
    expect(h.engine.session).toMatchObject({ streak: 1, bestStreak: 2 })
    h.engine.resetSession(h.now())
    expect(h.engine.session).toMatchObject({ streak: 0, bestStreak: 0, bestKills: 0 })
  })

  it('records outlive the capped list of recent matches', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested', 9)
    for (let i = 0; i < RECENT_KEEP + 3; i++) play(h, 'BountyHuntLobby', 'MissionRequested', 0)
    expect(h.engine.session.recent.some((r) => r.kills === 9)).toBe(false) // fell out
    expect(h.engine.session.bestKills).toBe(9) // the record did not
    expect(h.engine.session.bestStreak).toBe(RECENT_KEEP + 4)
  })

  it('keeps at most RECENT_KEEP matches', () => {
    const h = setup()
    for (let i = 0; i < RECENT_KEEP + 5; i++) play(h, 'BountyHuntLobby', 'MissionRequested', 0)
    expect(h.engine.session.recent).toHaveLength(RECENT_KEEP)
  })

  it('a match is not counted twice in the history', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested')
    h.game(L.disconnect('MissionRequested'))
    h.advance(500)
    expect(h.finished).toHaveLength(1)
  })

  it('normal mode: a kill classified after the disconnect still lands in its match', () => {
    const h = setup('normal')
    h.game(L.mode('BountyHuntLobby'))
    h.beginMatch()
    h.sdk(L.video('late'))
    h.advance(100)
    h.game(L.disconnect('MissionRequested'))
    expect(h.finished).toHaveLength(0) // the highlight is still waiting
    h.advance(4000)
    expect(h.finished).toHaveLength(1)
    expect(h.finished[0]).toMatchObject({ kills: 1, outcome: 'survived' })
  })

  it('the game closed mid-match: recorded without a result', () => {
    const h = setup()
    h.game(L.mode('BountyHuntLobby'))
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(400)
    h.engine.gameStopped(h.now() + 50)
    expect(h.finished).toHaveLength(1)
    expect(h.finished[0]).toMatchObject({ outcome: '', kills: 1 })
  })

  it('the Shooting Range leaves nothing in the history', () => {
    const h = setup()
    h.game(L.loading)
    h.game(L.level('shooting'))
    h.game(L.disconnect('MissionRequested'))
    h.engine.gameStopped(h.now())
    expect(h.finished).toHaveLength(0)
  })

  it('quitting the app hands out a match still waiting for late highlights', () => {
    const h = setup('normal')
    h.beginMatch()
    h.sdk(L.video('late'))
    h.game(L.disconnect('MissionRequested'))
    expect(h.finished).toHaveLength(0)
    h.engine.flushHistory()
    expect(h.finished).toHaveLength(1)
  })
})

describe('history file', () => {
  let dir: string
  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'hunt-history-'))
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const rec = (id: string, endedAt: number) => ({
    id,
    startedAt: endedAt - 60_000,
    endedAt,
    mode: 'Bounty Hunt',
    mapId: 'creek',
    mapName: 'Stillwater',
    outcome: 'survived' as const,
    kills: 3,
    deaths: 1,
    trades: 0,
    unclassified: 0,
    skulls: ['kill' as const]
  })

  it('appends lines and lists them newest first, creating the folder', async () => {
    const h = new HuntHistory(join(dir, 'hunt-history'))
    h.append(rec('a', 1000), 'fast')
    h.append(rec('b', 2000), 'normal')
    const list = await h.list()
    expect(list.map((m) => m.id)).toEqual(['b', 'a'])
    expect(list[0]).toMatchObject({ v: 1, latencyMode: 'normal', kills: 3 })
  })

  it('skips a broken line instead of losing the whole history', async () => {
    const h = new HuntHistory(dir)
    h.append(rec('a', 1000), 'fast')
    await fs.appendFile(join(dir, 'matches.ndjson'), '{"id":"half', 'utf8')
    await fs.appendFile(join(dir, 'matches.ndjson'), '\n', 'utf8')
    h.append(rec('b', 2000), 'fast')
    expect((await h.list()).map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('no file yet, or no folder configured: empty', async () => {
    expect(await new HuntHistory(dir).list()).toEqual([])
    expect(await new HuntHistory(null).list()).toEqual([])
    expect(new HuntHistory(null).append(rec('a', 1), 'fast')).toBeNull()
  })

  it('normalizes junk fields of a stored line', () => {
    expect(
      parseEntry('{"id":"x","endedAt":5,"kills":-3,"outcome":"won","latencyMode":"instant"}')
    ).toMatchObject({ kills: 0, outcome: '', latencyMode: 'fast', skulls: [] })
    expect(parseEntry('{"id":"x"}')).toBeNull()
  })
})
