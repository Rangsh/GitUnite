<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NCard, NSpace, NButton, NEmpty, NTag, NSpin, NGrid, NGi, NText,
  NRadioGroup, NRadio, NTooltip, NAlert,
} from 'naive-ui'
import { Moon } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import {
  computeActivity, computeBasicStats, computeLanguageTrend, computeLanguages,
  type AnalyticsScope,
} from '@/utils/analytics'
import { formatBytes, formatNumber, dayjs } from '@/utils/date'
import { LanguageDonut, HourlyBar, WeekdayBar, LanguageTrend } from '@/components/charts'
import StatCard from '@/components/common/StatCard.vue'

const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const trendGranularity = ref<'year' | 'quarter'>('year')

onMounted(async () => {
  await analytics.load()
})

watch(running, async (val, old) => {
  if (old && !val) await analytics.refresh()
})

const input = computed(() => ({
  repos: analytics.repos,
  commits: analytics.commits,
  repoStats: analytics.repoStats,
  codeDetailEnabled: ui.codeDetailEnabled,
  scope: scope.value,
  tz: timezone.value,
}))

const basic = computed(() => computeBasicStats(input.value))
const activity = computed(() => computeActivity(input.value))
const languages = computed(() => computeLanguages(input.value))
const trend = computed(() => computeLanguageTrend(input.value, trendGranularity.value))

const hasData = computed(() => analytics.commits.length > 0 || analytics.repos.length > 0)

const scopeTabs = computed(() => [
  { label: '聚合', value: 'all' as const },
  { label: 'GitHub', value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: 'Gitee', value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const goldenHourText = computed(() => {
  const g = activity.value.goldenHours
  if (g.count === 0) return '—'
  return `${String(g.start).padStart(2, '0')}:00 – ${String(g.end).padStart(2, '0')}:00`
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return dayjs(iso).format('YYYY-MM-DD')
}
</script>

<template>
  <NSpace vertical size="large">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-semibold m-0">数据看板</h1>
        <NText depth="3" class="text-sm">聚合统计你的提交行为、代码量、活跃度与技术栈</NText>
      </div>
      <NSpace align="center">
        <NRadioGroup v-model:value="scope" size="small">
          <NRadio
            v-for="t in scopeTabs"
            :key="t.value"
            :value="t.value"
            :disabled="t.disabled"
          >
            {{ t.label }}
          </NRadio>
        </NRadioGroup>
        <NButton size="small" type="primary" ghost :loading="running" @click="start()">
          同步
        </NButton>
      </NSpace>
    </div>

    <NSpin :show="analytics.loading">
      <div v-if="!hasData" class="py-16">
        <NEmpty description="还没有数据，请先在设置页连接账号并完成一次同步">
          <template #extra>
            <NButton type="primary" @click="start()" :loading="running">立即同步</NButton>
          </template>
        </NEmpty>
      </div>

      <NSpace v-else vertical size="large">
        <!-- 基础统计 -->
        <NGrid :cols="2" :s="4" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <StatCard label="仓库总数（不含 Fork）" :value="formatNumber(basic.repoCount)" :hint="`另有 ${basic.forkCount} 个 Fork`" icon="📁" accent="#3b82f6" />
          </NGi>
          <NGi>
            <StatCard label="总提交次数" :value="formatNumber(basic.commitCount)" icon="🔀" accent="#22c55e" />
          </NGi>
          <NGi>
            <StatCard label="代码新增行数" :value="formatNumber(basic.additions)" icon="➕" accent="#16a34a" />
          </NGi>
          <NGi>
            <StatCard label="代码删除行数" :value="formatNumber(basic.deletions)" icon="➖" accent="#ef4444" />
          </NGi>
          <NGi>
            <StatCard label="平均每次提交变更" :value="Math.round(basic.avgChanges).toLocaleString()" hint="行 / 提交" icon="📊" accent="#8b5cf6" />
          </NGi>
          <NGi>
            <StatCard label="活跃总天数" :value="formatNumber(activity.activeDays)" :hint="`日均 ${activity.avgCommitsPerDay.toFixed(1)} 次提交`" icon="📅" accent="#f59e0b" />
          </NGi>
          <NGi>
            <StatCard label="最长连续提交" :value="`${activity.longestStreak} 天`" :hint="activity.longestStreakStart ? `${formatDate(activity.longestStreakStart)} ~ ${formatDate(activity.longestStreakEnd)}` : ''" icon="🔥" accent="#f97316" />
          </NGi>
          <NGi>
            <StatCard label="当前连续提交" :value="`${activity.currentStreak} 天`" :hint="activity.currentStreak > 0 ? '保持住 🔥' : '最近两天未提交'" icon="⚡" accent="#ec4899" />
          </NGi>
        </NGrid>

        <NAlert v-if="!basic.hasCodeDetail" type="warning" :show-icon="true" class="!py-2">
          当前范围未开启代码行明细统计，代码量相关数据可能不完整。可在「设置 → 同步选项」中开启「代码行明细同步」。
        </NAlert>

        <!-- 活跃度 -->
        <NCard size="small" title="活跃度分析">
          <NSpace vertical size="medium">
            <NGrid :cols="2" :s="4" responsive="screen" :y-gap="8">
              <NGi>
                <div class="text-xs text-gray-500">首次提交</div>
                <div class="text-sm font-medium">{{ formatDate(activity.firstCommitAt) }}</div>
              </NGi>
              <NGi>
                <div class="text-xs text-gray-500">最近提交</div>
                <div class="text-sm font-medium">{{ formatDate(activity.lastCommitAt) }}</div>
              </NGi>
              <NGi>
                <div class="text-xs text-gray-500">编码黄金时段</div>
                <div class="text-sm font-medium">{{ goldenHourText }}</div>
              </NGi>
              <NGi>
                <div class="text-xs text-gray-500">深夜提交占比</div>
                <div class="text-sm font-medium">
                  {{ (activity.lateNightRatio * 100).toFixed(1) }}%
                  <NTooltip>
                    <template #trigger>
                      <Moon :size="13" class="inline ml-1 text-gray-400" />
                    </template>
                    本地时间 0:00–6:00 的提交占比
                  </NTooltip>
                </div>
              </NGi>
            </NGrid>

            <div>
              <div class="text-sm text-gray-600 mb-2">活跃时段分布（橙色为编码黄金时段）</div>
              <HourlyBar :data="activity.hourly" :golden-start="activity.goldenHours.start" />
            </div>
            <div>
              <div class="text-sm text-gray-600 mb-2">星期分布（周末为暖色）</div>
              <WeekdayBar :data="activity.weekday" />
            </div>
          </NSpace>
        </NCard>

        <!-- 语言与技术栈 -->
        <NGrid :cols="1" :m="2" responsive="screen" :x-gap="16">
          <NGi>
            <NCard size="small" title="语言占比">
              <LanguageDonut :data="languages" />
            </NCard>
          </NGi>
          <NGi>
            <NCard size="small" title="语言明细">
              <div class="space-y-2 max-h-[320px] overflow-auto">
                <div
                  v-for="(lang, i) in languages"
                  :key="lang.language"
                  class="flex items-center gap-3"
                >
                  <span class="w-5 text-xs text-gray-400">{{ i + 1 }}</span>
                  <span class="flex-1 text-sm truncate">{{ lang.language }}</span>
                  <span class="text-xs text-gray-400">{{ lang.repoCount }} 仓库</span>
                  <span class="text-xs text-gray-500 w-20 text-right">{{ formatBytes(lang.bytes) }}</span>
                  <div class="w-20 h-2 bg-gray-100 rounded overflow-hidden">
                    <div
                      class="h-full bg-brand-500 rounded"
                      :style="{ width: `${(lang.percentage * 100).toFixed(1)}%` }"
                    />
                  </div>
                  <span class="text-xs w-10 text-right">{{ (lang.percentage * 100).toFixed(1) }}%</span>
                </div>
                <div v-if="!languages.length" class="text-center text-gray-400 text-sm py-8">暂无语言数据</div>
              </div>
            </NCard>
          </NGi>
        </NGrid>

        <NCard size="small">
          <template #header>
            <div class="flex items-center justify-between">
              <span>技术栈趋势</span>
              <NRadioGroup v-model:value="trendGranularity" size="small">
                <NRadio value="year">按年</NRadio>
                <NRadio value="quarter">按季度</NRadio>
              </NRadioGroup>
            </div>
          </template>
          <LanguageTrend :data="trend" />
          <div v-if="trend.newLanguages.size" class="mt-2 flex items-center gap-2 flex-wrap">
            <NText depth="3" class="text-xs">✨ 最近时段新使用的语言：</NText>
            <NTag v-for="lang in trend.newLanguages" :key="lang" size="small" type="success">
              {{ lang }}
            </NTag>
          </div>
        </NCard>
      </NSpace>
    </NSpin>
  </NSpace>
</template>
