import type { Platform } from '@/api/types'
import { db, type RepoWeeklyStat } from '../schema'

export const repoStatRepo = {
  async put(stat: RepoWeeklyStat) {
    await db.repoStats.put(stat)
  },

  async get(repoId: string) {
    return db.repoStats.get(repoId)
  },

  async byPlatform(platform: Platform) {
    return db.repoStats.where('platform').equals(platform).toArray()
  },

  async all() {
    return db.repoStats.toArray()
  },

  async removeByPlatform(platform: Platform) {
    await db.repoStats.where('platform').equals(platform).delete()
  },

  async removeByRepoIds(repoIds: string[]) {
    if (!repoIds.length) return
    await db.repoStats.bulkDelete(repoIds)
  },
}
