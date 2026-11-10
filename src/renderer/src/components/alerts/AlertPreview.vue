<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// A live preview of the alert being edited: the real overlay page (`/alerts?preview`) shown at 1080p and scaled down, fed
// with what the main process would send for the variant as it is in the form right now. The page does not connect to the
// app (it must not count as an open alerts overlay) and plays no sound. Changes are sent a moment after typing stops.
// `channel` = the IPC that builds the alert (the Hunt kill streak has its own); `big` undefined = no "Крупнее" button
const props = withDefaults(defineProps<{ variant: unknown; big?: boolean; channel?: string }>(), {
  big: undefined,
  channel: 'alertBoxPreview'
})
const emit = defineEmits<{ toggleBig: [] }>()
const PREVIEW_URL = 'http://localhost:1040/alerts?preview=1'
const ipc = window.electron.ipcRenderer

const wrap = ref<HTMLElement | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const scale = ref(0.3)
const light = ref(false)

const send = async (): Promise<void> => {
  try {
    const payload = await ipc.invoke(props.channel, JSON.parse(JSON.stringify(props.variant)))
    frame.value?.contentWindow?.postMessage({ type: 'alert_preview', payload }, '*')
  } catch {
    /* the preview is only a help */
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => JSON.stringify(props.variant),
  () => {
    clearTimeout(timer)
    timer = setTimeout(send, 200)
  }
)

const onMessage = (ev: MessageEvent): void => {
  if (ev.data?.type === 'alert_preview_ready') void send()
}
let observer: ResizeObserver | undefined
onMounted(() => {
  window.addEventListener('message', onMessage)
  if (wrap.value) {
    observer = new ResizeObserver(() => {
      if (wrap.value) scale.value = wrap.value.clientWidth / 1920
    })
    observer.observe(wrap.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  observer?.disconnect()
  clearTimeout(timer)
})
</script>

<template>
  <div class="ap">
    <div class="ap-bar">
      <span class="font-semibold">Предпросмотр</span>
      <div class="ap-btns">
        <Button
          :label="light ? 'Фон: светлый' : 'Фон: тёмный'"
          size="small"
          text
          severity="secondary"
          @click="light = !light"
        />
        <Button
          v-if="big !== undefined"
          :label="big ? 'Мельче' : 'Крупнее'"
          size="small"
          text
          severity="secondary"
          @click="emit('toggleBig')"
        />
      </div>
    </div>
    <div ref="wrap" class="ap-stage" :class="{ light }">
      <iframe
        ref="frame"
        :src="PREVIEW_URL"
        class="ap-frame"
        :style="{ transform: `scale(${scale})` }"
        tabindex="-1"
        title="Предпросмотр алерта"
        @load="send"
      ></iframe>
    </div>
    <small class="ap-hint">
      Так алерт выглядит на экране 1920x1080. Появление и исчезновение не показываются: для этого
      есть кнопка «Тест».
    </small>
  </div>
</template>

<style lang="less" scoped>
.ap-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.ap-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: repeating-conic-gradient(#26262c 0% 25%, #1c1c21 0% 50%) 50% / 24px 24px;
  &.light {
    background: repeating-conic-gradient(#e6e6ea 0% 25%, #f6f6f8 0% 50%) 50% / 24px 24px;
  }
}
.ap-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  border: 0;
  transform-origin: 0 0;
  pointer-events: none;
  background: transparent;
  /* the iframe's page is transparent only when its colour scheme matches the iframe's own: in a dark app the default would give
     the preview an opaque white backdrop (the checkerboard behind it would never show) */
  color-scheme: normal;
}
.ap-btns {
  display: flex;
}
.ap-hint {
  opacity: 0.6;
  display: block;
  margin-top: 4px;
}
</style>
