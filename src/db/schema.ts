import Dexie, { type Table } from 'dexie'
import type { Platform, UnifiedCommit, UnifiedIssue, UnifiedRepo, UnifiedUser, SyncCursor } from '@/api/types'

export interface RepoWeeklyStat {
  /** 同 UnifiedRepo.id */
  repoId: string
  platform: Platform
  /** 总新增行数 */
  additions: number
  /** 总删除行数 */
  deletions: number
  /** 周起始 unix 秒 -> { a, d, c } */
  weeks: { w: number, a: number, d: number, c: number }[]
  updatedAt: string
}

/**
 * 成就徽章持久化记录（对应 PRD 3.8）。
 * 徽章本身由提交数据实时计算，这里只持久化“首次达成时间”等本地状态，
 * 供分享卡片选择露出（M5）以及跨会话保留达成时刻。
 */
export interface AchievementRecord {
  /** 徽章 id，见 utils/badges.ts 的 BADGES */
  id: string
  /** 依据提交数据推算的达成日期（YYYY-MM-DD） */
  achievedAt: string | null
  updatedAt: string
}

export class GitUniteDB extends Dexie {
  users!: Table<UnifiedUser, string>
  repos!: Table<UnifiedRepo, string>
  commits!: Table<UnifiedCommit, string>
  issues!: Table<UnifiedIssue, string>
  cursors!: Table<SyncCursor, string>
  repoStats!: Table<RepoWeeklyStat, string>
  achievements!: Table<AchievementRecord, string>

  constructor() {
    super('GitUnite')

    this.version(1).stores({
      users: 'id, platform, login',
      repos: 'id, platform, fullName, owner, isOwned, isContributed, updatedAt',
      commits: 'id, repoId, platform, sha, authorLogin, authoredAt',
      issues: 'id, repoId, platform, number, type, state, createdAt, mergedAt',
      cursors: '[platform+repoId], platform, lastSyncedAt',
      repoStats: 'repoId, platform',
    })

    // M4：成就徽章本地状态
    this.version(2).stores({
      achievements: 'id, achievedAt, updatedAt',
    })
  }
}

export const db = new GitUniteDB()
