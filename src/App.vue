<script setup lang="ts">
import { onMounted } from 'vue'
import { NMessageProvider, NDialogProvider, NConfigProvider, NLoadingBarProvider, zhCN, dateZhCN } from 'naive-ui'
import AppLayout from './components/layout/AppLayout.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
onMounted(() => {
  auth.restoreSession()
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
