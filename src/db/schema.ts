import Dexie, { type Table } from 'dexie'
import type { UnifiedUser, UnifiedRepo, UnifiedCommit, UnifiedIssue, SyncCursor } from '@/api/types'

export class GitUniteDB extends Dexie {
  users!: Table<UnifiedUser, string>
  repos!: Table<UnifiedRepo, string>
  commits!: Table<UnifiedCommit, string>
  issues!: Table<UnifiedIssue, string>
  cursors!: Table<SyncCursor, string>

  constructor() {
    super('GitUnite')

    this.version(1).stores({
      users: 'id, platform, login',
      repos: 'id, platform, fullName, owner, isOwned, isContributed, updatedAt',
      commits: 'id, repoId, platform, sha, authorLogin, authoredAt',
      issues: 'id, repoId, platform, number, type, state, createdAt, mergedAt',
      cursors: '[platform+repoId], platform, lastSyncedAt',
    })
  }
}

export const db = new GitUniteDB()
