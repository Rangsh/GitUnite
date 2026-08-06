<script setup lang="ts">
import { computed, h, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const store = useReposStore()
const auth = useAuthStore()
const router = useRouter()
const { running } = useSync()
const { filtered, languages, loading, filter, keyword, language, sort, contributedOnly, commitCounts } = storeToRefs(store)

onMounted(() => store.load())
watch(running, async (val, old) => {
  if (old && !val) await store.load()
})

const tabs = computed(() => [
  { label: t('common.aggregate'), value: 'all' as const },
  { label: t('common.github'), value: 'github' as const },
  { label: t('common.gitee'), value: 'gitee' as const },
])

const languageOptions = computed(() => [
  { label: t('repos.langAll'), value: '' },
  ...languages.value.map(l => ({ label: l, value: l })),
])

const sortOptions = computed(() => [
  { label: t('repos.sortUpdated'), value: 'updated' },
  { label: t('repos.sortStars'), value: 'stars' },
  { label: t('repos.sortName'), value: 'name' },
  { label: t('repos.sortCommits'), value: 'commits' },
])

const roleLabel = computed(() => ({
  owned: { text: t('repos.roleOwned'), type: 'success' as const },
  organization: { text: t('repos.roleOrg'), type: 'info' as const },
  fork: { text: t('common.fork'), type: 'warning' as const },
  pr_contributed: { text: t('repos.rolePr'), type: 'default' as const },
}))

const emptyDescription = computed(() => {
  if (!auth.anyConnected) return t('repos.emptyConnect')
  return t('repos.empty')
})

const columns = computed<DataTableColumns<UnifiedRepo>>(() => [
  {
    title: t('repos.colRepo'),
    key: 'fullName',
    render: (row) => {
      const PlatformIcon = row.platform === 'github' ? Github : Gitee
      const role = roleLabel.value[row.role]
      return h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        h(PlatformIcon as any, { size: 16 }),
        h('a', {
          href: row.htmlUrl,
          target: '_blank',
          class: 'font-medium text-ink-900 hover:underline',
        }, row.fullName),
        h(NTag, { size: 'small', type: role.type, bordered: false, class: '!rounded-lg' }, () => role.text),
        row.isPrivate ? h(NTag, { size: 'small', bordered: false, class: '!rounded-lg' }, () => t('repos.private')) : null,
      ])
    },
  },
  {
    title: t('repos.colDesc'),
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || h('span', { class: 'text-ink-300' }, '—'),
  },
  {
    title: t('repos.colLang'),
    key: 'language',
    width: 120,
    render: row => row.language || '—',
  },
  {
    title: t('repos.commits'),
    key: 'commits',
    width: 80,
    render: row => h('span', { class: 'gu-metric' }, String(commitCounts.value[row.id] ?? 0)),
  },
  {
    title: t('repos.stars'),
    key: 'stars',
    width: 90,
    render: row => h('div', { class: 'flex items-center gap-1' }, [
      h(Star, { size: 14, class: 'text-ink-400' }),
      h('span', { class: 'gu-metric' }, String(row.stargazersCount)),
    ]),
  },
  {
    title: t('repos.forks'),
    key: 'forks',
    width: 90,
    render: row => h('div', { class: 'flex items-center gap-1' }, [
      h(GitFork, { size: 14, class: 'text-ink-400' }),
      h('span', { class: 'gu-metric' }, String(row.forksCount)),
    ]),
  },
  {
    title: t('repos.updated'),
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
        <h1 class="m-0 text-2xl font-semibold tracking-tight text-ink-900">{{ t('repos.title') }}</h1>
        <p class="mt-1.5 text-sm text-ink-500">{{ t('repos.subtitle') }}</p>
      </div>
      <SyncButton :platform="filter === 'all' ? undefined : filter" />
    </header>

    <section class="rounded-2xl border border-ink-200/80 bg-white px-5 py-3 shadow-panel">
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="filter === tab.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:bg-ink-50'"
            @click="filter = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
        <NInput
          v-model:value="keyword"
          :placeholder="t('repos.searchPlaceholder')"
          clearable
          class="!max-w-[240px]"
        >
          <template #prefix><Search :size="14" /></template>
        </NInput>
        <NSelect
          v-model:value="language"
          :options="languageOptions"
          :placeholder="t('dashboard.languages')"
          clearable
          class="!w-[160px]"
        />
        <NSelect v-model:value="sort" :options="sortOptions" size="small" class="!w-[140px]" />
        <div class="flex items-center gap-2">
          <NText class="!text-ink-500 text-xs">{{ t('repos.onlyContributed') }}</NText>
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
              {{ t('common.goToSettings') }}
            </button>
          </template>
        </NEmpty>
      </div>
    </section>
  </div>
</template>
