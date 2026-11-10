<script setup lang="ts">
// "Окно поверх игры": the same overlay panel in a transparent, click-through, always-on-top
// window, so it can be read over Hunt without OBS. The main process owns the window; this
// block only toggles it and picks which view it draws (position, scale, opacity and theme
// come from "Вид оверлея", so the window repeats the OBS look).
import { onMounted, onUnmounted, ref } from 'vue'

interface OverlayWindowState {
  open: boolean
  visible: boolean
  source: string
  hotkey: string
}

const state = ref<OverlayWindowState | null>(null)

const load = async (): Promise<void> => {
  try {
    state.value = await window.electron.ipcRenderer.invoke('overlayWindowGet')
  } catch {
    /* the pushed state will arrive on the next change */
  }
}
const act = (payload: any): void => window.electron.ipcRenderer.send('overlayWindowAction', payload)

const sourceOptions = [
  { value: 'panel', label: 'Вся панель' },
  { value: 'recent', label: 'Последние катки, серия и рекорд' },
  { value: 'goal', label: 'Челлендж-цели' },
  { value: 'maps', label: 'Винрейт по картам' }
]

// The main process pushes the state on every open/close/source change and on hotkey presses.
let listener: ((e: unknown, s: OverlayWindowState) => void) | null = null
onMounted(() => {
  void load()
  listener = (_e, s) => {
    state.value = s
  }
  window.electron.ipcRenderer.on('overlayWindowState', listener)
})
onUnmounted(() => {
  if (listener) window.electron.ipcRenderer.removeListener('overlayWindowState', listener)
})
</script>

<template>
  <div class="gov">
    <p class="gov-hint">
      Панель можно показывать прямо поверх игры, без OBS. Это прозрачное окно поверх всех окон:
      клики и управление остаются у игры, а в саму игру ничего не внедряется.
    </p>
    <div class="gov-row">
      <ToggleSwitch
        :model-value="!!state?.open"
        @update:model-value="(v) => act({ type: v ? 'open' : 'close' })"
      />
      <span class="gov-label">Показывать поверх игры</span>
    </div>
    <label class="gov-field">
      <span>Что показывать в окне</span>
      <Select
        :model-value="state?.source || 'panel'"
        :options="sourceOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => act({ type: 'source', value: v })"
      />
    </label>
    <p class="gov-hint">
      Горячая клавиша <b>{{ state?.hotkey || 'Alt+Shift+O' }}</b> включает и выключает окно прямо во
      время игры. Настройки «Вид оверлея» (позиция, масштаб, прозрачность, тема) действуют и здесь.
    </p>
    <div class="gov-warn">
      <b>Важно:</b> в настройках графики игры выбери «Оконный» или «Оконный без рамки» режим. В
      полноэкранном (exclusive) режиме окно поверх игры не видно.
    </div>
  </div>
</template>

<style lang="less" scoped>
.gov {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gov-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 0;
}
.gov-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gov-label {
  font-size: 13px;
  opacity: 0.85;
}
.gov-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-width: 24rem;
}
.gov-field > span {
  font-size: 12.5px;
  opacity: 0.8;
}
.gov-warn {
  padding: 9px 11px;
  border: 1px solid rgba(245, 166, 35, 0.55);
  background: rgba(245, 166, 35, 0.08);
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.45;
}
.gov-warn b {
  color: #f5a623;
}
</style>
