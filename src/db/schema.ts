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

export class GitUniteDB extends Dexie {
  users!: Table<UnifiedUser, string>
  repos!: Table<UnifiedRepo, string>
  commits!: Table<UnifiedCommit, string>
  issues!: Table<UnifiedIssue, string>
  cursors!: Table<SyncCursor, string>
  repoStats!: Table<RepoWeeklyStat, string>

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
  }
}

export const db = new GitUniteDB()
