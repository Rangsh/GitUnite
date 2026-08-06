<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { NSelect, NSwitch, NText } from 'naive-ui'
import { useUiStore } from '@/stores/ui'
import { useSync } from '@/composables/useSync'
import { isValidTimezone, dayjs } from '@/utils/date'

const ui = useUiStore()
const { codeDetailEnabled, timezone, theme } = storeToRefs(ui)
const { start } = useSync()

const guessed = dayjs.tz.guess() || 'UTC'

const timezoneOptions = computed(() => {
  const commons = [
    guessed,
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Singapore',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
  ]
  const uniq = [...new Set(commons.filter(Boolean))]
  return [
    { label: `浏览器默认（${guessed}）`, value: '' },
    ...uniq.map(z => ({ label: z, value: z })),
  ]
})

const tzInvalid = computed(() => !!timezone.value && !isValidTimezone(timezone.value))

const themeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

// 开启代码明细后触发一次补全同步（Gitee 缺行数的提交）
watch(codeDetailEnabled, (on, was) => {
  if (on && was === false) {
    void start(undefined, { silent: false, backfillDetails: true })
  }
})
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
    <div class="border-b border-ink-100 px-5 py-4">
      <h2 class="m-0 text-base font-semibold text-ink-900">同步与外观</h2>
      <p class="mt-1 text-xs text-ink-400">影响统计口径、请求成本与界面主题</p>
    </div>
    <div class="space-y-5 px-5 py-4">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <NText class="!text-ink-800">代码行明细同步</NText>
          <div class="mt-0.5 text-xs text-ink-400">
            默认关闭以保护账号。开启后会逐条请求提交详情（Gitee 尤其耗配额），并自动补全已有提交的缺省行数。
          </div>
        </div>
        <NSwitch v-model:value="codeDetailEnabled" />
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <NText class="!text-ink-800">时区</NText>
          <div class="mt-0.5 text-xs text-ink-400">用于深夜提交、黄金时段等本地时间统计</div>
          <div v-if="tzInvalid" class="mt-1 text-xs text-red-500">无效的 IANA 时区，将回退到浏览器默认</div>
        </div>
        <NSelect
          v-model:value="timezone"
          :options="timezoneOptions"
          filterable
          tag
          placeholder="自动检测"
          class="sm:max-w-[280px] w-full"
          :status="tzInvalid ? 'error' : undefined"
        />
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <NText class="!text-ink-800">外观主题</NText>
          <div class="mt-0.5 text-xs text-ink-400">深色模式作用于侧栏、顶栏与内容区</div>
        </div>
        <NSelect
          v-model:value="theme"
          :options="themeOptions"
          class="sm:max-w-[180px] w-full"
        />
      </div>
    </div>
  </section>
</template>
