<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'
import type { LanguageTrendResult } from '@/utils/analytics'

const props = defineProps<{
  data: LanguageTrendResult
  height?: string
}>()

const palette = [
  '#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1',
  '#10b981', '#f97316', '#64748b', '#06b6d4', '#84cc16',
]

const option = computed(() => {
  const { periods, languages, series } = props.data
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#cbd5e1' } },
      backgroundColor: '#0f172a',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { fontSize: 11, color: '#64748b' },
    },
    grid: { left: 44, right: 16, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: periods,
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { fontSize: 10, color: '#94a3b8' },
    },
    series: languages.map((lang, i) => ({
      name: lang,
      type: 'line',
      stack: 'total',
      areaStyle: { opacity: 0.55 },
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: periods.length <= 12,
      emphasis: { focus: 'series' },
      itemStyle: { color: palette[i % palette.length] },
      lineStyle: { width: 2 },
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
  <div
    v-else
    class="flex items-center justify-center text-sm text-ink-400"
    :style="{ height: height || '300px' }"
  >
    暂无趋势数据
  </div>
</template>
