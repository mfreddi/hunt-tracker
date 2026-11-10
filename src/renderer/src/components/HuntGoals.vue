<script setup lang="ts">
// Challenge goals editor: "10 kills this stream", "3 survivals in a row"...
// The list lives in the tracker (state.goals = config + live progress). Every edit
// sends the whole list; main cleans it up and broadcasts it back - nothing is
// mutated here, the screen always shows what main confirmed.
import { computed, reactive } from 'vue'
import { useStore } from 'vuex'

const store = useStore()
const goals = computed<any[]>(() => store.state.hunt?.goals || [])

// Keep in sync with GOAL_LABELS / MAX_GOALS in the tracker's goals.ts.
const MAX_GOALS = 5
const metricOptions = [
  { value: 'kills', label: 'Убийств за эфир' },
  { value: 'survived', label: 'Выживаний за эфир' },
  { value: 'games', label: 'Каток за эфир' },
  { value: 'streak', label: 'Выживаний подряд' },
  { value: 'bestKills', label: 'Убийств за одну катку' }
]
const labelOf = (metric: string): string =>
  metricOptions.find((o) => o.value === metric)?.label || metric

const send = (list: any[]): void =>
  window.electron.ipcRenderer.send('huntAction', { type: 'goals', value: list })
const copyList = (): any[] => JSON.parse(JSON.stringify(goals.value)).map(stripProgress)
// Progress fields belong to the state, not to the config.
const stripProgress = (g: any): any => ({
  id: g.id,
  metric: g.metric,
  target: g.target,
  title: g.title,
  enabled: g.enabled
})
const change = (id: string, patch: Record<string, unknown>): void => {
  send(copyList().map((g) => (g.id === id ? { ...g, ...patch } : g)))
}
const add = (): void => {
  if (goals.value.length >= MAX_GOALS) return
  send([...copyList(), { metric: 'kills', target: 10, title: '', enabled: true }])
}
// The draft while the user is typing, else what main confirmed.
const shown = <T,>(drafts: Record<string, T>, id: string, confirmed: T): T =>
  id in drafts ? drafts[id] : confirmed
const remove = (id: string): void => send(copyList().filter((g) => g.id !== id))

// Typed values (title, target) are sent when the field is left or after a short pause,
// not per keystroke: main's answer comes back a moment later, and an echo of "1" must
// not land in the middle of typing "12" - nor a trimmed title swallow its spaces.
const titleDrafts = reactive<Record<string, string>>({})
const targetDrafts = reactive<Record<string, number | null>>({})
const timers: Record<string, ReturnType<typeof setTimeout>> = {}

const commitTitle = (id: string): void => {
  if (titleDrafts[id] === undefined) return
  const title = titleDrafts[id]
  delete titleDrafts[id]
  change(id, { title })
}
const commitTarget = (id: string): void => {
  clearTimeout(timers[id])
  if (!(id in targetDrafts)) return
  const v = targetDrafts[id]
  delete targetDrafts[id]
  if (v != null) change(id, { target: v }) // an emptied field just reverts
}
const draftTarget = (id: string, v: number | null): void => {
  targetDrafts[id] = v
  clearTimeout(timers[id])
  timers[id] = setTimeout(() => commitTarget(id), 600)
}
</script>

<template>
  <div class="goals">
    <p class="g-hint">
      Цели показываются отдельным виджетом в OBS (ссылка — в «Отдельные виджеты для OBS» выше).
      Прогресс идёт за текущую сессию эфира и начинается заново с новой сессией.
    </p>

    <div v-for="g in goals" :key="g.id" class="g-card" :class="{ off: !g.enabled }">
      <div class="g-row">
        <ToggleSwitch
          :model-value="g.enabled"
          @update:model-value="(v) => change(g.id, { enabled: v })"
        />
        <Select
          class="g-metric"
          fluid
          :model-value="g.metric"
          :options="metricOptions"
          option-label="label"
          option-value="value"
          @update:model-value="(v) => change(g.id, { metric: v })"
        />
        <!-- A fixed-width cell: the +/- buttons of the number field must not spill into
             the neighbours (the trash button used to sit on top of them). -->
        <div class="g-target">
          <InputNumber
            fluid
            :model-value="shown(targetDrafts, g.id, g.target)"
            :min="1"
            :max="9999"
            show-buttons
            button-layout="horizontal"
            @update:model-value="(v) => draftTarget(g.id, v)"
            @blur="commitTarget(g.id)"
          />
        </div>
        <span class="g-progress" :class="{ done: g.done }">
          {{ g.done ? '✓ ' : '' }}{{ g.value }} / {{ g.target }}
        </span>
        <Button
          icon="pi pi-trash"
          severity="secondary"
          text
          size="small"
          aria-label="Удалить цель"
          @click="remove(g.id)"
        />
      </div>
      <InputText
        class="g-title"
        :model-value="titleDrafts[g.id] ?? g.title"
        :placeholder="`Название (по умолчанию: ${labelOf(g.metric)})`"
        maxlength="40"
        @update:model-value="(v) => (titleDrafts[g.id] = String(v ?? ''))"
        @change="commitTitle(g.id)"
        @blur="commitTitle(g.id)"
      />
    </div>

    <p v-if="!goals.length" class="g-hint">
      Целей пока нет. Например: «10 убийств за эфир» или «3 выживания подряд».
    </p>
    <Button
      size="small"
      severity="secondary"
      icon="pi pi-plus"
      label="Добавить цель"
      :disabled="goals.length >= MAX_GOALS"
      @click="add"
    />
    <span v-if="goals.length >= MAX_GOALS" class="g-hint">
      Больше {{ MAX_GOALS }} целей не нужно.</span
    >
  </div>
</template>

<style lang="less" scoped>
.goals {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.g-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 0;
}
.g-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.g-card.off {
  opacity: 0.55;
}
.g-row {
  display: grid;
  /* toggle | metric (takes the rest) | number | progress | trash */
  grid-template-columns: auto minmax(0, 1fr) 11rem 5rem auto;
  align-items: center;
  gap: 10px;
}
.g-metric {
  min-width: 0;
}
.g-target {
  min-width: 0;
  overflow: hidden;
}
.g-target :deep(input) {
  min-width: 0;
  text-align: center;
}
.g-progress {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
  text-align: right;
  white-space: nowrap;
}
.g-progress.done {
  color: #4ade80;
  opacity: 1;
}
.g-title {
  width: 100%;
}
</style>
