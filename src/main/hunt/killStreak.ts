import type { AlertPayload } from '../alertBox/model'
import { fontFamily } from '../fontFamily'

// "Серия убийств": an announcer for a match. When the number of kills of the match reaches the number of a rule, a big
// title ("Доминатор") with a sound is shown on the alerts overlay (/alerts), once per rule per match.
// The settings live under the electron-store key `huntStreak`; this file is the pure part (settings made safe, which rules a
// kill fires, the alert of a rule).

export interface StreakRule {
  id: string
  /** The kill of the match this rule fires at (1..50; 1 = the first blood). */
  kills: number
  title: string
  /** false = no text at all, the picture alone (and the sound). */
  showText: boolean
  color: string
  /** A picture / gif / video shown with the title; '' = the title alone. */
  mediaUrl: string
  /** Own sound; '' = the built-in chime of the rule (it rises with the number of kills). */
  soundUrl: string
  enabled: boolean
}

/** What is shown when the streamer dies (one alert, no number). */
export interface DeathAlert {
  enabled: boolean
  title: string
  /** false = no text at all, the picture alone (and the sound). */
  showText: boolean
  /** The picture fills the whole screen. */
  fullscreen: boolean
  color: string
  mediaUrl: string
  /** Own sound; '' = no sound (a death has no built-in chime). */
  soundUrl: string
}

export interface StreakState {
  enabled: boolean
  rules: StreakRule[]
  death: DeathAlert
  /** Font family of the titles ('' = the overlay's own). */
  font: string
  /** Seconds the alert stays. */
  duration: number
  position: string
  /** Width of the picture, % of the screen. */
  widthPct: number
  volume: number
}

export const RULES_MAX = 12

/** "убийство" / "убийства" / "убийств" for a count. */
export function killsWord(n: number): string {
  const m100 = n % 100
  const m10 = n % 10
  if (m100 >= 11 && m100 <= 14) return 'убийств'
  if (m10 === 1) return 'убийство'
  if (m10 >= 2 && m10 <= 4) return 'убийства'
  return 'убийств'
}

const COLORS = ['#ffb020', '#ff5a1f', '#ff2d55', '#b026ff', '#2dd4bf', '#4a90e2']
const DEFAULT_RULES: Array<[number, string]> = [
  [3, 'Серия убийств'],
  [5, 'Доминатор'],
  [7, 'Неудержимый'],
  [10, 'Богоподобный']
]
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2060-\u2064\u2066-\u2069\uFEFF]/g

const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
const hex = (v: unknown, dflt: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : dflt
const url = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https?:\/\//i.test(s) && s.length <= 2000 ? s : ''
}
const text = (v: unknown, max: number): string =>
  Array.from(
    String(v ?? '')
      .replace(BAD_CHARS, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
    .slice(0, max)
    .join('')
    .trim()

export function defaultRules(): StreakRule[] {
  return DEFAULT_RULES.map(([kills, title], i) => ({
    id: `r${kills}`,
    kills,
    title,
    showText: true,
    color: COLORS[i % COLORS.length],
    mediaUrl: '',
    soundUrl: '',
    enabled: true
  }))
}

/** Whatever the settings window (or the store) holds, made safe and complete. Never saved before: the default rules, switched off. */
export function normalizeStreak(raw: any): StreakState {
  const r = raw && typeof raw === 'object' ? raw : {}
  const given = Array.isArray(r.rules) ? r.rules : null
  const seen = new Set<string>()
  const rules: StreakRule[] = []
  for (const it of given ?? defaultRules()) {
    if (!it || typeof it !== 'object' || rules.length >= RULES_MAX) continue
    let id = text(it.id, 40) || `r${rules.length + 1}`
    while (seen.has(id)) id += '_'
    seen.add(id)
    rules.push({
      id,
      kills: Math.round(num(it.kills, 1, 50, 3)),
      title: text(it.title, 40) || 'Серия убийств',
      showText: it.showText !== false,
      color: hex(it.color, COLORS[rules.length % COLORS.length]),
      mediaUrl: url(it.mediaUrl),
      soundUrl: url(it.soundUrl),
      enabled: it.enabled !== false
    })
  }
  const d = r.death && typeof r.death === 'object' ? r.death : {}
  return {
    enabled: r.enabled === true,
    rules,
    death: {
      enabled: d.enabled === true,
      title: text(d.title, 40) || 'Вы погибли',
      showText: d.showText !== false,
      fullscreen: d.fullscreen === true,
      color: hex(d.color, '#ff2d55'),
      mediaUrl: url(d.mediaUrl),
      soundUrl: url(d.soundUrl)
    },
    font: fontFamily(r.font),
    duration: num(r.duration, 2, 15, 4),
    position: /^[tmb][lcr]$/.test(r.position) ? r.position : 'mc',
    widthPct: Math.round(num(r.widthPct, 5, 100, 20)),
    volume: Math.round(num(r.volume, 0, 100, 70))
  }
}

/**
 * The rules that fire now: enabled, at exactly this number of kills, and not fired in this match yet. A match that jumps over a
 * number (two kills counted at once) fires the rules it passed, the highest of them last, so none is lost.
 */
export function rulesToFire(
  rules: StreakRule[],
  from: number,
  to: number,
  fired: ReadonlySet<string>
): StreakRule[] {
  return rules
    .filter((r) => r.enabled && r.kills > from && r.kills <= to && !fired.has(r.id))
    .sort((a, b) => a.kills - b.kills)
}

/** The alert of a rule as the alerts overlay draws it. `chime` (1..4, by the rank of the rule) is the built-in sound. */
export function streakPayload(
  rule: StreakRule,
  state: StreakState,
  kills: number,
  rank: number,
  id: string
): AlertPayload {
  const sub = `${kills} ${killsWord(kills)} в матче`
  return {
    ...basePayload(state, rule, id, sub),
    ...(rule.soundUrl ? {} : { chime: Math.max(1, Math.min(4, rank)) })
  }
}

/** The alert of a death: the title (and a picture / sound if set), no count under it. */
export function deathPayload(state: StreakState, id: string): AlertPayload {
  return {
    ...basePayload(state, state.death, id, ''),
    ...(state.death.fullscreen ? { fullscreen: true } : {})
  }
}

function basePayload(
  state: StreakState,
  rule: { title: string; showText: boolean; color: string; mediaUrl: string; soundUrl: string },
  id: string,
  sub: string
): AlertPayload {
  return {
    id,
    kind: /\.(mp4|webm)(\?|$)/i.test(rule.mediaUrl) ? 'video' : 'image',
    mediaUrl: rule.mediaUrl,
    soundUrl: rule.soundUrl,
    caption: !rule.showText ? '' : sub ? `${rule.title}\n${sub}` : rule.title,
    // the title in the colour of the rule, the count under it smaller (the overlay gives the "text" part its own size)
    captionParts: !rule.showText
      ? []
      : sub
        ? [
            { t: rule.title, k: 'user' },
            { t: '\n', k: '' },
            { t: sub, k: 'text' }
          ]
        : [{ t: rule.title, k: 'user' }],
    captionStyle: {
      size: 76,
      textSize: 34,
      color: '#ffffff',
      bold: true,
      align: 'center',
      outlineWidth: 6,
      outlineColor: '#000000',
      outlineOpacity: 85,
      bg: false,
      bgColor: '#141418',
      bgOpacity: 0,
      radius: 0,
      placement: 'below',
      userColor: rule.color,
      amountColor: ''
    },
    font: state.font,
    animationIn: 'zoom',
    animationOut: 'fade',
    duration: state.duration,
    position: state.position,
    widthPct: state.widthPct,
    volume: state.volume
  }
}
