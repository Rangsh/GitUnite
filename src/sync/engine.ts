import type { Platform, UnifiedCommit, UnifiedRepo } from '@/api/types'
import { getAdapter } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore, type SyncProgress } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { commitRepo, cursorRepo, repoRepo, repoStatRepo } from '@/db/repositories'
import { db } from '@/db/schema'

export interface SyncOptions {
  signal?: AbortSignal
  /** 仅同步这些仓库；不传则同步全部 */
  repoIds?: string[]
}

export async function syncPlatform(platform: Platform, options: SyncOptions = {}): Promise<void> {
  const auth = useAuthStore()
  const sync = useSyncStore()
  const ui = useUiStore()
  const token = auth.tokens[platform]
  if (!token) throw new Error(`未连接 ${platform} 账号`)

  const user = auth.users[platform]
  if (!user) throw new Error('用户信息缺失，请重新连接账号')

  const adapter = getAdapter(platform)
  const progress: SyncProgress = {
    platform,
    phase: 'repos',
    total: 0,
    current: 0,
    message: '正在拉取仓库列表…',
  }
  sync.setProgress(progress)

  // 1. 拉取仓库列表
  let repos: UnifiedRepo[]
  try {
    repos = await adapter.listRepos(token)
  }
  catch (err) {
    if (options.signal?.aborted) {
      sync.setProgress({ ...progress, phase: 'done', message: '已停止' })
      return
    }
    sync.setProgress({ ...progress, phase: 'error', message: `仓库列表拉取失败：${(err as Error).message}` })
    throw err
  }

  if (options.repoIds?.length) {
    const set = new Set(options.repoIds)
    repos = repos.filter(r => set.has(r.id))
  }

  await repoRepo.bulkPut(repos)
  progress.total = repos.length
  sync.setProgress({ ...progress })

  // 2. 逐仓库同步提交（HTTP 层已有并发池，这里串行调度即可）
  for (let i = 0; i < repos.length; i++) {
    if (options.signal?.aborted) break
    const repo = repos[i]
    progress.current = i
    progress.phase = 'commits'
    progress.message = `[${platform}] ${i + 1}/${repos.length} ${repo.fullName}`
    sync.setProgress({ ...progress })

    try {
      await syncRepo(adapter, token, repo, user.login, platform, ui.codeDetailEnabled, options.signal)
    }
    catch (err) {
      // 单仓库失败不影响整体，记录到进度信息后继续
      progress.message = `跳过 ${repo.fullName}：${(err as Error).message}`
      sync.setProgress({ ...progress })
    }
  }

  // 3. 刷新配额
  await auth.refreshRateLimit(platform)

  sync.setProgress({
    platform,
    phase: 'done',
    total: repos.length,
    current: repos.length,
    message: '同步完成',
  })
}

async function syncRepo(
  adapter: ReturnType<typeof getAdapter>,
  token: string,
  repo: UnifiedRepo,
  userLogin: string,
  platform: Platform,
  codeDetailEnabled: boolean,
  signal?: AbortSignal,
) {
  const cursor = await cursorRepo.get(platform, repo.id)
  const since = cursor?.lastSyncedAt ?? undefined

  // GitHub：优先用 stats/contributors 拿周聚合代码量
  if (platform === 'github' && adapter.getWeeklyStats) {
    const stats = await adapter.getWeeklyStats(token, repo, userLogin)
    if (stats) {
      await repoStatRepo.put({
        repoId: repo.id,
        platform,
        additions: stats.additions,
        deletions: stats.deletions,
        weeks: stats.weeks.map(w => ({ w: w.w, a: w.a, d: w.d, c: w.c })),
        updatedAt: new Date().toISOString(),
      })
    }
  }

  // 拉取提交列表
  let commits = await adapter.listCommits(token, repo, userLogin, since)
  if (signal?.aborted) return

  // 过滤掉库里已存在的提交
  if (commits.length) {
    const existing = await db.commits.where('repoId').equals(repo.id).primaryKeys()
    const existingSet = new Set(existing)
    commits = commits.filter(c => !existingSet.has(c.id))
  }

  // Gitee 无周聚合接口：按开关决定是否逐提交拉取代码行明细
  if (platform === 'gitee' && codeDetailEnabled && adapter.getCommitDetail && commits.length) {
    // 控制详情请求的节奏：每批 20 个，避免一次性打爆
    const batch = 20
    for (let i = 0; i < commits.length; i += batch) {
      if (signal?.aborted) break
      const slice = commits.slice(i, i + batch)
      const details = await Promise.all(
        slice.map(c => adapter.getCommitDetail!(token, repo, c.sha)),
      )
      slice.forEach((c, idx) => {
        const d = details[idx]
        if (d) {
          c.additions = d.additions
          c.deletions = d.deletions
          c.filesChanged = d.filesChanged
        }
      })
    }
  }

  if (commits.length) {
    await commitRepo.bulkPut(commits)
  }

  // 更新游标
  const newest = commits.reduce<UnifiedCommit | null>((acc, c) => {
    if (!acc) return c
    return new Date(c.authoredAt) > new Date(acc.authoredAt) ? c : acc
  }, null)

  await cursorRepo.put({
    platform,
    repoId: repo.id,
    lastCommitSha: newest?.sha ?? cursor?.lastCommitSha ?? null,
    lastSyncedAt: new Date().toISOString(),
    etag: cursor?.etag ?? null,
  })
}

export async function syncAll(options?: SyncOptions) {
  const auth = useAuthStore()
  const errors: Error[] = []

  // 串行执行：先 GitHub 再 Gitee。
  // 原因：两个平台的进度状态独立维护，但浏览器总出口带宽和用户注意力有限；
  // 且 Gitee 代码明细同步会产生大量请求，与 GitHub 并发容易同时触发两边限流。
  if (auth.tokens.github) {
    try {
      await syncPlatform('github', options)
    }
    catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }
  }
  if (auth.tokens.gitee) {
    try {
      await syncPlatform('gitee', options)
    }
    catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }
  }

  if (errors.length) {
    throw new Error(errors.map(e => e.message).join('；'))
  }
}

/** 判断 Gitee 是否首次同步（尚无任何 cursor），用于首次提示 */
export async function isGiteeFirstSync(): Promise<boolean> {
  const count = await db.cursors.where('platform').equals('gitee').count()
  return count === 0
}
