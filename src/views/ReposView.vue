<script setup lang="ts">
import { computed, h, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NSpace, NInput, NSelect, NDataTable, NTag, NButton, NEmpty, NSwitch, NText,
  type DataTableColumns,
} from 'naive-ui'
import { Search, Star, GitFork, ExternalLink } from 'lucide-vue-next'
import { Github, Gitee } from '@/components/common/PlatformIcon'
import { useReposStore } from '@/stores/repos'
import { useSync } from '@/composables/useSync'
import type { UnifiedRepo } from '@/api/types'

const store = useReposStore()
const { filtered, languages, loading, filter, keyword, language, sort, contributedOnly, commitCounts } = storeToRefs(store)
const { start, running } = useSync()

onMounted(() => store.load())
// 同步结束后重新加载列表与提交数
watch(running, async (val, old) => {
  if (old && !val) {
    await store.load()
  }
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

const columns = computed<DataTableColumns<UnifiedRepo>>(() => [
  {
    title: '仓库',
    key: 'fullName',
    render: (row) => {
      const PlatformIcon = row.platform === 'github' ? Github : Gitee
      return h(NSpace, { align: 'center', size: 8 }, () => [
        h(PlatformIcon as any, { size: 16 }),
      h('a', {
        href: row.htmlUrl,
        target: '_blank',
        class: 'font-medium hover:underline',
      }, row.fullName),
      h(NTag, { size: 'small', type: roleLabel[row.role].type, bordered: false }, () => roleLabel[row.role].text),
      row.isPrivate ? h(NTag, { size: 'small', bordered: false }, () => '私有') : null,
      ])
    },
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render: row => row.description || h('span', { class: 'text-gray-300' }, '—'),
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
    render: row => commitCounts.value[row.id] ?? 0,
  },
  {
    title: 'Star',
    key: 'stars',
    width: 90,
    render: row => h(NSpace, { size: 4, align: 'center' }, () => [
      h(Star, { size: 14, class: 'text-gray-400' }),
      row.stargazersCount,
    ]),
  },
  {
    title: 'Fork',
    key: 'forks',
    width: 90,
    render: row => h(NSpace, { size: 4, align: 'center' }, () => [
      h(GitFork, { size: 14, class: 'text-gray-400' }),
      row.forksCount,
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
    render: row => h('a', { href: row.htmlUrl, target: '_blank' }, h(ExternalLink, { size: 16, class: 'text-gray-400' })),
  },
])
</script>

<template>
  <NSpace vertical size="large">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">仓库列表</h1>
      <NButton type="primary" :loading="running" @click="start()">
        {{ running ? '同步中…' : '一键同步' }}
      </NButton>
    </div>

    <NSpace align="center" wrap>
      <NSpace>
        <NButton
          v-for="t in tabs"
          :key="t.value"
          :type="filter === t.value ? 'primary' : 'default'"
          size="small"
          @click="filter = t.value"
        >
          {{ t.label }}
        </NButton>
      </NSpace>
      <NInput
        v-model:value="keyword"
        placeholder="搜索仓库名或描述"
        clearable
        style="width: 240px"
      >
        <template #prefix><Search :size="14" /></template>
      </NInput>
      <NSelect
        v-model:value="language"
        :options="languageOptions"
        placeholder="语言"
        clearable
        style="width: 160px"
      />
      <NSelect v-model:value="sort" :options="sortOptions" size="small" style="width: 140px" />
      <NSpace align="center" :size="6">
        <NText>仅我贡献过的</NText>
        <NSwitch v-model:value="contributedOnly" size="small" />
      </NSpace>
    </NSpace>

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
    <NEmpty v-else description="尚未同步任何仓库，点击右上角「一键同步」开始" style="padding: 60px 0" />
  </NSpace>
</template>
