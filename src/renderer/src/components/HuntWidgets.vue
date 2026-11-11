<script setup lang="ts">
// "Отдельные виджеты для OBS": each Hunt widget as its own browser source (the overlay
// page with ?show=...), so it can be placed anywhere on the screen. Theme, opacity and
// scale are shared with the combined panel.
import { computed } from 'vue'
import { useStore } from 'vuex'
import OverlayLink from './OverlayLink.vue'
import { useI18n } from '../i18n'

const props = defineProps<{ url: string }>()

const store = useStore()
const s = computed<any>(() => store.state.hunt || null)
const { t } = useI18n()

const periodOptions = computed(() => [
  { value: 'all', label: t('hunt.widgets.periodAll') },
  { value: 'session', label: t('hunt.widgets.periodSession') }
])
const patch = (values: any): void =>
  window.electron.ipcRenderer.send('huntAction', { type: 'patch', values })
</script>

<template>
  <details v-if="s" class="widgets">
    <summary>{{ t('hunt.widgets.summary') }}</summary>
    <p class="w-hint">{{ t('hunt.widgets.hint') }}</p>
    <OverlayLink :url="props.url + '?show=recent'" :label="t('hunt.widgets.linkRecent')" />
    <OverlayLink :url="props.url + '?show=goal'" :label="t('hunt.widgets.linkGoal')" />
    <OverlayLink :url="props.url + '?show=maps'" :label="t('hunt.widgets.linkMaps')" />
    <label class="w-field">
      <span>{{ t('hunt.widgets.periodLabel') }}</span>
      <Select
        :model-value="s.look.mapsPeriod || 'all'"
        :options="periodOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ mapsPeriod: v })"
      />
    </label>
    <p class="w-hint">
      {{ t('hunt.widgets.mapsHint') }}
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
