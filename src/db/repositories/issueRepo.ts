import type { Platform, UnifiedIssue } from '@/api/types'
import { db } from '../schema'

export const issueRepo = {
  async bulkPut(issues: UnifiedIssue[]) {
    if (issues.length) await db.issues.bulkPut(issues)
  },

  async byPlatform(platform: Platform) {
    return db.issues.where('platform').equals(platform).toArray()
  },

  async all() {
    return db.issues.toArray()
  },

  async removeByPlatform(platform: Platform) {
    await db.issues.where('platform').equals(platform).delete()
  },

  async replaceForPlatform(platform: Platform, issues: UnifiedIssue[]) {
    await db.transaction('rw', db.issues, async () => {
      await db.issues.where('platform').equals(platform).delete()
      if (issues.length) await db.issues.bulkPut(issues)
    })
  },
}
