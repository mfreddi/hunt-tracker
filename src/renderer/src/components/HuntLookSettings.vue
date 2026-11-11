<script setup lang="ts">
// "Вид оверлея" of the Hunt settings: theme, position, scale, background, colors,
// what to show. Split out of SettingHunt.vue to keep it under the size guideline.
import { computed } from 'vue'
import { useStore } from 'vuex'
import { usePositionSelector } from '../composables/usePositionSelector'
import { useI18n } from '../i18n'
import type { MessageKey } from '@shared/i18n'

const store = useStore()
const s = computed<any>(() => store.state.hunt || null)
const { t } = useI18n()
const send = (payload: any): void => window.electron.ipcRenderer.send('huntAction', payload)
const patch = (values: any): void => send({ type: 'patch', values })
const { positions } = usePositionSelector()

const rowLabels: Record<string, MessageKey> = {
  duration: 'look.row.duration',
  survival: 'look.row.survival',
  combat: 'look.row.combat',
  modes: 'look.row.modes',
  current: 'look.row.current',
  recent: 'look.row.recent'
}
const setRow = (key: string, v: boolean): void =>
  patch({ rows: { ...(s.value?.look?.rows || {}), [key]: v } })

const themeOptions = computed(() => [
  { value: 'classic', label: t('look.theme.classic') },
  { value: 'slate', label: t('look.theme.slate') },
  { value: 'wood', label: t('look.theme.wood') },
  { value: 'blood', label: t('look.theme.blood') }
])

const scopeOptions = computed(() => [
  { value: 'mode', label: t('look.scope.mode') },
  { value: 'session', label: t('look.scope.session') }
])
</script>

<template>
  <div v-if="s">
    <label class="hunt-field">
      <span>{{ t('look.theme') }}</span>
      <Select
        :model-value="s.look.theme || 'classic'"
        :options="themeOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ theme: v })"
      />
    </label>
    <p v-if="s.look.theme && s.look.theme !== 'classic'" class="hunt-hint">
      {{ t('look.themeHint') }}
    </p>
    <div class="hunt-row">
      <label class="hunt-field">
        <span>{{ t('look.position') }}</span>
        <Select
          :model-value="s.look.position"
          :options="positions"
          option-label="label"
          option-value="value"
          @update:model-value="(v) => patch({ position: v })"
        />
      </label>
      <label class="hunt-field" style="max-width: 12rem">
        <span>{{ t('look.scale') }}</span>
        <Slider
          :model-value="s.look.scale"
          :min="0.6"
          :max="2"
          :step="0.1"
          @update:model-value="(v) => patch({ scale: v })"
        />
      </label>
      <label class="hunt-field" style="max-width: 12rem">
        <span>{{ t('look.bgOpacity', { pct: Math.round((s.look.bgOpacity ?? 1) * 100) }) }}</span>
        <Slider
          :model-value="s.look.bgOpacity ?? 1"
          :min="0"
          :max="1"
          :step="0.05"
          @update:model-value="(v) => patch({ bgOpacity: v })"
        />
      </label>
    </div>
    <div v-if="(s.theme || 'classic') === 'classic'" class="hunt-row">
      <label class="hunt-color"
        ><span>{{ t('look.bg') }}</span
        ><input
          type="color"
          :value="(s.look.bg || '#0a0a0f').slice(0, 7)"
          @input="(e) => patch({ bg: (e.target as HTMLInputElement).value })"
      /></label>
      <label class="hunt-color"
        ><span>{{ t('look.text') }}</span
        ><input
          type="color"
          :value="s.look.text"
          @input="(e) => patch({ text: (e.target as HTMLInputElement).value })"
      /></label>
      <label class="hunt-color"
        ><span>{{ t('look.accent') }}</span
        ><input
          type="color"
          :value="s.look.accent"
          @input="(e) => patch({ accent: (e.target as HTMLInputElement).value })"
      /></label>
    </div>
    <label class="hunt-field">
      <span>{{ t('look.whatToShow') }}</span>
      <Select
        :model-value="s.look.scope || 'mode'"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ scope: v })"
      />
    </label>
    <p class="hunt-hint">
      {{ t('look.scopeHint') }}
    </p>
    <div class="hunt-rows">
      <label v-for="(lbl, key) in rowLabels" :key="key" class="hunt-check">
        <ToggleSwitch
          :model-value="s.look.rows[key] !== false"
          @update:model-value="(v) => setRow(key, v)"
        />
        <span>{{ t(lbl) }}</span>
      </label>
    </div>
  </div>
</template>

<style lang="less" scoped>
.hunt-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 4px 0;
}
.hunt-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 6px;
}
.hunt-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  margin-bottom: 8px;
}
.hunt-field > span {
  font-size: 12.5px;
  opacity: 0.8;
}
.hunt-color input {
  width: 4rem;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: transparent;
}
.hunt-color {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  opacity: 0.85;
}
.hunt-rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  margin-top: 8px;
}
.hunt-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
</style>
