<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  NButton, NEmpty, NSpin, NTooltip, NTag,
} from 'naive-ui'
import {
  Activity, CalendarRange, Flame, FolderGit2,
  GitCommitHorizontal, Minus, Moon, Plus, RefreshCw, Zap,
} from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import {
  computeActivity, computeBasicStats, computeLanguageTrend, computeLanguages,
  type ActivityStats, type AnalyticsScope, type BasicStats, type LanguageStat, type LanguageTrendResult,
} from '@/utils/analytics'
import { formatBytes, formatNumber, localDateKey } from '@/utils/date'
import { LanguageDonut, HourlyBar, WeekdayBar, LanguageTrend } from '@/components/charts'
import StatCard from '@/components/common/StatCard.vue'

const { t, locale } = useI18n()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const trendGranularity = ref<'year' | 'quarter'>('year')
const computing = ref(false)

const emptyActivity: ActivityStats = {
  firstCommitAt: null,
  lastCommitAt: null,
  activeDays: 0,
  avgCommitsPerDay: 0,
  longestStreak: 0,
  longestStreakStart: null,
  longestStreakEnd: null,
  currentStreak: 0,
  hourly: new Array(24).fill(0),
  weekday: new Array(7).fill(0),
  goldenHours: { start: 9, end: 12, count: 0 },
  lateNightRatio: 0,
}

const basic = shallowRef<BasicStats>({
  repoCount: 0,
  forkCount: 0,
  commitCount: 0,
  additions: 0,
  deletions: 0,
  avgChanges: 0,
  hasCodeDetail: true,
})
const activity = shallowRef<ActivityStats>(emptyActivity)
const languages = shallowRef<LanguageStat[]>([])
const trend = shallowRef<LanguageTrendResult>({
  languages: [],
  periods: [],
  series: {},
  newLanguages: new Set(),
})

let computeToken = 0

function yieldToMain() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function recompute() {
  const token = ++computeToken
  const input = {
    repos: analytics.repos,
    commits: analytics.commits,
    repoStats: analytics.repoStats,
    codeDetailEnabled: ui.codeDetailEnabled,
    scope: scope.value,
    tz: timezone.value,
  }

  if (!input.repos.length && !input.commits.length) {
    basic.value = {
      repoCount: 0,
      forkCount: 0,
      commitCount: 0,
      additions: 0,
      deletions: 0,
      avgChanges: 0,
      hasCodeDetail: true,
    }
    activity.value = emptyActivity
    languages.value = []
    trend.value = { languages: [], periods: [], series: {}, newLanguages: new Set() }
    computing.value = false
    return
  }

  computing.value = true
  await yieldToMain()
  if (token !== computeToken) return

  try {
    basic.value = computeBasicStats(input)
  }
  catch (e) {
    console.error('[dashboard] basic stats failed', e)
  }
  await yieldToMain()
  if (token !== computeToken) return

  try {
    activity.value = computeActivity(input)
  }
  catch (e) {
    console.error('[dashboard] activity failed', e)
    activity.value = emptyActivity
  }
  await yieldToMain()
  if (token !== computeToken) return

  try {
    languages.value = computeLanguages(input)
  }
  catch (e) {
    console.error('[dashboard] languages failed', e)
    languages.value = []
  }
  await yieldToMain()
  if (token !== computeToken) return

  try {
    trend.value = computeLanguageTrend(input, trendGranularity.value)
  }
  catch (e) {
    console.error('[dashboard] trend failed', e)
    trend.value = { languages: [], periods: [], series: {}, newLanguages: new Set() }
  }
  if (token === computeToken) computing.value = false
}

onUnmounted(() => {
  computeToken++
})

watch(
  () => [
    analytics.loadedAt,
    analytics.repos.length,
    analytics.commits.length,
    scope.value,
    trendGranularity.value,
    timezone.value,
    ui.codeDetailEnabled,
  ],
  () => {
    void recompute()
  },
  { immediate: true },
)

const hasData = computed(() => analytics.commits.length > 0 || analytics.repos.length > 0)

/** 本地库存量：证明看板读的是同步下来的真实数据，不是假数 */
const dataProvenance = computed(() => {
  const repos = analytics.repos
  const commits = analytics.commits
  const by = (p: 'github' | 'gitee') => ({
    repos: repos.filter(r => r.platform === p).length,
    commits: commits.filter(c => c.platform === p).length,
  })
  return {
    github: by('github'),
    gitee: by('gitee'),
    stats: analytics.repoStats.length,
    loadedAt: analytics.loadedAt,
  }
})

const scopeTabs = computed(() => [
  { label: t('common.aggregate'), value: 'all' as const },
  { label: t('common.github'), value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: t('common.gitee'), value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const syncLabel = computed(() => {
  if (scope.value === 'github') return t('common.syncPlatform', { name: t('common.github') })
  if (scope.value === 'gitee') return t('common.syncPlatform', { name: t('common.gitee') })
  return t('common.syncOne')
})

function syncByScope() {
  if (scope.value === 'all') void start()
  else void start(scope.value)
}

const goldenHourText = computed(() => {
  const g = activity.value.goldenHours
  if (g.count === 0) return '—'
  return `${String(g.start).padStart(2, '0')}:00 – ${String(g.end).padStart(2, '0')}:00`
})

const langPalette = [
  '#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1',
  '#10b981', '#f97316', '#64748b', '#06b6d4', '#84cc16',
]

function langColor(i: number) {
  return langPalette[i % langPalette.length]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  return localDateKey(iso, timezone.value)
}
</script>

<template>
  <div class="dashboard mx-auto max-w-[1400px] space-y-6">
    <!-- Header -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Coding Archive
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          {{ t('dashboard.title') }}
        </h1>
        <p class="mt-1.5 max-w-xl text-sm text-ink-500">
          {{ t('dashboard.subtitle') }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-panel">
          <button
            v-for="tab in scopeTabs"
            :key="tab.value"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="scope === tab.value
              ? 'bg-ink-900 text-white shadow-sm'
              : tab.disabled
                ? 'cursor-not-allowed text-ink-300'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'"
            :disabled="tab.disabled"
            @click="scope = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <NButton
          type="primary"
          :loading="running"
          class="!h-9 !rounded-xl !px-4"
          @click="syncByScope"
        >
          <template #icon>
            <RefreshCw :size="15" />
          </template>
          {{ syncLabel }}
        </NButton>
      </div>
    </header>

    <NSpin :show="(analytics.loading || computing) && !hasData">
      <!-- Empty -->
      <div
        v-if="!hasData && !analytics.loading && !computing"
        class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-20 text-center animate-fade-up"
      >
        <NEmpty :description="`${t('dashboard.emptyTitle')}. ${t('dashboard.emptyDesc')}`">
          <template #extra>
            <NButton type="primary" class="!rounded-xl" :loading="running" @click="syncByScope">
              {{ syncLabel }}
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div v-else-if="hasData" class="space-y-6">
        <!-- 数据来源说明 -->
        <section
          class="rounded-2xl border border-ink-200/80 bg-white/90 px-5 py-4 shadow-panel animate-fade-up"
          style="animation-delay: 20ms"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="m-0 text-sm font-semibold text-ink-900">{{ t('dashboard.dataSource') }}</h2>
            <div class="gu-metric text-[11px] text-ink-400">
              {{ dataProvenance.loadedAt
                ? t('dashboard.loadedAt', { time: new Date(dataProvenance.loadedAt).toLocaleString(locale) })
                : t('dashboard.notLoaded') }}
            </div>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <div class="rounded-xl bg-ink-50 px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{{ t('common.github') }}</div>
              <div class="gu-metric mt-1 text-sm text-ink-800">
                {{ t('dashboard.repoCommitSummary', {
                  repos: dataProvenance.github.repos,
                  commits: formatNumber(dataProvenance.github.commits),
                }) }}
              </div>
            </div>
            <div class="rounded-xl bg-ink-50 px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{{ t('common.gitee') }}</div>
              <div class="gu-metric mt-1 text-sm text-ink-800">
                {{ t('dashboard.repoCommitSummary', {
                  repos: dataProvenance.gitee.repos,
                  commits: formatNumber(dataProvenance.gitee.commits),
                }) }}
              </div>
            </div>
            <div class="rounded-xl bg-ink-50 px-3 py-2">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{{ t('dashboard.githubWeeklyStats') }}</div>
              <div class="gu-metric mt-1 text-sm text-ink-800">
                {{ t('dashboard.reposWithLines', { count: dataProvenance.stats }) }}
              </div>
            </div>
          </div>
        </section>

        <!-- Primary KPIs -->
        <section
          class="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-up"
          style="animation-delay: 40ms"
        >
          <StatCard
            :label="t('dashboard.commits')"
            :value="formatNumber(basic.commitCount)"
            :icon="GitCommitHorizontal"
            tone="accent"
          />
          <StatCard
            :label="t('dashboard.repos')"
            :value="formatNumber(basic.repoCount)"
            :hint="t('dashboard.forkHint', { count: basic.forkCount })"
            :icon="FolderGit2"
          />
          <StatCard
            :label="t('dashboard.longestStreak')"
            :value="`${activity.longestStreak} ${t('common.unitDays')}`"
            :hint="activity.longestStreakStart ? `${formatDate(activity.longestStreakStart)} → ${formatDate(activity.longestStreakEnd)}` : undefined"
            :icon="Flame"
            tone="success"
          />
          <StatCard
            :label="t('dashboard.activeDays')"
            :value="formatNumber(activity.activeDays)"
            :hint="t('dashboard.dailyAvgHint', { avg: activity.avgCommitsPerDay.toFixed(1) })"
            :icon="CalendarRange"
          />
        </section>

        <!-- Secondary metrics -->
        <section
          class="grid grid-cols-2 gap-3 md:grid-cols-4 animate-fade-up"
          style="animation-delay: 80ms"
        >
          <StatCard
            variant="compact"
            :label="t('dashboard.additions')"
            :value="formatNumber(basic.additions)"
            :icon="Plus"
            tone="success"
          />
          <StatCard
            variant="compact"
            :label="t('dashboard.deletions')"
            :value="formatNumber(basic.deletions)"
            :icon="Minus"
            tone="danger"
          />
          <StatCard
            variant="compact"
            :label="t('dashboard.avgChanges')"
            :value="Math.round(basic.avgChanges).toLocaleString(locale)"
            :hint="t('dashboard.linesPerCommit')"
            :icon="Activity"
          />
          <StatCard
            variant="compact"
            :label="t('dashboard.currentStreak')"
            :value="`${activity.currentStreak} ${t('common.unitDays')}`"
            :hint="activity.currentStreak > 0 ? t('dashboard.streakKeep') : t('dashboard.streakBroken')"
            :icon="Zap"
            tone="accent"
          />
        </section>

        <div
          v-if="!basic.hasCodeDetail"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ t('dashboard.codeDetailIncomplete') }}
        </div>

        <!-- Activity -->
        <section
          class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel animate-fade-up"
          style="animation-delay: 120ms"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 class="m-0 text-base font-semibold text-ink-900">{{ t('dashboard.activity') }}</h2>
              <p class="mt-0.5 text-xs text-ink-400">{{ t('dashboard.activityHint') }}</p>
            </div>
            <div class="flex flex-wrap gap-4 text-sm">
              <div>
                <div class="text-[10px] uppercase tracking-wider text-ink-400">{{ t('dashboard.firstCommit') }}</div>
                <div class="gu-metric font-medium text-ink-800">{{ formatDate(activity.firstCommitAt) }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-ink-400">{{ t('dashboard.lastCommit') }}</div>
                <div class="gu-metric font-medium text-ink-800">{{ formatDate(activity.lastCommitAt) }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-ink-400">{{ t('dashboard.goldenHours') }}</div>
                <div class="gu-metric font-medium text-brand-700">{{ goldenHourText }}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-ink-400">
                  {{ t('dashboard.nightRatio') }}
                  <NTooltip>
                    <template #trigger>
                      <Moon :size="11" class="ml-0.5 inline text-ink-400" />
                    </template>
                    {{ t('dashboard.nightHoursTooltip') }}
                  </NTooltip>
                </div>
                <div class="gu-metric font-medium text-ink-800">
                  {{ (activity.lateNightRatio * 100).toFixed(1) }}%
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-6 p-5 lg:grid-cols-2">
            <div>
              <div class="mb-3 flex items-center gap-2 text-xs font-medium text-ink-500">
                <span class="inline-block h-2 w-2 rounded-full bg-brand-600" />
                {{ t('dashboard.hourlyDist') }}
                <span class="font-normal text-ink-400">{{ t('dashboard.goldenHighlight') }}</span>
              </div>
              <HourlyBar :data="activity.hourly" :golden-start="activity.goldenHours.start" />
            </div>
            <div>
              <div class="mb-3 flex items-center gap-2 text-xs font-medium text-ink-500">
                <span class="inline-block h-2 w-2 rounded-full bg-ink-700" />
                {{ t('dashboard.weekdayDist') }}
                <span class="font-normal text-ink-400">{{ t('dashboard.weekendWarm') }}</span>
              </div>
              <WeekdayBar :data="activity.weekday" />
            </div>
          </div>
        </section>

        <!-- Languages -->
        <section
          class="grid gap-4 lg:grid-cols-5 animate-fade-up"
          style="animation-delay: 160ms"
        >
          <div class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel lg:col-span-2">
            <div class="border-b border-ink-100 px-5 py-4">
              <h2 class="m-0 text-base font-semibold text-ink-900">{{ t('dashboard.languages') }}</h2>
              <p class="mt-0.5 text-xs text-ink-400">{{ t('dashboard.languagesWeighted') }}</p>
            </div>
            <div class="p-3">
              <LanguageDonut :data="languages" height="280px" />
            </div>
          </div>

          <div class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel lg:col-span-3">
            <div class="border-b border-ink-100 px-5 py-4">
              <h2 class="m-0 text-base font-semibold text-ink-900">{{ t('dashboard.topLanguages') }}</h2>
              <p class="mt-0.5 text-xs text-ink-400">{{ t('dashboard.topLanguagesHint') }}</p>
            </div>
            <div class="max-h-[320px] space-y-1 overflow-auto p-3">
              <div
                v-for="(lang, i) in languages"
                :key="lang.language"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-ink-50"
              >
                <span
                  class="gu-metric w-6 text-xs font-medium text-ink-400"
                >{{ String(i + 1).padStart(2, '0') }}</span>
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ background: langColor(i) }"
                />
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                  {{ lang.language }}
                </span>
                <span class="hidden text-xs text-ink-400 sm:inline">{{ t('dashboard.repoCountShort', { count: lang.repoCount }) }}</span>
                <span class="gu-metric w-16 text-right text-xs text-ink-500">
                  {{ formatBytes(lang.bytes) }}
                </span>
                <div class="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ink-100 sm:block">
                  <div
                    class="h-full rounded-full"
                    :style="{
                      width: `${Math.max(lang.percentage * 100, 1).toFixed(1)}%`,
                      background: langColor(i),
                    }"
                  />
                </div>
                <span class="gu-metric w-12 text-right text-xs font-medium text-ink-700">
                  {{ (lang.percentage * 100).toFixed(1) }}%
                </span>
              </div>
              <div v-if="!languages.length" class="py-16 text-center text-sm text-ink-400">
                {{ t('dashboard.noLanguageData') }}
              </div>
            </div>
          </div>
        </section>

        <!-- Trend -->
        <section
          class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel animate-fade-up"
          style="animation-delay: 200ms"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 class="m-0 text-base font-semibold text-ink-900">{{ t('dashboard.trend') }}</h2>
              <p class="mt-0.5 text-xs text-ink-400">{{ t('dashboard.trendHint') }}</p>
            </div>
            <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
              <button
                type="button"
                class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                :class="trendGranularity === 'year' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'"
                @click="trendGranularity = 'year'"
              >
                {{ t('dashboard.byYear') }}
              </button>
              <button
                type="button"
                class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                :class="trendGranularity === 'quarter' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'"
                @click="trendGranularity = 'quarter'"
              >
                {{ t('dashboard.byQuarter') }}
              </button>
            </div>
          </div>
          <div class="p-5">
            <LanguageTrend :data="trend" />
            <div v-if="trend.newLanguages.size" class="mt-4 flex flex-wrap items-center gap-2">
              <span class="text-xs text-ink-400">{{ t('dashboard.newThisPeriod') }}</span>
              <NTag
                v-for="lang in trend.newLanguages"
                :key="lang"
                size="small"
                :bordered="false"
                class="!rounded-lg !bg-brand-50 !text-brand-700"
              >
                {{ lang }}
              </NTag>
            </div>
          </div>
        </section>
      </div>
    </NSpin>
  </div>
</template>
