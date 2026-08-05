<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { NCard, NSwitch, NSpace, NText, NInput } from 'naive-ui'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { codeDetailEnabled, timezone } = storeToRefs(ui)
</script>

<template>
  <NCard title="同步选项" size="small">
    <NSpace vertical size="medium">
      <div class="flex items-center justify-between">
        <div>
          <NText>代码行明细同步</NText>
          <div class="text-xs text-gray-400">
            默认关闭以保护账号。开启后会逐条请求提交详情（Gitee 尤其耗配额），仅在需要增删行统计时打开。
          </div>
        </div>
        <NSwitch v-model:value="codeDetailEnabled" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <NText>时区</NText>
          <div class="text-xs text-gray-400">用于"凌晨提交""黄金时段"等本地时间统计，默认使用浏览器时区。</div>
        </div>
        <NInput v-model:value="timezone" placeholder="自动检测" style="max-width: 240px" />
      </div>
    </NSpace>
  </NCard>
</template>
