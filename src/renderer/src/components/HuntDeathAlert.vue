<script lang="ts" setup>
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useMediaUpload } from '../composables/useMediaUpload'
import AlertPreview from './alerts/AlertPreview.vue'
import type { StreakState } from '../types/huntStreak'
import { useI18n } from '../i18n'

// The death part of "Серия убийств": a title (and a picture / sound) when the streamer dies. Edits `state.death`
// of the parent in place and asks it to save (`commit`); shown on the same overlay (/killstreak).
const props = defineProps<{ state: StreakState; proActive: boolean }>()
const emit = defineEmits<{ commit: [] }>()
const ipc = window.electron.ipcRenderer
const toast = useToast()
const { upload } = useMediaUpload()
const { t } = useI18n()

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
    summary: t('hunt.ks.toastTitle'),
    detail: t('hunt.ks.testNoOverlay'),
    life: 5000
  })
}
</script>

<template>
  <div class="hd">
    <div class="hd-head">
      <span class="font-semibold">{{ t('hunt.death.head') }}</span>
      <small class="hd-hint">{{ t('hunt.death.hint') }}</small>
    </div>
    <div class="hd-main">
      <div class="hd-row" :class="{ off: !death.enabled }">
        <div class="hd-f">
          <span>{{ t('hunt.ks.f.text') }}</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.showText"
              :title="t('hunt.ks.tipShowText')"
              @change="emit('commit')"
            />
          </div>
        </div>
        <label class="hd-f hd-title">
          <span>{{ t('hunt.ks.f.title') }}</span>
          <InputText
            v-model="death.title"
            size="small"
            :disabled="!death.showText"
            @change="emit('commit')"
          />
        </label>
        <label class="hd-f">
          <span>{{ t('hunt.ks.f.color') }}</span>
          <input v-model="death.color" type="color" class="hd-color" @change="emit('commit')" />
        </label>
        <div class="hd-f">
          <span>{{ t('hunt.ks.f.image') }}</span>
          <div class="hd-file">
            <FileUpload
              mode="basic"
              accept="image/*,video/mp4,video/webm"
              auto
              :max-file-size="52428800"
              :title="death.mediaUrl ? t('hunt.ks.tipReplaceImage') : t('hunt.ks.tipChooseImage')"
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
              :title="t('hunt.ks.tipRemoveImage')"
              @click="((death.mediaUrl = ''), emit('commit'))"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>{{ t('hunt.death.f.onscreen') }}</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.fullscreen"
              :title="t('hunt.death.tipOnscreen')"
              @change="emit('commit')"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>{{ t('hunt.ks.f.sound') }}</span>
          <div class="hd-file">
            <FileUpload
              mode="basic"
              accept="audio/*"
              auto
              :max-file-size="8388608"
              :title="death.soundUrl ? t('hunt.ks.tipReplaceSound') : t('hunt.death.tipSound')"
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
              :title="t('hunt.ks.tipRemoveSound')"
              @click="((death.soundUrl = ''), emit('commit'))"
            />
          </div>
        </div>
        <div class="hd-f">
          <span>&nbsp;</span>
          <div class="hd-file">
            <ToggleSwitch
              v-model="death.enabled"
              :title="t('hunt.death.tipEnabled')"
              @change="emit('commit')"
            />
            <Button
              icon="pi pi-send"
              size="small"
              text
              severity="secondary"
              :title="t('hunt.ks.tipShowOnStream')"
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
      {{ t('hunt.death.nothing', { extra: death.soundUrl ? t('hunt.ks.nothingSound') : '' }) }}
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
