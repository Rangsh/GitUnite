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

  // 已有同步记录时做轻量增量；首次不自动全量，避免打开即打穿配额
  if (auth.anyConnected && await hasPreviouslySynced()) {
    void start(undefined, { silent: true, recentOnly: true, recentDays: 30 })
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
