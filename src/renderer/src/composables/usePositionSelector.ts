type OverlayPosition =
  'top-left' | 'top' | 'top-right' | 'center' | 'bottom-left' | 'bottom' | 'bottom-right'

export function usePositionSelector() {
  const positions = [
    { label: 'Сверху слева', value: 'top-left' as OverlayPosition },
    { label: 'Сверху', value: 'top' as OverlayPosition },
    { label: 'Сверху справа', value: 'top-right' as OverlayPosition },
    { label: 'По центру', value: 'center' as OverlayPosition },
    { label: 'Снизу слева', value: 'bottom-left' as OverlayPosition },
    { label: 'Снизу', value: 'bottom' as OverlayPosition },
    { label: 'Снизу справа', value: 'bottom-right' as OverlayPosition }
  ]

  return { positions }
}
