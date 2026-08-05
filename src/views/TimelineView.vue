<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NButton, NEmpty, NSpin, NRadioGroup, NRadio, NInput,
  NText, NTag, NDrawer, NDrawerContent, NIcon,
} from 'naive-ui'
import { Search, ExternalLink, GitCommit, ChevronDown, ChevronRight, RefreshCw } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import {
  computeDailyBuckets, computeHeatmap, isMergeCommit,
  type AnalyticsScope, type DailyBucket, type HeatmapPoint,
} from '@/utils/analytics'
import { createTzHelpers, formatNumber, resolveTimezone, dayjs } from '@/utils/date'
import { HeatmapChart } from '@/components/charts'
import { Github, Gitee } from '@/components/common/PlatformIcon'

const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const metric = ref<'commits' | 'code'>('commits')
/** 自然年，默认当前年 */
const selectedYear = ref(dayjs().tz(resolveTimezone()).year())
const colorTheme = ref<'default' | 'colorblind' | 'dark'>('default')
const keyword = ref('')
const mergeFilter = ref<'all' | 'merge' | 'non-merge'>('all')
const computing = ref(false)

const selectedDate = ref<string | null>(null)
const drawerShow = ref(false)
const expandedCommits = ref<Set<string>>(new Set())

const heatmap = shallowRef<HeatmapPoint[]>([])
const dailyBuckets = shallowRef<Map<string, DailyBucket>>(new Map())

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

  if (!input.commits.length) {
    heatmap.value = []
    dailyBuckets.value = new Map()
    computing.value = false
    return
  }

  computing.value = true
  await yieldToMain()
  if (token !== computeToken) return

  dailyBuckets.value = computeDailyBuckets(input)
  await yieldToMain()
  if (token !== computeToken) return

  heatmap.value = computeHeatmap(input, selectedYear.value)
  if (token === computeToken) computing.value = false
}

onUnmounted(() => {
  computeToken++
})

watch(
  () => [
    analytics.loadedAt,
    analytics.commits.length,
    scope.value,
    selectedYear.value,
    timezone.value,
    ui.codeDetailEnabled,
  ],
  () => {
    void recompute()
  },
  { immediate: true },
)

const repoMap = computed(() => new Map(analytics.repos.map(r => [r.id, r])))
const hasData = computed(() => analytics.commits.length > 0)

const dataProvenance = computed(() => {
  const commits = analytics.commits
  return {
    github: commits.filter(c => c.platform === 'github').length,
    gitee: commits.filter(c => c.platform === 'gitee').length,
    days: dailyBuckets.value.size,
  }
})

/** 仅按钮触发远程同步；Gitee 本地仍为 0 时自动全量补历史，其余走增量 */
function syncByScope() {
  const giteeEmpty = dataProvenance.value.gitee === 0
  const needFull = scope.value === 'gitee'
    ? giteeEmpty
    : scope.value === 'all'
      ? giteeEmpty
      : false
  const opts = { fullHistory: needFull }
  if (scope.value === 'all') void start(undefined, opts)
  else void start(scope.value, opts)
}

const syncLabel = computed(() => {
  if (scope.value === 'github') return '同步 GitHub'
  if (scope.value === 'gitee') {
    return dataProvenance.value.gitee === 0 ? '全量同步 Gitee' : '同步 Gitee'
  }
  return dataProvenance.value.gitee === 0 ? '同步全部（含 Gitee 全量）' : '同步全部'
})

function onSelectDate(date: string) {
  selectedDate.value = date
  drawerShow.value = true
}

const selectedBucket = computed(() => {
  if (!selectedDate.value) return null
  return dailyBuckets.value.get(selectedDate.value) ?? null
})

const filteredCommits = computed(() => {
  const b = selectedBucket.value
  if (!b) return []
  const tz = createTzHelpers(timezone.value)
  let list = [...b.commits].sort((a, b) =>
    new Date(b.authoredAt).getTime() - new Date(a.authoredAt).getTime())

  if (mergeFilter.value === 'merge') {
    list = list.filter(c => isMergeCommit(c.message))
  }
  else if (mergeFilter.value === 'non-merge') {
    list = list.filter(c => !isMergeCommit(c.message))
  }

  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(c => c.message.toLowerCase().includes(kw))
  }

  // 再保险：只保留真正落在选中本地日的提交（防止旧数据时区错位）
  if (selectedDate.value) {
    list = list.filter(c => tz.dateKey(c.authoredAt) === selectedDate.value)
  }
  return list
})

function toggleExpand(id: string) {
  const next = new Set(expandedCommits.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedCommits.value = next
}

function firstLine(msg: string) {
  return msg.split('\n', 1)[0]
}
function body(msg: string) {
  const idx = msg.indexOf('\n')
  return idx >= 0 ? msg.slice(idx + 1).trim() : ''
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlight(text: string) {
  const escaped = escapeHtml(text)
  const kw = keyword.value.trim()
  if (!kw) return escaped
  const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(re, '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>')
}

function timeStr(iso: string) {
  const tz = createTzHelpers(timezone.value)
  const hour = String(tz.hour(iso)).padStart(2, '0')
  // 分钟仍用 Date 本地解析 ISO 的 UTC 时刻再格式化到目标时区
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone.value?.trim() || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const hh = parts.find(p => p.type === 'hour')?.value ?? hour
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${hh}:${mm}`
}

const legend = computed(() => {
  if (!heatmap.value.length) return [0, 1]
  const max = metric.value === 'commits'
    ? Math.max(...heatmap.value.map(p => p.commits), 1)
    : Math.max(...heatmap.value.map(p => p.additions + p.deletions), 1)
  if (max === 1) return [0, 1]
  return [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), max]
})

const yearOptions = computed(() => {
  const current = dayjs().tz(resolveTimezone(timezone.value)).year()
  // 当前年往前共 4 个自然年：如 2026 / 2025 / 2024 / 2023
  return [current, current - 1, current - 2, current - 3]
})

const rangeLabel = computed(() => `${selectedYear.value} 年`)
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Commit Timeline
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">提交时间轴</h1>
        <p class="mt-1.5 text-sm text-ink-500">
          按本地时区归桶；点击日期查看当天真实提交
        </p>
      </div>
      <NButton type="primary" class="!rounded-xl" :loading="running" @click="syncByScope">
        <template #icon><RefreshCw :size="15" /></template>
        {{ syncLabel }}
      </NButton>
    </header>

    <NSpin :show="(analytics.loading || computing) && !hasData">
      <div
        v-if="!hasData && !analytics.loading && !computing"
        class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-16 text-center"
      >
        <NEmpty description="还没有提交数据。请按当前视角做一次全量同步。">
          <template #extra>
            <NButton type="primary" class="!rounded-xl" :loading="running" @click="syncByScope">
              {{ syncLabel }}
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div v-else-if="hasData" class="space-y-4">
        <section class="rounded-2xl border border-ink-200/80 bg-white px-5 py-4 shadow-panel">
          <div class="text-sm font-semibold text-ink-900">数据来源</div>
          <p class="mt-1 text-xs text-ink-500">
            热力图与抽屉均读取本地 IndexedDB 中的真实提交；GitHub 单条增删行来自周聚合分摊，列表接口本身不带 stats。
          </p>
          <div class="gu-metric mt-2 text-xs text-ink-600">
            GitHub {{ formatNumber(dataProvenance.github) }} 提交 ·
            Gitee {{ formatNumber(dataProvenance.gitee) }} 提交 ·
            有提交的天数 {{ dataProvenance.days }}
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                <button
                  v-for="m in ([
                    { v: 'commits', l: '提交频次' },
                    { v: 'code', l: '代码量' },
                  ] as const)"
                  :key="m.v"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="metric === m.v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'"
                  @click="metric = m.v"
                >
                  {{ m.l }}
                </button>
              </div>
              <div class="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
                <button
                  v-for="t in ([
                    { v: 'all', l: '聚合', d: false },
                    { v: 'github', l: 'GitHub', d: !auth.isConnected('github') },
                    { v: 'gitee', l: 'Gitee', d: !auth.isConnected('gitee') },
                  ] as const)"
                  :key="t.v"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="scope === t.v
                    ? 'bg-ink-900 text-white'
                    : t.d ? 'cursor-not-allowed text-ink-300' : 'text-ink-500 hover:bg-ink-50'"
                  :disabled="t.d"
                  @click="scope = t.v"
                >
                  {{ t.l }}
                </button>
              </div>
              <div class="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
                <button
                  v-for="y in yearOptions"
                  :key="y"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="selectedYear === y ? 'bg-white text-ink-900 shadow-sm ring-1 ring-ink-200' : 'text-ink-500'"
                  @click="selectedYear = y"
                >
                  {{ y }} 年
                </button>
              </div>
            </div>
            <NRadioGroup v-model:value="colorTheme" size="small">
              <NRadio value="default">默认</NRadio>
              <NRadio value="colorblind">色弱</NRadio>
              <NRadio value="dark">深色</NRadio>
            </NRadioGroup>
          </div>

          <div class="p-4" :class="colorTheme === 'dark' ? 'bg-slate-900' : ''">
            <HeatmapChart
              :data="heatmap"
              :metric="metric"
              :theme="colorTheme"
              height="220px"
              @select="onSelectDate"
            />
          </div>

          <div class="flex items-center justify-end gap-2 px-5 pb-4 text-xs text-ink-400">
            <span>{{ rangeLabel }} · 少</span>
            <span
              v-for="(_, i) in legend"
              :key="i"
              class="h-3 w-3 rounded-sm"
              :style="{
                background: colorTheme === 'colorblind'
                  ? ['#f0f0f0', '#ccebc5', '#7bccc4', '#43a2ca', '#0868ac'][i]
                  : colorTheme === 'dark'
                    ? ['#1e293b', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa'][i]
                    : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'][i],
              }"
            />
            <span>多</span>
          </div>
        </section>
      </div>
    </NSpin>

    <NDrawer v-model:show="drawerShow" :width="520" placement="right">
      <NDrawerContent :title="selectedDate ? `${selectedDate} 的提交` : '提交详情'" closable>
        <template v-if="selectedBucket">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <NTag size="small" type="info" :bordered="false">{{ selectedBucket.commits.length }} 次提交</NTag>
            <NTag
              v-if="selectedBucket.additions > 0 || selectedBucket.deletions > 0"
              size="small"
              type="success"
              :bordered="false"
            >
              +{{ Math.round(selectedBucket.additions) }} / -{{ Math.round(selectedBucket.deletions) }}
            </NTag>
          </div>
          <NText depth="3" class="mb-3 block text-xs">
            GitHub 单条提交通常无 +/−（列表接口不返回 stats）；当日合计来自周统计分摊。Gitee 在开启明细后可见逐条行数。
          </NText>

          <div class="mb-3 space-y-2">
            <NInput v-model:value="keyword" size="small" clearable placeholder="搜索 commit message">
              <template #prefix>
                <NIcon><Search :size="14" /></NIcon>
              </template>
            </NInput>
            <NRadioGroup v-model:value="mergeFilter" size="small">
              <NRadio value="all">全部</NRadio>
              <NRadio value="non-merge">非 Merge</NRadio>
              <NRadio value="merge">仅 Merge</NRadio>
            </NRadioGroup>
          </div>

          <div v-if="filteredCommits.length" class="space-y-2">
            <div
              v-for="c in filteredCommits"
              :key="c.id"
              class="rounded-xl border border-ink-100 p-3 transition-colors hover:border-brand-300"
            >
              <div class="flex items-start gap-2">
                <NButton text size="tiny" class="!mt-0.5" @click="toggleExpand(c.id)">
                  <template #icon>
                    <NIcon size="14">
                      <ChevronRight v-if="!expandedCommits.has(c.id)" />
                      <ChevronDown v-else />
                    </NIcon>
                  </template>
                </NButton>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-center gap-1.5">
                    <component :is="c.platform === 'github' ? Github : Gitee" :size="13" />
                    <NText depth="3" class="text-xs">
                      {{ repoMap.get(c.repoId)?.fullName || c.repoId }}
                    </NText>
                    <NText depth="3" class="gu-metric ml-auto text-xs">{{ timeStr(c.authoredAt) }}</NText>
                  </div>
                  <a
                    :href="c.htmlUrl"
                    target="_blank"
                    rel="noopener"
                    class="block text-sm font-medium text-ink-800 hover:text-brand-700 hover:underline"
                    v-html="highlight(firstLine(c.message))"
                  />
                  <div
                    v-if="body(c.message) && expandedCommits.has(c.id)"
                    class="mt-2 whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-2 font-mono text-xs text-ink-500"
                    v-html="highlight(body(c.message))"
                  />
                  <div class="mt-2 flex items-center gap-3 text-xs">
                    <span v-if="c.additions || c.deletions" class="text-ink-500">
                      <span class="text-emerald-600">+{{ c.additions }}</span>
                      <span class="ml-1 text-red-500">-{{ c.deletions }}</span>
                    </span>
                    <a
                      :href="c.htmlUrl"
                      target="_blank"
                      rel="noopener"
                      class="flex items-center gap-0.5 text-ink-400 hover:text-brand-600"
                    >
                      <GitCommit :size="12" />
                      {{ c.sha.slice(0, 7) }}
                      <ExternalLink :size="11" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <NEmpty v-else description="这一天没有符合条件的提交" class="py-12" />
        </template>
        <NEmpty v-else description="这一天没有提交记录" class="py-12" />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
