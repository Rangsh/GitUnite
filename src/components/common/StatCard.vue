<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  hint?: string
  icon?: string
  accent?: string
}>()

const accentColor = computed(() => props.accent || '#3b82f6')
</script>

<template>
  <div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <div class="text-xs text-gray-500 mb-1 truncate">{{ label }}</div>
        <div class="text-2xl font-semibold text-gray-800 tracking-tight">{{ value }}</div>
        <div v-if="hint" class="text-xs text-gray-400 mt-1">{{ hint }}</div>
      </div>
      <div
        v-if="icon"
        class="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
        :style="{ background: accentColor }"
      >
        <span class="text-base">{{ icon }}</span>
      </div>
    </div>
  </div>
</template>
