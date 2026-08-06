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
/** 单次同步内向更早历史补拉的轮数上限 */
const MAX_HISTORY_BACKFILL_ROUNDS = 3

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
  /** 为已有但缺行数的 Gitee 提交补拉明细（开启代码明细后触发） */
  backfillDetails?: boolean
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new DOMException('同步已取消', 'AbortError')
    throw err
  }
}

async function removeStaleRepos(platform: Platform, remoteIds: Set<string>) {
  const existing = await repoRepo.all(platform)
  const staleIds = existing.filter(r => !remoteIds.has(r.id)).map(r => r.id)
  if (!staleIds.length) return 0
  await Promise.all([
    repoRepo.removeByIds(staleIds),
    commitRepo.removeByRepoIds(staleIds),
    cursorRepo.removeByRepoIds(platform, staleIds),
    repoStatRepo.removeByRepoIds(staleIds),
    db.issues.where('repoId').anyOf(staleIds).delete(),
  ])
  return staleIds.length
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

  const filteredByIds = !!options.repoIds?.length
  if (filteredByIds) {
    const set = new Set(options.repoIds)
    repos = repos.filter(r => set.has(r.id))
  }

  // 全量列表时清理远端已消失的仓库，避免污染统计
  if (!filteredByIds) {
    const removed = await removeStaleRepos(platform, new Set(repos.map(r => r.id)))
    if (removed > 0) {
      progress.message = `[${platform}] 已清理 ${removed} 个远端不存在的仓库`
      sync.setProgress({ ...progress })
    }
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
  let truncatedRepos = 0

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
          backfillDetails: options.backfillDetails === true,
        },
      )
      giteeDetailsUsed += used.detailsFetched
      if (used.historyTruncated) truncatedRepos++
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

  const parts: string[] = ['同步完成']
  if (giteeDetailsUsed >= MAX_GITEE_DETAILS_PER_SYNC) {
    parts.push(`Gitee 明细已达本次上限 ${MAX_GITEE_DETAILS_PER_SYNC}，可再次同步继续补齐`)
  }
  if (truncatedRepos > 0) {
    parts.push(`${truncatedRepos} 个仓库历史可能不完整，下次同步会继续向更早方向补拉`)
  }

  sync.setProgress({
    platform,
    phase: 'done',
    total: reposToSync.length,
    current: reposToSync.length,
    message: parts.join('；'),
  })
}

async function fillGiteeDetails(
  adapter: ReturnType<typeof getAdapter>,
  token: string,
  repo: UnifiedRepo,
  commits: UnifiedCommit[],
  budget: number,
  signal?: AbortSignal,
): Promise<number> {
  if (!adapter.getCommitDetail || budget <= 0 || !commits.length) return 0
  const toFetch = commits.slice(0, budget)
  const batch = Math.max(1, PLATFORM_CONCURRENCY.gitee)
  const pauseMs = PLATFORM_MIN_INTERVAL_MS.gitee
  let fetched = 0
  for (let i = 0; i < toFetch.length; i += batch) {
    throwIfAborted(signal)
    const slice = toFetch.slice(i, i + batch)
    const details = await Promise.all(
      slice.map(c => adapter.getCommitDetail!(token, repo, c.sha, { signal })),
    )
    fetched += slice.length
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
  return fetched
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
    backfillDetails: boolean
  },
): Promise<{ detailsFetched: number, historyTruncated: boolean }> {
  const req = { signal }
  const cursor = fullHistory ? undefined : await cursorRepo.get(platform, repo.id)
  const since = cursor?.lastSyncedAt ?? undefined
  let detailsFetched = 0
  let historyTruncated = cursor?.historyTruncated === true

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

  // 拉取提交列表（向前增量）
  // since 用水位线（上次成功入库的最新提交时间），不要用墙钟，
  // 否则首次同步中断后会丢历史，或漏掉同步过程中产生的提交。
  let { commits, truncated } = await adapter.listCommits(token, repo, userLogin, since, req)
  throwIfAborted(signal)
  if (truncated) historyTruncated = true

  // 过滤掉库里已存在的提交（全量重拉时仍 upsert，只是少一次无意义写入）
  if (commits.length && !fullHistory) {
    const existing = await db.commits.where('repoId').equals(repo.id).primaryKeys()
    const existingSet = new Set(existing)
    commits = commits.filter(c => !existingSet.has(c.id))
  }

  // 若历史曾被截断：用 until=本地最早提交 向更早方向补拉若干轮
  if ((historyTruncated || truncated) && !fullHistory) {
    for (let round = 0; round < MAX_HISTORY_BACKFILL_ROUNDS; round++) {
      throwIfAborted(signal)
      const local = await db.commits.where('repoId').equals(repo.id).toArray()
      const allKnown = [...local, ...commits]
      if (!allKnown.length) break
      const oldest = allKnown.reduce((acc, c) =>
        new Date(c.authoredAt) < new Date(acc.authoredAt) ? c : acc)
      // until 不含该时刻，减 1ms 避免重复拉到边界提交
      const until = new Date(new Date(oldest.authoredAt).getTime() - 1).toISOString()
      const older = await adapter.listCommits(token, repo, userLogin, undefined, { ...req, until })
      if (!older.commits.length) {
        historyTruncated = false
        break
      }
      const knownIds = new Set(allKnown.map(c => c.id))
      const fresh = older.commits.filter(c => !knownIds.has(c.id))
      commits = [...commits, ...fresh]
      historyTruncated = older.truncated
      if (!older.truncated) break
    }
  }

  // Gitee：按开关 + 预算拉代码行明细
  if (platform === 'gitee' && codeDetailEnabled && adapter.getCommitDetail) {
    let budget = ctx.giteeDetailBudget
    if (commits.length && budget > 0) {
      const used = await fillGiteeDetails(adapter, token, repo, commits, budget, signal)
      detailsFetched += used
      budget -= used
    }
    // 补全已入库但缺行数的提交
    if (ctx.backfillDetails && budget > 0) {
      const stored = await db.commits.where('repoId').equals(repo.id).toArray()
      const missing = stored.filter(c => !c.additions && !c.deletions && !c.filesChanged)
      if (missing.length) {
        const used = await fillGiteeDetails(adapter, token, repo, missing, budget, signal)
        detailsFetched += used
        if (used) await commitRepo.bulkPut(missing.slice(0, used))
      }
    }
  }

  if (commits.length) {
    await commitRepo.bulkPut(commits)
  }

  // 空结果且无历史游标：不写墙钟水位，避免跳过真实历史
  if (!commits.length && !cursor?.lastSyncedAt && !fullHistory) {
    // 仍记录截断状态（若有）以便下次补拉；无提交则写一条空游标标记已扫过
    if (historyTruncated) {
      await cursorRepo.put({
        platform,
        repoId: repo.id,
        lastCommitSha: null,
        lastSyncedAt: null,
        etag: cursor?.etag ?? null,
        historyTruncated: true,
      })
    }
    return { detailsFetched, historyTruncated }
  }

  // 水位线取本次+历史中最新提交时间（仅用于向前增量，不代表历史完整）
  const newest = commits.reduce<UnifiedCommit | null>((acc, c) => {
    if (!acc) return c
    return new Date(c.authoredAt) > new Date(acc.authoredAt) ? c : acc
  }, null)

  const previousWatermark = fullHistory ? null : cursor?.lastSyncedAt
  const watermark = [newest?.authoredAt, previousWatermark]
    .filter((v): v is string => !!v)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    ?? null

  // 全量重拉且本轮未截断 → 清除截断标记
  if (fullHistory && !truncated) historyTruncated = false

  await cursorRepo.put({
    platform,
    repoId: repo.id,
    lastCommitSha: newest?.sha ?? (fullHistory ? null : cursor?.lastCommitSha) ?? null,
    lastSyncedAt: watermark,
    etag: cursor?.etag ?? null,
    historyTruncated,
  })

  return { detailsFetched, historyTruncated }
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
