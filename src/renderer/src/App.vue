<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useStore } from 'vuex'
import { LANGS, type Lang } from '@shared/i18n'
import SettingHunt from './components/SettingHunt.vue'
import { initI18n, useI18n } from './i18n'

const store = useStore()
const { t, lang, setLang } = useI18n()

const langOptions = computed<{ value: Lang; label: string }[]>(() =>
  LANGS.map((value) => ({ value, label: value === 'ru' ? 'Русский' : 'English' }))
)

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let closed = false

// A single connection to the overlay server: it replays the current hunt state and
// pushes every finished match. Reconnects every 2s while the window is open.
const connect = (): void => {
  if (socket) return
  const ws = new WebSocket('ws://localhost:1040')
  socket = ws
  ws.onmessage = (ev) => {
    let msg: any
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (msg?.type === 'hunt_update') store.commit('setHunt', msg.state)
    else if (msg?.type === 'hunt_match') store.commit('addHuntMatch', msg.entry)
  }
  ws.onerror = () => ws.close()
  ws.onclose = () => {
    socket = null
    if (!closed) reconnectTimer = setTimeout(connect, 2000)
  }
}

onMounted(() => {
  void initI18n()
  connect()
})

onBeforeUnmount(() => {
  closed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div>
        <h1 class="app-title">{{ t('app.title') }}</h1>
        <p class="app-subtitle">{{ t('app.subtitle') }}</p>
      </div>
      <label class="app-lang">
        <span class="app-lang-label">{{ t('app.language') }}</span>
        <Select
          size="small"
          :model-value="lang"
          :options="langOptions"
          option-label="label"
          option-value="value"
          @update:model-value="setLang"
        />
      </label>
    </header>
    <main class="app-content">
      <SettingHunt />
    </main>
    <Toast />
  </div>
</template>
