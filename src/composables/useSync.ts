import { useSyncStore } from '@/stores/sync'
import { syncAll, syncPlatform } from '@/sync/engine'
import type { Platform } from '@/api/types'

export function useSync() {
  const syncStore = useSyncStore()

  async function start(platform?: Platform) {
    if (platform) await syncPlatform(platform)
    else await syncAll()
  }

  return {
    progress: syncStore.progress,
    running: syncStore.running,
    start,
  }
}
