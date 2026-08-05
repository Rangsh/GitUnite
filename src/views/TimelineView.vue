<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NCard, NSpace, NButton, NEmpty, NSpin, NRadioGroup, NRadio, NInput,
  NText, NTag, NDrawer, NDrawerContent, NIcon,
} from 'naive-ui'
import { Search, ExternalLink, GitCommit, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import {
  computeDailyBuckets, computeHeatmap, isMergeCommit,
  type AnalyticsScope, type HeatmapPoint,
} from '@/utils/analytics'
import { dayjs } from '@/utils/date'
import { HeatmapChart } from '@/components/charts'
import { Github, Gitee } from '@/components/common/PlatformIcon'

const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const metric = ref<'commits' | 'code'>('commits')
const range = ref<'1y' | '2y' | 'all'>('1y')
const colorTheme = ref<'default' | 'colorblind' | 'dark'>('default')
const keyword = ref('')
const mergeFilter = ref<'all' | 'merge' | 'non-merge'>('all')

const selectedDate = ref<string | null>(null)
const drawerShow = ref(false)
const expandedCommits = ref<Set<string>>(new Set())

onMounted(() => analytics.load())
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

const heatmap = computed<HeatmapPoint[]>(() => computeHeatmap(input.value, range.value))
const dailyBuckets = computed(() => computeDailyBuckets(input.value))
const repoMap = computed(() => new Map(analytics.repos.map(r => [r.id, r])))

const hasData = computed(() => analytics.commits.length > 0)

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
  let list = [...b.commits].sort((a, b) =>
    dayjs(b.authoredAt).valueOf() - dayjs(a.authoredAt).valueOf())

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
  return list
})

function toggleExpand(id: string) {
  if (expandedCommits.value.has(id)) expandedCommits.value.delete(id)
  else expandedCommits.value.add(id)
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
  return dayjs(iso).format('HH:mm')
}

const legend = computed(() => {
  const max = metric.value === 'commits'
    ? Math.max(...heatmap.value.map(p => p.commits), 1)
    : Math.max(...heatmap.value.map(p => p.additions + p.deletions), 1)
  if (max === 1) return [0, 1]
  return [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), max]
})

const rangeLabel = computed(() => {
  if (range.value === '1y') return '近 1 年'
  if (range.value === '2y') return '近 2 年'
  return '全部'
})
</script>

<template>
  <NSpace vertical size="large">
    <div>
      <h1 class="text-2xl font-semibold m-0">提交时间轴</h1>
      <NText depth="3" class="text-sm">热力图展示你的提交节奏，点击任意日期查看当天提交详情</NText>
    </div>

    <NSpin :show="analytics.loading">
      <div v-if="!hasData" class="py-16">
        <NEmpty description="还没有提交数据，请先完成一次同步">
          <template #extra>
            <NButton type="primary" @click="start()" :loading="running">立即同步</NButton>
          </template>
        </NEmpty>
      </div>

      <NCard v-else size="small">
        <NSpace vertical size="medium">
          <!-- 控制栏 -->
          <NSpace align="center" justify="space-between" wrap>
            <NSpace align="center" wrap>
              <NRadioGroup v-model:value="metric" size="small">
                <NRadio value="commits">提交频次</NRadio>
                <NRadio value="code">代码量</NRadio>
              </NRadioGroup>
              <NRadioGroup v-model:value="scope" size="small">
                <NRadio value="all">聚合</NRadio>
                <NRadio value="github" :disabled="!auth.isConnected('github')">GitHub</NRadio>
                <NRadio value="gitee" :disabled="!auth.isConnected('gitee')">Gitee</NRadio>
              </NRadioGroup>
              <NRadioGroup v-model:value="range" size="small">
                <NRadio value="1y">近 1 年</NRadio>
                <NRadio value="2y">近 2 年</NRadio>
                <NRadio value="all">全部</NRadio>
              </NRadioGroup>
            </NSpace>
            <NSpace align="center" size="small">
              <NText depth="3" class="text-xs">配色</NText>
              <NRadioGroup v-model:value="colorTheme" size="small">
                <NRadio value="default">默认</NRadio>
                <NRadio value="colorblind">色弱友好</NRadio>
                <NRadio value="dark">深色</NRadio>
              </NRadioGroup>
            </NSpace>
          </NSpace>

          <!-- 热力图 -->
          <div :class="colorTheme === 'dark' ? 'bg-slate-900 rounded-lg p-3 -mx-1' : ''">
            <HeatmapChart
              :data="heatmap"
              :metric="metric"
              :theme="colorTheme"
              height="220px"
              @select="onSelectDate"
            />
          </div>

          <!-- 图例 -->
          <div class="flex items-center justify-end gap-2 text-xs text-gray-400">
            <span>{{ rangeLabel }} · 少</span>
            <span
              v-for="(_, i) in legend"
              :key="i"
              class="w-3 h-3 rounded-sm"
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

          <NText depth="3" class="text-xs self-center">
            点击单元格查看当日提交详情；代码量热力图颜色深浅 = 当日 additions + deletions
          </NText>
        </NSpace>
      </NCard>
    </NSpin>

    <!-- 单日提交详情抽屉 -->
    <NDrawer v-model:show="drawerShow" :width="520" placement="right">
      <NDrawerContent :title="selectedDate ? `${selectedDate} 的提交` : '提交详情'" closable>
        <template v-if="selectedBucket">
          <NSpace align="center" justify="space-between" class="mb-3">
            <NSpace size="small">
              <NTag size="small" type="info">{{ selectedBucket.commits.length }} 次提交</NTag>
              <NTag v-if="selectedBucket.additions > 0 || selectedBucket.deletions > 0" size="small" type="success">
                +{{ Math.round(selectedBucket.additions) }} / -{{ Math.round(selectedBucket.deletions) }}
              </NTag>
            </NSpace>
          </NSpace>

          <NSpace vertical size="small" class="mb-3">
            <NInput
              v-model:value="keyword"
              size="small"
              clearable
              placeholder="搜索 commit message"
            >
              <template #prefix>
                <NIcon><Search :size="14" /></NIcon>
              </template>
            </NInput>
            <NSpace align="center" size="small">
              <NText depth="3" class="text-xs">显示：</NText>
              <NRadioGroup v-model:value="mergeFilter" size="small">
                <NRadio value="all">全部</NRadio>
                <NRadio value="non-merge">非 Merge</NRadio>
                <NRadio value="merge">仅 Merge</NRadio>
              </NRadioGroup>
            </NSpace>
          </NSpace>

          <div v-if="filteredCommits.length" class="space-y-2">
            <div
              v-for="c in filteredCommits"
              :key="c.id"
              class="border border-gray-100 rounded-lg p-3 hover:border-brand-300 transition-colors"
            >
              <div class="flex items-start gap-2">
                <NButton
                  text
                  size="tiny"
                  class="!mt-0.5"
                  @click="toggleExpand(c.id)"
                >
                  <template #icon>
                    <NIcon size="14">
                      <ChevronRight v-if="!expandedCommits.has(c.id)" />
                      <ChevronDown v-else />
                    </NIcon>
                  </template>
                </NButton>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-1">
                    <component
                      :is="c.platform === 'github' ? Github : Gitee"
                      :size="13"
                    />
                    <NText depth="3" class="text-xs">
                      {{ repoMap.get(c.repoId)?.fullName || c.repoId }}
                    </NText>
                    <NText depth="3" class="text-xs ml-auto">{{ timeStr(c.authoredAt) }}</NText>
                  </div>
                  <a
                    :href="c.htmlUrl"
                    target="_blank"
                    rel="noopener"
                    class="font-medium text-sm text-gray-800 hover:text-brand-600 hover:underline block"
                    v-html="highlight(firstLine(c.message))"
                  />
                  <div
                    v-if="body(c.message) && expandedCommits.has(c.id)"
                    class="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-words font-mono bg-gray-50 rounded p-2"
                    v-html="highlight(body(c.message))"
                  />
                  <div class="mt-2 flex items-center gap-3 text-xs">
                    <span v-if="c.additions || c.deletions" class="text-gray-500">
                      <span class="text-green-600">+{{ c.additions }}</span>
                      <span class="text-red-500 ml-1">-{{ c.deletions }}</span>
                    </span>
                    <a
                      :href="c.htmlUrl"
                      target="_blank"
                      rel="noopener"
                      class="text-gray-400 hover:text-brand-500 flex items-center gap-0.5"
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
          <NEmpty v-else description="没有符合条件的提交" class="py-12" />
        </template>
      </NDrawerContent>
    </NDrawer>
  </NSpace>
</template>
