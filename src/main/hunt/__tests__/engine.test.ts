import { describe, expect, it } from 'vitest'
import { L, T0, gameClock, setup } from './helpers'

describe('match lifecycle', () => {
  it('counts a survived match with its map, kill and outcome', () => {
    const h = setup()
    h.beginMatch('creek')
    h.advance(1000)
    h.sdk(L.video('k1'))
    h.advance(400)
    h.game(L.disconnect('MissionRequested'))

    const s = h.engine.session
    expect(s.games).toBe(1)
    expect(s.survived).toBe(1)
    expect(s.lost).toBe(0)
    expect(s.kills).toBe(1)
    expect(s.maps).toEqual({ creek: 1 })
    expect(h.engine.current.status).toBe('complete')
    expect(h.engine.current.outcome).toBe('survived')
    expect(h.engine.current.mapName).toBe('DeSalle')
  })

  it('does not treat the loading network switch as the end of the match', () => {
    const h = setup()
    h.game(L.loading)
    h.game(L.nub)
    expect(h.engine.current.status).toBe('loading')
    expect(h.engine.session.games).toBe(1)
    expect(h.names()).toContain('loading_connection_transition')
    expect(h.names()).not.toContain('mission_disconnected')
  })

  it('counts every match once even when the same map repeats', () => {
    const h = setup()
    for (let i = 0; i < 3; i++) {
      h.beginMatch('civilwar')
      h.advance(500)
      h.game(L.disconnect('UserRequested'))
      h.game(L.menu)
      h.sdk(L.close())
      h.advance(500)
    }
    expect(h.engine.session.games).toBe(3)
    expect(h.engine.session.maps).toEqual({ civilwar: 3 })
    expect(h.engine.session.lost).toBe(3)
  })

  it('lost: user left, or the session ended with the death screen open', () => {
    const a = setup()
    a.beginMatch()
    a.game(L.disconnect('UserRequested'))
    expect(a.engine.session.lost).toBe(1)

    const b = setup()
    b.beginMatch()
    b.game(L.deathOpen())
    b.game(L.disconnect('GameSessionEnded'))
    expect(b.engine.session.lost).toBe(1)
  })

  it('survived after a revive: a closed death screen does not rule out extraction', () => {
    const h = setup()
    h.beginMatch()
    h.game(L.deathOpen())
    h.advance(3000)
    h.game(L.deathClose)
    h.game(L.disconnect('MissionRequested'))
    expect(h.engine.session.survived).toBe(1)
    expect(h.engine.session.lost).toBe(0)
  })

  it('has no outcome when the death screen is still open on MissionRequested', () => {
    const h = setup()
    h.beginMatch()
    h.game(L.deathOpen())
    h.game(L.disconnect('MissionRequested'))
    expect(h.engine.session.games).toBe(1)
    expect(h.engine.session.survived + h.engine.session.lost).toBe(0)
  })

  it('ignores a disconnect while nothing is going on', () => {
    const h = setup()
    h.game(L.disconnect('UserRequested'))
    expect(h.engine.session.games).toBe(0)
    expect(h.engine.session.lost).toBe(0)
  })

  it('does not count the Shooting Range or the Tutorial', () => {
    const h = setup()
    h.game(L.loading)
    h.game(L.level('shooting'))
    h.game(L.loaded)
    h.sdk(L.open())
    h.sdk(L.video('range1'))
    h.advance(400)
    h.game(L.disconnect('UserRequested'))
    h.game(L.menu)

    expect(h.engine.session.games).toBe(0)
    expect(h.engine.session.kills).toBe(0)
    expect(h.engine.session.lost).toBe(0)
    expect(h.engine.session.maps).toEqual({})

    h.beginMatch('creek')
    expect(h.engine.session.games).toBe(1)
    expect(h.engine.session.maps).toEqual({ creek: 1 })
  })
})

describe('kill vs death', () => {
  it('a highlight with a death screen right behind it is a death', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('d1'))
    h.advance(90)
    h.game(L.deathOpen())
    h.advance(400)
    expect(h.engine.session.deaths).toBe(1)
    expect(h.engine.session.kills).toBe(0)
    expect(h.engine.current.skulls).toEqual(['death'])
  })

  it('kills after a death screen has closed are still counted (respawn / revive)', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('d1'))
    h.advance(90)
    h.game(L.deathOpen())
    h.advance(400)
    h.game(L.deathClose)
    h.advance(5000)
    h.sdk(L.video('k1'))
    h.advance(400)
    h.sdk(L.video('k2'))
    h.advance(400)
    expect(h.engine.session.deaths).toBe(1)
    expect(h.engine.session.kills).toBe(2)
    expect(h.engine.current.skulls).toEqual(['death', 'kill', 'kill'])
  })

  it('a death screen without a highlight (knockdown) is not a death', () => {
    const h = setup()
    h.beginMatch()
    h.game(L.deathOpen())
    h.advance(100)
    h.game(L.deathClose)
    h.advance(10_000)
    expect(h.engine.session.deaths).toBe(0)
    expect(h.engine.session.kills).toBe(0)
  })

  it('a duplicated death-screen line does not double count', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('d1'))
    h.advance(50)
    h.game(L.deathOpen())
    h.advance(10)
    h.game(L.deathOpen())
    h.advance(400)
    h.advance(10_000)
    expect(h.engine.session.deaths).toBe(1)
    expect(h.engine.session.kills).toBe(0)
  })

  it('the same highlight id is counted once', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.sdk(L.video('k1'))
    h.advance(400)
    h.sdk(L.video('k1'))
    h.advance(400)
    expect(h.engine.session.kills).toBe(1)
  })

  it('correlates by the SDK/Game.log clocks when both are available', () => {
    const h = setup()
    h.beginMatch()
    const at = h.now() + 10
    h.advance(10)
    h.sdk(L.video('d1', at))
    // the death line is only read much later, but its own timestamp matches the highlight
    h.advance(250)
    h.game(L.deathOpen(at))
    h.advance(100)
    expect(h.engine.session.deaths).toBe(1)
    expect(h.engine.session.kills).toBe(0)
  })

  it('waits the configured time before calling it a kill', () => {
    const h = setup('fast')
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(299)
    expect(h.engine.session.kills).toBe(0)
    h.advance(2)
    expect(h.engine.session.kills).toBe(1)
  })

  it('normal mode waits 3.5 seconds (3s + the trade window)', () => {
    const h = setup('normal')
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(3400)
    expect(h.engine.session.kills).toBe(0)
    h.advance(200)
    expect(h.engine.session.kills).toBe(1)
  })

  it('a highlight is unknown when Game.log was not readable', () => {
    const h = setup()
    h.beginMatch()
    h.engine.setGameLogHealthy(false)
    h.sdk(L.video('u1'))
    h.advance(400)
    expect(h.engine.session.unclassified).toBe(1)
    expect(h.engine.session.kills).toBe(0)
    expect(h.engine.session.deaths).toBe(0)
  })

  it('attributes kills and deaths to the mode of the match', () => {
    const h = setup()
    h.game(L.mode('BountyClashLobby'))
    h.game('CGameLobby::DoConfirmReady()')
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(400)
    expect(h.engine.session.modes['Bounty Clash']).toEqual({
      games: 1,
      survived: 0,
      lost: 0,
      kills: 1,
      deaths: 0
    })
    expect(h.engine.current.mode).toBe('Bounty Clash')
  })

  it('late classification counts in the totals but not in the next match skulls', () => {
    const h = setup('normal')
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(500)
    h.game(L.disconnect('MissionRequested'))
    h.advance(500)
    h.beginMatch('civilwar') // next match starts before k1 is classified
    expect(h.engine.current.mapId).toBe('civilwar')
    h.advance(3000)
    expect(h.engine.session.kills).toBe(1)
    expect(h.engine.current.skulls).toEqual([])
    expect(h.engine.session.games).toBe(2)
  })
})

// Real lines of the NVIDIA event log: a friend's game that could not connect
// (the NVIDIA service never answered the Create request) and a healthy one.
const SDK_FAILED = [
  '2026-10-21T07:36:49.860[I] GAME              Core.cpp:30   Creating GfeSDK Version 1.1.3.21cee5b5',
  '2026-10-21T07:36:50.251[E] TASK     CallbackContext.h:69   Message JoinIPCChannel[join] return value: NVGSDK_SUCCESS(0) Joined bus',
  '2026-10-21T07:36:50.252[I] GAME        Controller.cpp:121  Posted Request Create[2d7cc146]',
  '2026-10-21T07:36:55.253[E] TASK     CallbackContext.h:73   Message Create[2d7cc146] return value: NVGSDK_ERR_IPC_FAILED(-1024) Request timed out',
  '2026-10-21T07:36:55.253[E] GAME              Core.cpp:128  Failure during NVGSDK_Create: NVGSDK_ERR_IPC_FAILED Error: Failed initializing SDK'
]
const SDK_OK = [
  '2026-10-18T11:52:54.884[E] TASK     CallbackContext.h:69   Message JoinIPCChannel[join] return value: NVGSDK_SUCCESS(0) Joined bus',
  '2026-10-18T11:52:54.884[I] GAME        Controller.cpp:121  Posted Request Create[ff7ef06b]',
  '2026-10-18T11:52:55.044[E] TASK     CallbackContext.h:69   Message Create[ff7ef06b] return value: NVGSDK_SUCCESS(0) Success'
]

describe('NVIDIA Highlights link', () => {
  it('starts unknown', () => {
    const h = setup()
    expect(h.engine.sdkInfo).toEqual({ state: 'unknown', error: '', received: 0 })
  })

  it('a game that could not connect is reported as failed, with the NVIDIA error', () => {
    const h = setup()
    SDK_FAILED.forEach((l) => h.sdk(l))
    expect(h.engine.sdkInfo).toMatchObject({ state: 'failed', error: 'NVGSDK_ERR_IPC_FAILED' })
  })

  it('a healthy start is connected (the joined-bus line alone is not enough)', () => {
    const h = setup()
    h.sdk(SDK_OK[0])
    expect(h.engine.sdkInfo.state).toBe('unknown')
    SDK_OK.forEach((l) => h.sdk(l))
    expect(h.engine.sdkInfo).toMatchObject({ state: 'connected', error: '' })
  })

  it('the same is found when the tracker starts after the game (snapshot read)', () => {
    const failed = setup()
    failed.engine.restoreFromSdkLines(SDK_FAILED, failed.now())
    expect(failed.engine.sdkInfo.state).toBe('failed')
    const ok = setup()
    ok.engine.restoreFromSdkLines(SDK_OK, ok.now())
    expect(ok.engine.sdkInfo.state).toBe('connected')
  })

  it('counts the highlights received from NVIDIA, once each', () => {
    const h = setup()
    SDK_OK.forEach((l) => h.sdk(l))
    h.beginMatch()
    h.sdk(L.video('a1'))
    h.sdk(L.video('a1')) // the same request twice
    h.sdk(L.video('a2'))
    expect(h.engine.sdkInfo.received).toBe(2)
  })

  it('a new game run starts clean', () => {
    const h = setup()
    SDK_FAILED.forEach((l) => h.sdk(l))
    h.engine.resetTransient()
    expect(h.engine.sdkInfo).toEqual({ state: 'unknown', error: '', received: 0 })
  })

  it('tells the UI when it changes', () => {
    const h = setup()
    const before = h.changes.count
    SDK_FAILED.forEach((l) => h.sdk(l))
    expect(h.changes.count).toBeGreaterThan(before)
  })
})

describe('per-mode stats', () => {
  const play = (
    h: ReturnType<typeof setup>,
    lobby: string,
    result: 'MissionRequested' | 'UserRequested'
  ) => {
    h.game(L.mode(lobby))
    h.game('CGameLobby::DoConfirmReady()')
    h.beginMatch()
    h.sdk(L.video(`k${h.now()}`))
    h.advance(400)
    h.game(L.disconnect(result))
    h.game(L.menu)
    h.sdk(L.close())
    h.advance(500)
  }

  it('keeps games, results and kills of each mode apart', () => {
    const h = setup()
    play(h, 'BountyHuntLobby', 'MissionRequested')
    play(h, 'BountyHuntLobby', 'UserRequested')
    play(h, 'QuickplayLobby', 'MissionRequested')

    const m = h.engine.session.modes
    expect(m['Bounty Hunt']).toEqual({ games: 2, survived: 1, lost: 1, kills: 2, deaths: 0 })
    expect(m['Soul Survivor']).toEqual({ games: 1, survived: 1, lost: 0, kills: 1, deaths: 0 })
    expect(m['Bounty Clash']).toBeUndefined()
    expect(h.engine.session.games).toBe(3)
  })

  it('a match whose mode was never seen counts in the totals but in no mode', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(400)
    h.game(L.disconnect('MissionRequested'))
    expect(h.engine.session.games).toBe(1)
    expect(h.engine.session.survived).toBe(1)
    expect(h.engine.session.modes).toEqual({})
  })

  it('the Shooting Range leaves no game in the mode', () => {
    const h = setup()
    h.game(L.mode('BountyHuntLobby'))
    h.game(L.loading)
    h.game(L.level('shooting'))
    expect(h.engine.session.games).toBe(0)
    expect(h.engine.session.modes['Bounty Hunt']?.games ?? 0).toBe(0)
  })

  it('a session reset keeps the match in progress in its mode', () => {
    const h = setup()
    h.game(L.mode('BountyClashLobby'))
    h.game('CGameLobby::DoConfirmReady()')
    h.beginMatch()
    h.engine.resetSession(h.now())
    expect(h.engine.session.modes['Bounty Clash']?.games).toBe(1)
  })

  it('knows the active mode: in play, then the lobby pick, then the last played', () => {
    const h = setup()
    expect(h.engine.activeMode).toBe('')

    h.game(L.mode('BountyHuntLobby'))
    expect(h.engine.activeMode).toBe('Bounty Hunt') // picked in the lobby

    h.game('CGameLobby::DoConfirmReady()')
    h.beginMatch()
    expect(h.engine.activeMode).toBe('Bounty Hunt') // in play
    h.game(L.disconnect('MissionRequested'))

    h.game(L.mode('QuickplayLobby'))
    expect(h.engine.activeMode).toBe('Soul Survivor') // next pick wins between matches

    // game restarted: the pick is forgotten, the last played mode is the best guess
    h.engine.resetTransient()
    expect(h.engine.activeMode).toBe('Bounty Hunt')
  })

  it('a mode picked in the lobby reaches the overlay right away', () => {
    const h = setup()
    const before = h.changes.count
    h.game(L.mode('BountyClashLobby'))
    expect(h.changes.count).toBeGreaterThan(before)
    const after = h.changes.count
    h.game(L.mode('BountyClashLobby')) // same pick again: nothing to push
    expect(h.changes.count).toBe(after)
  })

  it('a restore outside a match pushes the restored mode', () => {
    const h = setup()
    const before = h.changes.count
    h.engine.restoreFromGameLines([L.mode('QuickplayLobby')], h.now())
    expect(h.engine.activeMode).toBe('Soul Survivor')
    expect(h.changes.count).toBeGreaterThan(before)
  })
})

describe('trades', () => {
  const trade = (h: ReturnType<typeof setup>) => {
    h.beginMatch()
    h.advance(10)
    const at = h.now()
    h.sdk(L.video('k1', at))
    h.advance(20)
    h.sdk(L.video('d1', at + 300))
    h.advance(10)
    h.game(L.deathOpen(at + 300))
  }

  it('normal mode pairs a kill and a death within 500ms into a trade', () => {
    const h = setup('normal')
    trade(h)
    h.advance(4000)
    const s = h.engine.session
    expect(s.trades).toBe(1)
    expect(s.kills).toBe(1)
    expect(s.deaths).toBe(1)
    const quiet = h.events.filter(
      (e) => (e.name === 'kill' || e.name === 'death') && e.data.suppressSound
    )
    expect(quiet).toHaveLength(2)
  })

  it('fast mode has no trades: they count as a plain kill and death', () => {
    const h = setup('fast')
    trade(h)
    h.advance(1000)
    const s = h.engine.session
    expect(s.trades).toBe(0)
    expect(s.kills).toBe(1)
    expect(s.deaths).toBe(1)
  })
})

describe('game stop', () => {
  it('classifies an old enough pending highlight normally', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(100)
    h.engine.gameStopped(h.now() + 250)
    expect(h.engine.session.kills).toBe(1)
  })

  it('cannot tell a highlight that is still too fresh', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(50)
    h.engine.gameStopped(h.now())
    expect(h.engine.session.kills).toBe(0)
    expect(h.engine.session.unclassified).toBe(1)
  })

  it('closes the match and resets the transient state', () => {
    const h = setup()
    h.beginMatch()
    h.engine.gameStopped(h.now())
    expect(h.engine.current.status).toBe('complete')
    expect(h.engine.statuses).toEqual({ game: 'waiting', events: 'waiting' })
    h.advance(5000) // stopping and relaunching the game takes time
    h.beginMatch('colorado')
    expect(h.engine.session.games).toBe(2)
  })
})

describe('restart in the middle of a match', () => {
  const matchLines = [L.loading, L.nub, L.level('creek'), L.loaded]

  it('keeps counting the same match instead of adding a new game', () => {
    const a = setup()
    a.beginMatch('creek')
    a.sdk(L.video('k1'))
    a.advance(400)
    const saved = {
      session: JSON.parse(JSON.stringify(a.engine.session)),
      current: JSON.parse(JSON.stringify(a.engine.current))
    }
    expect(saved.session.games).toBe(1)
    expect(saved.session.kills).toBe(1)

    const b = setup('fast', saved)
    b.engine.restoreFromGameLines(matchLines, b.now())
    b.engine.restoreFromSdkLines([L.open(), L.video('k1')], b.now())
    expect(b.engine.session.games).toBe(1)
    expect(b.engine.current.status).toBe('active')

    // the highlight that was already counted before the restart is not counted again
    b.sdk(L.video('k1'))
    b.advance(400)
    expect(b.engine.session.kills).toBe(1)
    b.sdk(L.video('k2'))
    b.advance(400)
    expect(b.engine.session.kills).toBe(2)
    expect(b.engine.current.skulls).toEqual(['kill', 'kill'])
  })

  it('a stale "in progress" match from a previous run does not stay active by itself', () => {
    const a = setup()
    a.beginMatch()
    const saved = {
      session: JSON.parse(JSON.stringify(a.engine.session)),
      current: JSON.parse(JSON.stringify(a.engine.current))
    }
    const b = setup('fast', saved)
    expect(b.engine.current.status).toBe('complete')
    expect(b.engine.inMatch).toBe(false)
  })

  it('a different match found in the logs is a new game', () => {
    const a = setup()
    a.beginMatch('creek')
    a.game(L.disconnect('MissionRequested'))
    const saved = {
      session: JSON.parse(JSON.stringify(a.engine.session)),
      current: JSON.parse(JSON.stringify(a.engine.current))
    }
    // fresh ids, like the random ones a real restart would generate
    const b = setup('fast', saved, 'next')
    b.engine.restoreFromGameLines([L.loading, L.nub, L.level('civilwar'), L.loaded], b.now())
    expect(b.engine.session.games).toBe(2)
    expect(b.engine.current.mapId).toBe('civilwar')
  })

  it('does not count anything when the snapshot finds the game in the lobby', () => {
    const h = setup()
    h.engine.restoreFromGameLines(
      [L.mode('BountyHuntLobby'), ...matchLines, L.disconnect('MissionRequested'), L.menu],
      h.now()
    )
    expect(h.engine.session.games).toBe(0)
    expect(h.engine.inMatch).toBe(false)
  })
})

describe('session', () => {
  it('reset keeps the match in progress as the first game of the new session', () => {
    const h = setup()
    h.beginMatch()
    h.sdk(L.video('k1'))
    h.advance(400)
    h.engine.resetSession(h.now())
    const s = h.engine.session
    expect(s.games).toBe(1)
    expect(s.kills).toBe(0)
    expect(s.startedAt).toBe(h.now())
    expect(h.engine.current.skulls).toEqual([])
    h.sdk(L.video('k2'))
    h.advance(400)
    expect(h.engine.session.kills).toBe(1)
  })

  it('reset between matches starts from zero', () => {
    const h = setup()
    h.beginMatch()
    h.game(L.disconnect('MissionRequested'))
    h.engine.resetSession(h.now())
    expect(h.engine.session.games).toBe(0)
    expect(h.engine.session.survived).toBe(0)
  })

  it('reports changes and events', () => {
    const h = setup()
    let changes = 0
    ;(h.engine as any).onChange = () => changes++
    h.beginMatch()
    expect(changes).toBeGreaterThan(0)
    expect(h.names()).toEqual(
      expect.arrayContaining([
        'mission_loading_started',
        'map_detected',
        'mission_loaded',
        'gameplay_started'
      ])
    )
  })

  it('log status changes are reported once', () => {
    const h = setup()
    let changes = 0
    ;(h.engine as any).onChange = () => changes++
    h.engine.setStatus('events', 'online')
    h.engine.setStatus('events', 'online')
    expect(changes).toBe(1)
    expect(h.engine.statuses.events).toBe('online')
  })
})

describe('sanity of the helpers', () => {
  it('game clock is UTC', () => {
    expect(gameClock(T0)).toBe('<21:00:00>')
  })
})

describe('a log that is read again from its start', () => {
  // Everything one poll finds is fed at one instant (the same `now`).
  const oldSession = (h: ReturnType<typeof setup>, matches: number): void => {
    for (let i = 0; i < matches; i++) {
      h.beginMatch('creek')
      h.game(L.disconnect('UserRequested'))
      h.game(L.menu)
      h.sdk(L.close())
    }
  }

  it('adds at most one game, not one per old match', () => {
    const h = setup()
    h.beginMatch()
    h.advance(500)
    h.game(L.disconnect('UserRequested'))
    h.game(L.menu)
    h.sdk(L.close())
    expect(h.engine.session.games).toBe(1)

    h.advance(60_000)
    oldSession(h, 12) // the whole file again, in a single poll
    expect(h.engine.session.games).toBeLessThanOrEqual(2)
  })

  it('a real next match in a later poll is still counted', () => {
    const h = setup()
    oldSession(h, 1)
    for (let i = 0; i < 3; i++) {
      h.advance(60_000)
      oldSession(h, 1)
    }
    expect(h.engine.session.games).toBe(4)
  })

  it('an SDK highlight stamped long before the game started is ignored', () => {
    const h = setup()
    h.engine.gameStarted(1234, h.now())
    h.beginMatch()
    h.sdk(L.video('old', h.now() - 3 * 3600_000)) // a leftover of an earlier run
    h.sdk(L.video('fresh', h.now() + 5000))
    h.advance(20_000)
    expect(h.engine.session.kills + h.engine.session.deaths).toBe(1)
  })

  it('a highlight a little before the discovery of the process still counts (slow discovery)', () => {
    const h = setup()
    h.engine.gameStarted(1234, h.now())
    h.beginMatch()
    h.sdk(L.video('early', h.now() - 20_000))
    h.advance(20_000)
    expect(h.engine.session.kills + h.engine.session.deaths).toBe(1)
  })
})
