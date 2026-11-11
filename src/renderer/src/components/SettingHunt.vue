<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import OverlayLink from './OverlayLink.vue'
import HuntGameOverlay from './HuntGameOverlay.vue'
import HuntGoals from './HuntGoals.vue'
import HuntHistory from './HuntHistory.vue'
import HuntKillStreak from './HuntKillStreak.vue'
import HuntLookSettings from './HuntLookSettings.vue'
import HuntWidgets from './HuntWidgets.vue'
import { useI18n } from '../i18n'

const store = useStore()
const { t } = useI18n()
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

const gapOptions = computed(() => [
  { value: 3, label: t('hunt.session.gap.3') },
  { value: 6, label: t('hunt.session.gap.6') },
  { value: 12, label: t('hunt.session.gap.12') },
  { value: 0, label: t('hunt.session.gap.off') }
])

const latencyOptions = computed(() => [
  { value: 'normal', label: t('hunt.conn.speed.normal') },
  { value: 'fast', label: t('hunt.conn.speed.fast') }
])

const sdkFailed = computed(() => s.value?.sdk?.state === 'failed')

// Live state of one log: where the path is known and whether it is actually being read.
const logState = (kind: 'game' | 'events', hasPath: boolean): { text: string; cls: string } => {
  if (!hasPath) return { text: t('hunt.conn.status.notFound'), cls: 'bad' }
  const st = s.value?.statuses?.[kind]
  // The events are read, but the game never connected to NVIDIA Highlights when it
  // started: nothing will ever arrive, so "читается" would be a lie.
  if (kind === 'events' && sdkFailed.value) return { text: t('hunt.conn.status.noNvidia'), cls: 'bad' }
  if (st === 'online') {
    const n = Number(s.value?.sdk?.received || 0)
    return {
      text: n > 0 ? t('hunt.conn.status.readingMoments', { n }) : t('hunt.conn.status.reading'),
      cls: 'ok'
    }
  }
  if (st === 'missing') return { text: t('hunt.conn.status.fileMissing'), cls: 'bad' }
  return {
    text: s.value?.connected ? t('hunt.conn.status.connecting') : t('hunt.conn.status.waitingGame'),
    cls: ''
  }
}
const gameLogState = computed(() => logState('game', !!s.value?.gamePath))
const sdkState = computed(() => logState('events', !!s.value?.eventsPath))
</script>

<template>
  <div v-if="s" class="hunt">
    <OverlayLink :url="OBS_URL">
      <Button size="small" severity="secondary" :label="t('common.test')" @click="send({ type: 'test' })" />
    </OverlayLink>
    <HuntWidgets :url="OBS_URL" />

    <details class="hunt-group" open>
      <summary>{{ t('hunt.group.gameWindow') }}</summary>
      <HuntGameOverlay />
    </details>

    <details class="hunt-group" open>
      <summary>{{ t('hunt.group.connection') }}</summary>
      <p class="hunt-hint">{{ t('hunt.conn.intro') }}</p>
      <div class="hunt-statusrow">
        <span
          v-tooltip.top="s.connected ? t('hunt.conn.dataFromGameTip') : t('hunt.conn.noDataTip')"
          class="hunt-dot"
          :class="{ ok: s.connected }"
        ></span>
        <span v-if="s.enabled" class="hunt-hint">{{ t('hunt.conn.trackerOn') }}</span>
        <span v-else class="hunt-hint">{{ t('hunt.conn.trackerOff') }}</span>
      </div>
      <div class="hunt-row">
        <ToggleSwitch
          :model-value="s.enabled"
          @update:model-value="(v) => send({ type: 'enabled', value: v })"
        />
        <span class="hunt-label">{{ t('hunt.conn.enableTracker') }}</span>
      </div>
      <div class="hunt-paths">
        <div class="hunt-path-item">
          <span class="hunt-path-label">{{ t('hunt.conn.gameData') }}</span>
          <span class="hunt-path-status" :class="gameLogState.cls">{{ gameLogState.text }}</span>
        </div>
        <div class="hunt-path-item">
          <span class="hunt-path-label">{{ t('hunt.conn.combatEvents') }}</span>
          <span class="hunt-path-status" :class="sdkState.cls">{{ sdkState.text }}</span>
        </div>
      </div>
      <div v-if="sdkFailed" class="hunt-warn">
        <b>{{ t('hunt.conn.sdkFailedTitle') }}</b>{{ t('hunt.conn.sdkFailed') }}
      </div>
      <p v-if="s.statuses?.events === 'missing' && s.eventsPath" class="hunt-hint">
        {{ t('hunt.conn.eventsMissing') }}
      </p>
      <label class="hunt-field">
        <span>{{ t('hunt.conn.speedLabel') }}</span>
        <Select
          :model-value="s.latencyMode || 'normal'"
          :options="latencyOptions"
          option-label="label"
          option-value="value"
          @update:model-value="(v) => send({ type: 'latencyMode', value: v })"
        />
      </label>
      <p class="hunt-hint">
        {{ t('hunt.conn.speedHint') }}
      </p>
      <label class="hunt-field">
        <span>{{ t('hunt.conn.gamePathLabel') }}</span>
        <InputText
          :model-value="s.gamePath || ''"
          :placeholder="t('hunt.conn.gamePathPlaceholder')"
          @change="(e) => setPath('gamePath', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label class="hunt-field">
        <span>{{ t('hunt.conn.eventsPathLabel') }}</span>
        <InputText
          :model-value="s.eventsPath || ''"
          :placeholder="t('hunt.conn.eventsPathPlaceholder')"
          @change="(e) => setPath('eventsPath', (e.target as HTMLInputElement).value)"
        />
      </label>
      <Button
        size="small"
        icon="pi pi-search"
        :label="t('hunt.conn.detect')"
        :loading="detecting"
        @click="detectPaths"
      />
      <div v-if="detected === 'error'" class="hunt-detect bad">{{ t('hunt.conn.detectFailed') }}</div>
      <div v-else-if="detected" class="hunt-detect">
        <div :class="detected.game ? 'ok' : 'bad'">
          {{
            detected.game
              ? t('hunt.conn.detectGameOk')
              : t('hunt.conn.detectGameBad')
          }}
        </div>
        <div :class="detected.events ? 'ok' : 'bad'">
          {{
            detected.events
              ? t('hunt.conn.detectEventsOk')
              : t('hunt.conn.detectEventsBad')
          }}
        </div>
      </div>
    </details>

    <details class="hunt-group" open>
      <summary>{{ t('hunt.group.session') }}</summary>
      <div class="hunt-stats">
        <div>
          <span>{{ t('hunt.session.inGame') }}</span><b>{{ played }}</b>
        </div>
        <div>
          <span>{{ t('hunt.session.games') }}</span><b>{{ sess.games || 0 }}</b>
        </div>
        <div>
          <span>{{ t('hunt.session.survived') }}</span><b class="green">{{ sess.survived || 0 }}</b>
        </div>
        <div>
          <span>{{ t('hunt.session.lost') }}</span><b class="red">{{ sess.lost || 0 }}</b>
        </div>
        <div>
          <span>K / D</span><b>{{ sess.kills || 0 }}/{{ sess.deaths || 0 }}</b
          ><em>K/D {{ kd }}</em>
        </div>
        <div v-if="sess.trades">
          <span>{{ t('hunt.session.trades') }}</span><b>{{ sess.trades }}</b>
        </div>
        <div
          v-if="sess.unclassified"
          v-tooltip.top="t('hunt.session.unclassifiedTip')"
        >
          <span>{{ t('hunt.session.unclassified') }}</span><b class="red">{{ sess.unclassified }}</b>
        </div>
      </div>
      <div v-if="cur.inMatch" class="hunt-current">
        <span class="hunt-curlabel">{{ t('hunt.session.currentMatch') }}</span>
        <span>{{ cur.map }} - {{ cur.mode }}</span>
        <span v-if="cur.skulls && cur.skulls.length > 0">
          {{ t('hunt.session.skulls', { kills: cur.skulls.filter((x: string) => x === 'kill').length, total: cur.skulls.length }) }}
        </span>
      </div>
      <p class="hunt-hint">
        {{ t('hunt.session.hint') }}
      </p>
      <div class="hunt-row">
        <label class="hunt-field">
          <span>{{ t('hunt.session.newAuto') }}</span>
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
          :label="t('hunt.session.newBtn')"
          @click="send({ type: 'reset' })"
        />
      </div>
    </details>

    <details class="hunt-group" :open="(s.goals || []).length > 0">
      <summary>{{ t('hunt.group.goals') }}</summary>
      <HuntGoals />
    </details>

    <details class="hunt-group">
      <summary>{{ t('hunt.group.streak') }}</summary>
      <HuntKillStreak />
    </details>

    <details class="hunt-group">
      <summary>{{ t('hunt.group.history') }}</summary>
      <HuntHistory />
    </details>

    <details class="hunt-group">
      <summary>{{ t('hunt.group.look') }}</summary>
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
