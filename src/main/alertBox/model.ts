import type { AppEvent, DonationAppEvent } from '../events/types'
import { fontFamily } from '../fontFamily'

// Alert variants of the "Алерты" overlay (/alerts): the streamer makes a list of alerts for donations from any
// platform, each with its own conditions (platform, amount range), look, animation and voice. The first enabled variant
// whose conditions fit the donation is shown. Pure module: no electron, no store, no sockets - AlertBox.ts runs it.

export const ANIMATIONS = [
  'pop',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'bounce',
  'zoom',
  'shake',
  'fade',
  'none'
] as const
export type AnimationName = (typeof ANIMATIONS)[number]

export const VOICE_MODES = ['off', 'platform', 'edge', 'yandex'] as const
export type VoiceMode = (typeof VOICE_MODES)[number]

export interface AlertVoiceConfig {
  /** off | the platform's own voice (when it has one) | our Edge / Yandex synthesizer. */
  mode: VoiceMode
  /** What is read: only the donor's message, or "name, amount, message". */
  read: 'message' | 'full'
  /** When the chosen voice is not available: the synthesizer of the app ('engine') or stay silent. */
  fallback: 'engine' | 'silent'
  volume: number // 0..100
}

/** How the caption is drawn. The defaults are the look the overlay always had. */
export interface CaptionStyle {
  size: number // px at 1080p
  /** Size of the donor's message ({text}) in px; 0 = like `size`. */
  textSize: number
  color: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  outlineWidth: number
  outlineColor: string
  outlineOpacity: number // 0..100
  /** The plate behind the text. */
  bg: boolean
  bgColor: string
  bgOpacity: number // 0..100
  radius: number
  /** Where the caption sits: under the picture, above it or over its lower part. */
  placement: 'below' | 'above' | 'over'
  /** Colour of {user} / of {amount} {currency}; '' = like the rest of the text. */
  userColor: string
  amountColor: string
}

/** Effects of an alert: a burst of confetti, a glow around the picture, a shake when it comes in. */
export interface AlertEffects {
  confetti: boolean
  glow: boolean
  shake: boolean
  /** The glow, and the main colour of the confetti. */
  color: string
  /** Only for a donation of at least this amount; null = every donation this variant shows. */
  minAmount: number | null
}

/** What the overlay gets of the effects: only the ones that are on (and only with Pro, and when the amount is big enough). */
export interface AlertEffectsPayload {
  confetti: boolean
  glow: boolean
  shake: boolean
  color: string
}

/** A piece of the filled caption; `k` says which variable it came from ('' = plain text), so the overlay can colour it. */
export interface CaptionPart {
  t: string
  k: '' | 'user' | 'amount' | 'text' | 'platform'
}

export interface AlertVariant {
  id: string
  name: string
  enabled: boolean
  /** Platforms this variant is for; empty = every donation platform. */
  platforms: string[]
  /** Amount range in the streamer's account currency; null = unbounded. */
  minAmount: number | null
  maxAmount: number | null
  mediaUrl: string
  soundUrl: string
  /** {user} {amount} {currency} {text} {platform} */
  caption: string
  captionFont: string
  captionStyle: CaptionStyle
  effects: AlertEffects
  animationIn: AnimationName
  animationOut: AnimationName
  duration: number // seconds on screen
  position: string // [t|m|b][l|c|r]
  widthPct: number
  volume: number // 0..100 of the sound / video
  voice: AlertVoiceConfig
}

/** What the overlay gets (`alert_box` message). */
export interface AlertPayload {
  id: string
  kind: 'image' | 'video'
  mediaUrl: string
  soundUrl: string
  caption: string
  captionParts: CaptionPart[]
  captionStyle: CaptionStyle
  /** A built-in sound (1..4, rising) for an alert that has none of its own (the kill streak announcer). */
  chime?: number
  /** The picture / video fills the whole screen (cropped to fit) instead of a box of `widthPct` (the Hunt death alert). */
  fullscreen?: boolean
  /** Set only when the effects apply to this alert (Pro, amount at or above the variant's threshold, at least one on). */
  effects?: AlertEffectsPayload
  font: string
  animationIn: AnimationName
  animationOut: AnimationName
  duration: number
  position: string
  widthPct: number
  volume: number
  /** Set by AlertBox when a voice was prepared: where the overlay fetches it and how loud it plays. */
  voice?: { url: string; volume: number }
}

const clampNum = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
const oneOf = <T extends string>(v: unknown, list: readonly T[], dflt: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : dflt
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const hexColor = (v: unknown, dflt: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : dflt

/** The effects made safe; a variant saved before they existed has none. */
export function normalizeEffects(raw: unknown): AlertEffects {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const min =
    e.minAmount === null || e.minAmount === undefined || e.minAmount === ''
      ? null
      : Number(e.minAmount)
  return {
    confetti: e.confetti === true,
    glow: e.glow === true,
    shake: e.shake === true,
    color: hexColor(e.color, '#ffd23f'),
    minAmount: min !== null && Number.isFinite(min) && min > 0 ? min : null
  }
}

/** The caption style made safe; anything missing (a variant saved before it existed) gets the look the overlay always had. */
export function normalizeCaptionStyle(raw: unknown): CaptionStyle {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    size: Math.round(clampNum(c.size, 12, 120, 26)),
    textSize: Number(c.textSize) > 0 ? Math.round(clampNum(c.textSize, 12, 120, 26)) : 0,
    color: hexColor(c.color, '#ffffff'),
    bold: c.bold !== false,
    align: oneOf(c.align, ['left', 'center', 'right'] as const, 'center'),
    outlineWidth: clampNum(c.outlineWidth, 0, 10, 3),
    outlineColor: hexColor(c.outlineColor, '#000000'),
    outlineOpacity: Math.round(clampNum(c.outlineOpacity, 0, 100, 55)),
    bg: c.bg !== false,
    bgColor: hexColor(c.bgColor, '#141418'),
    bgOpacity: Math.round(clampNum(c.bgOpacity, 0, 100, 72)),
    radius: Math.round(clampNum(c.radius, 0, 40, 10)),
    placement: oneOf(c.placement, ['below', 'above', 'over'] as const, 'below'),
    userColor: hexColor(c.userColor, ''),
    amountColor: hexColor(c.amountColor, '')
  }
}
const amountOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function emptyVariant(id: string): AlertVariant {
  return normalizeVariant({ id })
}

/** One stored / received variant made safe: every field clamped, enums checked, unknown ones dropped. */
export function normalizeVariant(raw: any, fallbackId = ''): AlertVariant {
  const r = raw && typeof raw === 'object' ? raw : {}
  const v = r.voice && typeof r.voice === 'object' ? r.voice : {}
  let min = amountOrNull(r.minAmount)
  let max = amountOrNull(r.maxAmount)
  if (min !== null && max !== null && min > max) [min, max] = [max, min]
  return {
    id: str(r.id, 64) || fallbackId,
    name: str(r.name, 80),
    enabled: r.enabled !== false,
    platforms: Array.isArray(r.platforms)
      ? Array.from(
          new Set<string>(
            (r.platforms as unknown[]).filter(
              (p): p is string => typeof p === 'string' && p.length <= 32
            )
          )
        )
      : [],
    minAmount: min,
    maxAmount: max,
    mediaUrl: str(r.mediaUrl, 2000),
    soundUrl: str(r.soundUrl, 2000),
    caption: str(r.caption, 300) || '{user} - {amount} {currency}',
    captionFont: fontFamily(r.captionFont),
    captionStyle: normalizeCaptionStyle(r.captionStyle),
    effects: normalizeEffects(r.effects),
    animationIn: oneOf(r.animationIn, ANIMATIONS, 'pop'),
    animationOut: oneOf(r.animationOut, ANIMATIONS, 'fade'),
    duration: clampNum(r.duration, 1, 60, 6),
    position: /^[tmb][lcr]$/.test(r.position) ? r.position : 'mc',
    widthPct: clampNum(r.widthPct, 5, 100, 40),
    volume: clampNum(r.volume, 0, 100, 70),
    voice: {
      mode: oneOf(v.mode, VOICE_MODES, 'off'),
      read: oneOf(v.read, ['message', 'full'] as const, 'message'),
      fallback: oneOf(v.fallback, ['engine', 'silent'] as const, 'engine'),
      volume: clampNum(v.volume, 0, 100, 100)
    }
  }
}

/** The stored list: junk entries dropped, ids made unique, at most 50 variants. */
export function normalizeVariants(raw: unknown): AlertVariant[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: AlertVariant[] = []
  for (const item of raw.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue
    let v = normalizeVariant(item, `v${out.length + 1}`)
    while (seen.has(v.id)) v = { ...v, id: `${v.id}_` }
    seen.add(v.id)
    out.push(v)
  }
  return out
}

/** Does this variant fit the donation? (An invalid amount never fits a bounded variant.) */
export function matches(
  v: AlertVariant,
  d: Pick<DonationAppEvent, 'platform' | 'amount'>
): boolean {
  if (!v.enabled) return false
  if (v.platforms.length && !v.platforms.includes(d.platform)) return false
  if (v.minAmount === null && v.maxAmount === null) return true
  if (!Number.isFinite(d.amount)) return false
  if (v.minAmount !== null && d.amount < v.minAmount) return false
  if (v.maxAmount !== null && d.amount > v.maxAmount) return false
  return true
}

/** The first enabled variant, from the top of the list, that fits. */
export function pickVariant(
  variants: AlertVariant[],
  d: Pick<DonationAppEvent, 'platform' | 'amount'>
): AlertVariant | null {
  return variants.find((v) => matches(v, d)) ?? null
}

const PLATFORM_NAMES: Record<string, string> = {
  donationalerts: 'DonationAlerts',
  donatepay: 'DonatePay',
  donatex: 'DonateX',
  godonate: 'GoDonate',
  memealerts: 'MemeAlerts',
  ihaqdonate: 'iHAQ Donate',
  cloudtips: 'CloudTips',
  tribute: 'Tribute',
  boosty: 'Boosty'
}
export const platformName = (p: string): string => PLATFORM_NAMES[p] ?? p

export function fillCaption(template: string, d: DonationAppEvent): string {
  // a line break comes only from {br} in the template: the donor's own line breaks are folded into spaces
  const message = (d.message || '').replace(/\s+/g, ' ').trim()
  return template
    .replace(/\{user\}/g, d.username || 'Аноним')
    .replace(/\{amount\}/g, String(d.amount))
    .replace(/\{currency\}/g, d.currency || '')
    .replace(/\{text\}/g, message)
    .replace(/\{platform\}/g, platformName(d.platform))
    .replace(/\{br\}/gi, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim()
}

/**
 * The same caption as `fillCaption`, in pieces that remember which variable they came from, so the overlay can colour the name
 * and the amount. Spaces are left as they are (the overlay collapses them); a line break comes only from {br}.
 */
export function captionParts(template: string, d: DonationAppEvent): CaptionPart[] {
  const message = (d.message || '').replace(/\s+/g, ' ').trim()
  const parts: CaptionPart[] = []
  for (const tok of template.split(/(\{(?:user|amount|currency|text|platform|br)\})/gi)) {
    if (!tok) continue
    const m = /^\{(user|amount|currency|text|platform|br)\}$/i.exec(tok)
    if (!m) {
      parts.push({ t: tok, k: '' })
      continue
    }
    switch (m[1].toLowerCase()) {
      case 'user':
        parts.push({ t: d.username || 'Аноним', k: 'user' })
        break
      case 'amount':
        parts.push({ t: String(d.amount), k: 'amount' })
        break
      case 'currency':
        parts.push({ t: d.currency || '', k: 'amount' })
        break
      case 'text':
        parts.push({ t: message, k: 'text' })
        break
      case 'platform':
        parts.push({ t: platformName(d.platform), k: 'platform' })
        break
      default:
        parts.push({ t: '\n', k: '' })
    }
  }
  return parts
}

/** What is read aloud for a donation, by the variant's voice settings ('' = nothing to read). */
export function voiceText(v: AlertVariant, d: DonationAppEvent): string {
  const message = (d.message || '')
    .replace(/\[(спам|ссылка)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (v.voice.read === 'message') return message
  const head = `${d.username || 'Аноним'} - ${d.amount} ${d.currency || ''}`.trim()
  return message ? `${head}. ${message}` : head
}

const kindOf = (url: string): 'image' | 'video' =>
  /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image'

/** The effects that apply to this donation, or undefined: needs Pro, at least one effect on and a big enough amount. */
export function effectsFor(
  v: AlertVariant,
  d: DonationAppEvent,
  pro: boolean
): AlertEffectsPayload | undefined {
  const e = v.effects
  if (!pro || !(e.confetti || e.glow || e.shake)) return undefined
  if (e.minAmount !== null && !(d.amount >= e.minAmount)) return undefined
  return { confetti: e.confetti, glow: e.glow, shake: e.shake, color: e.color }
}

/** `pro`: whether the effects apply (the settings preview passes true so they can be tried before buying). */
export function buildPayload(
  v: AlertVariant,
  d: DonationAppEvent,
  pro = false
): AlertPayload | null {
  // an alert with neither a picture / video, a sound nor a caption has nothing to show
  const caption = fillCaption(v.caption, d)
  if (!v.mediaUrl && !v.soundUrl && !caption) return null
  const effects = effectsFor(v, d, pro)
  return {
    id: `${v.id}:${d.id}`,
    kind: kindOf(v.mediaUrl),
    mediaUrl: v.mediaUrl,
    soundUrl: v.soundUrl,
    caption,
    captionParts: captionParts(v.caption, d),
    captionStyle: v.captionStyle,
    ...(effects ? { effects } : {}),
    font: v.captionFont,
    animationIn: v.animationIn,
    animationOut: v.animationOut,
    duration: v.duration,
    position: v.position,
    widthPct: v.widthPct,
    volume: v.volume
  }
}

export const isDonation = (e: AppEvent): e is DonationAppEvent => e.kind === 'donation'
