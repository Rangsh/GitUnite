<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NPopconfirm, NText } from 'naive-ui'
import { clearEtagCache } from '@/api/http'
import { db } from '@/db/schema'
import { useAnalyticsStore } from '@/stores/analytics'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/composables/useFeedback'

const { t } = useI18n()

async function clearAll() {
  const auth = useAuthStore()
  // 先走 store 断开，清空 useStorage 绑定的 Token，避免 reload 前被写回 localStorage
  if (auth.isConnected('github')) await auth.disconnect('github')
  if (auth.isConnected('gitee')) await auth.disconnect('gitee')

  await Promise.all([
    db.repos.clear(),
    db.commits.clear(),
    db.issues.clear(),
    db.cursors.clear(),
    db.repoStats.clear(),
    db.achievements.clear(),
  ])
  clearEtagCache()
  useAnalyticsStore().reset()
  message.success(t('danger.cleared'))
  setTimeout(() => location.reload(), 800)
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-panel">
    <div class="border-b border-red-100 px-5 py-4">
      <h2 class="m-0 text-base font-semibold text-red-600">{{ t('danger.title') }}</h2>
      <p class="mt-1 text-xs text-ink-400">
        {{ t('danger.desc') }}
      </p>
    </div>
    <div class="px-5 py-4">
      <NPopconfirm @positive-click="clearAll">
        <template #trigger>
          <NButton type="error" ghost class="!rounded-xl">{{ t('danger.clearBtn') }}</NButton>
        </template>
        <NText>{{ t('danger.clearConfirm') }}</NText>
      </NPopconfirm>
    </div>
  </section>
</template>
