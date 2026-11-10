<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useMediaUpload } from '../composables/useMediaUpload'
import OverlayLink from './OverlayLink.vue'
import FontPicker from './FontPicker.vue'
import HuntDeathAlert from './HuntDeathAlert.vue'
import AlertPreview from './alerts/AlertPreview.vue'
import { POSITION_OPTIONS } from './alerts/alertOptions'
import type { StreakRule, StreakState } from '../types/huntStreak'

// "Серия убийств": a big title with a sound on the screen when the kills of a match reach the number of a rule
// ("Доминатор" at 5). Shown on its own overlay (/killstreak). The rules are edited on a copy and sent
// when an edit is finished; what the main process sends back (made safe) is what is shown.
const ipc = window.electron.ipcRenderer
const toast = useToast()
const { upload } = useMediaUpload()

const state = reactive<StreakState | Record<string, never>>({}) as StreakState
const ready = ref(false)
const proActive = ref(true)
const selected = ref('')

const replace = (next: StreakState): void => {
  state.enabled = next.enabled
  state.rules = next.rules
  state.death = next.death
  state.font = next.font
  state.duration = next.duration
  state.position = next.position
  state.widthPct = next.widthPct
  state.volume = next.volume
  if (!state.rules.some((r) => r.id === selected.value)) selected.value = state.rules[0]?.id ?? ''
}
onMounted(async () => {
  replace(await ipc.invoke('getHuntStreak'))
  ready.value = true
})

let saving = false
let again = false
const commit = async (): Promise<void> => {
  // one save at a time; an edit made meanwhile is sent right after
  if (saving) {
    again = true
    return
  }
  saving = true
  try {
    replace(await ipc.invoke('huntStreakSave', JSON.parse(JSON.stringify(state))))
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Серия убийств',
      detail: 'Не удалось сохранить',
      life: 4000
    })
  } finally {
    saving = false
  }
  if (again) {
    again = false
    void commit()
  }
}
// A number field fires `blur` before it writes what was typed into the model: one tick later the model is up to date.
const afterBlur = (): void => {
  setTimeout(() => void commit(), 0)
}

const COLORS = ['#ffb020', '#ff5a1f', '#ff2d55', '#b026ff', '#2dd4bf', '#4a90e2']
const addRule = (): void => {
  if (state.rules.length >= 12) return
  const top = state.rules.reduce((m, r) => Math.max(m, r.kills), 1)
  const id = `r${Date.now().toString(36)}`
  state.rules.push({
    id,
    kills: Math.min(50, top + 2),
    title: 'Новая серия',
    showText: true,
    color: COLORS[state.rules.length % COLORS.length],
    mediaUrl: '',
    soundUrl: '',
    enabled: true
  })
  selected.value = id
  void commit()
}
const removeRule = (i: number): void => {
  state.rules.splice(i, 1)
  void commit()
}
const pick = async (
  event: any,
  rule: StreakRule,
  field: 'mediaUrl' | 'soundUrl'
): Promise<void> => {
  const file = event.files?.[0]
  if (!file) return
  const url = await upload(
    file,
    field === 'mediaUrl' && /\.webm$/i.test(file.name) ? 'video' : undefined
  )
  if (url) {
    rule[field] = url
    void commit()
  }
}
const test = async (rule: StreakRule): Promise<void> => {
  const r = await ipc.invoke('huntStreakTest', rule.id)
  if (r === 'ok') return
  const detail =
    r === 'no-overlay'
      ? 'Источник «Серия убийств» не открыт в OBS (ссылка выше), показывать негде'
      : 'Сначала сохрани правило'
  toast.add({ severity: 'warn', summary: 'Серия убийств', detail, life: 5000 })
}

const current = computed(() => state.rules.find((r) => r.id === selected.value) ?? null)
</script>

<template>
  <div v-if="ready" class="ks">
    <p class="ks-hint">
      Крупная надпись и звук на экране, когда число убийств в матче достигает числа правила
      (например, «Доминатор» на пятом). Показывается в своём источнике в OBS (ссылка ниже), по
      одному разу за матч, отдельно от алертов донатов. Число 1 — первое убийство в матче («Первая
      кровь»).
    </p>
    <OverlayLink url="http://localhost:1040/killstreak" label="Ссылка для OBS (серия убийств)" />
    <label class="ks-line">
      <ToggleSwitch v-model="state.enabled" @change="commit" />
      Включить серию убийств
    </label>

    <div class="ks-main">
      <div class="ks-rules">
        <div class="ks-head">
          <span class="font-semibold">Правила ({{ state.rules.length }})</span>
          <Button
            icon="pi pi-plus"
            label="Добавить"
            size="small"
            :disabled="state.rules.length >= 12"
            @click="addRule"
          />
        </div>
        <p v-if="!state.rules.length" class="ks-hint">Правил нет: ничего показываться не будет.</p>
        <div
          v-for="(r, i) in state.rules"
          :key="r.id"
          class="ks-row"
          :class="{ off: !r.enabled, sel: r.id === selected }"
          @click="selected = r.id"
        >
          <label class="ks-f ks-num">
            <span>Убийств</span>
            <InputNumber v-model="r.kills" :min="1" :max="50" size="small" @blur="afterBlur" />
          </label>
          <div class="ks-f ks-fit">
            <span>Текст</span>
            <div class="ks-file">
              <ToggleSwitch
                v-model="r.showText"
                title="Показывать надпись (выключить: только картинка)"
                @change="commit"
              />
            </div>
          </div>
          <label class="ks-f ks-title">
            <span>Надпись</span>
            <InputText v-model="r.title" size="small" :disabled="!r.showText" @change="commit" />
          </label>
          <label class="ks-f ks-fit">
            <span>Цвет</span>
            <input v-model="r.color" type="color" class="ks-color" @change="commit" />
          </label>
          <div class="ks-f ks-fit">
            <span>Картинка</span>
            <div class="ks-file">
              <FileUpload
                mode="basic"
                accept="image/*,video/mp4,video/webm"
                auto
                :max-file-size="52428800"
                :title="r.mediaUrl ? 'Заменить картинку' : 'Выбрать картинку, гифку или видео'"
                choose-icon="pi pi-image"
                custom-upload
                @uploader="(e: any) => pick(e, r, 'mediaUrl')"
              />
              <Button
                v-if="r.mediaUrl"
                icon="pi pi-times"
                size="small"
                text
                severity="secondary"
                title="Убрать картинку"
                @click="((r.mediaUrl = ''), commit())"
              />
            </div>
          </div>
          <div class="ks-f ks-fit">
            <span>Звук</span>
            <div class="ks-file">
              <FileUpload
                mode="basic"
                accept="audio/*"
                auto
                :max-file-size="8388608"
                :title="r.soundUrl ? 'Заменить звук' : 'Свой звук (без него играет фанфара)'"
                choose-icon="pi pi-volume-up"
                custom-upload
                @uploader="(e: any) => pick(e, r, 'soundUrl')"
              />
              <Button
                v-if="r.soundUrl"
                icon="pi pi-times"
                size="small"
                text
                severity="secondary"
                title="Убрать звук: останется встроенная фанфара"
                @click="((r.soundUrl = ''), commit())"
              />
            </div>
          </div>
          <div class="ks-f ks-fit ks-actions">
            <span>&nbsp;</span>
            <div class="ks-file">
              <ToggleSwitch v-model="r.enabled" title="Правило включено" @change="commit" />
              <Button
                icon="pi pi-send"
                size="small"
                text
                severity="secondary"
                title="Показать на стриме"
                @click.stop="test(r)"
              />
              <Button
                icon="pi pi-trash"
                size="small"
                text
                severity="danger"
                title="Удалить"
                @click.stop="removeRule(i)"
              />
            </div>
          </div>
          <small v-if="!r.showText && !r.mediaUrl" class="ks-warn ks-nothing">
            Текст выключен и картинки нет: на экране ничего не появится{{
              r.soundUrl ? ', будет только звук' : ''
            }}.
          </small>
        </div>
        <small class="ks-hint"
          >Без своего звука играет встроенная фанфара: чем выше правило, тем она длиннее.</small
        >

        <div class="ks-opts">
          <div class="ks-fontrow">
            <FontPicker
              v-model="state.font"
              class="ks-fontpick"
              label="Шрифт надписей"
              @update:model-value="commit"
            />
          </div>
          <label class="ks-f">
            <span>Показывать, сек</span>
            <InputNumber
              v-model="state.duration"
              :min="2"
              :max="15"
              size="small"
              @blur="afterBlur"
            />
          </label>
          <label class="ks-f ks-wide">
            <span>Положение</span>
            <Select
              v-model="state.position"
              :options="POSITION_OPTIONS"
              option-label="label"
              option-value="value"
              size="small"
              @change="commit"
            />
          </label>
          <label class="ks-f">
            <span>Ширина картинки, %</span>
            <InputNumber
              v-model="state.widthPct"
              :min="5"
              :max="100"
              size="small"
              @blur="afterBlur"
            />
          </label>
          <label class="ks-f">
            <span>Громкость, %</span>
            <InputNumber
              v-model="state.volume"
              :min="0"
              :max="100"
              size="small"
              @blur="afterBlur"
            />
          </label>
        </div>
      </div>

      <div v-if="current" class="ks-prev">
        <AlertPreview :variant="{ ...current, font: state.font }" channel="huntStreakPreview" />
      </div>
    </div>

    <HuntDeathAlert :state="state" :pro-active="proActive" @commit="commit" />
  </div>
</template>

<style lang="less" scoped>
.ks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.ks-hint {
  margin: 0;
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.4;
}
.ks-warn {
  color: #f5a623;
}
.ks-nothing {
  flex: 0 0 100%;
}
.ks-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ks-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 16px;
  align-items: start;
}
@media (max-width: 1000px) {
  .ks-main {
    grid-template-columns: minmax(0, 1fr);
  }
  .ks-prev {
    order: -1;
  }
}
.ks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.ks-rules {
  min-width: 0;
}
.ks-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: flex-start;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  border-bottom-color: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  &.sel {
    border-color: rgba(255, 255, 255, 0.25);
  }
  &.off {
    opacity: 0.55;
  }
}
.ks-f {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  > span:first-child {
    opacity: 0.75;
  }
  &.ks-num {
    width: 5.6rem;
  }
  &.ks-title {
    flex: 1;
    min-width: 9rem;
  }
  &.ks-fit {
    width: auto;
  }
  &.ks-wide {
    width: 12rem;
  }
}
.ks-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 10px;
  .ks-f {
    width: 8.5rem;
  }
  .ks-f.ks-wide {
    width: 12rem;
  }
}
.ks-opts .ks-fontrow {
  // its own line (the other options start on the next one), the width of the picker is limited inside
  flex: 0 0 100%;
  .ks-fontpick {
    max-width: 30rem;
  }
  // the same height as the small fields next to it (the picker's select does not take `size`)
  :deep(.p-select-label) {
    padding: 0.375rem 0.625rem;
    font-size: 0.875rem;
  }
}
.ks-file {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}
.ks-file :deep(.p-fileupload .p-button) {
  padding: 0.3rem 0.55rem;
  // icon only: the title says what it is, so the row does not wrap on a narrow window
  .p-button-label {
    display: none;
  }
}
.ks-color {
  width: 44px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
:deep(.p-inputnumber),
:deep(.p-select) {
  width: 100%;
}
:deep(.p-inputnumber-input) {
  width: 100%;
  min-width: 0;
  // the same size as the small text field next to it (the number field does not take `size` on its input)
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
}
</style>
