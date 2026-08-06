<script setup lang="ts">
import { computed, h, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  NInput, NSelect, NDataTable, NTag, NEmpty, NSwitch, NText,
  type DataTableColumns,
} from 'naive-ui'
import { Search, Star, GitFork, ExternalLink, FolderGit2 } from 'lucide-vue-next'
import { Github, Gitee } from '@/components/common/PlatformIcon'
import SyncButton from '@/components/sync/SyncButton.vue'
import { useReposStore } from '@/stores/repos'
import { useAuthStore } from '@/stores/auth'
import { useSync } from '@/composables/useSync'
import type { UnifiedRepo } from '@/api/types'

const store = useReposStore()
const auth = useAuthStore()
const router = useRouter()
const { running } = useSync()
const { filtered, languages, loading, filter, keyword, language, sort, contributedOnly, commitCounts } = storeToRefs(store)

onMounted(() => store.load())
watch(running, async (val, old) => {
  if (old && !val) await store.load()
})

const tabs = [
  { label: '全部', value: 'all' },
  { label: 'GitHub', value: 'github' },
  { label: 'Gitee', value: 'gitee' },
] as const

const languageOptions = computed(() => [
  { label: '全部语言', value: '' },
  ...languages.value.map(l => ({ label: l, value: l })),
])

const sortOptions = [
  { label: '最近活跃', value: 'updated' },
  { label: 'Star 数', value: 'stars' },
  { label: '名称', value: 'name' },
  { label: '提交数', value: 'commits' },
]

const roleLabel: Record<UnifiedRepo['role'], { text: string, type: 'success' | 'info' | 'warning' | 'default' }> = {
  owned: { text: '自有', type: 'success' },
  organization: { text: '组织', type: 'info' },
  fork: { text: 'Fork', type: 'warning' },
  pr_contributed: { text: 'PR 贡献', type: 'default' },
}

const emptyDescription = computed(() => {
  if (!auth.anyConnected) return '尚未连接账号。请先到设置中粘贴 GitHub / Gitee Token。'
  return '尚未同步任何仓库。点击右上角同步开始拉取。'
})

const columns = computed<DataTableColumns<UnifiedRepo>>(() => [
  {
    title: '仓库',
    key: 'fullName',
    render: (row) => {
      const PlatformIcon = row.platform === 'github' ? Github : Gitee
      return h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        h(PlatformIcon as any, { size: 16 }),
        h('a', {
          href: row.htmlUrl,
          target: '_blank',
          class: 'font-medium text-ink-900 hover:underline',
        }, row.fullName),
        h(NTag, { size: 'small', type: roleLabel[row.role].type, bordered: false, class: '!rounded-lg' }, () => roleLabel[row.role].text),
        row.isPrivate ? h(NTag, { size: 'small', bordered: false, class: '!rounded-lg' }, () => '私有') : null,
      ])
    },
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || h('span', { class: 'text-ink-300' }, '—'),
  },
  {
    title: '语言',
    key: 'language',
    width: 120,
    render: row => row.language || '—',
  },
  {
    title: '提交',
    key: 'commits',
    width: 80,
    render: row => h('span', { class: 'gu-metric' }, String(commitCounts.value[row.id] ?? 0)),
  },
  {
    title: 'Star',
    key: 'stars',
    width: 90,
    render: row => h('div', { class: 'flex items-center gap-1' }, [
      h(Star, { size: 14, class: 'text-ink-400' }),
      h('span', { class: 'gu-metric' }, String(row.stargazersCount)),
    ]),
  },
  {
    title: 'Fork',
    key: 'forks',
    width: 90,
    render: row => h('div', { class: 'flex items-center gap-1' }, [
      h(GitFork, { size: 14, class: 'text-ink-400' }),
      h('span', { class: 'gu-metric' }, String(row.forksCount)),
    ]),
  },
  {
    title: '最后活跃',
    key: 'updatedAt',
    width: 120,
    render: row => new Date(row.updatedAt).toLocaleDateString(),
  },
  {
    title: '',
    key: 'actions',
    width: 60,
    render: row => h('a', { href: row.htmlUrl, target: '_blank' }, h(ExternalLink, { size: 16, class: 'text-ink-400' })),
  },
])
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
          <FolderGit2 :size="13" /> Repositories
        </p>
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">仓库列表</h1>
        <p class="mt-1.5 text-sm text-ink-500">聚合 GitHub / Gitee 名下与参与贡献的仓库</p>
      </div>
      <SyncButton :platform="filter === 'all' ? undefined : filter" />
    </header>

    <section class="rounded-2xl border border-ink-200/80 bg-white px-5 py-3 shadow-panel">
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
          <button
            v-for="t in tabs"
            :key="t.value"
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="filter === t.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:bg-ink-50'"
            @click="filter = t.value"
          >
            {{ t.label }}
          </button>
        </div>
        <NInput
          v-model:value="keyword"
          placeholder="搜索仓库名或描述"
          clearable
          class="!max-w-[240px]"
        >
          <template #prefix><Search :size="14" /></template>
        </NInput>
        <NSelect
          v-model:value="language"
          :options="languageOptions"
          placeholder="语言"
          clearable
          class="!w-[160px]"
        />
        <NSelect v-model:value="sort" :options="sortOptions" size="small" class="!w-[140px]" />
        <div class="flex items-center gap-2">
          <NText class="!text-ink-500 text-xs">仅我贡献过的</NText>
          <NSwitch v-model:value="contributedOnly" size="small" />
        </div>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
      <NDataTable
        v-if="filtered.length"
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :row-key="(row: UnifiedRepo) => row.id"
        :max-height="600"
        :bordered="false"
        size="small"
      />
      <div v-else class="px-6 py-16 text-center">
        <NEmpty :description="emptyDescription">
          <template #extra>
            <button
              v-if="!auth.anyConnected"
              type="button"
              class="mt-2 rounded-xl bg-ink-900 px-4 py-2 text-sm text-white"
              @click="router.push('/settings')"
            >
              去设置连接账号
            </button>
          </template>
        </NEmpty>
      </div>
    </section>
  </div>
</template>
