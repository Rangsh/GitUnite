<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NTag, NSpace } from 'naive-ui'
import { RefreshCw } from 'lucide-vue-next'
import { useSync } from '@/composables/useSync'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  platform?: 'github' | 'gitee'
  /** 顶栏等窄位：隐藏进度 Tag，按钮更紧凑 */
  compact?: boolean
}>()

const { t } = useI18n()
const auth = useAuthStore()
const { progress, running, start, stop } = useSync()

const disabled = computed(() => {
  if (props.platform) return !auth.isConnected(props.platform)
  return !auth.anyConnected
})

const label = computed(() => {
  if (running.value) return t('common.syncing')
  if (props.platform) {
    return t('common.syncPlatform', {
      name: props.platform === 'github' ? t('common.github') : t('common.gitee'),
    })
  }
  return t('common.syncOne')
})
</script>

<template>
  <NSpace align="center" :size="props.compact ? 6 : 'medium'">
    <NButton
      type="primary"
      :size="props.compact ? 'small' : 'medium'"
      :disabled="disabled"
      :loading="running"
      class="!rounded-lg"
      @click="start(props.platform)"
    >
      <template #icon>
        <RefreshCw :size="props.compact ? 14 : 16" />
      </template>
      {{ label }}
    </NButton>
    <NButton v-if="running" quaternary size="small" @click="stop">
      {{ t('common.stop') }}
    </NButton>
    <NTag
      v-if="progress && !props.compact"
      :type="progress.phase === 'error' ? 'error' : progress.phase === 'done' ? 'success' : 'info'"
    >
      {{ progress.message }}
    </NTag>
  </NSpace>
</template>
