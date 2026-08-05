<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag, NModal, NSpace, NText } from 'naive-ui'
import { RefreshCw } from 'lucide-vue-next'
import { useSync } from '@/composables/useSync'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ platform?: 'github' | 'gitee' }>()

const auth = useAuthStore()
const { progress, running, giteePromptVisible, start, stop, confirmGiteeStart, cancelGiteeStart } = useSync()

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
    <NTag v-if="progress" :type="progress.phase === 'error' ? 'error' : progress.phase === 'done' ? 'success' : 'info'">
      {{ progress.message }}
    </NTag>

    <NModal
      :show="giteePromptVisible"
      preset="card"
      title="Gitee 代码明细同步提示"
      style="max-width: 520px"
      :closable="false"
      :mask-closable="false"
    >
      <NSpace vertical>
        <NText>
          Gitee 平台不提供代码行聚合接口，开启代码明细同步后需要逐个提交请求详情，耗时较长且容易触发限流。
        </NText>
        <NText depth="3">
          你可以在「设置 - 同步选项」中关闭「代码行明细同步」来加快速度；关闭后只统计提交次数，不影响其他功能。
        </NText>
        <NSpace justify="end">
          <NButton @click="cancelGiteeStart">暂不同步</NButton>
          <NButton type="primary" @click="confirmGiteeStart">我知道了，开始同步</NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </NSpace>
</template>
