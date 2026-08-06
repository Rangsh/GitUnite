<script setup lang="ts">
import { NButton, NPopconfirm, NText } from 'naive-ui'
import { clearEtagCache } from '@/api/http'
import { db } from '@/db/schema'
import { useAnalyticsStore } from '@/stores/analytics'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/composables/useFeedback'

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
    db.users.clear(),
  ])
  clearEtagCache()
  useAnalyticsStore().reset()
  message.success('已清除全部本地数据，即将刷新页面')
  setTimeout(() => location.reload(), 800)
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-panel">
    <div class="border-b border-red-100 px-5 py-4">
      <h2 class="m-0 text-base font-semibold text-red-600">危险操作</h2>
      <p class="mt-1 text-xs text-ink-400">
        将删除 Token、仓库、提交、游标、周统计与成就徽章，不可恢复。
      </p>
    </div>
    <div class="px-5 py-4">
      <NPopconfirm @positive-click="clearAll">
        <template #trigger>
          <NButton type="error" ghost class="!rounded-xl">清除全部本地数据</NButton>
        </template>
        <NText>确定清除全部本地数据？此操作不可撤销。</NText>
      </NPopconfirm>
    </div>
  </section>
</template>
