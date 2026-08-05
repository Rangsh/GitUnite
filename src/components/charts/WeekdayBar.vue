<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'

const props = defineProps<{
  /** 0=周日 ... 6=周六 */
  data: number[]
  height?: string
}>()

/** PRD：周一至周日；内部桶仍是 JS 惯例 0=周日 */
const labels = ['一', '二', '三', '四', '五', '六', '日']
const order = [1, 2, 3, 4, 5, 6, 0]

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0f172a',
    borderWidth: 0,
    textStyle: { color: '#f8fafc', fontSize: 12 },
    formatter: (params: any) => {
      const p = params[0]
      return `周${p.name}<br/>提交 <b>${p.value}</b> 次`
    },
  },
  grid: { left: 36, right: 8, top: 12, bottom: 28 },
  xAxis: {
    type: 'category',
    data: labels,
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
  series: [
    {
      type: 'bar',
      data: order.map((dayIndex) => {
        const v = props.data[dayIndex] ?? 0
        const weekend = dayIndex === 0 || dayIndex === 6
        return {
          value: v,
          itemStyle: {
            color: weekend ? '#f59e0b' : '#334155',
            borderRadius: [4, 4, 0, 0],
          },
        }
      }),
      barCategoryGap: '40%',
    },
  ],
}))
</script>

<template>
  <VChart :option="option" :style="{ height: height || '220px', width: '100%' }" autoresize />
</template>
