<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NTag, NSpace } from 'naive-ui'
import { RefreshCw } from 'lucide-vue-next'
import { useSync } from '@/composables/useSync'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ platform?: 'github' | 'gitee' }>()

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
      {{ t('common.stop') }}
    </NButton>
    <NTag
      v-if="progress"
      :type="progress.phase === 'error' ? 'error' : progress.phase === 'done' ? 'success' : 'info'"
    >
      {{ progress.message }}
    </NTag>
  </NSpace>
</template>
