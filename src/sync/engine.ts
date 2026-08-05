import type { Platform, UnifiedCommit, UnifiedRepo } from '@/api/types'
import { getAdapter } from '@/api'
import { PLATFORM_CONCURRENCY, PLATFORM_MIN_INTERVAL_MS } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore, type SyncProgress } from '@/stores/sync'
import { useUiStore } from '@/stores/ui'
import { commitRepo, cursorRepo, repoRepo, repoStatRepo } from '@/db/repositories'
import { db } from '@/db/schema'

/** 单次同步内 Gitee 代码明细最多请求数，防止长历史把账号打穿 */
const MAX_GITEE_DETAILS_PER_SYNC = 200

export interface SyncOptions {
  signal?: AbortSignal
  /** 仅同步这些仓库；不传则同步全部 */
  repoIds?: string[]
  /**
   * 轻量增量：只同步最近 N 天内有更新的仓库（默认 30 天）。
   * 启动自动同步时使用，避免对长期不活跃的仓库发起请求。
   */
  recentOnly?: boolean
  recentDays?: number
  /**
   * 忽略游标，重新拉取提交历史（用于修复不完整同步 / 错误水位线）。
   * 已存在的 commit 会按 id upsert，不会重复插入。
   */
  fullHistory?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new DOMException('同步已取消', 'AbortError')
    throw err
  }
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
  const req = { signal: options.signal }
  const progress: SyncProgress = {
    platform,
    phase: 'repos',
    total: 0,
    current: 0,
    message: '正在拉取仓库列表…',
  }
  sync.setProgress(progress)

  // 1. 拉取仓库列表（不拉 languages，后面按需增量）
  let repos: UnifiedRepo[]
  try {
    repos = await adapter.listRepos(token, { ...req, includeLanguages: false })
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

  // 语言字节：仅对「新仓 / updatedAt 变化 / 本地无语言数据」补请求
  const existingRepos = await repoRepo.all(platform)
  const existingById = new Map(existingRepos.map(r => [r.id, r]))
  if (adapter.getRepoLanguages) {
    progress.message = `[${platform}] 增量更新语言分布…`
    sync.setProgress({ ...progress })
    for (const repo of repos) {
      throwIfAborted(options.signal)
      const prev = existingById.get(repo.id)
      const canReuse = prev
        && prev.updatedAt === repo.updatedAt
        && prev.languages
        && Object.keys(prev.languages).length > 0
      if (canReuse) {
        repo.languages = prev.languages
        repo.language = prev.language ?? repo.language
        continue
      }
      try {
        const languages = await adapter.getRepoLanguages(token, repo.fullName, req)
        repo.languages = languages
        if (!repo.language) {
          const top = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]
          if (top) repo.language = top[0]
        }
      }
      catch {
        if (prev?.languages) {
          repo.languages = prev.languages
          repo.language = prev.language ?? repo.language
        }
      }
    }
  }

  await repoRepo.bulkPut(repos)
  progress.total = repos.length
  sync.setProgress({ ...progress })

  // 轻量增量：只对最近 N 天内更新过的仓库拉取提交
  let reposToSync = repos
  if (options.recentOnly) {
    const days = options.recentDays ?? 30
    const threshold = Date.now() - days * 86400_000
    reposToSync = repos.filter(r => new Date(r.updatedAt).getTime() >= threshold)
    progress.total = reposToSync.length
    progress.message = `[${platform}] 增量同步 ${reposToSync.length} 个近期活跃仓库…`
    sync.setProgress({ ...progress })
  }

  const existingStats = await repoStatRepo.byPlatform(platform)
  const statsByRepo = new Map(existingStats.map(s => [s.repoId, s]))

  let giteeDetailsUsed = 0

  // 2. 逐仓库同步提交（HTTP 层已有全局池 + 间隔）
  for (let i = 0; i < reposToSync.length; i++) {
    throwIfAborted(options.signal)
    const repo = reposToSync[i]
    progress.current = i
    progress.phase = 'commits'
    progress.message = `[${platform}] ${i + 1}/${reposToSync.length} ${repo.fullName}`
    sync.setProgress({ ...progress })

    try {
      const detailBudget = platform === 'gitee'
        ? Math.max(0, MAX_GITEE_DETAILS_PER_SYNC - giteeDetailsUsed)
        : 0
      const used = await syncRepo(
        adapter,
        token,
        repo,
        user.login,
        platform,
        !!ui.codeDetailEnabled,
        options.signal,
        options.fullHistory === true,
        {
          prevRepo: existingById.get(repo.id),
          cachedStat: statsByRepo.get(repo.id),
          giteeDetailBudget: detailBudget,
        },
      )
      giteeDetailsUsed += used
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // 单仓库失败不影响整体，记录到进度信息后继续
      progress.message = `跳过 ${repo.fullName}：${(err as Error).message}`
      sync.setProgress({ ...progress })
    }
  }

  // 3. 刷新配额（失败不阻断）
  try {
    await auth.refreshRateLimit(platform)
  }
  catch {
    // ignore
  }

  sync.setProgress({
    platform,
    phase: 'done',
    total: reposToSync.length,
    current: reposToSync.length,
    message: giteeDetailsUsed >= MAX_GITEE_DETAILS_PER_SYNC
      ? `同步完成（Gitee 明细已达本次上限 ${MAX_GITEE_DETAILS_PER_SYNC}，可再次同步继续补齐）`
      : '同步完成',
  })
}

async function syncRepo(
  adapter: ReturnType<typeof getAdapter>,
  token: string,
  repo: UnifiedRepo,
  userLogin: string,
  platform: Platform,
  codeDetailEnabled: boolean,
  signal: AbortSignal | undefined,
  fullHistory: boolean,
  ctx: {
    prevRepo?: UnifiedRepo
    cachedStat?: Awaited<ReturnType<typeof repoStatRepo.get>>
    giteeDetailBudget: number
  },
): Promise<number> {
  const req = { signal }
  const cursor = fullHistory ? undefined : await cursorRepo.get(platform, repo.id)
  const since = cursor?.lastSyncedAt ?? undefined
  let detailsFetched = 0

  // GitHub：仓库未更新且已有周统计缓存则跳过（stats 接口易触发 secondary limit）
  if (platform === 'github' && adapter.getWeeklyStats) {
    const unchanged = ctx.prevRepo?.updatedAt === repo.updatedAt && !!ctx.cachedStat
    if (!unchanged) {
      const stats = await adapter.getWeeklyStats(token, repo, userLogin, req)
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
  }

  throwIfAborted(signal)

  // 拉取提交列表
  // since 用水位线（上次成功入库的最新提交时间），不要用墙钟，
  // 否则首次同步中断后会丢历史，或漏掉同步过程中产生的提交。
  let commits = await adapter.listCommits(token, repo, userLogin, since, req)
  throwIfAborted(signal)

  // 过滤掉库里已存在的提交（全量重拉时仍 upsert，只是少一次无意义写入）
  if (commits.length && !fullHistory) {
    const existing = await db.commits.where('repoId').equals(repo.id).primaryKeys()
    const existingSet = new Set(existing)
    commits = commits.filter(c => !existingSet.has(c.id))
  }

  // Gitee 无周聚合接口：按开关 + 本次预算决定是否逐提交拉取代码行明细
  if (
    platform === 'gitee'
    && codeDetailEnabled
    && adapter.getCommitDetail
    && commits.length
    && ctx.giteeDetailBudget > 0
  ) {
    const toFetch = commits.slice(0, ctx.giteeDetailBudget)
    const batch = Math.max(1, PLATFORM_CONCURRENCY.gitee)
    const pauseMs = PLATFORM_MIN_INTERVAL_MS.gitee
    for (let i = 0; i < toFetch.length; i += batch) {
      throwIfAborted(signal)
      const slice = toFetch.slice(i, i + batch)
      const details = await Promise.all(
        slice.map(c => adapter.getCommitDetail!(token, repo, c.sha, req)),
      )
      detailsFetched += slice.length
      slice.forEach((c, idx) => {
        const d = details[idx]
        if (d) {
          c.additions = d.additions
          c.deletions = d.deletions
          c.filesChanged = d.filesChanged
        }
      })
      if (i + batch < toFetch.length && pauseMs > 0) {
        await new Promise<void>(r => setTimeout(r, pauseMs))
      }
    }
  }

  if (commits.length) {
    await commitRepo.bulkPut(commits)
  }

  // 更新游标：水位线取本次入库的最新提交 authoredAt
  const newest = commits.reduce<UnifiedCommit | null>((acc, c) => {
    if (!acc) return c
    return new Date(c.authoredAt) > new Date(acc.authoredAt) ? c : acc
  }, null)

  const previousWatermark = fullHistory ? null : cursor?.lastSyncedAt
  const watermark = [newest?.authoredAt, previousWatermark]
    .filter((v): v is string => !!v)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    ?? new Date().toISOString()

  await cursorRepo.put({
    platform,
    repoId: repo.id,
    lastCommitSha: newest?.sha ?? (fullHistory ? null : cursor?.lastCommitSha) ?? null,
    lastSyncedAt: watermark,
    etag: cursor?.etag ?? null,
  })

  return detailsFetched
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
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      errors.push(err instanceof Error ? err : new Error(String(err)))
    }
  }
  if (auth.tokens.gitee) {
    try {
      await syncPlatform('gitee', options)
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
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

/**
 * 是否已经做过至少一次同步（存在任意游标）。
 * 启动自动增量只在已有数据时运行，避免首次打开就触发耗时的全量同步。
 */
export async function hasPreviouslySynced(): Promise<boolean> {
  return await db.cursors.count() > 0
}
