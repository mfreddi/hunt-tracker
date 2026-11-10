import type { AlertPayload } from '../alertBox/model'
import {
  type StreakRule,
  type StreakState,
  normalizeStreak,
  rulesToFire,
  deathPayload,
  streakPayload
} from './killStreak'

// The kill streak announcer: watches the kills of the match and shows the alert of a rule when the count
// reaches its number. The alert goes to its own overlay (/killstreak), not through the donation alerts.

interface StoreLike {
  get(key: string): any
  set(key: string, value: any): void
}

export interface KillStreakDeps {
  store: StoreLike
  isPro: () => boolean
  /** Shows an alert on the /killstreak overlay; false = no such overlay is open. */
  show: (payload: AlertPayload) => boolean
  now?: () => number
}

export type StreakTestResult = 'ok' | 'pro' | 'no-overlay' | 'no-rule'

export class KillStreakAlerts {
  private matchId = ''
  private last = 0
  private fired = new Set<string>()

  constructor(private d: KillStreakDeps) {}

  get(): StreakState {
    return normalizeStreak(this.d.store.get('huntStreak'))
  }

  save(raw: unknown): StreakState {
    const state = normalizeStreak(raw)
    this.d.store.set('huntStreak', state)
    return state
  }

  private pro(): boolean {
    try {
      return !!this.d.isPro()
    } catch {
      return false
    }
  }

  /** A kill of the current match; `kills` is the count of the match now. */
  handleKill(e: { kills: number; matchId: string }): void {
    if (e.matchId !== this.matchId) {
      this.matchId = e.matchId
      this.last = 0
      this.fired.clear()
    }
    const from = this.last
    this.last = e.kills
    const state = this.get()
    // switched on in the middle of a match: what is behind it is not announced afterwards (the count is followed all the time)
    if (!state.enabled || !this.pro()) return
    for (const rule of rulesToFire(state.rules, from, e.kills, this.fired)) {
      this.fired.add(rule.id)
      this.d.show(this.payload(rule, state, e.kills, `${e.matchId}:${rule.id}`))
    }
  }

  /** The streamer died (a late death of an earlier match is dropped by the tracker). */
  handleDeath(e: { matchId: string }): void {
    const state = this.get()
    if (!state.enabled || !state.death.enabled || !this.pro()) return
    this.d.show(deathPayload(state, `streak:death:${e.matchId}:${(this.d.now ?? Date.now)()}`))
  }

  /** What the preview shows for the death alert (no Pro needed). */
  previewDeath(raw?: any): AlertPayload {
    const state = normalizeStreak({ ...this.get(), death: raw?.death, font: raw?.font })
    return deathPayload(state, 'streak:death:preview')
  }

  /** The "Тест" button of the death alert. */
  testDeath(): StreakTestResult {
    if (!this.pro()) return 'pro'
    return this.d.show(deathPayload(this.get(), `streak:death:test:${(this.d.now ?? Date.now)()}`))
      ? 'ok'
      : 'no-overlay'
  }

  /** The alert of a rule as it would be shown (for the preview and the test button). */
  payload(rule: StreakRule, state: StreakState, kills: number, key: string): AlertPayload {
    // rank = the place of the rule among the enabled ones, low to high: the higher the rule, the higher the built-in chime
    const rank = state.rules.filter((r) => r.enabled && r.kills <= rule.kills).length
    return streakPayload(rule, state, kills, rank, `streak:${key}:${(this.d.now ?? Date.now)()}`)
  }

  /** What the preview shows for a rule (any rule, switched on or not; Pro is not needed: it can be tried before buying). */
  preview(raw: unknown): AlertPayload | null {
    // the font comes with the rule: it is shown before the edit is saved
    const state = normalizeStreak({ ...this.get(), font: (raw as any)?.font ?? this.get().font })
    const rule = normalizeStreak({ rules: [raw] }).rules[0]
    return rule ? this.payload(rule, state, rule.kills, 'preview') : null
  }

  /** The "Тест" button: the alert of a rule on the /killstreak overlay (Pro, like the real thing). */
  test(ruleId: string): StreakTestResult {
    const state = this.get()
    const rule = state.rules.find((r) => r.id === ruleId)
    if (!rule) return 'no-rule'
    if (!this.pro()) return 'pro'
    return this.d.show(this.payload(rule, state, rule.kills, `test:${rule.id}`))
      ? 'ok'
      : 'no-overlay'
  }
}
