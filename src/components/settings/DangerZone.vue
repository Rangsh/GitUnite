<script setup lang="ts">
import { NCard, NButton, NSpace, NPopconfirm } from 'naive-ui'

// TODO: 调用 auth store / db 清除数据
function clearAll() {
  // localStorage.clear + db.delete() + location.reload()
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
