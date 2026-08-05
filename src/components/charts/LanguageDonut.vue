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
  '#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1',
  '#10b981', '#f97316', '#64748b', '#06b6d4', '#84cc16',
  '#8b5cf6', '#eab308',
]

const option = computed(() => {
  const items = props.data.slice(0, 12)
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#0f172a',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (p: any) => {
        const d = items[p.dataIndex]
        if (!d) return p.name
        return `<b>${d.language}</b><br/>${formatBytes(d.bytes)} · ${(d.percentage * 100).toFixed(1)}%<br/>${d.repoCount} 个仓库`
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 4,
      top: 'middle',
      textStyle: { fontSize: 11, color: '#64748b' },
      pageIconColor: '#64748b',
    },
    series: [
      {
        name: '语言占比',
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 4 },
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
    :style="{ height: height || '280px', width: '100%' }"
    autoresize
  />
  <div
    v-else
    class="flex items-center justify-center text-sm text-ink-400"
    :style="{ height: height || '280px' }"
  >
    暂无语言数据
  </div>
</template>
