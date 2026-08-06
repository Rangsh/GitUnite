<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NEmpty, NSpin, NTag, NText, NTooltip,
} from 'naive-ui'
import {
  Award, CalendarDays, CalendarRange, Code2, FileCode2,
  Flame, GitCommitHorizontal, Moon, Plus, Sun,
} from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { achievementRepo } from '@/db/repositories'
import { availableYears, computeYearbook, yearbookStory, type YearbookData } from '@/utils/yearbook'
import { evaluateBadges, type BadgeStatus } from '@/utils/badges'
import type { AnalyticsScope } from '@/utils/analytics'
import { resolveTimezone, dayjs, formatNumber } from '@/utils/date'
import { runInAnalyticsWorker } from '@/workers/runAnalytics'
import { WordCloud } from '@/components/charts'
import StatCard from '@/components/common/StatCard.vue'
import BadgeCard from '@/components/yearbook/BadgeCard.vue'
import SyncButton from '@/components/sync/SyncButton.vue'

const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const currentYear = dayjs().tz(resolveTimezone()).year()
const year = ref(currentYear)
const computing = ref(false)

const data = shallowRef<YearbookData | null>(null)
const badges = shallowRef<BadgeStatus[]>([])

let computeToken = 0
function yieldToMain() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

async function recompute() {
  const token = ++computeToken
  if (!analytics.commits.length) {
    data.value = null
    badges.value = []
    computing.value = false
    return
  }

  const yearList = availableYears(analytics.commits, timezone.value)
  if (!yearList.includes(year.value)) year.value = yearList[0]

  computing.value = true
  await yieldToMain()
  if (token !== computeToken) return

  const baseInput = {
    repos: analytics.repos,
    commits: analytics.commits,
    repoStats: analytics.repoStats,
    codeDetailEnabled: ui.codeDetailEnabled,
    tz: timezone.value,
  }

  try {
    try {
      data.value = await runInAnalyticsWorker<YearbookData>({
        type: 'yearbook',
        payload: { ...baseInput, scope: scope.value, year: year.value },
      })
    }
    catch {
      data.value = computeYearbook({ ...baseInput, scope: scope.value, year: year.value })
    }
  }
  catch (e) {
    console.error('[yearbook] compute failed', e)
    data.value = null
  }
  await yieldToMain()
  if (token !== computeToken) return

  try {
    // 徽章含 Vue 组件引用，不能走 Worker structured clone；主线程计算即可
    const badgeInput = {
      ...baseInput,
      me: {
        github: auth.user('github')?.login ?? null,
        gitee: auth.user('gitee')?.login ?? null,
      },
    }
    badges.value = evaluateBadges(badgeInput)
    // 持久化：首次达成时间不覆盖
    const now = new Date().toISOString()
    const existing = await achievementRepo.all()
    const existingMap = new Map(existing.map(e => [e.id, e]))
    void achievementRepo.bulkPut(
      badges.value
        .filter(b => b.earned)
        .map(b => ({
          id: b.id,
          achievedAt: existingMap.get(b.id)?.achievedAt ?? b.achievedAt,
          updatedAt: now,
        })),
    )
  }
  catch (e) {
    console.error('[yearbook] badges failed', e)
    badges.value = []
  }

  if (token === computeToken) computing.value = false
}

onUnmounted(() => {
  computeToken++
})

watch(
  () => [analytics.loadedAt, analytics.commits.length, scope.value, year.value, timezone.value, ui.codeDetailEnabled],
  () => void recompute(),
  { immediate: true },
)

const hasData = computed(() => analytics.commits.length > 0)

const years = computed(() => availableYears(analytics.commits, timezone.value))

const scopeTabs = computed(() => [
  { label: '聚合', value: 'all' as const },
  { label: 'GitHub', value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: 'Gitee', value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const earnedCount = computed(() => badges.value.filter(b => b.earned).length)

const sortedBadges = computed(() =>
  [...badges.value].sort((a, b) => Number(b.earned) - Number(a.earned)))

const story = computed(() => (data.value ? yearbookStory(data.value) : ''))

const mostActiveMonthText = computed(() =>
  data.value?.mostActiveMonth != null ? MONTHS[data.value.mostActiveMonth] : '—')
const mostActiveWeekdayText = computed(() =>
  data.value?.mostActiveWeekday != null ? WEEKDAYS[data.value.mostActiveWeekday] : '—')
const mostActiveHourText = computed(() =>
  data.value?.mostActiveHour != null ? `${String(data.value.mostActiveHour).padStart(2, '0')}:00` : '—')
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          <Award :size="13" /> Yearbook
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">年度报告</h1>
        <p class="mt-1.5 text-sm text-ink-500">
          按本地时区归桶的年度编程年鉴，与累计成就徽章
        </p>
      </div>
      <SyncButton :platform="scope === 'all' ? undefined : scope" />
    </header>

    <NSpin :show="(analytics.loading || computing) && !data">
      <div
        v-if="!hasData && !analytics.loading && !computing"
        class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-20 text-center animate-fade-up"
      >
        <NEmpty description="还没有提交数据。同步后生成你的编程年鉴。">
          <template #extra>
            <div class="mt-3 flex justify-center">
              <SyncButton />
            </div>
          </template>
        </NEmpty>
      </div>

      <div v-else class="space-y-5">
        <!-- 年份 + 平台切换 -->
        <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200/80 bg-white px-5 py-3 shadow-panel">
          <div class="inline-flex flex-wrap rounded-lg border border-ink-200 bg-ink-50 p-0.5">
            <button
              v-for="y in years"
              :key="y"
              type="button"
              class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              :class="year === y ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:bg-ink-50'"
              @click="year = y"
            >
              {{ y }} 年
            </button>
          </div>
          <div class="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
            <button
              v-for="t in scopeTabs"
              :key="t.value"
              type="button"
              class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              :class="scope === t.value
                ? 'bg-ink-900 text-white'
                : t.disabled ? 'cursor-not-allowed text-ink-300' : 'text-ink-500 hover:bg-ink-50'"
              :disabled="t.disabled"
              @click="scope = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </section>

        <template v-if="data && data.hasData">
          <!-- 年度故事 -->
          <section class="rounded-2xl border border-brand-200/80 bg-gradient-to-br from-brand-50 to-white px-5 py-4 shadow-panel animate-fade-up">
            <p class="m-0 text-sm leading-relaxed text-ink-700">
              <span class="mr-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">Year Story</span>
              {{ story }}
            </p>
          </section>

          <!-- 年度 KPI -->
          <section class="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-up" style="animation-delay: 60ms">
            <StatCard
              :label="`${data.year} 年提交`"
              :value="formatNumber(data.commitCount)"
              :icon="GitCommitHorizontal"
              tone="accent"
            />
            <StatCard
              label="新增行"
              :value="formatNumber(data.additions)"
              :icon="Plus"
              tone="success"
            />
            <StatCard
              label="删除行"
              :value="formatNumber(data.deletions)"
              :icon="Code2"
              tone="danger"
            />
            <StatCard
              label="最长连续"
              :value="`${data.longestStreak} 天`"
              :hint="data.longestStreakStart ? `${data.longestStreakStart} → ${data.longestStreakEnd}` : undefined"
              :icon="Flame"
              tone="accent"
            />
          </section>

          <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              variant="compact"
              label="活跃天数"
              :value="`${data.activeDays} 天`"
              :hint="`占全年 ${(data.activeDaysRatio * 100).toFixed(1)}%`"
              :icon="CalendarRange"
            />
            <StatCard
              variant="compact"
              label="最活跃月份"
              :value="mostActiveMonthText"
              :icon="Sun"
              tone="accent"
            />
            <StatCard
              variant="compact"
              label="最活跃星期"
              :value="mostActiveWeekdayText"
              :icon="CalendarDays"
            />
            <StatCard
              variant="compact"
              label="最活跃时段"
              :value="mostActiveHourText"
              :icon="Moon"
              tone="accent"
            />
          </section>

          <!-- 节奏 + 语言 -->
          <section class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-panel">
              <h2 class="m-0 text-base font-semibold text-ink-900">编码节奏</h2>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-xl bg-ink-50 p-4">
                  <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
                    <Moon :size="12" /> 深夜占比
                    <NTooltip>
                      <template #trigger>
                        <span class="cursor-help text-ink-300">ⓘ</span>
                      </template>
                      本地时间 0:00–6:00 的提交占比
                    </NTooltip>
                  </div>
                  <div class="gu-metric mt-1 text-2xl font-semibold text-ink-900">
                    {{ (data.lateNightRatio * 100).toFixed(1) }}%
                  </div>
                </div>
                <div class="rounded-xl bg-ink-50 p-4">
                  <div class="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
                    <CalendarDays :size="12" /> 周末占比
                  </div>
                  <div class="gu-metric mt-1 text-2xl font-semibold text-ink-900">
                    {{ (data.weekendRatio * 100).toFixed(1) }}%
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-panel">
              <h2 class="m-0 text-base font-semibold text-ink-900">语言与仓库</h2>
              <div class="mt-4 space-y-3">
                <div>
                  <div class="mb-1.5 text-xs text-ink-400">Top 5 语言（按提交数）</div>
                  <div class="flex flex-wrap gap-1.5">
                    <NTag
                      v-for="(l, i) in data.topLanguages"
                      :key="l.language"
                      :bordered="false"
                      class="!rounded-lg"
                      :style="{ background: ['#ccfbf1', '#e0f2fe', '#fef3c7', '#e2e8f0', '#f1f5f9'][i % 5], color: '#0f172a' }"
                    >
                      {{ l.language }} · {{ l.count }}
                    </NTag>
                    <NText v-if="!data.topLanguages.length" depth="3" class="text-xs">暂无</NText>
                  </div>
                </div>
                <div>
                  <div class="mb-1.5 text-xs text-ink-400">今年新使用的语言</div>
                  <div class="flex flex-wrap gap-1.5">
                    <NTag
                      v-for="lang in data.newLanguages"
                      :key="lang"
                      size="small"
                      :bordered="false"
                      class="!rounded-lg !bg-brand-50 !text-brand-700"
                    >
                      {{ lang }}
                    </NTag>
                    <NText v-if="!data.newLanguages.length" depth="3" class="text-xs">今年没有新语言</NText>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3 pt-1">
                  <div class="rounded-xl bg-ink-50 p-3">
                    <div class="text-[11px] uppercase tracking-wider text-ink-400">贡献仓库</div>
                    <div class="gu-metric mt-0.5 text-xl font-semibold text-ink-900">{{ data.contributedRepoCount }}</div>
                  </div>
                  <div class="rounded-xl bg-ink-50 p-3">
                    <div class="text-[11px] uppercase tracking-wider text-ink-400">首次贡献新仓库</div>
                    <div class="gu-metric mt-0.5 text-xl font-semibold text-ink-900">{{ data.newRepoCount }}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 词云 -->
          <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
            <div class="border-b border-ink-100 px-5 py-4">
              <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-ink-900">
                <FileCode2 :size="17" /> Commit 词云
              </h2>
              <p class="mt-0.5 text-xs text-ink-400">已去除 merge / fix / update 等停用词</p>
            </div>
            <WordCloud :data="data.words" height="340px" />
          </section>
        </template>

        <div
          v-else-if="data && !data.hasData"
          class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-16 text-center"
        >
          <NEmpty :description="`${year} 年没有提交记录，可切换上方年份查看`">
            <template #extra>
              <div class="mt-3 flex justify-center">
                <SyncButton :platform="scope === 'all' ? undefined : scope" />
              </div>
            </template>
          </NEmpty>
        </div>

        <!-- 徽章：全生涯累计 -->
        <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel animate-fade-up" style="animation-delay: 120ms">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-ink-900">
                <Award :size="17" /> 成就徽章
              </h2>
              <p class="mt-0.5 text-xs text-ink-400">基于全平台累计数据本地计算，已获得 {{ earnedCount }} / {{ badges.length }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
            <BadgeCard
              v-for="b in sortedBadges"
              :key="b.id"
              :badge="b"
            />
          </div>
        </section>
      </div>
    </NSpin>
  </div>
</template>
