<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GitBranch } from 'lucide-vue-next'
import { formatNumber } from '@/utils/date'

export interface ShareCardData {
  avatarUrl: string | null
  nickname: string
  hideIdentity: boolean
  totalCommits: number
  languageCount: number
  activeDays: number
  longestStreak: number
  topLanguages: { language: string, percentage: number }[]
  earnedBadges: { id: string, name: string }[]
  year: number
}

const props = defineProps<{ data: ShareCardData }>()

const { t } = useI18n()

const displayName = computed(() =>
  props.data.hideIdentity ? t('share.anonymous') : props.data.nickname)

const initials = computed(() => {
  const name = displayName.value
  return name ? name.trim().slice(0, 1).toUpperCase() : '?'
})

const kpiItems = computed(() => [
  { label: t('share.totalCommits'), value: formatNumber(props.data.totalCommits) },
  { label: t('share.languages'), value: formatNumber(props.data.languageCount) },
  { label: t('share.activeDays'), value: formatNumber(props.data.activeDays) },
  { label: t('share.longestStreak'), value: `${props.data.longestStreak} ${t('common.unitDays')}` },
])

const palette = ['#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1']
</script>

<template>
  <div
    class="share-card relative flex flex-col overflow-hidden bg-white"
    style="width: 1200px; height: 630px; font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;"
  >
    <!-- 背景装饰 -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/10" />
      <div class="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-sky-500/10" />
      <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,148,136,0.04),transparent_40%)]" />
    </div>

    <!-- 头部 -->
    <div class="relative flex items-center gap-6 px-16 pt-14">
      <div
        class="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-900 text-4xl font-semibold text-white shadow-lift ring-4 ring-white"
      >
        <img
          v-if="data.avatarUrl && !data.hideIdentity"
          :src="data.avatarUrl"
          alt=""
          crossorigin="anonymous"
          class="h-full w-full object-cover"
        >
        <span v-else>{{ initials }}</span>
      </div>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold uppercase tracking-[0.25em] text-brand-700">
          {{ t('share.archiveTitle', { year: data.year }) }}
        </div>
        <h1 class="mt-1 truncate text-5xl font-bold tracking-tight text-ink-900">
          {{ displayName }}
        </h1>
        <div class="mt-2 flex items-center gap-2 text-sm text-ink-400">
          <GitBranch :size="14" />
          <span>{{ t('share.localNote') }}</span>
        </div>
      </div>
    </div>

    <!-- KPI -->
    <div class="relative mt-12 grid grid-cols-4 gap-6 px-16">
      <div
        v-for="(item, i) in kpiItems"
        :key="item.label"
        class="rounded-2xl border border-ink-100 bg-white/80 px-6 py-5 backdrop-blur"
      >
        <div class="text-xs font-medium uppercase tracking-wider text-ink-400">{{ item.label }}</div>
        <div
          class="gu-metric mt-2 text-4xl font-bold"
          :style="{ color: i === 0 ? '#0d9488' : '#0f172a' }"
        >
          {{ item.value }}
        </div>
      </div>
    </div>

    <!-- 语言 + 徽章 -->
    <div class="relative mt-auto flex items-end justify-between gap-10 px-16 pb-12">
      <div class="min-w-0">
        <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">{{ t('share.topLanguages') }}</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(lang, i) in data.topLanguages.slice(0, 3)"
            :key="lang.language"
            class="rounded-full px-4 py-1.5 text-base font-medium text-white shadow-sm"
            :style="{ background: palette[i % palette.length] }"
          >
            {{ lang.language }}
            <span class="ml-1 opacity-80">{{ (lang.percentage * 100).toFixed(0) }}%</span>
          </span>
          <span v-if="!data.topLanguages.length" class="text-sm text-ink-300">{{ t('share.noLang') }}</span>
        </div>
      </div>

      <div class="shrink-0 text-right">
        <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ t('share.badgesCumulative', { count: data.earnedBadges.length }) }}
        </div>
        <div class="flex justify-end gap-2">
          <div
            v-for="b in data.earnedBadges.slice(0, 5)"
            :key="b.id"
            class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-ink-50"
          >
            <img :src="`/badges/${b.id}.webp`" :alt="t(`badges.${b.id}.name`)" class="h-full w-full object-contain">
          </div>
          <div
            v-if="data.earnedBadges.length > 5"
            class="flex h-16 w-16 items-center justify-center rounded-xl bg-ink-900 text-base font-semibold text-white"
          >
            +{{ data.earnedBadges.length - 5 }}
          </div>
          <div
            v-if="!data.earnedBadges.length"
            class="text-sm text-ink-300"
          >
            {{ t('share.noBadge') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-card {
  /* 截图时确保背景不透明 */
  background-color: #ffffff;
}
</style>
