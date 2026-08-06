import { defineStore } from 'pinia'
import type { Platform } from '@/api/types'

export type SyncPhase = 'idle' | 'repos' | 'commits' | 'stats' | 'done' | 'error'

export interface SyncProgress {
  platform: Platform
  phase: SyncPhase
  total: number
  current: number
  message: string
}

interface SyncState {
  progress: Record<Platform, SyncProgress | null>
  lastSyncedAt: string | null
}

export const useSyncStore = defineStore('sync', {
  state: (): SyncState => ({
    progress: { github: null, gitee: null },
    lastSyncedAt: null,
  }),

  getters: {
    // 任一平台在跑就视为同步中
    running(state): boolean {
      return (['github', 'gitee'] as Platform[]).some((p) => {
        const ph = state.progress[p]?.phase
        return ph && ph !== 'done' && ph !== 'error'
      })
    },
    // 合并两个平台的进度信息，用于 UI 展示
    activeProgress(state): SyncProgress | null {
      const running = (['github', 'gitee'] as Platform[]).find((p) => {
        const ph = state.progress[p]?.phase
        return ph && ph !== 'done'
      })
      if (running) return state.progress[running]
      // 两个都结束时优先返回 error
      const errored = (['github', 'gitee'] as Platform[]).find(p => state.progress[p]?.phase === 'error')
      return errored ? state.progress[errored] : state.progress.github ?? state.progress.gitee
    },
  },

  actions: {
    setProgress(p: SyncProgress) {
      this.progress[p.platform] = { ...p }
      if (p.phase === 'done') {
        this.lastSyncedAt = new Date().toISOString()
      }
    },

    resetPlatform(platform: Platform) {
      this.progress[platform] = null
    },

    resetAll() {
      this.progress.github = null
      this.progress.gitee = null
    },
  },
})
