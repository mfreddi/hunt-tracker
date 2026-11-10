// "Серия убийств" of the Hunt settings. Same shape as the tracker's killStreak.ts; the
// main process makes every value safe on save, so what the settings window gets back is
// what is stored.

export interface StreakRule {
  id: string
  kills: number
  title: string
  showText: boolean
  color: string
  mediaUrl: string
  soundUrl: string
  enabled: boolean
}

export interface DeathAlert {
  enabled: boolean
  title: string
  showText: boolean
  fullscreen: boolean
  color: string
  mediaUrl: string
  soundUrl: string
}

export interface StreakState {
  enabled: boolean
  rules: StreakRule[]
  death: DeathAlert
  font: string
  duration: number
  position: string
  widthPct: number
  volume: number
}
