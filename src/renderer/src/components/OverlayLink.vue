<script setup lang="ts">
// The one way an overlay URL is shown in settings: the link, a copy button, a
// slot for overlay-specific actions (Тест, Превью...), and the same link for
// OBS on a second PC (two-PC streaming: Hunt Tracker on the gaming PC, OBS on
// the streaming PC; the overlay server listens on the whole LAN).
import { ref } from 'vue'
import { lanUrl, useLanAddresses } from '../composables/useLanAddresses'

const props = defineProps<{
  url: string
  // Optional caption above the link (e.g. which of several overlays it is).
  label?: string
  // A public web link, not a local overlay: no "second PC" block.
  noLan?: boolean
}>()

const copied = ref<string | null>(null)
const copy = (text: string): void => {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = text
    setTimeout(() => {
      if (copied.value === text) copied.value = null
    }, 1500)
  })
}

const { addresses, load } = useLanAddresses()
const lanOpen = ref(false)
const toggleLan = (): void => {
  lanOpen.value = !lanOpen.value
  if (lanOpen.value) void load()
}
</script>

<template>
  <div class="ol">
    <div v-if="props.label" class="ol-label">{{ props.label }}</div>
    <div class="ol-row">
      <div class="ol-box" title="Нажми, чтобы скопировать" @click="copy(props.url)">
        <span class="ol-url">{{ props.url }}</span>
      </div>
      <Button
        size="small"
        severity="secondary"
        :icon="copied === props.url ? 'pi pi-check' : 'pi pi-copy'"
        :label="copied === props.url ? 'Скопировано' : 'Копировать'"
        @click="copy(props.url)"
      />
      <slot />
    </div>
    <button v-if="!props.noLan" type="button" class="ol-lan-toggle" @click="toggleLan">
      <i :class="lanOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
      Стримишь с двух ПК?
    </button>
    <div v-if="lanOpen && !props.noLan" class="ol-lan">
      <p class="ol-hint">
        Запусти Hunt Tracker на игровом ПК, а в OBS на стрим-ПК вставь ссылку с адресом этого
        компьютера в сети. Если Windows спросит про брандмауэр — разреши доступ в частной сети.
      </p>
      <div v-if="addresses === null" class="ol-hint">Ищем адрес в сети…</div>
      <div v-else-if="!addresses.length" class="ol-hint">
        Компьютер не подключён к локальной сети.
      </div>
      <template v-else>
        <div v-for="a in addresses" :key="a.ip" class="ol-row">
          <div class="ol-box" :class="{ dim: a.virtual }" @click="copy(lanUrl(props.url, a.ip))">
            <span class="ol-url">{{ lanUrl(props.url, a.ip) }}</span>
            <span class="ol-iface">{{ a.label }}</span>
          </div>
          <Button
            size="small"
            severity="secondary"
            :icon="copied === lanUrl(props.url, a.ip) ? 'pi pi-check' : 'pi pi-copy'"
            :label="copied === lanUrl(props.url, a.ip) ? 'Скопировано' : 'Копировать'"
            @click="copy(lanUrl(props.url, a.ip))"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="less" scoped>
.ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ol-label {
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.85;
}
.ol-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ol-box {
  flex: 1 1 260px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12.5px;
  font-family: Consolas, 'Cascadia Mono', monospace;
}
.ol-box:hover {
  border-color: rgba(255, 255, 255, 0.4);
}
.ol-box.dim {
  opacity: 0.6;
}
.ol-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ol-iface {
  flex: none;
  font-family: inherit;
  font-size: 11px;
  opacity: 0.55;
}
.ol-lan-toggle {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 12px;
  opacity: 0.65;
  cursor: pointer;
}
.ol-lan-toggle:hover {
  opacity: 0.9;
}
.ol-lan-toggle .pi {
  font-size: 10px;
}
.ol-lan {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
}
.ol-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 0;
}
</style>
