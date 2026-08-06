<script setup lang="ts">
import { computed, ref } from 'vue'
import { VChart } from './echarts'
import type { CollabCategory, CollaborationGraph } from '@/utils/collaboration'
import { formatNumber } from '@/utils/date'

const props = defineProps<{
  graph: CollaborationGraph
  height?: string
}>()

const emit = defineEmits<{
  (e: 'select-repo', repoId: string): void
  (e: 'select-collaborator', key: string): void
}>()

const selectedRepoId = ref<string | null>(null)

// ECharts graph 的 category 必须是 categories 数组的数字索引
const CATEGORIES = [
  { name: '我', kind: 'me', color: '#0d9488' },
  { name: '仓库', kind: 'repo', color: '#64748b' },
  { name: '协作者', kind: 'collaborator', color: '#0ea5e9' },
] as const
const CATEGORY_INDEX: Record<CollabCategory, number> = {
  me: 0,
  repo: 1,
  collaborator: 2,
}
const colorOf = (cat: CollabCategory) => CATEGORIES[CATEGORY_INDEX[cat]].color

const option = computed(() => {
  const repoById = new Map(props.graph.repos.map(r => [r.id, r]))
  const collabByKey = new Map(props.graph.collaborators.map(c => [c.key, c]))
  const relatedCollabKeys = new Set<string>()
  if (selectedRepoId.value) {
    for (const c of props.graph.collaborators) {
      if (c.sharedRepoIds.includes(selectedRepoId.value)) relatedCollabKeys.add(c.key)
    }
  }

  const dimmed = (cat: CollabCategory, id: string) => {
    if (!selectedRepoId.value) return false
    if (cat === 'me') return false
    if (cat === 'repo') return id !== selectedRepoId.value
    if (cat === 'collaborator') return !relatedCollabKeys.has(id)
    return false
  }

  const maxEdge = Math.max(1, ...props.graph.edges.map(e => e.value))

  return {
    tooltip: {
      backgroundColor: '#0f172a',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (p: any) => {
        if (p.dataType !== 'node') return ''
        const kind = p.data.kind as CollabCategory
        if (kind === 'me') return `<b>我</b><br/>${formatNumber(p.data.value)} 次提交`
        if (kind === 'repo') {
          const repo = repoById.get(p.data.repoId)
          if (!repo) return `<b>${p.data.name}</b>`
          return `<b>${repo.fullName}</b><br/>`
            + `${repo.language || '未知语言'} · ★ ${formatNumber(repo.stargazersCount)}<br/>`
            + `我的提交 <b>${formatNumber(p.data.value)}</b>`
        }
        const c = collabByKey.get(p.data.id)
        if (!c) return `<b>${p.data.name}</b>`
        const names = c.sharedRepoIds
          .slice(0, 3)
          .map(id => repoById.get(id)?.name)
          .filter(Boolean)
          .join('、')
        const more = c.sharedRepoIds.length > 3 ? ` 等` : ''
        return `<b>${c.name}</b><br/>`
          + `共同提交 <b>${formatNumber(c.sharedCommits)}</b> 次<br/>`
          + `涉及 ${c.sharedRepoIds.length} 个仓库：${names}${more}`
      },
    },
    legend: {
      data: CATEGORIES.map(c => c.name),
      bottom: 8,
      textStyle: { fontSize: 11, color: '#64748b' },
      itemGap: 16,
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories: CATEGORIES.map(c => ({ name: c.name, itemStyle: { color: c.color } })),
        force: {
          repulsion: 320,
          edgeLength: [60, 160],
          gravity: 0.08,
          friction: 0.18,
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: '#334155',
          formatter: (p: any) => (p.data.kind === 'me' ? '我' : p.data.name),
        },
        edgeSymbol: ['none', 'none'],
        lineStyle: {
          color: '#cbd5e1',
          curveness: 0.12,
        },
        emphasis: {
          focus: 'none',
          lineStyle: { width: 3, color: '#0d9488' },
          label: { show: true, fontWeight: 600 },
        },
        data: props.graph.nodes.map((n) => {
          const isDim = dimmed(n.category, n.id)
          return {
            id: n.id,
            name: n.name,
            category: CATEGORY_INDEX[n.category],
            kind: n.category,
            value: n.value,
            repoId: n.repoId,
            symbolSize: n.symbolSize,
            itemStyle: {
              color: colorOf(n.category),
              borderColor: n.category === 'me' ? '#0f766e' : '#ffffff',
              borderWidth: n.category === 'me' ? 3 : 2,
              opacity: isDim ? 0.15 : 1,
            },
            label: { opacity: isDim ? 0.2 : 1 },
          }
        }),
        links: props.graph.edges.map(e => ({
          source: e.source,
          target: e.target,
          value: e.value,
          lineStyle: {
            width: 1 + (e.value / maxEdge) * 5,
          },
        })),
      },
    ],
  }
})

function onClick(params: any) {
  if (params?.dataType !== 'node') return
  if (params.data.kind === 'repo') {
    selectedRepoId.value = selectedRepoId.value === params.data.repoId ? null : params.data.repoId
    emit('select-repo', params.data.repoId)
  }
}

function onDblClick(params: any) {
  if (params?.dataType !== 'node') return
  if (params.data.kind === 'collaborator') {
    emit('select-collaborator', params.data.id)
  }
}

function clearSelection() {
  selectedRepoId.value = null
}

defineExpose({ clearSelection })
</script>

<template>
  <VChart
    :option="option"
    :style="{ height: height || '560px', width: '100%' }"
    autoresize
    @click="onClick"
    @dblclick="onDblClick"
  />
</template>
