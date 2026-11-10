<script setup lang="ts">
// "Вид оверлея" of the Hunt settings: theme, position, scale, background, colors,
// what to show. Split out of SettingHunt.vue to keep it under the size guideline.
import { computed } from 'vue'
import { useStore } from 'vuex'
import { usePositionSelector } from '../composables/usePositionSelector'

const store = useStore()
const s = computed<any>(() => store.state.hunt || null)
const send = (payload: any): void => window.electron.ipcRenderer.send('huntAction', payload)
const patch = (values: any): void => send({ type: 'patch', values })
const { positions } = usePositionSelector()

const rowLabels: Record<string, string> = {
  duration: 'Время в игре',
  survival: 'Выживание (вышли/не вышли)',
  combat: 'Боевая статистика (K/D)',
  modes: 'Сводка по режимам (когда показана вся сессия)',
  current: 'Текущая катка',
  recent: 'Последние катки, серия и рекорд'
}
const setRow = (key: string, v: boolean): void =>
  patch({ rows: { ...(s.value?.look?.rows || {}), [key]: v } })

const themeOptions = [
  { value: 'classic', label: 'Классика' },
  { value: 'slate', label: 'Камень' },
  { value: 'wood', label: 'Дерево' },
  { value: 'blood', label: 'Кровь — кровавый ивент' }
]

const scopeOptions = [
  { value: 'mode', label: 'Статистика текущего режима' },
  { value: 'session', label: 'За всю сессию (все режимы)' }
]
</script>

<template>
  <div v-if="s">
    <label class="hunt-field">
      <span>Тема</span>
      <Select
        :model-value="s.look.theme || 'classic'"
        :options="themeOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ theme: v })"
      />
    </label>
    <p v-if="s.look.theme && s.look.theme !== 'classic'" class="hunt-hint">
      У темы свои цвета — настройки цвета ниже действуют только для «Классики».
    </p>
    <div class="hunt-row">
      <label class="hunt-field">
        <span>Позиция</span>
        <Select
          :model-value="s.look.position"
          :options="positions"
          option-label="label"
          option-value="value"
          @update:model-value="(v) => patch({ position: v })"
        />
      </label>
      <label class="hunt-field" style="max-width: 12rem">
        <span>Масштаб</span>
        <Slider
          :model-value="s.look.scale"
          :min="0.6"
          :max="2"
          :step="0.1"
          @update:model-value="(v) => patch({ scale: v })"
        />
      </label>
      <label class="hunt-field" style="max-width: 12rem">
        <span>Фон: {{ Math.round((s.look.bgOpacity ?? 1) * 100) }}%</span>
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
        ><span>Фон</span
        ><input
          type="color"
          :value="(s.look.bg || '#0a0a0f').slice(0, 7)"
          @input="(e) => patch({ bg: (e.target as HTMLInputElement).value })"
      /></label>
      <label class="hunt-color"
        ><span>Текст</span
        ><input
          type="color"
          :value="s.look.text"
          @input="(e) => patch({ text: (e.target as HTMLInputElement).value })"
      /></label>
      <label class="hunt-color"
        ><span>Акцент</span
        ><input
          type="color"
          :value="s.look.accent"
          @input="(e) => patch({ accent: (e.target as HTMLInputElement).value })"
      /></label>
    </div>
    <label class="hunt-field">
      <span>Что показывать</span>
      <Select
        :model-value="s.look.scope || 'mode'"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        @update:model-value="(v) => patch({ scope: v })"
      />
    </label>
    <p class="hunt-hint">
      Статистика текущего режима переключается сама: показывается режим, в котором идёт катка, а
      между катками - выбранный в лобби (или последний сыгранный).
    </p>
    <div class="hunt-rows">
      <label v-for="(lbl, key) in rowLabels" :key="key" class="hunt-check">
        <ToggleSwitch
          :model-value="s.look.rows[key] !== false"
          @update:model-value="(v) => setRow(key, v)"
        />
        <span>{{ lbl }}</span>
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
