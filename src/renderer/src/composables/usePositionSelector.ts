import { computed } from 'vue'
import type { MessageKey } from '@shared/i18n'
import { useI18n } from '../i18n'

type OverlayPosition =
  'top-left' | 'top' | 'top-right' | 'center' | 'bottom-left' | 'bottom' | 'bottom-right'

const POSITIONS: Array<{ value: OverlayPosition; key: MessageKey }> = [
  { key: 'pos.top-left', value: 'top-left' },
  { key: 'pos.top', value: 'top' },
  { key: 'pos.top-right', value: 'top-right' },
  { key: 'pos.center', value: 'center' },
  { key: 'pos.bottom-left', value: 'bottom-left' },
  { key: 'pos.bottom', value: 'bottom' },
  { key: 'pos.bottom-right', value: 'bottom-right' }
]

export function usePositionSelector() {
  const { t } = useI18n()
  const positions = computed(() => POSITIONS.map((p) => ({ value: p.value, label: t(p.key) })))

  return { positions }
}
