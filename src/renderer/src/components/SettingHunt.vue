<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import OverlayLink from './OverlayLink.vue'
import HuntGoals from './HuntGoals.vue'
import HuntHistory from './HuntHistory.vue'
import HuntKillStreak from './HuntKillStreak.vue'
import HuntLookSettings from './HuntLookSettings.vue'
import HuntWidgets from './HuntWidgets.vue'

const store = useStore()
const s = computed<any>(() => store.state.hunt || null)
const sess = computed<any>(() => s.value?.session || {})
const cur = computed<any>(() => s.value?.current || {})

// The ws replay normally fills this within milliseconds; this is the fallback.
onMounted(async () => {
  if (!store.state.hunt) {
    try {
      store.commit('setHunt', await window.electron.ipcRenderer.invoke('getHunt'))
    } catch {
      /* ws will deliver it */
    }
  }
})

const send = (payload: any): void => window.electron.ipcRenderer.send('huntAction', payload)

const OBS_URL = 'http://localhost:1040/hunt'

const detecting = ref(false)
// What the last search found: which of the two logs were located.
const detected = ref<{ game: boolean; events: boolean } | 'error' | null>(null)

// Manual editing of the two log paths this app reads from (they are published openly here).
const setPath = (key: 'gamePath' | 'eventsPath', value: string): void =>
  send({ type: 'paths', [key]: value })

// Ask the main process to look the paths up, then apply what it found.
const detectPaths = async () => {
  detecting.value = true
  detected.value = null
  try {
    const r = await window.electron.ipcRenderer.invoke('huntDetectPaths')
    detected.value = { game: !!r?.gamePath, events: !!r?.eventsPath }
    send({ type: 'paths', gamePath: r?.gamePath ?? null, eventsPath: r?.eventsPath ?? null })
  } catch {
    detected.value = 'error'
  } finally {
    detecting.value = false
  }
}

const kd = computed(() => Number(sess.value.kd || 0).toFixed(2))

// While playing, the state is refreshed at least once a minute: minutes are enough here.
const played = computed(() => {
  const ms = Number(sess.value.playedMs || 0)
  const m = Math.floor(ms / 60000)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
})

const gapOptions = [
  { value: 3, label: 'после 3 ч без игры' },
  { value: 6, label: 'после 6 ч без игры' },
  { value: 12, label: 'после 12 ч без игры' },
  { value: 0, label: 'выключено — только вручную' }
]

const latencyOptions = [
  { value: 'normal', label: 'Обычная - 3,5 с, находит размены (рекомендуется)' },
  { value: 'fast', label: 'Быстро - 300 мс, возможны ложные срабатывания' }
]

const sdkFailed = computed(() => s.value?.sdk?.state === 'failed')

// Live state of one log: where the path is known and whether it is actually being read.
const logState = (kind: 'game' | 'events', hasPath: boolean): { text: string; cls: string } => {
  if (!hasPath) return { text: 'не найден', cls: 'bad' }
  const st = s.value?.statuses?.[kind]
  // The events are read, but the game never connected to NVIDIA Highlights when it
  // started: nothing will ever arrive, so "читается" would be a lie.
  if (kind === 'events' && sdkFailed.value) return { text: 'нет связи с NVIDIA', cls: 'bad' }
  if (st === 'online') {
    const n = Number(s.value?.sdk?.received || 0)
    return { text: n > 0 ? `читается · моментов: ${n}` : 'читается', cls: 'ok' }
  }
  if (st === 'missing') return { text: 'файл не появился', cls: 'bad' }
  return { text: s.value?.connected ? 'подключаемся' : 'ждём игру', cls: '' }
}
const gameLogState = computed(() => logState('game', !!s.value?.gamePath))
const sdkState = computed(() => logState('events', !!s.value?.eventsPath))
</script>

<template>
  <div v-if="s" class="hunt">
    <OverlayLink :url="OBS_URL">
      <Button size="small" severity="secondary" label="Тест" @click="send({ type: 'test' })" />
    </OverlayLink>
    <HuntWidgets :url="OBS_URL" />

    <details class="hunt-group" open>
      <summary>Подключение игры</summary>
      <p class="hunt-hint">
        Hunt Tracker собирает данные Hunt Showdown прямо на этом компьютере. Игра должна быть
        установлена, а Highlights включены в игре и в приложении NVIDIA. Сами моменты сохранять не
        нужно - достаточно, чтобы функция была включена.
      </p>
      <div class="hunt-statusrow">
        <span
          v-tooltip.top="s.connected ? 'Данные из игры приходят' : 'Нет данных из игры'"
          class="hunt-dot"
          :class="{ ok: s.connected }"
        ></span>
        <span v-if="s.enabled" class="hunt-hint">трекер включён</span>
        <span v-else class="hunt-hint">трекер выключен</span>
      </div>
      <div class="hunt-row">
        <ToggleSwitch
          :model-value="s.enabled"
          @update:model-value="(v) => send({ type: 'enabled', value: v })"
        />
        <span class="hunt-label">Включить трекер</span>
      </div>
      <div class="hunt-paths">
        <div class="hunt-path-item">
          <span class="hunt-path-label">Данные игры</span>
          <span class="hunt-path-status" :class="gameLogState.cls">{{ gameLogState.text }}</span>
        </div>
        <div class="hunt-path-item">
          <span class="hunt-path-label">События боя</span>
          <span class="hunt-path-status" :class="sdkState.cls">{{ sdkState.text }}</span>
        </div>
      </div>
      <div v-if="sdkFailed" class="hunt-warn">
        <b>Игра не подключилась к NVIDIA Highlights при запуске</b>, поэтому убийства и смерти
        сейчас не считаются (игры и исходы считаются). Обычно так бывает, когда игру запускают, пока
        приложение NVIDIA ещё не загрузилось. Закрой игру, дождись, пока приложение NVIDIA полностью
        запустится, и запусти игру заново. Если не помогает — перезапусти приложение NVIDIA и
        проверь, что в нём включены оверлей и Highlights.
      </div>
      <p v-if="s.statuses?.events === 'missing' && s.eventsPath" class="hunt-hint">
        События боя не появились: включи Highlights в игре и в приложении NVIDIA (сами моменты
        сохранять не нужно), иначе убийства не считаются.
      </p>
      <label class="hunt-field">
        <span>Скорость учёта убийств</span>
        <Select
          :model-value="s.latencyMode || 'normal'"
          :options="latencyOptions"
          option-label="label"
          option-value="value"
          @update:model-value="(v) => send({ type: 'latencyMode', value: v })"
        />
      </label>
      <p class="hunt-hint">
        Убийство и смерть сначала выглядят одинаково, отличить их можно только по данным игры.
        Обычная скорость надёжнее и находит размены, поэтому рекомендуется. В быстром режиме, если
        подтверждение смерти запоздает, смерть может засчитаться как убийство — бывают ложные
        срабатывания.
      </p>
      <label class="hunt-field">
        <span>Путь к данным игры (game.log)</span>
        <InputText
          :model-value="s.gamePath || ''"
          placeholder="Например, …\Hunt Showdown 1896\game.log"
          @change="(e) => setPath('gamePath', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label class="hunt-field">
        <span>Путь к событиям боя (NVIDIA Highlights)</span>
        <InputText
          :model-value="s.eventsPath || ''"
          placeholder="Папка с событиями боя"
          @change="(e) => setPath('eventsPath', (e.target as HTMLInputElement).value)"
        />
      </label>
      <Button
        size="small"
        icon="pi pi-search"
        label="Определить автоматически"
        :loading="detecting"
        @click="detectPaths"
      />
      <div v-if="detected === 'error'" class="hunt-detect bad">Не удалось выполнить поиск.</div>
      <div v-else-if="detected" class="hunt-detect">
        <div :class="detected.game ? 'ok' : 'bad'">
          {{
            detected.game
              ? '✓ Игра найдена'
              : '✗ Игра не найдена: ищем Hunt: Showdown 1896 в библиотеках Steam'
          }}
        </div>
        <div :class="detected.events ? 'ok' : 'bad'">
          {{
            detected.events
              ? '✓ События боя найдены'
              : '✗ События боя не найдены: включи Highlights в игре и в приложении NVIDIA и сыграй катку'
          }}
        </div>
      </div>
    </details>

    <details class="hunt-group" open>
      <summary>Сессия</summary>
      <div class="hunt-stats">
        <div>
          <span>В игре</span><b>{{ played }}</b>
        </div>
        <div>
          <span>Игр</span><b>{{ sess.games || 0 }}</b>
        </div>
        <div>
          <span>Выжили</span><b class="green">{{ sess.survived || 0 }}</b>
        </div>
        <div>
          <span>Не выжили</span><b class="red">{{ sess.lost || 0 }}</b>
        </div>
        <div>
          <span>K / D</span><b>{{ sess.kills || 0 }}/{{ sess.deaths || 0 }}</b
          ><em>K/D {{ kd }}</em>
        </div>
        <div v-if="sess.trades">
          <span>Размены</span><b>{{ sess.trades }}</b>
        </div>
        <div
          v-if="sess.unclassified"
          v-tooltip.top="'Не удалось отличить убийство от смерти: данные игры были недоступны'"
        >
          <span>Не определено</span><b class="red">{{ sess.unclassified }}</b>
        </div>
      </div>
      <div v-if="cur.inMatch" class="hunt-current">
        <span class="hunt-curlabel">Текущая катка:</span>
        <span>{{ cur.map }} - {{ cur.mode }}</span>
        <span v-if="cur.skulls && cur.skulls.length > 0">
          черепов: {{ cur.skulls.filter((x: string) => x === 'kill').length }}/{{
            cur.skulls.length
          }}
        </span>
      </div>
      <p class="hunt-hint">
        Считаются все режимы кроме Tutorial и Shooting Range. Время в игре идёт, только пока
        запущена игра.
      </p>
      <div class="hunt-row">
        <label class="hunt-field">
          <span>Новая сессия автоматически</span>
          <Select
            :model-value="s.sessionGapHours ?? 3"
            :options="gapOptions"
            option-label="label"
            option-value="value"
            @update:model-value="(v) => send({ type: 'sessionGap', value: v })"
          />
        </label>
        <Button
          size="small"
          severity="secondary"
          icon="pi pi-refresh"
          label="Новая сессия"
          @click="send({ type: 'reset' })"
        />
      </div>
    </details>

    <details class="hunt-group" :open="(s.goals || []).length > 0">
      <summary>Челлендж-цели</summary>
      <HuntGoals />
    </details>

    <details class="hunt-group">
      <summary>Серия убийств</summary>
      <HuntKillStreak />
    </details>

    <details class="hunt-group">
      <summary>История каток</summary>
      <HuntHistory />
    </details>

    <details class="hunt-group">
      <summary>Вид оверлея</summary>
      <HuntLookSettings />
    </details>
  </div>
</template>

<style lang="less" scoped>
.hunt {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hunt-warn {
  margin: 6px 0 10px;
  padding: 9px 11px;
  border: 1px solid rgba(245, 166, 35, 0.55);
  background: rgba(245, 166, 35, 0.08);
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.45;
}
.hunt-warn b {
  color: #f5a623;
}
.hunt-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 4px 0;
}
.hunt-hint code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
}
.hunt-group {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px 12px 12px;
}
.hunt-group > summary {
  cursor: pointer;
  padding: 8px 0;
  font-weight: 600;
  font-size: 13px;
}
.hunt-group[open] > summary {
  margin-bottom: 8px;
}
.hunt-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 6px;
}
.hunt-label {
  font-size: 13px;
  opacity: 0.85;
}
.hunt-paths {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: 12px;
}
.hunt-path-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}
.hunt-path-label {
  font-size: 13px;
  opacity: 0.8;
}
.hunt-path-status {
  font-size: 12px;
  opacity: 0.6;
}
.hunt-detect {
  margin-top: 8px;
  font-size: 12.5px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hunt-detect .ok {
  color: #4ade80;
}
.hunt-detect .bad,
.hunt-detect.bad {
  color: #f87171;
}
.hunt-path-status.ok {
  color: #4ade80;
  opacity: 1;
}
.hunt-path-status.bad {
  color: #f87171;
  opacity: 1;
}
.hunt-statusrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.hunt-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #f87171;
  flex: none;
}
.hunt-dot.ok {
  background: #4ade80;
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
.hunt-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  font-size: 13px;
}
.hunt-stats div {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.hunt-stats span {
  opacity: 0.6;
}
.hunt-stats em {
  opacity: 0.55;
  font-style: normal;
  font-size: 0.9em;
}
.hunt-stats b.green {
  color: #4ade80;
}
.hunt-stats b.red {
  color: #f87171;
}
.hunt-current {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(74, 222, 128, 0.1);
  border-radius: 6px;
}
.hunt-curlabel {
  opacity: 0.7;
  font-weight: 600;
}
</style>
