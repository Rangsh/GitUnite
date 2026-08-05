<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NSwitch, NSpace, NText } from 'naive-ui'

const codeDetailEnabled = ref(true)
const autoIncrementalSync = ref(true)
const timezone = ref('')

// TODO: 接入 ui store，读写 LocalStorage；切换代码明细开关时触发补全同步
</script>

<template>
  <NCard title="同步选项" size="small">
    <NSpace vertical size="medium">
      <div class="flex items-center justify-between">
        <div>
          <NText>代码行明细同步</NText>
          <div class="text-xs text-gray-400">
            关闭后只统计提交次数，不统计新增/删除行数。Gitee 无聚合接口，开启后同步较慢。
          </div>
        </div>
        <NSwitch v-model:value="codeDetailEnabled" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <NText>启动时自动增量同步</NText>
          <div class="text-xs text-gray-400">每次打开应用自动拉取最近 30 天的新数据。</div>
        </div>
        <NSwitch v-model:value="autoIncrementalSync" />
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
