<script setup lang="ts">
import { onMounted } from 'vue'
import { NMessageProvider, NDialogProvider, NConfigProvider, NLoadingBarProvider, zhCN, dateZhCN } from 'naive-ui'
import AppLayout from './components/layout/AppLayout.vue'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'
import { useSync } from './composables/useSync'
import { hasPreviouslySynced } from './sync/engine'

const auth = useAuthStore()
const ui = useUiStore()

onMounted(async () => {
  await auth.restoreSession()

  // 启动时自动轻量增量同步（仅在已有历史数据、且用户未关闭该开关时）。
  // 首次使用不自动触发，避免在用户尚未看到引导时就开始耗时的全量同步。
  if (ui.autoIncrementalSync && auth.anyConnected && await hasPreviouslySynced()) {
    const { start } = useSync()
    void start(undefined, { silent: true, recentOnly: true, recentDays: 30 })
  }
})
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <AppLayout />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
