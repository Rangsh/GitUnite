import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { useAnalyticsStore } from '@/stores/analytics'
import { isGiteeFirstSync, syncAll, syncPlatform } from '@/sync/engine'
import { tryAcquireSyncLock } from '@/sync/syncLock'
import { dialog, message } from '@/composables/useFeedback'
import type { Platform } from '@/api/types'

const abortController = ref<AbortController | null>(null)

export interface StartOptions {
  /** 静默模式：不弹 Gitee 首次提示、不弹成功/失败 toast（启动自动同步用） */
  silent?: boolean
  /** 轻量增量：只同步近 N 天活跃的仓库 */
  recentOnly?: boolean
  recentDays?: number
  /** 忽略游标，重新拉取完整提交历史 */
  fullHistory?: boolean
  /** 为缺行数的 Gitee 提交补拉明细 */
  backfillDetails?: boolean
}

export function useSync() {
  const syncStore = useSyncStore()
  const uiStore = useUiStore()
  const { running } = storeToRefs(syncStore)
  const activeProgress = computed(() => syncStore.activeProgress)

  async function start(platform?: Platform, options: StartOptions = {}) {
    if (running.value) return

    // 非静默模式下，Gitee 首次同步且代码明细开启时弹窗告知耗时风险
    if (
      !options.silent
      && uiStore.codeDetailEnabled
      && (platform === 'gitee' || platform === undefined)
      && await isGiteeFirstSync()
    ) {
      dialog.warning({
        title: 'Gitee 代码明细同步提示',
        content:
          'Gitee 平台不提供代码行聚合接口，开启代码明细同步后需要逐个提交请求详情，耗时较长且容易触发限流。\n\n建议在「设置 - 同步选项」中保持关闭；仅在确实需要增删行统计时开启。本次同步仍会限制明细请求数量以保护账号。',
        positiveText: '我知道了，开始同步',
        negativeText: '暂不同步',
        // 注意：不要 await doStart()，否则对话框会一直 loading 到整个同步结束才关闭。
        onPositiveClick: () => {
          void doStart(platform, options)
        },
      })
      return
    }

    await doStart(platform, options)
  }

  async function doStart(platform?: Platform, options: StartOptions = {}) {
    const lock = await tryAcquireSyncLock()
    if (!lock) {
      if (!options.silent) {
        message.warning('另一个标签页正在同步，请稍后再试（防止双开打穿平台限流）')
      }
      return
    }

    abortController.value = new AbortController()
    try {
      const syncOpts = {
        signal: abortController.value.signal,
        recentOnly: options.recentOnly,
        recentDays: options.recentDays,
        fullHistory: options.fullHistory,
        backfillDetails: options.backfillDetails,
      }
      if (platform) await syncPlatform(platform, syncOpts)
      else await syncAll(syncOpts)

      if (!abortController.value?.signal.aborted) {
        if (!options.silent) message.success('同步完成')
        // 后台刷新看板，不阻塞同步收尾；refresh 内部用 shallowRef，避免卡住路由
        void useAnalyticsStore().refresh()
      }
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        syncStore.resetAll()
        return
      }
      // axios / fetch 取消
      if ((err as { code?: string, name?: string })?.code === 'ERR_CANCELED') {
        syncStore.resetAll()
        return
      }
      if ((err as { name?: string })?.name === 'CanceledError') {
        syncStore.resetAll()
        return
      }
      if (!options.silent) {
        message.error(`同步失败：${(err as Error).message}`)
      }
    }
    finally {
      abortController.value = null
      lock.release()
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
