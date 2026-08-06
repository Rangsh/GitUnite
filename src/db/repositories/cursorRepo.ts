import { db } from '../schema'
import type { Platform, SyncCursor } from '@/api/types'

export const cursorRepo = {
  async get(platform: Platform, repoId: string): Promise<SyncCursor | undefined> {
    return db.cursors.get([platform, repoId])
  },

  async put(cursor: SyncCursor) {
    await db.cursors.put(cursor)
  },

  async allByPlatform(platform: Platform): Promise<SyncCursor[]> {
    return db.cursors.where('platform').equals(platform).toArray()
  },

  async removeByPlatform(platform: Platform) {
    await db.cursors.where('platform').equals(platform).delete()
  },

  async removeByRepoIds(platform: Platform, repoIds: string[]) {
    if (!repoIds.length) return
    await db.transaction('rw', db.cursors, async () => {
      for (const repoId of repoIds) {
        await db.cursors.where({ platform, repoId }).delete()
      }
    })
  },
}
