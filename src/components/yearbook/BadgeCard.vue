<script setup lang="ts">
import { computed, ref } from 'vue'
import { Lock } from 'lucide-vue-next'
import type { BadgeStatus, BadgeTone } from '@/utils/badges'

const props = defineProps<{
  badge: BadgeStatus
}>()

// 徽章图片：public/badges/<id>.webp（256px WebP）
const imgSrc = computed(() => `/badges/${props.badge.id}.webp`)
const imgFailed = ref(false)

const TONE_COLORS: Record<BadgeTone, string> = {
  accent: '#0d9488',
  success: '#059669',
  warning: '#d97706',
  danger: '#e11d48',
  info: '#0284c7',
  default: '#64748b',
}

const tone = computed(() => TONE_COLORS[props.badge.tone] ?? TONE_COLORS.default)
const progressPct = computed(() => Math.round(props.badge.progress * 100))
</script>

<template>
  <div
    class="relative flex flex-col items-center rounded-2xl border p-4 text-center transition-all"
    :class="badge.earned
      ? 'border-ink-200 bg-white shadow-panel hover:shadow-lift'
      : 'border-dashed border-ink-200 bg-ink-50/60'"
  >
    <!-- 徽章图像：资源最长边 256px WebP；展示约 56px 高以适配 2x -->
    <div class="relative flex h-14 w-full items-center justify-center">
      <img
        v-if="!imgFailed"
        :src="imgSrc"
        :alt="badge.name"
        width="256"
        height="140"
        class="h-14 w-auto max-w-full object-contain"
        :class="badge.earned ? 'opacity-100 drop-shadow-sm' : 'opacity-40 grayscale'"
        @error="imgFailed = true"
      />
      <component
        v-else
        :is="badge.icon"
        :size="40"
        :stroke-width="1.6"
        :color="badge.earned ? tone : '#94a3b8'"
      />

      <div
        v-if="!badge.earned"
        class="absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white text-ink-400 shadow"
      >
        <Lock :size="11" />
      </div>
    </div>

    <div
      class="mt-2 text-sm font-semibold"
      :class="badge.earned ? 'text-ink-900' : 'text-ink-500'"
    >
      {{ badge.name }}
    </div>
    <div class="mt-0.5 text-[11px] leading-relaxed text-ink-400">
      {{ badge.description }}
    </div>

    <!-- 进度 -->
    <div v-if="!badge.earned" class="mt-3 w-full">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          class="h-full rounded-full transition-all"
          :style="{ width: `${progressPct}%`, background: tone }"
        />
      </div>
      <div class="mt-1 text-[11px] text-ink-400">{{ badge.metricLabel }}</div>
    </div>
    <div
      v-else
      class="mt-3 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      :style="{ color: tone, background: `${tone}1a` }"
    >
      已达成{{ badge.achievedAt ? ` · ${badge.achievedAt}` : '' }}
    </div>
  </div>
</template>
