<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag, NSpace } from 'naive-ui'
import { RefreshCw } from 'lucide-vue-next'
import { useSync } from '@/composables/useSync'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ platform?: 'github' | 'gitee' }>()

const auth = useAuthStore()
const { progress, running, start, stop } = useSync()

const disabled = computed(() => {
  if (props.platform) return !auth.isConnected(props.platform)
  return !auth.anyConnected
})

const label = computed(() => {
  if (running.value) return '同步中…'
  return props.platform ? `同步 ${props.platform === 'github' ? 'GitHub' : 'Gitee'}` : '一键同步'
})
</script>

<template>
  <NSpace align="center">
    <NButton
      type="primary"
      :disabled="disabled"
      :loading="running"
      @click="start(props.platform)"
    >
      <template #icon>
        <RefreshCw :size="16" />
      </template>
      {{ label }}
    </NButton>
    <NButton v-if="running" quaternary size="small" @click="stop">
      停止
    </NButton>
    <NTag
      v-if="progress"
      :type="progress.phase === 'error' ? 'error' : progress.phase === 'done' ? 'success' : 'info'"
    >
      {{ progress.message }}
    </NTag>
  </NSpace>
</template>
