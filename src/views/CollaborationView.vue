<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  NButton, NEmpty, NSpin, NSwitch, NDrawer, NDrawerContent,
  NTag, NText, NTooltip,
} from 'naive-ui'
import { ExternalLink, GitCommit, Network, RefreshCw, Users } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import {
  computeCollaboration, type CollaborationGraph,
} from '@/utils/collaboration'
import type { AnalyticsScope } from '@/utils/analytics'
import { createTzHelpers, formatNumber } from '@/utils/date'
import { ForceGraph } from '@/components/charts'
import { Github, Gitee } from '@/components/common/PlatformIcon'

const { t } = useI18n()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const includeCollaborators = ref(false)
const computing = ref(false)

const graph = shallowRef<CollaborationGraph | null>(null)
const selectedRepoId = ref<string | null>(null)

const drawerKey = ref<string | null>(null)
const drawerShow = ref(false)

let computeToken = 0
function yieldToMain() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function recompute() {
  const token = ++computeToken
  if (!analytics.commits.length) {
    graph.value = null
    computing.value = false
    return
  }
  computing.value = true
  await yieldToMain()
  if (token !== computeToken) return
  try {
    graph.value = computeCollaboration({
      repos: analytics.repos,
      commits: analytics.commits,
      scope: scope.value,
      includeCollaborators: includeCollaborators.value,
      me: {
        github: auth.user('github')?.login ?? null,
        gitee: auth.user('gitee')?.login ?? null,
      },
      maxCollaborators: 60,
    })
  }
  catch (e) {
    console.error('[collaboration] compute failed', e)
    graph.value = null
  }
  if (token === computeToken) computing.value = false
}

onUnmounted(() => {
  computeToken++
})

watch(
  () => [analytics.loadedAt, analytics.commits.length, scope.value, includeCollaborators.value],
  () => void recompute(),
  { immediate: true },
)

const hasData = computed(() => analytics.commits.length > 0)

const scopeTabs = computed(() => [
  { label: t('common.aggregate'), value: 'all' as const },
  { label: t('common.github'), value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: t('common.gitee'), value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const syncLabel = computed(() => {
  if (scope.value === 'github') return t('collaboration.syncLabelGithub')
  if (scope.value === 'gitee') return t('collaboration.syncLabelGitee')
  return t('collaboration.syncLabelAll')
})
function syncByScope() {
  if (scope.value === 'all') void start()
  else void start(scope.value)
}

const repoMap = computed(() => new Map(analytics.repos.map(r => [r.id, r])))
const selectedRepo = computed(() =>
  selectedRepoId.value ? repoMap.value.get(selectedRepoId.value) ?? null : null)

function onSelectRepo(repoId: string) {
  selectedRepoId.value = selectedRepoId.value === repoId ? null : repoId
}

function onSelectCollaborator(key: string) {
  drawerKey.value = key
  drawerShow.value = true
}

const drawerCollaborator = computed(() =>
  graph.value?.collaborators.find(c => c.key === drawerKey.value) ?? null)

const drawerTitle = computed(() =>
  drawerCollaborator.value
    ? t('collaboration.commitsWith', { name: drawerCollaborator.value.name })
    : t('collaboration.drawerTitle'),
)

const drawerCommits = computed(() => {
  if (!drawerKey.value || !graph.value) return []
  const list = graph.value.collaboratorCommits.get(drawerKey.value) ?? []
  return [...list].sort((a, b) =>
    new Date(b.authoredAt).getTime() - new Date(a.authoredAt).getTime())
})

function timeStr(iso: string) {
  const tz = createTzHelpers(timezone.value)
  const hour = String(tz.hour(iso)).padStart(2, '0')
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone.value?.trim() || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const hh = parts.find(p => p.type === 'hour')?.value ?? hour
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${tz.dateKey(iso)} ${hh}:${mm}`
}

function firstLine(msg: string) {
  return msg.split('\n', 1)[0]
}
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          <Network :size="13" /> Collaboration Graph
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">{{ t('collaboration.title') }}</h1>
        <p class="mt-1.5 text-sm text-ink-500">
          {{ t('collaboration.subtitle') }}
        </p>
      </div>
      <NButton type="primary" class="!rounded-xl" :loading="running" @click="syncByScope">
        <template #icon><RefreshCw :size="15" /></template>
        {{ syncLabel }}
      </NButton>
    </header>

    <NSpin :show="(analytics.loading || computing) && !graph">
      <div
        v-if="!hasData && !analytics.loading && !computing"
        class="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-20 text-center"
      >
        <NEmpty :description="t('collaboration.empty')">
          <template #extra>
            <NButton type="primary" class="!rounded-xl" :loading="running" @click="syncByScope">
              {{ syncLabel }}
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div v-else-if="graph" class="space-y-4">
        <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                <button
                  v-for="tab in scopeTabs"
                  :key="tab.value"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="scope === tab.value
                    ? 'bg-white text-ink-900 shadow-sm'
                    : tab.disabled
                      ? 'cursor-not-allowed text-ink-300'
                      : 'text-ink-500 hover:bg-ink-50'"
                  :disabled="tab.disabled"
                  @click="scope = tab.value"
                >
                  {{ tab.label }}
                </button>
              </div>
              <label class="flex cursor-pointer select-none items-center gap-2 text-xs text-ink-600">
                <NSwitch v-model:value="includeCollaborators" size="small" />
                <span class="flex items-center gap-1"><Users :size="13" /> {{ t('collaboration.includeCollab') }}</span>
              </label>
            </div>

            <div class="flex items-center gap-3 text-xs text-ink-500">
              <span>{{ t('collaboration.reposCount', { count: formatNumber(graph.repos.length) }) }}</span>
              <span class="text-ink-200">·</span>
              <span>{{ t('collaboration.collabCount', { count: formatNumber(graph.collaborators.length) }) }}</span>
              <NTooltip v-if="graph.truncated.collaborators > 0">
                <template #trigger>
                  <NTag size="small" type="warning" :bordered="false" class="!rounded-lg">
                    {{ t('collaboration.truncated', { count: graph.truncated.collaborators }) }}
                  </NTag>
                </template>
                {{ t('collaboration.truncatedHint') }}
              </NTooltip>
              <NTooltip v-if="graph.collaboratorsUnavailable">
                <template #trigger>
                  <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
                    {{ t('collaboration.onlyRepoGraph') }}
                  </NTag>
                </template>
                {{ t('collaboration.onlyRepoGraphHint') }}
              </NTooltip>
            </div>
          </div>

          <div class="p-2">
            <ForceGraph
              :graph="graph"
              height="580px"
              @select-repo="onSelectRepo"
              @select-collaborator="onSelectCollaborator"
            />
          </div>

          <div class="flex flex-wrap items-center gap-4 border-t border-ink-100 px-5 py-3 text-xs text-ink-400">
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-brand-600" /> {{ t('collaboration.legendMe') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" /> {{ t('collaboration.legendRepo') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" /> {{ t('collaboration.legendCollab') }}
            </span>
            <span class="ml-auto">{{ t('collaboration.legendControls') }}</span>
          </div>
        </section>

        <!-- 选中仓库的详情条 -->
        <section
          v-if="selectedRepo"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-5 py-4 animate-fade-up"
        >
          <component :is="selectedRepo.platform === 'github' ? Github : Gitee" :size="16" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-ink-900">{{ selectedRepo.fullName }}</div>
            <div class="mt-0.5 text-xs text-ink-500">
              {{ selectedRepo.language || t('collaboration.unknownLanguage') }}
              <template v-if="selectedRepo.stargazersCount">
                · ★ {{ formatNumber(selectedRepo.stargazersCount) }}
              </template>
            </div>
          </div>
          <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
            {{ t('collaboration.myCommits', { count: formatNumber(graph?.nodes.find(n => n.id === selectedRepo?.id)?.value ?? 0) }) }}
          </NTag>
          <NButton
            size="small"
            quaternary
            class="!rounded-lg"
            @click="selectedRepoId = null"
          >
            {{ t('collaboration.clearSelection') }}
          </NButton>
          <NButton
            size="small"
            tag="a"
            :href="selectedRepo.htmlUrl"
            target="_blank"
            rel="noopener"
            class="!rounded-lg"
          >
            <template #icon><ExternalLink :size="13" /></template>
            {{ t('collaboration.openRepo') }}
          </NButton>
        </section>
      </div>
    </NSpin>

    <!-- 协作者共同提交抽屉 -->
    <NDrawer v-model:show="drawerShow" :width="520" placement="right">
      <NDrawerContent
        :title="drawerTitle"
        closable
      >
        <template v-if="drawerCollaborator">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
              {{ t('collaboration.sharedCommitsCount', { count: drawerCollaborator.sharedCommits }) }}
            </NTag>
            <NTag size="small" :bordered="false" class="!rounded-lg">
              {{ t('collaboration.sharedReposCount', { count: drawerCollaborator.sharedRepoIds.length }) }}
            </NTag>
          </div>
          <NText depth="3" class="mb-3 block text-xs">
            {{ t('collaboration.drawerHint') }}
          </NText>

          <div v-if="drawerCommits.length" class="space-y-2">
            <div
              v-for="c in drawerCommits"
              :key="c.id"
              class="rounded-xl border border-ink-100 p-3 transition-colors hover:border-brand-300"
            >
              <div class="mb-1 flex items-center gap-1.5">
                <component :is="c.platform === 'github' ? Github : Gitee" :size="13" />
                <NText depth="3" class="text-xs">{{ repoMap.get(c.repoId)?.fullName || c.repoId }}</NText>
                <NText depth="3" class="gu-metric ml-auto text-xs">{{ timeStr(c.authoredAt) }}</NText>
              </div>
              <a
                :href="c.htmlUrl"
                target="_blank"
                rel="noopener"
                class="block text-sm font-medium text-ink-800 hover:text-brand-700 hover:underline"
              >
                {{ firstLine(c.message) }}
              </a>
              <div class="mt-2">
                <a
                  :href="c.htmlUrl"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-1 text-xs text-ink-400 hover:text-brand-600"
                >
                  <GitCommit :size="12" /> {{ c.sha.slice(0, 7) }} <ExternalLink :size="11" />
                </a>
              </div>
            </div>
          </div>
          <NEmpty v-else :description="t('collaboration.noSharedCommits')" class="py-12" />
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
