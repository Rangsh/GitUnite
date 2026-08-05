<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { NCard, NButton, NSpace, NPopconfirm } from 'naive-ui'
import { db } from '@/db/schema'

const message = useMessage()

async function clearAll() {
  await Promise.all([
    db.repos.clear(),
    db.commits.clear(),
    db.issues.clear(),
    db.cursors.clear(),
    db.repoStats.clear(),
  ])
  localStorage.removeItem('gitunite:token:github')
  localStorage.removeItem('gitunite:token:gitee')
  message.success('已清除全部本地数据，即将刷新页面')
  setTimeout(() => location.reload(), 800)
}
</script>

<template>
  <NCard title="危险操作" size="small" header-style="color: #d03050">
    <NSpace>
      <NPopconfirm @positive-click="clearAll">
        <template #trigger>
          <NButton type="error" ghost>清除全部本地数据</NButton>
        </template>
        将删除所有 Token、缓存的仓库与提交记录，不可恢复。确定继续？
      </NPopconfirm>
    </NSpace>
  </NCard>
</template>
