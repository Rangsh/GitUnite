import { db, type AchievementRecord } from '../schema'

export const achievementRepo = {
  async get(id: string) {
    return db.achievements.get(id)
  },

  async all() {
    return db.achievements.toArray()
  },

  async put(record: AchievementRecord) {
    await db.achievements.put(record)
  },

  async bulkPut(records: AchievementRecord[]) {
    if (records.length) await db.achievements.bulkPut(records)
  },

  async clear() {
    await db.achievements.clear()
  },
}
