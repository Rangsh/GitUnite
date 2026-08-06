<script setup lang="ts">
import { computed } from 'vue'
import { VChart } from './echarts'
import type { WordWeight } from '@/utils/wordcloud'

const props = defineProps<{
  data: WordWeight[]
  height?: string
}>()

const palette = [
  '#0d9488', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1',
  '#10b981', '#f97316', '#64748b', '#06b6d4', '#84cc16',
]

const option = computed(() => {
  const max = Math.max(...props.data.map(d => d.value), 1)
  return {
    tooltip: {
      backgroundColor: '#0f172a',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (p: any) => `${p.name}<br/>出现 <b>${p.value}</b> 次`,
    },
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '92%',
        height: '92%',
        sizeRange: [14, 52],
        rotationRange: [-30, 30],
        rotationStep: 15,
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: {
          fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
          fontWeight: 600,
          color: () => palette[Math.floor(Math.random() * palette.length)],
        },
        emphasis: {
          textStyle: { textShadowBlur: 8, textShadowColor: 'rgba(13,148,136,0.4)' },
        },
        data: props.data.map(d => ({
          name: d.name,
          value: d.value,
          // 线性映射字号，避免最大词独占画面
          textStyle: { fontSize: 14 + (d.value / max) * 38 },
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
  <div
    v-else
    class="flex items-center justify-center text-sm text-ink-400"
    :style="{ height: height || '320px' }"
  >
    暂无足够的提交信息生成词云
  </div>
</template>
