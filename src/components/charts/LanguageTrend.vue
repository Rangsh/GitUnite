<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'
import type { LanguageTrendResult } from '@/utils/analytics'

const props = defineProps<{
  data: LanguageTrendResult
  height?: string
}>()

const palette = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]

const option = computed(() => {
  const { periods, languages, series } = props.data
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 44, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: periods,
      axisTick: { show: false },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: { fontSize: 11 },
    },
    series: languages.map((lang, i) => ({
      name: lang,
      type: 'line',
      stack: 'total',
      areaStyle: { opacity: 0.7 },
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: periods.length <= 12,
      emphasis: { focus: 'series' },
      itemStyle: { color: palette[i % palette.length] },
      data: series[lang],
    })),
  }
})
</script>

<template>
  <VChart
    v-if="data.periods.length"
    :option="option"
    :style="{ height: height || '300px', width: '100%' }"
    autoresize
  />
  <div v-else class="flex items-center justify-center text-gray-400 text-sm" :style="{ height: height || '300px' }">
    暂无趋势数据
  </div>
</template>
