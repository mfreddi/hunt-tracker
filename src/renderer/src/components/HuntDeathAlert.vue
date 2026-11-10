<script lang="ts" setup>
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useMediaUpload } from '../composables/useMediaUpload'
import AlertPreview from './alerts/AlertPreview.vue'
import type { StreakState } from '../types/huntStreak'

// The death part of "Серия убийств": a title (and a picture / sound) when the streamer dies. Edits `state.death`
// of the parent in place and asks it to save (`commit`); shown on the same overlay (/killstreak).
const props = defineProps<{ state: StreakState; proActive: boolean }>()
const emit = defineEmits<{ commit: [] }>()
const ipc = window.electron.ipcRenderer
const toast = useToast()
const { upload } = useMediaUpload()

const death = computed(() => props.state.death)
const variant = computed(() => ({ death: death.value, font: props.state.font }))

const pick = async (event: any, field: 'mediaUrl' | 'soundUrl'): Promise<void> => {
  const file = event.files?.[0]
  if (!file) return
  const url = await upload(
    file,
    field === 'mediaUrl' && /\.webm$/i.test(file.name) ? 'video' : undefined
  )
  if (url) {
    death.value[field] = url
    emit('commit')
  }
}
const test = async (): Promise<void> => {
  const r = await ipc.invoke('huntDeathTest')
  if (r === 'ok') return
  toast.add({
    severity: 'warn',
    summary: 'Серия убийств',
    detail: 'Источник «Серия убийств» не открыт в OBS (ссылка выше), показывать негде',
    life: 5000
  })
}
</script>

<template>
  <div class="hd">
    <div class="hd-head">
      <span class="font-semibold">Смерть</span>
      <small class="hd-hint"
        >Надпись и звук, когда тебя убили. Работает вместе с включённой серией убийств.</small
      >
    </div>
    <div class="hd-main">
      <div class="hd-row" :class="{ off: !death.enabled }">
        <div class="hd-f">
          <span>Текст</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.showText"
              title="Показывать надпись (выключить: только картинка)"
              @change="emit('commit')"
            />
          </div>
        </div>
        <label class="hd-f hd-title">
          <span>Надпись</span>
          <InputText
            v-model="death.title"
            size="small"
            :disabled="!death.showText"
            @change="emit('commit')"
          />
        </label>
        <label class="hd-f">
          <span>Цвет</span>
          <input v-model="death.color" type="color" class="hd-color" @change="emit('commit')" />
        </label>
        <div class="hd-f">
          <span>Картинка</span>
          <div class="hd-file">
            <FileUpload
              mode="basic"
              accept="image/*,video/mp4,video/webm"
              auto
              :max-file-size="52428800"
              :title="death.mediaUrl ? 'Заменить картинку' : 'Выбрать картинку, гифку или видео'"
              choose-icon="pi pi-image"
              custom-upload
              @uploader="(e: any) => pick(e, 'mediaUrl')"
            />
            <Button
              v-if="death.mediaUrl"
              icon="pi pi-times"
              size="small"
              text
              severity="secondary"
              title="Убрать картинку"
              @click="((death.mediaUrl = ''), emit('commit'))"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>На весь экран</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.fullscreen"
              title="Растянуть картинку на весь экран (обрезается по краям, чтобы не искажаться)"
              @change="emit('commit')"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>Звук</span>
          <div class="hd-file">
            <FileUpload
              mode="basic"
              accept="audio/*"
              auto
              :max-file-size="8388608"
              :title="death.soundUrl ? 'Заменить звук' : 'Звук смерти (без него тишина)'"
              choose-icon="pi pi-volume-up"
              custom-upload
              @uploader="(e: any) => pick(e, 'soundUrl')"
            />
            <Button
              v-if="death.soundUrl"
              icon="pi pi-times"
              size="small"
              text
              severity="secondary"
              title="Убрать звук"
              @click="((death.soundUrl = ''), emit('commit'))"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>&nbsp;</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.enabled"
              title="Показывать при смерти"
              @change="emit('commit')"
            />
            <Button
              icon="pi pi-send"
              size="small"
              text
              severity="secondary"
              title="Показать на стриме"
              @click="test"
            />
          </div>
        </div>
      </div>
      <div class="hd-prev">
        <AlertPreview :variant="variant" channel="huntDeathPreview" />
      </div>
    </div>
    <small v-if="!death.showText && !death.mediaUrl" class="hd-warn">
      Текст выключен и картинки нет: на экране ничего не появится{{
        death.soundUrl ? ', будет только звук' : ''
      }}.
    </small>
  </div>
</template>

<style lang="less" scoped>
.hd {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
}
.hd-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hd-hint {
  font-size: 12px;
  opacity: 0.65;
}
.hd-warn {
  font-size: 12px;
  color: #f5a623;
}
.hd-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 16px;
  align-items: start;
}
@media (max-width: 1000px) {
  .hd-main {
    grid-template-columns: minmax(0, 1fr);
  }
}
.hd-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: flex-start;
  &.off {
    opacity: 0.55;
  }
}
.hd-f {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  > span:first-child {
    opacity: 0.75;
  }
  &.hd-title {
    flex: 1;
    min-width: 9rem;
  }
}
.hd-file {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}
.hd-file :deep(.p-fileupload .p-button) {
  padding: 0.3rem 0.55rem;
  .p-button-label {
    display: none;
  }
}
.hd-color {
  width: 44px;
  height: 32px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
</style>
