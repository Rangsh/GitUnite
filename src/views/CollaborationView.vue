<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
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

const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { start, running } = useSync()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const includeCollaborators = ref(true)
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
  { label: '聚合', value: 'all' as const },
  { label: 'GitHub', value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: 'Gitee', value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])

const syncLabel = computed(() => {
  if (scope.value === 'github') return '同步 GitHub'
  if (scope.value === 'gitee') return '同步 Gitee'
  return '同步全部'
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
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">协作网络</h1>
        <p class="mt-1.5 text-sm text-ink-500">
          以你为中心：仓库按提交数定大小，协作者按共同提交数定大小
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
        <NEmpty description="还没有提交数据。同步后在此展示协作关系图。">
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
                  v-for="t in scopeTabs"
                  :key="t.value"
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
                  :class="scope === t.value
                    ? 'bg-white text-ink-900 shadow-sm'
                    : t.disabled
                      ? 'cursor-not-allowed text-ink-300'
                      : 'text-ink-500 hover:bg-ink-50'"
                  :disabled="t.disabled"
                  @click="scope = t.value"
                >
                  {{ t.label }}
                </button>
              </div>
              <label class="flex cursor-pointer select-none items-center gap-2 text-xs text-ink-600">
                <NSwitch v-model:value="includeCollaborators" size="small" />
                <span class="flex items-center gap-1"><Users :size="13" /> 显示协作者</span>
              </label>
            </div>

            <div class="flex items-center gap-3 text-xs text-ink-500">
              <span>{{ formatNumber(graph.repos.length) }} 仓库</span>
              <span class="text-ink-200">·</span>
              <span>{{ formatNumber(graph.collaborators.length) }} 协作者</span>
              <NTooltip v-if="graph.truncated.collaborators > 0">
                <template #trigger>
                  <NTag size="small" type="warning" :bordered="false" class="!rounded-lg">
                    已截断 {{ graph.truncated.collaborators }} 人
                  </NTag>
                </template>
                为保证流畅，仅展示共同提交最多的 60 位协作者
              </NTooltip>
              <NTooltip v-if="graph.collaboratorsUnavailable">
                <template #trigger>
                  <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
                    仅仓库图
                  </NTag>
                </template>
                当前同步只缓存「你自己」的提交，无法推断协作者。二级节点将在后续补齐共同作者数据后可用。
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
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-brand-600" /> 我
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" /> 仓库（单击高亮关联协作者）
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" /> 协作者（双击查看共同提交）
            </span>
            <span class="ml-auto">滚轮缩放 · 拖拽节点 · 空白处拖动画布</span>
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
              {{ selectedRepo.language || '未知语言' }}
              <template v-if="selectedRepo.stargazersCount">
                · ★ {{ formatNumber(selectedRepo.stargazersCount) }}
              </template>
            </div>
          </div>
          <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
            我的提交 {{ formatNumber(graph?.nodes.find(n => n.id === selectedRepo?.id)?.value ?? 0) }}
          </NTag>
          <NButton
            size="small"
            quaternary
            class="!rounded-lg"
            @click="selectedRepoId = null"
          >
            取消选中
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
            打开仓库
          </NButton>
        </section>
      </div>
    </NSpin>

    <!-- 协作者共同提交抽屉 -->
    <NDrawer v-model:show="drawerShow" :width="520" placement="right">
      <NDrawerContent
        :title="drawerCollaborator ? `${drawerCollaborator.name} 的共同提交` : '共同提交'"
        closable
      >
        <template v-if="drawerCollaborator">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <NTag size="small" type="info" :bordered="false" class="!rounded-lg">
              {{ drawerCollaborator.sharedCommits }} 次共同提交
            </NTag>
            <NTag size="small" :bordered="false" class="!rounded-lg">
              涉及 {{ drawerCollaborator.sharedRepoIds.length }} 个仓库
            </NTag>
          </div>
          <NText depth="3" class="mb-3 block text-xs">
            以下为该协作者在与你共同仓库中的提交记录（读取自本地缓存，不额外请求接口）。
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
          <NEmpty v-else description="没有可展示的共同提交" class="py-12" />
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
