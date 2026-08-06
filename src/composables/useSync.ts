import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { useAnalyticsStore } from '@/stores/analytics'
import { isGiteeFirstSync, syncAll, syncPlatform } from '@/sync/engine'
import { tryAcquireSyncLock } from '@/sync/syncLock'
import { setActiveSyncController, abortActiveSync } from '@/sync/activeSync'
import { dialog, message } from '@/composables/useFeedback'
import { t } from '@/i18n'
import type { Platform } from '@/api/types'

export interface StartOptions {
  /** 静默模式：不弹 Gitee 首次提示、不弹成功/失败 toast */
  silent?: boolean
  /**
   * 轻量增量：只同步近 N 天内有更新的仓库（默认 30 天）。
   * 可由调用方显式传入；应用不会在启动时自动同步。
   */
  recentOnly?: boolean
  recentDays?: number
  /** 忽略游标，重新拉取完整提交历史 */
  fullHistory?: boolean
  /** 为缺行数的 Gitee 提交补拉明细 */
  backfillDetails?: boolean
}

export { abortActiveSync } from '@/sync/activeSync'

export function useSync() {
  const syncStore = useSyncStore()
  const uiStore = useUiStore()
  const { running } = storeToRefs(syncStore)
  const activeProgress = computed(() => syncStore.activeProgress)

  async function start(platform?: Platform, options: StartOptions = {}) {
    // 已有同步在跑：跨按钮 / 跨页共用同一把状态，避免并发写库
    if (running.value) {
      if (!options.silent) {
        message.info(t('syncMsg.busy'))
      }
      return
    }

    // 非静默模式下，Gitee 首次同步且代码明细开启时弹窗告知耗时风险
    if (
      !options.silent
      && uiStore.codeDetailEnabled
      && (platform === 'gitee' || platform === undefined)
      && await isGiteeFirstSync()
    ) {
      dialog.warning({
        title: t('syncMsg.giteeDetailTitle'),
        content: t('syncMsg.giteeDetailBody'),
        positiveText: t('syncMsg.giteeDetailOk'),
        negativeText: t('syncMsg.giteeDetailCancel'),
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
    // 禁止因本页 running=false 就 steal：其它标签页同步中时会误抢锁导致双开打穿配额。
    // 仅当 localStorage 心跳锁已过期时，tryAcquireSyncLock(false) 内部会自然放行。
    const lock = await tryAcquireSyncLock()
    if (!lock) {
      if (!options.silent) {
        message.warning(
          running.value
            ? t('syncMsg.busyWait')
            : t('syncMsg.lockBusy'),
        )
      }
      return
    }

    const controller = new AbortController()
    setActiveSyncController(controller)
    try {
      const syncOpts = {
        signal: controller.signal,
        recentOnly: options.recentOnly,
        recentDays: options.recentDays,
        fullHistory: options.fullHistory,
        // 用户手动同步且开启了代码明细时，顺带补全历史缺行数（仍属主动点击）
        backfillDetails: options.backfillDetails ?? uiStore.codeDetailEnabled,
      }
      if (platform) await syncPlatform(platform, syncOpts)
      else await syncAll(syncOpts)

      if (!controller.signal.aborted) {
        if (!options.silent) message.success(t('syncMsg.done'))
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
      // 任意未预期失败都要清掉进行中 phase，否则 SyncButton 会永久 loading
      syncStore.resetAll()
      if (!options.silent) {
        message.error(t('syncMsg.failed', { message: (err as Error).message }))
      }
    }
    finally {
      setActiveSyncController(null)
      lock.release()
    }
  }

  function stop() {
    abortActiveSync()
    message.info(t('syncMsg.stopped'))
  }

  return {
    progress: activeProgress,
    running,
    start,
    stop,
  }
}
