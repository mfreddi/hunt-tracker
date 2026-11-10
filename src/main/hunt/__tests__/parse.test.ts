import { describe, expect, it } from 'vitest'
import {
  IGNORED_MAP_IDS,
  RE,
  getMapName,
  modeFromLine,
  parseDisconnect,
  parseGameTimeOfDay,
  parseSdkTimestamp,
  utcTimeOfDay
} from '../parse'

describe('modeFromLine', () => {
  it('recognises the three lobby targets, case-insensitively', () => {
    expect(modeFromLine('GotoDeepLinkingTarget(BountyHuntLobby, x)')).toBe('Bounty Hunt')
    expect(modeFromLine('SelectDeepLinkingTarget(BountyClashLobby)')).toBe('Bounty Clash')
    expect(modeFromLine('gotodeeplinkingtarget(QuickplayLobby')).toBe('Soul Survivor')
    expect(modeFromLine('something else')).toBeNull()
  })
})

describe('parseDisconnect', () => {
  const nub = "Client_OnDisconnect(cause=11, reasonType='Unknown' desc='Nub destroyed')"

  it('flags the menu->mission network switch as a loading transition', () => {
    expect(parseDisconnect(nub, 'loading')).toEqual({
      cause: 11,
      reason: 'Unknown',
      isLoadingTransition: true
    })
  })

  it('is a real disconnect outside the loading phase', () => {
    expect(parseDisconnect(nub, 'gameplay')?.isLoadingTransition).toBe(false)
  })

  it('is a real disconnect when the reason differs', () => {
    const line = "Client_OnDisconnect(cause=17, reasonType='MissionRequested' desc='Nub destroyed')"
    expect(parseDisconnect(line, 'loading')?.isLoadingTransition).toBe(false)
  })

  it('returns null for unrelated lines', () => {
    expect(parseDisconnect('nothing here', 'gameplay')).toBeNull()
  })
})

describe('timestamps', () => {
  it('parses the SDK local timestamp prefix to the right instant', () => {
    const t = parseSdkTimestamp('2026-10-03T23:39:04.606 Posted Request HLSetVideo[ab12]')
    expect(t).toBe(new Date(2026, 9, 3, 23, 39, 4, 606).getTime())
  })

  it('returns null when there is no timestamp', () => {
    expect(parseSdkTimestamp('Posted Request HLSetVideo[ab12]')).toBeNull()
  })

  it('parses the Game.log UTC time of day', () => {
    expect(parseGameTimeOfDay("<21:39:04> Starting UI state machine 'death/StateMachine'")).toBe(
      (21 * 3600 + 39 * 60 + 4) * 1000
    )
    expect(parseGameTimeOfDay('no prefix')).toBeNull()
  })

  it('utcTimeOfDay is independent of the machine time zone', () => {
    expect(utcTimeOfDay(Date.UTC(2026, 9, 3, 21, 39, 4, 606))).toBe(
      (21 * 3600 + 39 * 60 + 4) * 1000 + 606
    )
  })
})

describe('maps', () => {
  it('maps known ids and passes unknown ones through', () => {
    expect(getMapName('cemetery')).toBe('Stillwater')
    expect(getMapName('COLORADO')).toBe('Mammon')
    expect(getMapName('brand_new_map')).toBe('brand_new_map')
  })

  it('ignores the shooting range and the tutorial', () => {
    expect(IGNORED_MAP_IDS.has('shooting')).toBe(true)
    expect(IGNORED_MAP_IDS.has('tutorial_scripted')).toBe(true)
    expect(IGNORED_MAP_IDS.has('creek')).toBe(false)
  })
})

describe('line patterns', () => {
  it('match the lines the reference tracker keys on', () => {
    expect(RE.prepareLevel.exec("PrepareLevel 'levels/creek' (client)")?.[1]).toBe('creek')
    expect(RE.loading.test("Starting UI state machine 'loading/StateMachine'")).toBe(true)
    expect(RE.loading.test('CGameLobby::OnGameStarting()')).toBe(true)
    expect(RE.deathOpen.test("<21:39:04> Starting UI state machine 'death/StateMachine'...")).toBe(
      true
    )
    expect(RE.deathClose.test("Stopping UI state machine 'death/StateMachine'")).toBe(true)
    expect(
      RE.sdkSetVideo.exec('2026-10-03T23:39:04.606 Posted Request HLSetVideo[3a058860]')?.[1]
    ).toBe('3a058860')
    expect(RE.sdkOpenGroup.exec('Posted Request HLOpenGroup[96c1d81c]')?.[1]).toBe('96c1d81c')
  })
})
