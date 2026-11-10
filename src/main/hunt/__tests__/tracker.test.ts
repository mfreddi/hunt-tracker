// The I/O shell around the engine (HuntTracker): process discovery, tailing two
// real files, persistence. The game itself and `tasklist` are replaced by a fake
// pid and temp files, so the whole loop can be exercised on any OS.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { HuntTracker } from '../../HuntTracker'
import { L, stamp } from './helpers'

let dir: string
let gameLog: string
let sdkDir: string
let tracker: HuntTracker | null = null

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'hunt-tracker-'))
  await fs.mkdir(join(dir, 'USER'))
  await fs.mkdir(join(dir, 'events'))
  gameLog = join(dir, 'USER', 'Game.log')
  sdkDir = join(dir, 'events')
})

afterEach(async () => {
  tracker?.dispose()
  tracker = null
  await fs.rm(dir, { recursive: true, force: true })
})

async function waitFor(cond: () => boolean, ms = 8000): Promise<void> {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time')
    await new Promise((r) => setTimeout(r, 25))
  }
}

const sdkFile = (pid: number): string => join(sdkDir, `HuntGame_${pid}.log`)
const append = (file: string, ...lines: string[]): Promise<void> =>
  fs.appendFile(file, lines.join('\n') + '\n')

function make(initial: any, pid: { value: number | null }, alive = { value: true }) {
  const save = vi.fn()
  const emit = vi.fn()
  tracker = new HuntTracker(
    {
      latencyMode: 'fast',
      enabled: true,
      gamePath: gameLog,
      eventsPath: sdkDir,
      ...initial
    },
    save,
    emit,
    { findPid: async () => pid.value, isAlive: () => alive.value }
  )
  return { tracker, save, emit, alive }
}

describe('game started after tracking began', () => {
  it('reads the new logs from the start and counts kills and deaths', async () => {
    const pid = { value: null as number | null }
    const { tracker: t, save, alive } = make({}, pid)

    // the game starts: both logs appear, then the process
    await fs.writeFile(gameLog, '')
    await append(gameLog, L.loading, L.nub, L.level('creek'), L.loaded)
    await fs.writeFile(sdkFile(4242), '')
    await append(sdkFile(4242), `${stamp(Date.now())} ${L.open()}`)
    pid.value = 4242

    await waitFor(() => t.get().connected && t.get().current.inMatch)
    expect(t.get().session.games).toBe(1)
    expect(t.get().current.map).toBe('DeSalle')
    await waitFor(() => t.get().statuses.game === 'online' && t.get().statuses.events === 'online')

    await append(sdkFile(4242), L.video('k1', Date.now()))
    await waitFor(() => t.get().session.kills === 1)

    // a death: the highlight first, the death screen line right behind it
    await append(sdkFile(4242), L.video('d1', Date.now()))
    await append(gameLog, L.deathOpen(Date.now()))
    await waitFor(() => t.get().session.deaths === 1)
    expect(t.get().session.kills).toBe(1)
    expect(t.get().current.skulls).toEqual(['kill', 'death'])

    // kills after the death screen closed still count (revive / respawn)
    await append(gameLog, L.deathClose)
    await append(sdkFile(4242), L.video('k2', Date.now()))
    await waitFor(() => t.get().session.kills === 2)

    await append(gameLog, L.disconnect('UserRequested'))
    await waitFor(() => t.get().session.lost === 1)

    await waitFor(() => save.mock.calls.length > 0)
    const saved = save.mock.calls[save.mock.calls.length - 1][0]
    expect(saved.session.kills).toBe(2)

    alive.value = false
    await waitFor(() => !t.get().connected)
    expect(t.get().session.kills).toBe(2)
  }, 20_000)
})

describe('recent matches block (Pro)', () => {
  const stored = {
    enabled: false,
    session: {
      games: 3,
      recent: [
        {
          outcome: 'survived',
          kills: 4,
          deaths: 0,
          mode: 'Bounty Hunt',
          mapName: 'Lawson',
          endedAt: 5
        },
        {
          outcome: 'lost',
          kills: 1,
          deaths: 1,
          mode: 'Bounty Hunt',
          mapName: 'DeSalle',
          endedAt: 9
        },
        'junk',
        null,
        { outcome: 'won', kills: -5, mode: 3 }
      ]
    }
  }
  const make2 = (pro: boolean) =>
    new HuntTracker(stored, vi.fn(), vi.fn(), {
      findPid: async () => null,
      isAlive: () => false,
      isPro: () => pro
    })

  it('older stores load with no matches; junk entries are dropped, not guessed', () => {
    const { tracker: old } = make({ enabled: false }, { value: null })
    expect(old.get().recent).toBeNull() // not Pro
    const t = make2(true)
    const r = t.get().recent
    expect(r?.total).toBe(3) // two good entries + the damaged object, cleaned
    expect(r?.matches[2]).toMatchObject({ outcome: '', kills: 0, mode: '' })
    t.dispose()
  })

  it('only with Pro; the raw list never goes to the overlay', () => {
    const free = make2(false)
    expect(free.get().recent).toBeNull()
    expect(free.get().session).not.toHaveProperty('recent')
    const pro = make2(true)
    expect(pro.get().recent).toMatchObject({ streak: 0, bestStreak: 1, bestKills: 4 })
    expect(pro.get().session).not.toHaveProperty('recent')
    free.dispose()
    pro.dispose()
  })

  it('the row toggle defaults to on and survives junk', () => {
    const { tracker: t } = make({ enabled: false }, { value: null })
    expect(t.get().look.rows.recent).toBe(true)
    t.patchLook({ rows: { recent: false } })
    expect(t.get().look.rows.recent).toBe(false)
  })
})

describe('win rate per map (Pro)', () => {
  const entry = (id: string, mapName: string, outcome: string, mode = 'Bounty Hunt') =>
    JSON.stringify({
      v: 1,
      id,
      startedAt: 1,
      endedAt: 2,
      mode,
      mapId: 'm',
      mapName,
      outcome,
      kills: 0,
      deaths: 0,
      trades: 0,
      unclassified: 0,
      skulls: [],
      latencyMode: 'fast'
    })

  const withHistory = async (
    lines: string[],
    pro: boolean,
    initial: Record<string, unknown> = {}
  ) => {
    const historyDir = join(dir, 'hist')
    await fs.mkdir(historyDir, { recursive: true })
    await fs.writeFile(join(historyDir, 'matches.ndjson'), lines.join('\n') + '\n')
    tracker = new HuntTracker({ enabled: false, ...initial }, vi.fn(), vi.fn(), {
      findPid: async () => null,
      isAlive: () => false,
      historyDir,
      isPro: () => pro
    })
    return tracker
  }

  it('older stores count the whole history; free users get no data', async () => {
    const { tracker: old } = make({ enabled: false }, { value: null })
    expect(old.get().look.mapsPeriod).toBe('all')
    expect(old.get().maps).toBeNull()
  })

  it('reads the history at start: all-time win rate, scoped to the mode like the overlay', async () => {
    const t = await withHistory(
      [
        entry('a', 'Stillwater', 'survived'),
        entry('b', 'Stillwater', 'lost'),
        entry('c', 'Lawson', 'survived'),
        entry('d', 'Lawson', 'lost', 'Bounty Clash'),
        entry('e', 'Lawson', '', 'Bounty Hunt'), // no result: left out
        'broken line'
      ],
      true,
      { look: { scope: 'session' } } // all modes
    )
    await waitFor(() => (t.get().maps?.length ?? 0) > 0)
    expect(t.get().maps).toEqual([
      { name: 'Lawson', games: 2, survived: 1, rate: 50 },
      { name: 'Stillwater', games: 2, survived: 1, rate: 50 }
    ])
  })

  it('only with Pro', async () => {
    const t = await withHistory([entry('a', 'Lawson', 'survived')], false)
    await new Promise((r) => setTimeout(r, 200))
    expect(t.get().maps).toBeNull()
  })

  it('the session period counts only this session', async () => {
    const t = await withHistory(
      [entry('a', 'Lawson', 'lost'), entry('b', 'Lawson', 'lost')],
      true,
      {
        look: { scope: 'session', mapsPeriod: 'session' },
        session: {
          recent: [
            { outcome: 'survived', kills: 1, mode: 'Bounty Hunt', mapName: 'DeSalle', endedAt: 5 }
          ]
        }
      }
    )
    await new Promise((r) => setTimeout(r, 200))
    expect(t.get().maps).toEqual([{ name: 'DeSalle', games: 1, survived: 1, rate: 100 }])
  })
})

describe('challenge goals', () => {
  const withGoals = (goals: unknown, pro = true, session: Record<string, unknown> = {}) => {
    const save = vi.fn()
    const emit = vi.fn()
    const t = new HuntTracker({ enabled: false, goals, session }, save, emit, {
      findPid: async () => null,
      isAlive: () => false,
      isPro: () => pro
    })
    return { t, save, emit }
  }

  it('older stores have no goals; junk is dropped, not guessed', () => {
    const { tracker: old } = make({ enabled: false }, { value: null })
    expect(old.get().goals).toEqual([])
    const { t } = withGoals([
      { id: 'a', metric: 'kills', target: 5 },
      'junk',
      { metric: 'nope', target: 1 }
    ])
    expect(t.get().goals).toHaveLength(1)
    t.dispose()
  })

  it('progress follows the session; Pro is reported separately', () => {
    const { t } = withGoals([{ id: 'a', metric: 'kills', target: 10 }], false, { kills: 4 })
    expect(t.get().goals[0]).toMatchObject({ value: 4, done: false })
    expect(t.get().proActive).toBe(false) // the settings still show and edit the goals
    t.dispose()
    const pro = withGoals([{ id: 'a', metric: 'kills', target: 3 }], true, { kills: 4 }).t
    expect(pro.get().goals[0].done).toBe(true)
    expect(pro.get().proActive).toBe(true)
    pro.dispose()
  })

  it('setGoals cleans the list, saves it with the settings and broadcasts', async () => {
    const { t, save, emit } = withGoals([])
    t.setGoals([
      { metric: 'survived', target: 3, title: '  Выжить  ' },
      { metric: 'wat', target: 1 }
    ])
    expect(t.get().goals).toMatchObject([
      { metric: 'survived', target: 3, title: 'Выжить', enabled: true }
    ])
    expect(t.get().goals[0].id).toMatch(/^g_/)
    expect(emit.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'hunt_update' })
    t.dispose() // dispose saves right away
    const saved = save.mock.calls.at(-1)?.[0]
    expect(saved.goals).toHaveLength(1)
    // ...and the next start reads the same goals back
    const again = new HuntTracker(saved, vi.fn(), vi.fn(), {
      findPid: async () => null,
      isAlive: () => false
    })
    expect(again.get().goals).toHaveLength(1)
    again.dispose()
  })

  it('a new session starts the progress over, the goals stay', () => {
    const { t } = withGoals([{ id: 'a', metric: 'kills', target: 10 }], true, {
      kills: 6,
      bestKills: 6
    })
    expect(t.get().goals[0].value).toBe(6)
    t.resetSession()
    expect(t.get().goals[0]).toMatchObject({ value: 0, done: false })
    t.dispose()
  })
})

describe('Pro overlay themes', () => {
  const withPro = (theme: any, pro: { value: boolean }) =>
    new HuntTracker({ enabled: false, look: { theme } }, vi.fn(), vi.fn(), {
      findPid: async () => null,
      isAlive: () => false,
      isPro: () => pro.value
    })

  it('older stores and junk load as the classic theme', () => {
    const { tracker: t } = make({ enabled: false }, { value: null })
    expect(t.get().look.theme).toBe('classic')
    expect(t.get().theme).toBe('classic')
    const pro = { value: true }
    expect(withPro('neon', pro).get().look.theme).toBe('classic')
  })

  it('a Pro theme is drawn only while Pro is active, and comes back with it', () => {
    const pro = { value: true }
    const t = withPro('blood', pro)
    expect(t.get().theme).toBe('blood')
    pro.value = false
    expect(t.get().theme).toBe('classic') // overlay falls back
    expect(t.get().look.theme).toBe('blood') // the pick is kept
    pro.value = true
    expect(t.get().theme).toBe('blood')
    t.dispose()
  })

  it('a failing Pro check means no Pro theme', () => {
    const t = new HuntTracker({ enabled: false, look: { theme: 'slate' } }, vi.fn(), vi.fn(), {
      findPid: async () => null,
      isAlive: () => false,
      isPro: () => {
        throw new Error('not ready')
      }
    })
    expect(t.get().theme).toBe('classic')
    t.dispose()
  })
})

describe('NVIDIA Highlights link, end to end', () => {
  const FAILED = [
    '2026-10-21T07:36:50.251[E] TASK     CallbackContext.h:69   Message JoinIPCChannel[join] return value: NVGSDK_SUCCESS(0) Joined bus',
    '2026-10-21T07:36:55.253[E] TASK     CallbackContext.h:73   Message Create[2d7cc146] return value: NVGSDK_ERR_IPC_FAILED(-1024) Request timed out'
  ]

  it('a game started before the tracker, whose launch could not connect, is flagged', async () => {
    // The friend's case: the game has been running for a while, the events log holds
    // only the failed start, "events" reads fine and still nothing will ever arrive.
    await fs.writeFile(gameLog, '')
    await append(gameLog, L.loading, L.nub, L.level('creek'), L.loaded)
    await fs.writeFile(sdkFile(8181), '')
    await append(sdkFile(8181), ...FAILED)

    const pid = { value: 8181 as number | null }
    const { tracker: t } = make({}, pid)
    await waitFor(() => t.get().connected && t.get().statuses.events === 'online')
    expect(t.get().sdk).toMatchObject({
      state: 'failed',
      error: 'NVGSDK_ERR_IPC_FAILED',
      received: 0
    })
    expect(t.get().session.games).toBeGreaterThanOrEqual(0)
  }, 20_000)

  it('a game started after the tracker that connected fine is connected, and counts moments', async () => {
    const pid = { value: null as number | null }
    const { tracker: t } = make({}, pid)
    await fs.writeFile(gameLog, '')
    await append(gameLog, L.loading, L.nub, L.level('creek'), L.loaded)
    await fs.writeFile(sdkFile(8282), '')
    await append(
      sdkFile(8282),
      '2026-10-18T11:52:55.044[E] TASK     CallbackContext.h:69   Message Create[ff7ef06b] return value: NVGSDK_SUCCESS(0) Success',
      `${stamp(Date.now())} ${L.open()}`
    )
    pid.value = 8282
    await waitFor(() => t.get().connected && t.get().sdk.state === 'connected')
    await append(sdkFile(8282), L.video('k1', Date.now()))
    await waitFor(() => t.get().sdk.received === 1)
    expect(t.get().sdk.state).toBe('connected')
  }, 20_000)
})

describe('session clock and automatic new session', () => {
  const startGame = async (pid: { value: number | null }, id: number) => {
    await fs.writeFile(gameLog, '')
    await fs.writeFile(sdkFile(id), '')
    pid.value = id
  }

  it('counts game time only while the game runs', async () => {
    const pid = { value: null as number | null }
    const { tracker: t, alive } = make({}, pid)
    expect(t.get().playingSince).toBeNull()
    await startGame(pid, 5151)
    await waitFor(() => t.get().connected)
    await new Promise((r) => setTimeout(r, 300))
    expect(t.get().playingSince).not.toBeNull()
    expect(t.get().session.playedMs).toBeGreaterThanOrEqual(250)

    alive.value = false
    await waitFor(() => !t.get().connected)
    const frozen = t.get().session.playedMs
    expect(t.get().playingSince).toBeNull()
    await new Promise((r) => setTimeout(r, 300))
    expect(t.get().session.playedMs).toBe(frozen) // the clock stopped with the game
  }, 20_000)

  const stale = () => ({
    session: {
      startedAt: Date.now() - 6 * 3600_000,
      lastPayloadAt: Date.now() - 4 * 3600_000,
      games: 5
    }
  })

  it('a long break starts a new session (default 3 h)', async () => {
    const pid = { value: null as number | null }
    const { tracker: t } = make(stale(), pid)
    await startGame(pid, 5252)
    await waitFor(() => t.get().connected)
    expect(t.get().session.games).toBe(0)
  }, 20_000)

  it('with the automatic reset off the old session goes on', async () => {
    const pid = { value: null as number | null }
    const { tracker: t } = make({ ...stale(), sessionGapHours: 0 }, pid)
    await startGame(pid, 5353)
    await waitFor(() => t.get().connected)
    expect(t.get().session.games).toBe(5)
  }, 20_000)

  describe('a session that is simply old, the game not running', () => {
    const HOUR = 3600_000
    const old = (hoursAgo: number, extra: Record<string, unknown> = {}) => ({
      session: {
        startedAt: Date.now() - (hoursAgo + 1) * HOUR,
        lastPayloadAt: Date.now() - hoursAgo * HOUR,
        games: 5,
        kills: 12,
        recent: [{ outcome: 'survived', kills: 4, mode: 'Bounty Hunt', endedAt: 1 }]
      },
      ...extra
    })

    it('is renewed on its own after a long break - the game does not have to start', async () => {
      const { tracker: t } = make(old(72), { value: null }) // three days, tracker enabled
      await waitFor(() => t.get().session.games === 0)
      expect(t.get().session).toMatchObject({ games: 0, kills: 0, playedMs: 0 })
      expect(t.get().recent).toBeNull() // (not Pro here) - and no stale list is kept either
    }, 20_000)

    it('is renewed at app start even with the tracker switched off', () => {
      const { tracker: t } = make(old(72, { enabled: false }), { value: null })
      expect(t.get().session.games).toBe(0)
      expect(t.get().session.kills).toBe(0)
    })

    it('stays while the break is shorter than the setting', async () => {
      const { tracker: t } = make(old(2), { value: null })
      await new Promise((r) => setTimeout(r, 1200)) // a few loop ticks
      expect(t.get().session.games).toBe(5)
    }, 20_000)

    it('stays when the automatic reset is off', async () => {
      const { tracker: t } = make(old(500, { sessionGapHours: 0 }), { value: null })
      await new Promise((r) => setTimeout(r, 1200))
      expect(t.get().session.games).toBe(5)
    }, 20_000)

    it('picking a shorter break applies at once', () => {
      const { tracker: t } = make(old(5, { enabled: false, sessionGapHours: 12 }), { value: null })
      expect(t.get().session.games).toBe(5) // 5 h < 12 h
      t.setSessionGap(3)
      expect(t.get().session.games).toBe(0)
    })

    it('an already empty session is not "renewed" over and over (no pointless saves)', async () => {
      const { tracker: t, save } = make(
        { session: { startedAt: 1, lastPayloadAt: Date.now() - 100 * HOUR } },
        { value: null }
      )
      const before = save.mock.calls.length
      await new Promise((r) => setTimeout(r, 1200))
      expect(t.get().session.games).toBe(0)
      expect(save.mock.calls.length).toBe(before)
    }, 20_000)
  })

  it('only the offered gaps are accepted', () => {
    const { tracker: t } = make({ enabled: false }, { value: null })
    t.setSessionGap(12)
    expect(t.get().sessionGapHours).toBe(12)
    t.setSessionGap(7)
    expect(t.get().sessionGapHours).toBe(12)
  })
})

describe('game already running when tracking starts', () => {
  it('rebuilds the match from the logs without counting what is already there', async () => {
    await fs.writeFile(gameLog, '')
    await append(
      gameLog,
      L.mode('BountyHuntLobby'),
      L.loading,
      L.nub,
      L.level('civilwar'),
      L.loaded
    )
    await fs.writeFile(sdkFile(777), '')
    await append(
      sdkFile(777),
      `${stamp(Date.now() - 60_000)} ${L.open()}`,
      L.video('old1', Date.now() - 30_000)
    )

    const pid = { value: 777 as number | null }
    const { tracker: t } = make({}, pid)

    await waitFor(() => t.get().connected && t.get().current.inMatch)
    expect(t.get().current.map).toBe('Lawson')
    expect(t.get().current.mode).toBe('Bounty Hunt')
    expect(t.get().session.games).toBe(1)
    expect(t.get().session.kills).toBe(0) // old1 was already in the log

    await append(sdkFile(777), L.video('new1', Date.now()))
    await waitFor(() => t.get().session.kills === 1)
    expect(t.get().session.kills).toBe(1)
  }, 20_000)

  it('picks the match back up after a restart without adding a second game', async () => {
    await fs.writeFile(gameLog, '')
    await append(gameLog, L.loading, L.nub, L.level('creek'), L.loaded)
    await fs.writeFile(sdkFile(55), '')
    await append(sdkFile(55), L.open())

    const pid = { value: 55 as number | null }
    const first = make({}, pid)
    await waitFor(() => first.tracker.get().current.inMatch)
    await append(sdkFile(55), L.video('k1', Date.now()))
    await waitFor(() => first.tracker.get().session.kills === 1)
    first.tracker.dispose()
    const persisted = first.save.mock.calls[first.save.mock.calls.length - 1][0]
    expect(persisted.session.games).toBe(1)

    const second = make(persisted, pid)
    await waitFor(() => second.tracker.get().current.inMatch)
    expect(second.tracker.get().session.games).toBe(1)
    expect(second.tracker.get().session.kills).toBe(1)
    await append(sdkFile(55), L.video('k2', Date.now()))
    await waitFor(() => second.tracker.get().session.kills === 2)
  }, 20_000)
})

describe('settings and persistence', () => {
  it('loads the first (pre-engine) persisted shape', () => {
    const legacy = {
      gameLogPath: 'C:/Steam/Hunt/USER/Game.log',
      nvidiaLogsPath: 'C:/Users/x/AppData/Local/NVIDIA Corporation/GfeSDK',
      enabled: false,
      connected: true,
      look: {
        position: 'top',
        bg: '#111111',
        text: '#eeeeee',
        accent: '#ff0000',
        scale: 1.4,
        rows: { maps: true, duration: false }
      },
      session: {
        startedAt: 1,
        // recent: an older one would now be renewed on its own (that is tested apart)
        lastPayloadAt: Date.now() - 60_000,
        games: 3,
        survived: 1,
        lost: 2,
        kills: 7,
        deaths: 4,
        kd: 1.75,
        maps: { cemetery: 2, civilwar: 1 },
        modes: { 'Bounty Hunt': { kills: 7, deaths: 4 }, 'Bounty Clash': { kills: 0, deaths: 0 } }
      },
      current: { inMatch: true, map: 'old', mode: 'Bounty Hunt', skulls: ['kill'] }
    }
    // built directly: make() would add the new key names on top of the old ones
    const t = new HuntTracker(legacy, vi.fn(), vi.fn())
    tracker = t
    const s = t.get()
    expect(s.session).toMatchObject({
      games: 3,
      survived: 1,
      lost: 2,
      kills: 7,
      deaths: 4,
      trades: 0
    })
    expect(s.session.maps).toEqual({ cemetery: 2, civilwar: 1 })
    // older stores only had kills/deaths per mode
    expect(s.session.modes['Bounty Hunt']).toEqual({
      games: 0,
      survived: 0,
      lost: 0,
      kills: 7,
      deaths: 4
    })
    expect(s.look.scope).toBe('mode')
    expect(s.activeMode).toBe('')
    expect(s.gamePath).toBe('C:/Steam/Hunt/USER/Game.log')
    expect(s.eventsPath).toBe('C:/Users/x/AppData/Local/NVIDIA Corporation/GfeSDK')
    expect(s.latencyMode).toBe('fast')
    expect(s.look.position).toBe('top')
    expect(s.look.scale).toBe(1.4)
    expect(s.look.bgOpacity).toBe(1) // no field in old stores: the panel stays opaque
    expect(s.sessionGapHours).toBe(3) // the fixed break it always was
    expect(s.session.playedMs).toBe(0)
    expect(s.look.rows.duration).toBe(false)
    expect(s.current.inMatch).toBe(false) // a transient view from the old shape is not trusted
    expect(s.connected).toBe(false)
  })

  it('survives garbage in the store', () => {
    for (const junk of [undefined, null, 'x', 42, { session: 'no', look: 7, match: [] }]) {
      const t = new HuntTracker(junk, vi.fn(), vi.fn())
      expect(t.get().session.games).toBe(0)
      t.dispose()
    }
  })

  it('the demo never touches the real session', () => {
    const real = { session: { games: 2, kills: 5, deaths: 1, survived: 1, lost: 1 } }
    const { tracker: t, save } = make({ ...real, enabled: false }, { value: null })
    t.demo()
    expect(t.get().session.kills).toBe(20)
    t.dispose()
    expect(save.mock.calls[save.mock.calls.length - 1][0].session.kills).toBe(5)
  })

  it('a fresh session after "reset" starts from zero', () => {
    const { tracker: t } = make(
      { enabled: false, session: { games: 2, kills: 5 } },
      { value: null }
    )
    t.resetSession()
    expect(t.get().session.kills).toBe(0)
    expect(t.get().session.games).toBe(0)
  })

  it('latency mode: valid values apply, junk is ignored', () => {
    const { tracker: t } = make({ enabled: false }, { value: null })
    t.setLatencyMode('normal')
    expect(t.get().latencyMode).toBe('normal')
    t.setLatencyMode('turbo' as any)
    expect(t.get().latencyMode).toBe('normal')
    t.setLatencyMode('instant' as any) // removed mode
    expect(t.get().latencyMode).toBe('normal')
  })

  it('a store saved with the removed instant mode loads as fast', () => {
    const { tracker: t } = make({ enabled: false, latencyMode: 'instant' }, { value: null })
    expect(t.get().latencyMode).toBe('fast')
  })

  it('broadcasts the state on changes and saves it on dispose', () => {
    const { tracker: t, save, emit } = make({ enabled: false }, { value: null })
    t.patchLook({ scale: 1.5 })
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'hunt_update' }))
    t.dispose()
    expect(save.mock.calls[save.mock.calls.length - 1][0].look.scale).toBe(1.5)
  })

  it('flags a missing NVIDIA path right away', () => {
    const { tracker: t } = make({ eventsPath: null }, { value: null })
    expect(t.get().statuses.events).toBe('missing')
  })

  it('refuses to start without a Game.log path and says so', () => {
    const { tracker: t } = make({ gamePath: null }, { value: null })
    expect(t.get().statuses.game).toBe('missing')
  })

  it('look values are clamped and unknown positions fall back', () => {
    const { tracker: t } = make({ enabled: false }, { value: null })
    t.patchLook({ scale: 99, position: 'middle-of-nowhere' })
    expect(t.get().look.scale).toBe(2)
    expect(t.get().look.position).toBe('top-left')
    t.patchLook({ bgOpacity: 0.4 })
    expect(t.get().look.bgOpacity).toBe(0.4)
    t.patchLook({ bgOpacity: 5 })
    expect(t.get().look.bgOpacity).toBe(1)
    t.patchLook({ bgOpacity: 'x' })
    expect(t.get().look.bgOpacity).toBe(1)
  })
})
