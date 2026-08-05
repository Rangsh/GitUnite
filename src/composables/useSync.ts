import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { isGiteeFirstSync, syncAll, syncPlatform } from '@/sync/engine'
import type { Platform } from '@/api/types'

const abortController = ref<AbortController | null>(null)
const giteePromptVisible = ref(false)
const pendingStart = ref<{ platform?: Platform } | null>(null)

export function useSync() {
  const syncStore = useSyncStore()
  const uiStore = useUiStore()
  const { progress, running } = storeToRefs(syncStore)

  async function start(platform?: Platform) {
    // Gitee 首次同步且代码明细开启时，弹窗告知耗时风险
    if (
      uiStore.codeDetailEnabled
      && (platform === 'gitee' || platform === undefined)
      && await isGiteeFirstSync()
    ) {
      pendingStart.value = { platform }
      giteePromptVisible.value = true
      return
    }
    await doStart(platform)
  }

  async function confirmGiteeStart() {
    giteePromptVisible.value = false
    const target = pendingStart.value?.platform
    pendingStart.value = null
    await doStart(target)
  }

  function cancelGiteeStart() {
    giteePromptVisible.value = false
    pendingStart.value = null
  }

  async function doStart(platform?: Platform) {
    if (syncStore.running) return
    abortController.value = new AbortController()
    try {
      if (platform) await syncPlatform(platform, { signal: abortController.value.signal })
      else await syncAll({ signal: abortController.value.signal })
    }
    finally {
      abortController.value = null
    }
  }

  function stop() {
    abortController.value?.abort()
  }

  return {
    progress,
    running,
    giteePromptVisible,
    start,
    stop,
    confirmGiteeStart,
    cancelGiteeStart,
  }
}
