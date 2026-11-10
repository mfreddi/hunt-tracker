<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useStore } from 'vuex'
import SettingHunt from './components/SettingHunt.vue'

const store = useStore()

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

onMounted(connect)

onBeforeUnmount(() => {
  closed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">Hunt Tracker</h1>
      <p class="app-subtitle">Трекер Hunt: Showdown и оверлей для OBS</p>
    </header>
    <main class="app-content">
      <SettingHunt />
    </main>
    <Toast />
  </div>
</template>
