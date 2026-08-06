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

  /** 删除指定 id 的仓库（远端已消失时用） */
  async removeByIds(ids: string[]) {
    if (!ids.length) return
    await db.repos.bulkDelete(ids)
  },

  async count(platform?: Platform) {
    return platform ? db.repos.where('platform').equals(platform).count() : db.repos.count()
  },
}
