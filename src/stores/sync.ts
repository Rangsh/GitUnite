import { defineStore } from 'pinia'
import type { Platform } from '@/api/types'

export interface SyncProgress {
  platform: Platform
  phase: 'idle' | 'repos' | 'commits' | 'stats' | 'done' | 'error'
  total: number
  current: number
  message: string
}

export const useSyncStore = defineStore('sync', {
  state: () => ({
    running: false as boolean,
    progress: null as SyncProgress | null,
    lastSyncedAt: null as string | null,
  }),

  actions: {
    // TODO(M2): 由 sync/engine.ts 驱动，更新进度；同时考虑用 Web Worker 避免阻塞主线程
    setProgress(p: SyncProgress | null) {
      this.progress = p
      this.running = p !== null && p.phase !== 'done' && p.phase !== 'error'
    },
  },
})
