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
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  const gs = props.goldenStart ?? 9
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}<br/>提交 <b>${p.value}</b> 次`
      },
    },
    grid: { left: 40, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { fontSize: 10, interval: 2 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: props.data.map((v, i) => ({
          value: v,
          itemStyle: {
            color: i >= gs && i < gs + 3 ? '#f59e0b' : '#3b82f6',
            borderRadius: [3, 3, 0, 0],
          },
        })),
        barCategoryGap: '40%',
      },
    ],
  }
})
</script>

<template>
  <VChart :option="option" :style="{ height: height || '240px', width: '100%' }" autoresize />
</template>
