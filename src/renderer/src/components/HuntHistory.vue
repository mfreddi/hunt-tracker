<script setup lang="ts">
// Hunt match history (settings): filters, totals of what is filtered, per-map rows,
// the match list and a CSV export. Data: getHuntHistory once, then hunt_match
// pushes each finished match into the store (newest first).
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import { useI18n } from '../i18n'

const store = useStore()
const toast = useToast()
const { t, lang } = useI18n()
const all = computed<any[]>(() => store.state.huntHistory || [])

onMounted(async () => {
  // The store starts with an empty array, so only skip once something is there.
  if (store.state.huntHistory.length) return
  try {
    store.commit('setHuntHistory', await window.electron.ipcRenderer.invoke('getHuntHistory'))
  } catch {
    store.commit('setHuntHistory', [])
  }
})

const PAGE = 30
const DAY = 24 * 60 * 60 * 1000
const mode = ref<string>('')
const map = ref<string>('')
const period = ref<string>('all')
const shown = ref(PAGE)

const periods = computed(() => [
  { value: 'all', label: t('hunt.history.period.all') },
  { value: 'today', label: t('hunt.history.period.today') },
  { value: '7', label: t('hunt.history.period.7') },
  { value: '30', label: t('hunt.history.period.30') }
])
const optionsOf = (key: 'mode' | 'mapName', allLabel: string): any[] => [
  { value: '', label: allLabel },
  ...[...new Set(all.value.map((m) => m[key]).filter(Boolean))]
    .sort()
    .map((v) => ({ value: v, label: v }))
]
const modes = computed(() => optionsOf('mode', t('hunt.history.allModes')))
const maps = computed(() => optionsOf('mapName', t('hunt.history.allMaps')))

const since = (): number => {
  if (period.value === 'today') return new Date().setHours(0, 0, 0, 0)
  if (period.value === '7' || period.value === '30') return Date.now() - Number(period.value) * DAY
  return 0
}
const filtered = computed(() => {
  const from = since()
  return all.value.filter(
    (m) =>
      m.endedAt >= from &&
      (!mode.value || m.mode === mode.value) &&
      (!map.value || m.mapName === map.value)
  )
})

interface Totals {
  games: number
  survived: number
  lost: number
  kills: number
  deaths: number
}
const sum = (list: any[]): Totals =>
  list.reduce(
    (t, m) => {
      t.games++
      if (m.outcome === 'survived') t.survived++
      if (m.outcome === 'lost') t.lost++
      t.kills += m.kills
      t.deaths += m.deaths
      return t
    },
    { games: 0, survived: 0, lost: 0, kills: 0, deaths: 0 }
  )
const kd = (t: Totals): string => (t.deaths ? t.kills / t.deaths : t.kills).toFixed(2)
const pct = (t: Totals): string => (t.games ? Math.round((t.survived / t.games) * 100) + '%' : '-')

const totals = computed(() => sum(filtered.value))
const byMap = computed(() => {
  const groups = new Map<string, any[]>()
  for (const m of filtered.value) {
    const k = m.mapName || '?'
    groups.set(k, [...(groups.get(k) || []), m])
  }
  return [...groups.entries()]
    .map(([name, list]) => ({ name, t: sum(list) }))
    .sort((a, b) => b.t.games - a.t.games)
})

const when = (ts: number): string =>
  new Date(ts).toLocaleString(lang.value === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
const minutes = (m: any): string =>
  m.startedAt ? t('hunt.history.minutes', { n: Math.max(1, Math.round((m.endedAt - m.startedAt) / 60000)) }) : ''
const outcomeText = (o: string): string =>
  o === 'survived' ? t('hunt.history.outcome.survived') : o === 'lost' ? t('hunt.history.outcome.lost') : '-'

const csvEscape = (v: any): string => {
  const s = String(v ?? '')
  return /["\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const exportCsv = async (): Promise<void> => {
  const lines = [
    t('hunt.history.csvHeader')
  ]
  for (const m of filtered.value) {
    lines.push(
      [
        m.startedAt ? new Date(m.startedAt).toLocaleString(lang.value === 'ru' ? 'ru-RU' : 'en-US') : '',
        new Date(m.endedAt).toLocaleString(lang.value === 'ru' ? 'ru-RU' : 'en-US'),
        m.mode,
        m.mapName,
        outcomeText(m.outcome),
        m.kills,
        m.deaths,
        m.trades
      ]
        .map(csvEscape)
        .join(';')
    )
  }
  const resp = await window.electron.ipcRenderer.invoke('saveTextFile', {
    content: lines.join('\r\n'),
    defaultName: `hunt-matches-${new Date().toISOString().slice(0, 10)}.csv`
  })
  if (resp?.error) store.commit('setError', resp)
  else if (resp?.filePath)
    toast.add({ severity: 'success', summary: t('hunt.history.csvSaved'), detail: resp.filePath, life: 6000 })
}
</script>

<template>
  <div class="hh">
    <p v-if="!all.length" class="hh-hint">
      {{ t('hunt.history.empty') }}
    </p>
    <template v-else>
      <div class="hh-filters">
        <Select v-model="period" :options="periods" option-label="label" option-value="value" />
        <Select v-model="mode" :options="modes" option-label="label" option-value="value" />
        <Select v-model="map" :options="maps" option-label="label" option-value="value" />
      </div>
      <div class="hh-totals">
        <span
          >{{ t('hunt.history.gamesLabel') }} <b>{{ totals.games }}</b></span
        >
        <span
          >{{ t('hunt.history.survivedLabel') }} <b class="green">{{ totals.survived }}</b> ({{ pct(totals) }})</span
        >
        <span
          >{{ t('hunt.history.lostLabel') }} <b class="red">{{ totals.lost }}</b></span
        >
        <span
          >K/D <b>{{ totals.kills }}/{{ totals.deaths }}</b> ({{ kd(totals) }})</span
        >
      </div>
      <details v-if="byMap.length > 1" class="hh-maps">
        <summary>{{ t('hunt.history.byMaps') }}</summary>
        <div v-for="g in byMap" :key="g.name" class="hh-maprow">
          <span>{{ g.name }}</span>
          <span>{{ t('hunt.history.gamesCount', { n: g.t.games }) }}</span>
          <span>{{ t('hunt.history.survivedPct', { pct: pct(g.t) }) }}</span>
          <span>{{ t('hunt.history.kdValue', { kd: kd(g.t) }) }}</span>
        </div>
      </details>
      <div class="hh-list">
        <div v-for="m in filtered.slice(0, shown)" :key="m.id" class="hh-match">
          <span class="hh-when">{{ when(m.endedAt) }}</span>
          <span>{{ m.mode || '-' }}</span>
          <span>{{ m.mapName || '-' }}</span>
          <span :class="m.outcome === 'survived' ? 'green' : m.outcome === 'lost' ? 'red' : ''">
            {{ outcomeText(m.outcome) }}
          </span>
          <span
            >{{ m.kills }}/{{ m.deaths
            }}<template v-if="m.trades">{{ t('hunt.history.tradeShort', { n: m.trades }) }}</template></span
          >
          <span class="hh-dim">{{ minutes(m) }}</span>
        </div>
        <p v-if="!filtered.length" class="hh-hint">{{ t('hunt.history.noMatches') }}</p>
      </div>
      <div class="hh-actions">
        <Button
          v-if="filtered.length > shown"
          size="small"
          severity="secondary"
          :label="t('hunt.history.showMore', { n: filtered.length - shown })"
          @click="shown += PAGE"
        />
        <Button
          size="small"
          severity="secondary"
          icon="pi pi-download"
          label="CSV"
          :disabled="!filtered.length"
          @click="exportCsv"
        />
      </div>
    </template>
  </div>
</template>

<style lang="less" scoped>
.hh {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hh-hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 4px 0;
}
.hh-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hh-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 13px;
}
.hh-maps > summary {
  cursor: pointer;
  font-size: 12.5px;
  opacity: 0.8;
  margin-bottom: 4px;
}
.hh-maprow,
.hh-match {
  display: grid;
  gap: 8px;
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.hh-maprow {
  grid-template-columns: 2fr 1fr 1fr 1fr;
}
.hh-match {
  grid-template-columns: 6.5rem 1.2fr 1fr 5.5rem 1fr 4rem;
}
.hh-list {
  max-height: 360px;
  overflow-y: auto;
}
.hh-when,
.hh-dim {
  opacity: 0.6;
}
.hh-actions {
  display: flex;
  gap: 8px;
}
.green {
  color: #4ade80;
}
.red {
  color: #f87171;
}
</style>
