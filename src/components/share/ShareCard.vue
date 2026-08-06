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
  {
    label: t('share.totalCommits'),
    value: formatNumber(props.data.totalCommits),
    accent: true,
  },
  {
    label: t('share.languages'),
    value: formatNumber(props.data.languageCount),
    accent: false,
  },
  {
    label: t('share.activeDays'),
    value: formatNumber(props.data.activeDays),
    accent: false,
  },
  {
    label: t('share.longestStreak'),
    value: `${props.data.longestStreak}`,
    unit: t('common.unitDays'),
    accent: false,
  },
])

/** 装饰用热力点阵：由提交数派生，导出时稳定可复现 */
const heatCells = computed(() => {
  const seed = Math.max(1, props.data.totalCommits + props.data.activeDays * 7 + props.data.year)
  const cells: number[] = []
  let x = seed % 2147483647
  for (let i = 0; i < 84; i++) {
    x = (x * 48271) % 2147483647
    cells.push((x % 5) / 4)
  }
  return cells
})

const langPalette = ['#0d9488', '#38bdf8', '#f59e0b']
</script>

<template>
  <div
    class="share-poster relative flex flex-col overflow-hidden text-white"
    style="width: 1200px; height: 630px; font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0b1220;"
  >
    <!-- 氛围底 -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        class="absolute inset-0"
        style="background:
          radial-gradient(900px 520px at 12% -8%, rgba(13,148,136,0.28), transparent 55%),
          radial-gradient(700px 480px at 92% 108%, rgba(56,189,248,0.12), transparent 50%),
          linear-gradient(160deg, #0b1220 0%, #111827 48%, #0b1220 100%);"
      />
      <!-- 左侧青绿竖条：海报签名 -->
      <div class="absolute inset-y-0 left-0 w-1.5" style="background: linear-gradient(180deg, #2dd4bf, #0d9488 40%, #0f766e);" />
      <!-- 热力点阵水印 -->
      <div
        class="absolute bottom-16 right-14 grid gap-1.5 opacity-40"
        style="grid-template-columns: repeat(14, 12px);"
      >
        <span
          v-for="(v, i) in heatCells"
          :key="i"
          class="h-3 w-3 rounded-sm"
          :style="{ background: `rgba(13, 148, 136, ${0.08 + v * 0.55})` }"
        />
      </div>
      <!-- 细网格 -->
      <div
        class="absolute inset-0 opacity-[0.04]"
        style="background-image:
          linear-gradient(rgba(248,250,252,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(248,250,252,0.5) 1px, transparent 1px);
          background-size: 48px 48px;"
      />
    </div>

    <!-- 主体 -->
    <div class="relative flex h-full flex-col px-16 py-12 pl-[72px]">
      <!-- 顶栏身份 -->
      <header class="flex items-center gap-6">
        <div
          class="flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-full text-4xl font-semibold"
          style="background: #1e293b; box-shadow: 0 0 0 3px rgba(13,148,136,0.45), 0 12px 40px rgba(0,0,0,0.35);"
        >
          <img
            v-if="data.avatarUrl && !data.hideIdentity"
            :src="data.avatarUrl"
            alt=""
            crossorigin="anonymous"
            class="h-full w-full object-cover"
          >
          <span v-else class="text-teal-200">{{ initials }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div
            class="text-[13px] font-semibold uppercase"
            style="letter-spacing: 0.28em; color: #2dd4bf;"
          >
            {{ t('share.archiveTitle', { year: data.year }) }}
          </div>
          <h1
            class="mt-1 truncate text-[52px] font-bold leading-none tracking-tight"
            style="color: #f8fafc;"
          >
            {{ displayName }}
          </h1>
          <div class="mt-3 flex items-center gap-2 text-[15px]" style="color: #94a3b8;">
            <GitBranch :size="15" :stroke-width="2" style="color: #0d9488;" />
            <span>{{ t('share.localNote') }}</span>
          </div>
        </div>
        <div class="hidden shrink-0 flex-col items-end sm:flex">
          <div class="text-[11px] font-semibold uppercase tracking-[0.2em]" style="color: #64748b;">
            GitUnite
          </div>
          <div class="mt-1 text-sm font-medium" style="color: #94a3b8;">
            Local Archive
          </div>
        </div>
      </header>

      <!-- KPI 海报数字 -->
      <section class="mt-10 grid grid-cols-4 gap-4">
        <div
          v-for="item in kpiItems"
          :key="item.label"
          class="relative overflow-hidden rounded-2xl px-5 py-5"
          style="background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.14);"
        >
          <div
            v-if="item.accent"
            class="absolute inset-x-0 top-0 h-0.5"
            style="background: linear-gradient(90deg, transparent, #2dd4bf, transparent);"
          />
          <div class="text-[11px] font-semibold uppercase tracking-[0.18em]" style="color: #64748b;">
            {{ item.label }}
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span
              class="gu-metric text-[42px] font-bold leading-none"
              :style="{ color: item.accent ? '#2dd4bf' : '#f1f5f9' }"
            >
              {{ item.value }}
            </span>
            <span
              v-if="item.unit"
              class="text-base font-medium"
              style="color: #64748b;"
            >{{ item.unit }}</span>
          </div>
        </div>
      </section>

      <!-- 底栏：语言 + 徽章 -->
      <footer class="mt-auto flex items-end justify-between gap-10 pt-8">
        <div class="min-w-0">
          <div class="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style="color: #64748b;">
            {{ t('share.topLanguages') }}
          </div>
          <div class="flex flex-wrap gap-2.5">
            <span
              v-for="(lang, i) in data.topLanguages.slice(0, 3)"
              :key="lang.language"
              class="inline-flex items-center rounded-full px-4 py-2 text-[15px] font-semibold text-white"
              :style="{ background: langPalette[i % langPalette.length] }"
            >
              {{ lang.language }}
              <span class="ml-2 opacity-80">{{ (lang.percentage * 100).toFixed(0) }}%</span>
            </span>
            <span v-if="!data.topLanguages.length" class="text-sm" style="color: #64748b;">
              {{ t('share.noLang') }}
            </span>
          </div>
        </div>

        <div class="shrink-0 text-right">
          <div class="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style="color: #64748b;">
            {{ t('share.badgesCumulative', { count: data.earnedBadges.length }) }}
          </div>
          <div class="flex justify-end gap-3">
            <div
              v-for="b in data.earnedBadges.slice(0, 5)"
              :key="b.id"
              class="flex h-[72px] w-[72px] items-center justify-center"
            >
              <img
                :src="`/badges/${b.id}.webp`"
                :alt="t(`badges.${b.id}.name`)"
                class="h-[68px] w-[68px] object-contain"
                style="filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));"
              >
            </div>
            <div
              v-if="data.earnedBadges.length > 5"
              class="flex h-[72px] w-[72px] items-center justify-center rounded-full text-lg font-bold"
              style="background: #0d9488; color: #ecfdf5; box-shadow: 0 8px 16px rgba(0,0,0,0.35);"
            >
              +{{ data.earnedBadges.length - 5 }}
            </div>
            <div
              v-if="!data.earnedBadges.length"
              class="text-sm"
              style="color: #64748b;"
            >
              {{ t('share.noBadge') }}
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.share-poster {
  background-color: #0b1220;
}
</style>
