<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NEmpty, NSpin, NTag, NTooltip, NAlert,
} from 'naive-ui'
import {
  ExternalLink, GitPullRequest, CircleCheck, CircleDot, CircleX,
  GitPullRequestCreateArrow, TimerReset, Trophy, CircleMinus,
} from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { computeContributions, type ContributionStats } from '@/utils/contributions'
import type { AnalyticsScope } from '@/utils/analytics'
import { formatDuration } from '@/utils/date'
import { Github, Gitee } from '@/components/common/PlatformIcon'
import SyncButton from '@/components/sync/SyncButton.vue'
import StatCard from '@/components/common/StatCard.vue'

const { t } = useI18n()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()

const scope = ref<AnalyticsScope>('all')
const computing = ref(false)
const stats = shallowRef<ContributionStats | null>(null)

let computeToken = 0
function yieldToMain() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function recompute() {
  const token = ++computeToken
  if (!analytics.issues.length) {
    stats.value = null
    computing.value = false
    return
  }
  computing.value = true
  await yieldToMain()
  if (token !== computeToken) return
  try {
    stats.value = computeContributions({
      repos: analytics.repos,
      issues: analytics.issues,
      scope: scope.value,
    })
  }
  catch (e) {
    console.error('[contributions] compute failed', e)
    stats.value = null
  }
  if (token === computeToken) computing.value = false
}

onUnmounted(() => {
  computeToken++
})

watch(
  () => [analytics.loadedAt, analytics.issues.length, scope.value],
  () => void recompute(),
  { immediate: true },
)

const scopeTabs = computed(() => [
  { label: t('common.aggregate'), value: 'all' as const },
  { label: t('common.github'), value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: t('common.gitee'), value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const hasData = computed(() => stats.value?.hasData ?? false)

const scopeMissing = computed(() => {
  if (scope.value === 'all') {
    const connected: Array<'github' | 'gitee'> = []
    if (auth.isConnected('github')) connected.push('github')
    if (auth.isConnected('gitee')) connected.push('gitee')
    if (!connected.length) return false
    return connected.every(p => ui.prIssueScopeMissing[p])
  }
  return !!ui.prIssueScopeMissing[scope.value]
})

const needsFullSyncHint = computed(() =>
  !hasData.value
  && !scopeMissing.value
  && analytics.commits.length > 0
  && !analytics.loading
  && !computing.value,
)

const medianText = computed(() =>
  stats.value?.mergeMedianMs != null ? formatDuration(stats.value.mergeMedianMs) : '—')
const meanText = computed(() =>
  stats.value?.mergeMeanMs != null ? formatDuration(stats.value.mergeMeanMs) : '—')
const mergedCount = computed(() => stats.value?.pr.merged ?? 0)
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          <GitPullRequestCreateArrow :size="13" /> {{ t('contributions.eyebrow') }}
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">{{ t('contributions.title') }}</h1>
        <p class="mt-1.5 text-sm text-ink-500">{{ t('contributions.subtitle') }}</p>
      </div>
      <SyncButton :platform="scope === 'all' ? undefined : scope" />
    </header>

    <NSpin :show="(analytics.loading || computing) && !stats">
      <!-- 切换条 -->
      <section class="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-white px-5 py-3 shadow-panel">
        <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
          <button
            v-for="tab in scopeTabs"
            :key="tab.value"
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="scope === tab.value
              ? 'bg-white text-ink-900 shadow-sm'
              : tab.disabled ? 'cursor-not-allowed text-ink-300' : 'text-ink-500 hover:bg-ink-50'"
            :disabled="tab.disabled"
            @click="scope = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <NTag v-if="stats" size="small" :bordered="false" class="!rounded-lg !bg-ink-100 !text-ink-600">
          {{ t('contributions.totalItems', { count: stats.pr.created + stats.issue.created }) }}
        </NTag>
      </section>

      <!-- 缺权限 / 无数据引导 -->
      <NAlert
        v-if="scopeMissing"
        type="warning"
        class="!rounded-2xl"
        :title="t('contributions.scopeMissingTitle')"
      >
        {{ t('contributions.scopeMissingBody') }}
      </NAlert>

      <NAlert
        v-else-if="needsFullSyncHint"
        type="info"
        class="!rounded-2xl"
        :title="t('contributions.needFullSyncTitle')"
      >
        {{ t('contributions.needFullSyncBody') }}
      </NAlert>

      <div
        v-if="!hasData && !analytics.loading && !computing && !scopeMissing && !needsFullSyncHint"
        class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-20 text-center animate-fade-up"
      >
        <NEmpty :description="t('contributions.empty')">
          <template #extra>
            <div class="mt-3 flex justify-center"><SyncButton :platform="scope === 'all' ? undefined : scope" /></div>
          </template>
        </NEmpty>
      </div>

      <div v-else-if="stats" class="space-y-5">
        <!-- KPI：PR / Issue 各三项，对齐 PRD 3.7 -->
        <section class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard :label="t('contributions.prCreated')" :value="stats.pr.created" :icon="GitPullRequest" tone="accent" />
          <StatCard :label="t('contributions.prMerged')" :value="stats.pr.merged" :icon="CircleCheck" tone="success" />
          <StatCard :label="t('contributions.prClosed')" :value="stats.pr.closedUnmerged" :icon="CircleMinus" tone="danger" />
          <StatCard :label="t('contributions.issueCreated')" :value="stats.issue.created" :icon="CircleDot" />
          <StatCard :label="t('contributions.issueClosed')" :value="stats.issue.closedUnmerged" :icon="CircleX" />
          <StatCard :label="t('contributions.issueOpen')" :value="stats.issue.open" :icon="CircleDot" tone="accent" />
        </section>

        <section class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-panel lg:col-span-1">
            <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-ink-900">
              <TimerReset :size="17" /> {{ t('contributions.mergeTime') }}
            </h2>
            <p class="mt-0.5 text-xs text-ink-400">{{ t('contributions.mergeBasedOn', { count: mergedCount }) }}</p>
            <div class="mt-4 grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-ink-50 p-4">
                <div class="text-[11px] uppercase tracking-wider text-ink-400">{{ t('contributions.median') }}</div>
                <div class="gu-metric mt-1 text-2xl font-semibold text-ink-900">{{ medianText }}</div>
              </div>
              <div class="rounded-xl bg-ink-50 p-4">
                <div class="text-[11px] uppercase tracking-wider text-ink-400">{{ t('contributions.mean') }}</div>
                <div class="gu-metric mt-1 text-2xl font-semibold text-ink-900">{{ meanText }}</div>
              </div>
            </div>
            <NTooltip>
              <template #trigger>
                <p class="mt-3 cursor-help text-xs text-ink-400">
                  {{ t('contributions.mergeHint') }}
                </p>
              </template>
              {{ t('contributions.mergeTooltip') }}
            </NTooltip>
          </div>

          <!-- Top 仓库 -->
          <div class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel lg:col-span-2">
            <div class="border-b border-ink-100 px-5 py-4">
              <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-ink-900">
                <Trophy :size="17" /> {{ t('contributions.rankTitle') }}
              </h2>
              <p class="mt-0.5 text-xs text-ink-400">{{ t('contributions.rankDesc') }}</p>
            </div>
            <div class="divide-y divide-ink-100">
              <div
                v-for="(repo, i) in stats.topRepos"
                :key="repo.repoId"
                class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50"
              >
                <span class="w-5 text-right text-xs font-medium text-ink-400">{{ i + 1 }}</span>
                <component :is="repo.platform === 'github' ? Github : Gitee" :size="14" />
                <a
                  :href="repo.htmlUrl"
                  target="_blank"
                  rel="noopener"
                  class="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 hover:text-brand-700 hover:underline"
                >
                  {{ repo.fullName }}
                  <ExternalLink :size="11" class="ml-0.5 inline text-ink-300" />
                </a>
                <span class="flex items-center gap-1.5">
                  <NTag v-if="repo.prCount" size="small" :bordered="false" class="!rounded-lg !bg-brand-50 !text-brand-700">
                    {{ t('contributions.prTag', { count: repo.prCount }) }}
                  </NTag>
                  <NTag v-if="repo.issueCount" size="small" :bordered="false" class="!rounded-lg !bg-ink-100 !text-ink-600">
                    {{ t('contributions.issueTag', { count: repo.issueCount }) }}
                  </NTag>
                  <span class="gu-metric w-8 text-right text-xs font-semibold text-ink-700">{{ repo.total }}</span>
                </span>
              </div>
              <div v-if="!stats.topRepos.length" class="px-5 py-12 text-center text-sm text-ink-400">
                {{ t('contributions.noRank') }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </NSpin>
  </div>
</template>
