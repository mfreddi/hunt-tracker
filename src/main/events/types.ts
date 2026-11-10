// One normalized taxonomy for every "something happened" moment the app can
// react to - streaming-platform events (follow/sub/cheer/raid/reward across
// Twitch/VKPL/Kick/YouTube) and donations (every connector in Donations.ts).
// This is the foundation an event -> action rule system builds on later; for
// now it's data only, no UI, no executors. See docs/backlog.md "Native event
// -> action system" for the full plan.
//
// Deliberately narrower than the platforms' raw payloads - only the fields an
// action/condition would plausibly key off (who, how much/how many, which
// reward). Anything not modeled here (message text formatting, badges, etc.)
// stays in the existing chat/ws pipeline, which this sits alongside rather
// than replaces.

export type AppEventPlatform =
  | 'twitch'
  | 'vkpl'
  | 'kick'
  | 'youtube'
  | 'donationalerts'
  | 'donatepay'
  | 'donatex'
  | 'godonate'
  | 'memealerts'
  | 'ihaqdonate'
  | 'cloudtips'
  | 'tribute'
  | 'boosty'

interface AppEventBase {
  id: string
  ts: number
  platform: AppEventPlatform
  username: string
}

export interface FollowAppEvent extends AppEventBase {
  kind: 'follow'
}

export interface SubAppEvent extends AppEventBase {
  kind: 'sub'
  tier?: number
  months?: number
  isGift: boolean
  giftCount?: number
}

export interface CheerAppEvent extends AppEventBase {
  kind: 'cheer'
  amount: number // bits (Twitch) or Kicks (Kick) - platform-specific unit, not currency
  message?: string
}

export interface RaidAppEvent extends AppEventBase {
  kind: 'raid'
  viewers: number
}

export interface RewardAppEvent extends AppEventBase {
  kind: 'reward'
  rewardId: string
  redemptionId: string
  input?: string
}

export interface DonationAppEvent extends AppEventBase {
  kind: 'donation'
  amount: number // already in the streamer's account currency, see donationTypes.ts
  currency: string
  message?: string
  voiceHint?: {
    premium?: { voice?: unknown; speed?: unknown; emotion?: unknown }
    /** A ready voice file of the platform (DonateX). */
    url?: string
  }
}

export type AppEvent =
  FollowAppEvent | SubAppEvent | CheerAppEvent | RaidAppEvent | RewardAppEvent | DonationAppEvent

export type AppEventKind = AppEvent['kind']
