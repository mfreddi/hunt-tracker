// Choices for the Hunt overlay settings (labels are translated by the caller, ids are the ones main understands).

import type { MessageKey } from '@shared/i18n'

export const POSITION_OPTIONS: Array<{ value: string; key: MessageKey }> = [
  { value: 'tl', key: 'apos.tl' },
  { value: 'tc', key: 'apos.tc' },
  { value: 'tr', key: 'apos.tr' },
  { value: 'ml', key: 'apos.ml' },
  { value: 'mc', key: 'apos.mc' },
  { value: 'mr', key: 'apos.mr' },
  { value: 'bl', key: 'apos.bl' },
  { value: 'bc', key: 'apos.bc' },
  { value: 'br', key: 'apos.br' }
]
