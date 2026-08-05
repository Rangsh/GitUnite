<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'
import type { HeatmapPoint } from '@/utils/analytics'

const props = defineProps<{
  data: HeatmapPoint[]
  metric: 'commits' | 'code'
  theme?: 'default' | 'colorblind' | 'dark'
  height?: string
}>()

const emit = defineEmits<{
  (e: 'select', date: string): void
}>()

const colorRanges = computed(() => {
  if (props.theme === 'colorblind') {
    return ['#f0f0f0', '#ccebc5', '#7bccc4', '#43a2ca', '#0868ac']
  }
  if (props.theme === 'dark') {
    return ['#1e293b', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa']
  }
  // GitHub 风格绿
  return ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
})

const maxValue = computed(() => {
  if (!props.data.length) return 1
  if (props.metric === 'commits') {
    return Math.max(...props.data.map(d => d.commits), 1)
  }
  return Math.max(...props.data.map(d => d.additions + d.deletions), 1)
})

const range = computed(() => {
  if (!props.data.length) return ['2024-01-01', '2024-01-01'] as [string, string]
  // 必须用 YYYY-MM-DD 字符串；new Date('YYYY-MM-DD') 会按 UTC 解析导致东八区偏一天
  return [props.data[0].date, props.data[props.data.length - 1].date] as [string, string]
})

const option = computed(() => {
  const metric = props.metric
  const values = props.data.map((d) => {
    const v = metric === 'commits' ? d.commits : d.additions + d.deletions
    return [d.date, v]
  })

  const textColor = props.theme === 'dark' ? '#cbd5e1' : '#475569'

  return {
    tooltip: {
      formatter: (p: any) => {
        const point = props.data[p.dataIndex]
        if (!point) return p.value[0]
        const lines = point.commits + point.additions + point.deletions === 0
          ? '无提交'
          : `${point.commits} 次提交<br/>+${point.additions} / -${point.deletions}`
        return `<b>${p.value[0]}</b><br/>${lines}`
      },
    },
    visualMap: {
      min: 0,
      max: maxValue.value,
      show: false,
      inRange: { color: colorRanges.value },
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
    },
    calendar: {
      top: 24,
      left: 40,
      right: 24,
      cellSize: ['auto', 16],
      range: range.value,
      itemStyle: { borderWidth: 2, borderColor: props.theme === 'dark' ? '#0f172a' : '#fff' },
      splitLine: { show: false },
      yearLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        nameMap: ['日', '一', '二', '三', '四', '五', '六'],
        color: textColor,
        fontSize: 11,
      },
      monthLabel: {
        nameMap: 'ZH',
        color: textColor,
        fontSize: 11,
      },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: values,
      },
    ],
  }
})

function onChartClick(params: any) {
  if (params?.value?.[0]) {
    emit('select', params.value[0])
  }
}
</script>

<template>
  <VChart
    :option="option"
    :style="{ height: height || '220px', width: '100%' }"
    autoresize
    @click="onChartClick"
  />
</template>
