import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { isGiteeFirstSync, syncAll, syncPlatform } from '@/sync/engine'
import { dialog, message } from '@/composables/useFeedback'
import type { Platform } from '@/api/types'

const abortController = ref<AbortController | null>(null)

export function useSync() {
  const syncStore = useSyncStore()
  const uiStore = useUiStore()
  const { running } = storeToRefs(syncStore)
  const activeProgress = computed(() => syncStore.activeProgress)

  async function start(platform?: Platform) {
    if (running.value) return

    // Gitee 首次同步且代码明细开启时，弹窗告知耗时风险
    if (
      uiStore.codeDetailEnabled
      && (platform === 'gitee' || platform === undefined)
      && await isGiteeFirstSync()
    ) {
      dialog.warning({
        title: 'Gitee 代码明细同步提示',
        content:
          'Gitee 平台不提供代码行聚合接口，开启代码明细同步后需要逐个提交请求详情，耗时较长且容易触发限流。\n\n你可以在「设置 - 同步选项」中关闭「代码行明细同步」来加快速度；关闭后只统计提交次数，不影响其他功能。',
        positiveText: '我知道了，开始同步',
        negativeText: '暂不同步',
        // 注意：不要 await doStart()，否则对话框会一直 loading 到整个同步结束才关闭。
        // 同步在后台执行，进度由 syncStore / message 展示。
        onPositiveClick: () => {
          void doStart(platform)
        },
      })
      return
    }

    await doStart(platform)
  }

  async function doStart(platform?: Platform) {
    abortController.value = new AbortController()
    try {
      if (platform) await syncPlatform(platform, { signal: abortController.value.signal })
      else await syncAll({ signal: abortController.value.signal })

      if (!abortController.value?.signal.aborted) {
        message.success('同步完成')
      }
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      message.error(`同步失败：${(err as Error).message}`)
    }
    finally {
      abortController.value = null
    }
  }

  function stop() {
    abortController.value?.abort()
    message.info('已停止同步')
  }

  return {
    progress: activeProgress,
    running,
    start,
    stop,
  }
}
