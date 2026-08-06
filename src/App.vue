<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import {
  NMessageProvider, NDialogProvider, NConfigProvider, NLoadingBarProvider,
  zhCN, dateZhCN, enUS, dateEnUS, darkTheme,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useAuthStore } from './stores/auth'
import { useAnalyticsStore } from './stores/analytics'
import { useUiStore } from './stores/ui'
import { useSync } from './composables/useSync'
import { hasPreviouslySynced } from './sync/engine'
import { setAppLocale } from './i18n'
import { setFeedbackLocale } from './composables/useFeedback'

const auth = useAuthStore()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const { locale, isDark } = storeToRefs(ui)
const { start } = useSync()

const naiveLocale = computed(() => (locale.value === 'zh-CN' ? zhCN : enUS))
const naiveDateLocale = computed(() => (locale.value === 'zh-CN' ? dateZhCN : dateEnUS))

watch(isDark, (dark) => {
  document.documentElement.classList.toggle('dark', dark)
}, { immediate: true })

watch(locale, (loc) => {
  setAppLocale(loc)
  setFeedbackLocale(loc)
}, { immediate: true })

onMounted(async () => {
  await auth.restoreSession()
  void analytics.load()

  if (auth.anyConnected && await hasPreviouslySynced()) {
    window.setTimeout(() => {
      void start(undefined, { silent: true, recentOnly: true, recentDays: 30 })
    }, 2500)
  }
})
</script>

<template>
  <NConfigProvider
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    :theme="isDark ? darkTheme : null"
  >
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <RouterView />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
