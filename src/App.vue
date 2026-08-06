<script setup lang="ts">
import { onMounted } from 'vue'
import { NMessageProvider, NDialogProvider, NConfigProvider, NLoadingBarProvider, zhCN, dateZhCN } from 'naive-ui'
import { useAuthStore } from './stores/auth'
import { useAnalyticsStore } from './stores/analytics'
import { useSync } from './composables/useSync'
import { hasPreviouslySynced } from './sync/engine'

const auth = useAuthStore()
const analytics = useAnalyticsStore()
const { start } = useSync()

onMounted(async () => {
  await auth.restoreSession()
  void analytics.load()

  // 已有同步记录时，延迟做轻量增量，避免刚打开就和用户手动同步抢锁
  if (auth.anyConnected && await hasPreviouslySynced()) {
    window.setTimeout(() => {
      void start(undefined, { silent: true, recentOnly: true, recentDays: 30 })
    }, 2500)
  }
})
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <RouterView />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
