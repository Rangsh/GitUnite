import { db } from '../schema'
import type { Platform, UnifiedRepo } from '@/api/types'

export const repoRepo = {
  async bulkPut(repos: UnifiedRepo[]) {
    await db.repos.bulkPut(repos)
  },

  async all(platform?: Platform) {
    return platform
      ? db.repos.where('platform').equals(platform).toArray()
      : db.repos.toArray()
  },

  async get(id: string) {
    return db.repos.get(id)
  },

  async removeByPlatform(platform: Platform) {
    await db.repos.where('platform').equals(platform).delete()
  },

  async count(platform?: Platform) {
    return platform ? db.repos.where('platform').equals(platform).count() : db.repos.count()
  },
}
