<script setup lang="ts">
// "Отдельные виджеты для OBS": each Hunt widget as its own browser source (the overlay
// page with ?show=...), so it can be placed anywhere on the screen. Theme, opacity and
// scale are shared with the combined panel.
import { computed } from 'vue'
import { useStore } from 'vuex'
import OverlayLink from './OverlayLink.vue'

const props = defineProps<{ url: string }>()

const store = useStore()
const s = computed<any>(() => store.state.hunt || null)

const periodOptions = [
  { value: 'all', label: 'за всё время (вся история каток)' },
  { value: 'session', label: 'за текущий эфир (сессию)' }
]
const patch = (values: any): void =>
  window.electron.ipcRenderer.send('huntAction', { type: 'patch', values })
</script>

<template>
  <details v-if="s" class="widgets">
    <summary>Отдельные виджеты для OBS</summary>
    <p class="w-hint">
      Каждый виджет добавляется в OBS отдельным источником «Браузер» — его можно поставить и
      растянуть в любом месте экрана. Тема, прозрачность и масштаб общие с панелью.
    </p>
    <OverlayLink :url="props.url + '?show=recent'" label="Последние катки, серия и рекорд" />
    <OverlayLink :url="props.url + '?show=goal'" label="Челлендж-цели" />
    <OverlayLink :url="props.url + '?show=maps'" label="Винрейт по картам" />
    <label class="w-field">
      <span>Винрейт по картам считать</span>
      <Select
        :model-value="s.look.mapsPeriod || 'all'"
        :options="periodOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ mapsPeriod: v })"
      />
    </label>
    <p class="w-hint">
      Винрейт — доля выжитых каток на карте; катки без результата (игру закрыли посреди катки) не
      считаются. Режим берётся тот же, что и у панели.
    </p>
  </details>
</template>

<style lang="less" scoped>
.widgets > summary {
  cursor: pointer;
  font-size: 12.5px;
  opacity: 0.8;
  padding: 2px 0;
}
.widgets[open] > summary {
  margin-bottom: 6px;
}
.widgets[open] {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.w-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 0;
}
.w-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 24rem;
}
.w-field > span {
  font-size: 12.5px;
  opacity: 0.8;
}
</style>
