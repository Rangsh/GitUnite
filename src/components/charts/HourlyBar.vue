<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'

const props = defineProps<{
  /** 0-23 点提交桶 */
  data: number[]
  /** 黄金时段起始小时 */
  goldenStart?: number
  height?: string
}>()

const option = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}`)
  const gs = props.goldenStart ?? 9
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}:00<br/>提交 <b>${p.value}</b> 次`
      },
    },
    grid: { left: 36, right: 8, top: 12, bottom: 28 },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { fontSize: 10, color: '#94a3b8', interval: 2 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLabel: { fontSize: 10, color: '#94a3b8' },
    },
    series: [
      {
        type: 'bar',
        data: props.data.map((v, i) => ({
          value: v,
          itemStyle: {
            color: i >= gs && i < gs + 3 ? '#0d9488' : '#cbd5e1',
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barCategoryGap: '35%',
      },
    ],
  }
})
</script>

<template>
  <VChart :option="option" :style="{ height: height || '220px', width: '100%' }" autoresize />
</template>
