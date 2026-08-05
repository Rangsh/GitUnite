<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  hint?: string
  /** lucide 组件，可选 */
  icon?: Component
  /** primary = 主 KPI；compact = 次级条 */
  variant?: 'primary' | 'compact'
  tone?: 'default' | 'accent' | 'danger' | 'success'
}>()

const toneClass = computed(() => {
  switch (props.tone) {
    case 'accent':
      return 'text-brand-700 bg-brand-50'
    case 'danger':
      return 'text-red-700 bg-red-50'
    case 'success':
      return 'text-emerald-700 bg-emerald-50'
    default:
      return 'text-ink-700 bg-ink-100'
  }
})
</script>

<template>
  <div
    v-if="variant === 'compact'"
    class="flex items-center gap-3 rounded-xl border border-ink-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm"
  >
    <div
      v-if="icon"
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      :class="toneClass"
    >
      <component :is="icon" :size="16" :stroke-width="2" />
    </div>
    <div class="min-w-0">
      <div class="text-[11px] font-medium uppercase tracking-wider text-ink-500">{{ label }}</div>
      <div class="gu-metric mt-0.5 text-lg font-semibold text-ink-900">{{ value }}</div>
      <div v-if="hint" class="mt-0.5 truncate text-xs text-ink-400">{{ hint }}</div>
    </div>
  </div>

  <div
    v-else
    class="group relative overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-5 shadow-panel transition-shadow hover:shadow-lift"
  >
    <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[11px] font-medium uppercase tracking-wider text-ink-500">{{ label }}</div>
        <div class="gu-metric mt-2 text-3xl font-semibold text-ink-900 sm:text-[2rem]">{{ value }}</div>
        <div v-if="hint" class="mt-2 text-xs leading-relaxed text-ink-400">{{ hint }}</div>
      </div>
      <div
        v-if="icon"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        :class="toneClass"
      >
        <component :is="icon" :size="18" :stroke-width="2" />
      </div>
    </div>
  </div>
</template>
