<script setup lang="ts">
import { onMounted } from 'vue'
import { NMessageProvider, NDialogProvider, NConfigProvider, NLoadingBarProvider, zhCN, dateZhCN } from 'naive-ui'
import { useAuthStore } from './stores/auth'
import { useAnalyticsStore } from './stores/analytics'

const auth = useAuthStore()
const analytics = useAnalyticsStore()

onMounted(async () => {
  // 只恢复登录态 + 读本地 IndexedDB，绝不自动打 GitHub/Gitee 同步接口
  await auth.restoreSession()
  void analytics.load()
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
