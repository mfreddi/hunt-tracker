<script lang="ts" setup>
// A font family from this PC: a dropdown with search (and typing a name by hand), '' = the overlay's own
// font. The list comes from the system after one click (see useSystemFonts); the picked name is stored
// as plain text. OBS draws it with the fonts of the PC it runs on.
import { computed } from 'vue'
import { useI18n } from '../i18n'
import { useSystemFonts } from '../composables/useSystemFonts'

const props = defineProps<{ modelValue: string; label?: string; defaultLabel?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const { t } = useI18n()

const { fonts, loaded, busy, failed, supported, load } = useSystemFonts()
const defaultLabel = computed(() => props.defaultLabel || t('common.default'))
const options = computed(() => [
  { value: '', label: defaultLabel.value },
  ...fonts.value.map((f) => ({ value: f, label: f })),
  // a saved name that is not in the list (other PC, list not loaded yet) stays selectable
  ...(props.modelValue && !fonts.value.includes(props.modelValue)
    ? [{ value: props.modelValue, label: props.modelValue }]
    : [])
])
const set = (v: unknown): void => emit('update:modelValue', typeof v === 'string' ? v : '')
</script>

<template>
  <div class="fp">
    <span v-if="label" class="fp-label">{{ label }}</span>
    <div class="fp-row">
      <Select
        :model-value="modelValue"
        :options="options"
        option-label="label"
        option-value="value"
        filter
        editable
        :placeholder="defaultLabel"
        class="fp-select"
        @update:model-value="set"
      >
        <template #option="{ option }">
          <span :style="option.value ? { fontFamily: `'${option.value}', sans-serif` } : {}">{{
            option.label
          }}</span>
        </template>
      </Select>
      <Button
        v-if="supported && !loaded"
        :label="t('fonts.load')"
        icon="pi pi-download"
        size="small"
        severity="secondary"
        outlined
        :loading="busy"
        @click="load"
      />
    </div>
    <small v-if="failed" class="fp-hint">
      {{ t('fonts.failed') }}
    </small>
    <small v-else-if="!supported" class="fp-hint">
      {{ t('fonts.unsupported') }}
    </small>
    <small class="fp-hint">
      {{ t('fonts.hint') }}
    </small>
  </div>
</template>

<style lang="less" scoped>
.fp {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fp-label {
  font-size: 13px;
}
.fp-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.fp-select {
  flex: 1;
  min-width: 0;
}
.fp-hint {
  font-size: 11px;
  opacity: 0.65;
}
</style>
