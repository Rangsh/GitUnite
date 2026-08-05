<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'
import type { LanguageStat } from '@/utils/analytics'
import { formatBytes } from '@/utils/date'

const props = defineProps<{
  data: LanguageStat[]
  loading?: boolean
  height?: string
}>()

const palette = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#eab308',
]

const option = computed(() => {
  const items = props.data.slice(0, 12)
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const d = items[p.dataIndex]
        if (!d) return p.name
        return `<b>${d.language}</b><br/>${formatBytes(d.bytes)} · ${(d.percentage * 100).toFixed(1)}%<br/>${d.repoCount} 个仓库`
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { fontSize: 12 },
    },
    series: [
      {
        name: '语言占比',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: items.map((d, i) => ({
          name: d.language,
          value: d.bytes,
          itemStyle: { color: palette[i % palette.length] },
        })),
      },
    ],
  }
})
</script>

<template>
  <VChart
    v-if="data.length"
    :option="option"
    :style="{ height: height || '320px', width: '100%' }"
    autoresize
  />
  <div v-else class="flex items-center justify-center text-gray-400 text-sm" :style="{ height: height || '320px' }">
    暂无语言数据
  </div>
</template>
