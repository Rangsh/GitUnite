import { db } from '../schema'
import type { Platform, UnifiedCommit } from '@/api/types'

export const commitRepo = {
  async bulkPut(commits: UnifiedCommit[]) {
    await db.commits.bulkPut(commits)
  },

  async byRepo(repoId: string) {
    return db.commits.where('repoId').equals(repoId).toArray()
  },

  async byPlatform(platform: Platform) {
    return db.commits.where('platform').equals(platform).toArray()
  },

  async all() {
    return db.commits.toArray()
  },

  async removeByPlatform(platform: Platform) {
    await db.commits.where('platform').equals(platform).delete()
  },

  async count(platform?: Platform) {
    return platform
      ? db.commits.where('platform').equals(platform).count()
      : db.commits.count()
  },
}
