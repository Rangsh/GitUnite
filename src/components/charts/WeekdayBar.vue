<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'

const props = defineProps<{
  /** 0=周日 ... 6=周六 */
  data: number[]
  height?: string
}>()

const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const option = computed(() => ({
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
    data: labels,
    axisTick: { show: false },
    axisLabel: { fontSize: 11 },
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
          // 周末用暖色
          color: i === 0 || i === 6 ? '#f97316' : '#6366f1',
          borderRadius: [3, 3, 0, 0],
        },
      })),
      barCategoryGap: '45%',
    },
  ],
}))
</script>

<template>
  <VChart :option="option" :style="{ height: height || '240px', width: '100%' }" autoresize />
</template>
