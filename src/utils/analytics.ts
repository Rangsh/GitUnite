import type { Platform, UnifiedCommit, UnifiedRepo } from '@/api/types'
import type { RepoWeeklyStat } from '@/db/schema'
import { dayjs, localDateKey, localDayOfWeek, localHour } from './date'

export type AnalyticsScope = 'all' | Platform

export interface BasicStats {
  repoCount: number
  forkCount: number
  /** 按 SHA 去重后的提交数 */
  commitCount: number
  additions: number
  deletions: number
  avgChanges: number
  /** 是否存在有效的代码行明细（关闭明细或 Gitee 未拉取时为 false） */
  hasCodeDetail: boolean
}

export interface StreakInfo {
  longest: number
  longestStart: string | null
  longestEnd: string | null
  current: number
}

export interface ActivityStats {
  firstCommitAt: string | null
  lastCommitAt: string | null
  activeDays: number
  avgCommitsPerDay: number
  longestStreak: number
  longestStreakStart: string | null
  longestStreakEnd: string | null
  currentStreak: number
  /** 0-23 点提交桶 */
  hourly: number[]
  /** 0=周日 … 6=周六 */
  weekday: number[]
  /** 提交最多的连续 3 小时：[起始小时, 提交数] */
  goldenHours: { start: number, end: number, count: number }
  /** 0:00-6:00 提交占比 0-1 */
  lateNightRatio: number
}

export interface LanguageStat {
  language: string
  bytes: number
  percentage: number
  repoCount: number
}

export interface LanguageTrendResult {
  /** 排序后的语言（按总提交数降序，取 topN） */
  languages: string[]
  /** 时间序列点，period 为 YYYY 或 YYYY-QN */
  periods: string[]
  /** 每语言在每时段的提交数矩阵，与 periods / languages 对齐 */
  series: Record<string, number[]>
  /** 当期出现、历史未出现的语言集合 */
  newLanguages: Set<string>
}

export interface HeatmapPoint {
  date: string
  commits: number
  additions: number
  deletions: number
}

export interface DailyBucket {
  date: string
  commits: UnifiedCommit[]
  additions: number
  deletions: number
}

export interface AnalyticsInput {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  repoStats: RepoWeeklyStat[]
  /** 当关闭代码明细或数据缺失时，代码行相关统计标记为不可用 */
  codeDetailEnabled: boolean
  scope: AnalyticsScope
  tz?: string
}

/**
 * 按 scope 过滤仓库。
 */
export function filterRepos(repos: UnifiedRepo[], scope: AnalyticsScope): UnifiedRepo[] {
  if (scope === 'all') return repos
  return repos.filter(r => r.platform === scope)
}

/**
 * 按 scope 过滤提交，并按 `${platform}:${sha}` 去重。
 * 同一 SHA 在 fork 与上游重复出现时，优先保留非 fork 仓库的那条（便于语言归属）。
 */
export function dedupeCommits(
  commits: UnifiedCommit[],
  reposById: Map<string, UnifiedRepo>,
): UnifiedCommit[] {
  const map = new Map<string, UnifiedCommit>()
  for (const c of commits) {
    const key = `${c.platform}:${c.sha}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, c)
      continue
    }
    // 优先非 fork
    const curRepo = reposById.get(c.repoId)
    const exRepo = reposById.get(existing.repoId)
    if (curRepo && !curRepo.isFork && exRepo?.isFork) {
      map.set(key, c)
    }
  }
  return [...map.values()]
}

export function computeBasicStats(input: AnalyticsInput): BasicStats {
  const repos = filterRepos(input.repos, input.scope)
  const scopePlatforms = input.scope === 'all' ? null : new Set([input.scope])
  const repoIds = new Set(repos.map(r => r.id))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (scopePlatforms) commits = commits.filter(c => scopePlatforms.has(c.platform))

  const reposById = new Map(repos.map(r => [r.id, r]))
  commits = dedupeCommits(commits, reposById)

  const forkCount = repos.filter(r => r.isFork).length
  const repoCount = repos.length - forkCount // 不含 fork 的仓库数；PRD：Fork 单独成项

  let additions = 0
  let deletions = 0
  let hasCodeDetail = false

  if (input.scope === 'all' || input.scope === 'github') {
    const ghStats = input.repoStats.filter(s => s.platform === 'github' && repoIds.has(s.repoId))
    for (const s of ghStats) {
      additions += s.additions
      deletions += s.deletions
    }
    if (ghStats.length > 0) hasCodeDetail = true
  }
  if (input.scope === 'all' || input.scope === 'gitee') {
    // Gitee 代码量来自逐提交明细
    const giteeCommits = commits.filter(c => c.platform === 'gitee')
    let giteeHasDetail = false
    for (const c of giteeCommits) {
      additions += c.additions
      deletions += c.deletions
      if (c.additions > 0 || c.deletions > 0 || c.filesChanged > 0) giteeHasDetail = true
    }
    // Gitee 有提交且明细开关开着才算有明细
    if (giteeCommits.length > 0 && input.codeDetailEnabled && giteeHasDetail) {
      hasCodeDetail = true
    }
    else if (input.scope === 'gitee') {
      hasCodeDetail = giteeHasDetail && input.codeDetailEnabled
    }
  }

  const commitCount = commits.length
  const avgChanges = commitCount > 0 ? (additions + deletions) / commitCount : 0

  return {
    repoCount,
    forkCount,
    commitCount,
    additions,
    deletions,
    avgChanges,
    hasCodeDetail,
  }
}

function computeStreaks(dateKeys: string[], tz?: string): StreakInfo {
  if (dateKeys.length === 0) {
    return { longest: 0, longestStart: null, longestEnd: null, current: 0 }
  }
  const sorted = [...new Set(dateKeys)].sort()
  let longest = 1
  let longestStart = sorted[0]
  let longestEnd = sorted[0]
  let runStart = sorted[0]
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (dayjs(sorted[i]).diff(dayjs(sorted[i - 1]), 'day') === 1) {
      run++
    }
    else {
      run = 1
      runStart = sorted[i]
    }
    if (run > longest) {
      longest = run
      longestStart = runStart
      longestEnd = sorted[i]
    }
  }
  if (longest === 1) {
    longestEnd = sorted[sorted.length - 1]
    longestStart = runStart
  }

  // 当前连续：最近提交日为今天或昨天才视为仍在继续
  const today = dayjs().tz(tz ?? dayjs.tz.guess()).format('YYYY-MM-DD')
  const yesterday = dayjs(today).subtract(1, 'day').format('YYYY-MM-DD')
  const last = sorted[sorted.length - 1]
  let current = 0
  if (last === today || last === yesterday) {
    current = 1
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (dayjs(sorted[i + 1]).diff(dayjs(sorted[i]), 'day') === 1) {
        current++
      }
      else {
        break
      }
    }
  }

  return { longest, longestStart, longestEnd, current }
}

export function computeActivity(input: AnalyticsInput): ActivityStats {
  const empty: ActivityStats = {
    firstCommitAt: null,
    lastCommitAt: null,
    activeDays: 0,
    avgCommitsPerDay: 0,
    longestStreak: 0,
    longestStreakStart: null,
    longestStreakEnd: null,
    currentStreak: 0,
    hourly: new Array(24).fill(0),
    weekday: new Array(7).fill(0),
    goldenHours: { start: 9, end: 12, count: 0 },
    lateNightRatio: 0,
  }

  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  commits = dedupeCommits(commits, reposById)

  if (commits.length === 0) return empty

  const hourly = new Array(24).fill(0)
  const weekday = new Array(7).fill(0)
  const daySet = new Set<string>()
  let first = commits[0].authoredAt
  let last = commits[0].authoredAt
  let lateNight = 0

  for (const c of commits) {
    const d = toDate(c.authoredAt)
    if (d < toDate(first)) first = c.authoredAt
    if (d > toDate(last)) last = c.authoredAt
    const h = localHour(c.authoredAt, input.tz)
    hourly[h]++
    weekday[localDayOfWeek(c.authoredAt, input.tz)]++
    daySet.add(localDateKey(c.authoredAt, input.tz))
    if (h < 6) lateNight++
  }

  // 黄金时段：连续 3 小时窗口最大
  let bestStart = 9
  let bestCount = -1
  for (let h = 0; h <= 21; h++) {
    const sum = hourly[h] + hourly[h + 1] + hourly[h + 2]
    if (sum > bestCount) {
      bestCount = sum
      bestStart = h
    }
  }

  const dateKeys = [...daySet]
  const streak = computeStreaks(dateKeys, input.tz)

  return {
    firstCommitAt: first,
    lastCommitAt: last,
    activeDays: daySet.size,
    avgCommitsPerDay: commits.length / daySet.size,
    longestStreak: streak.longest,
    longestStreakStart: streak.longestStart,
    longestStreakEnd: streak.longestEnd,
    currentStreak: streak.current,
    hourly,
    weekday,
    goldenHours: { start: bestStart, end: bestStart + 3, count: bestCount },
    lateNightRatio: lateNight / commits.length,
  }
}

function toDate(iso: string): number {
  return new Date(iso).getTime()
}

/**
 * 语言统计：按 repo.languages 字节数加权聚合。
 */
export function computeLanguages(input: AnalyticsInput): LanguageStat[] {
  const repos = filterRepos(input.repos, input.scope)
  const byteMap = new Map<string, number>()
  const repoSet = new Map<string, Set<string>>()

  for (const repo of repos) {
    for (const [lang, bytes] of Object.entries(repo.languages ?? {})) {
      if (!lang || !Number.isFinite(bytes) || bytes <= 0) continue
      byteMap.set(lang, (byteMap.get(lang) ?? 0) + bytes)
      if (!repoSet.has(lang)) repoSet.set(lang, new Set())
      repoSet.get(lang)!.add(repo.id)
    }
  }

  const total = [...byteMap.values()].reduce((a, b) => a + b, 0)
  const stats: LanguageStat[] = []
  for (const [language, bytes] of byteMap) {
    stats.push({
      language,
      bytes,
      percentage: total > 0 ? bytes / total : 0,
      repoCount: repoSet.get(language)?.size ?? 0,
    })
  }
  stats.sort((a, b) => b.bytes - a.bytes)

  // 把占比 < 1% 的小项合并为「其他」
  const major = stats.filter(s => s.percentage >= 0.01)
  const minor = stats.filter(s => s.percentage < 0.01)
  if (minor.length > 0) {
    const otherBytes = minor.reduce((a, b) => a + b.bytes, 0)
    major.push({
      language: '其他',
      bytes: otherBytes,
      percentage: otherBytes / total,
      repoCount: 0,
    })
  }
  return major
}

/**
 * 技术栈趋势：按年或季度统计各语言（仓库主语言）的提交数。
 */
export function computeLanguageTrend(
  input: AnalyticsInput,
  granularity: 'year' | 'quarter' = 'year',
  topN = 8,
): LanguageTrendResult {
  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  commits = dedupeCommits(commits, reposById)

  // period -> language -> count
  const bucket = new Map<string, Map<string, number>>()
  const langTotals = new Map<string, number>()
  const periods = new Set<string>()

  for (const c of commits) {
    const repo = reposById.get(c.repoId)
    const lang = repo?.language || '未知'
    const d = dayjs(c.authoredAt)
    let period: string
    if (granularity === 'year') {
      period = d.format('YYYY')
    }
    else {
      const q = Math.floor(d.month() / 3) + 1
      period = `${d.format('YYYY')}-Q${q}`
    }
    periods.add(period)
    if (!bucket.has(period)) bucket.set(period, new Map())
    const row = bucket.get(period)!
    row.set(lang, (row.get(lang) ?? 0) + 1)
    langTotals.set(lang, (langTotals.get(lang) ?? 0) + 1)
  }

  const sortedPeriods = [...periods].sort()
  const languages = [...langTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([lang]) => lang)

  const series: Record<string, number[]> = {}
  for (const lang of languages) {
    series[lang] = sortedPeriods.map(p => bucket.get(p)?.get(lang) ?? 0)
  }

  // 新学语言：在最后一个时段出现、但在之前所有时段未出现
  const newLanguages = new Set<string>()
  if (sortedPeriods.length > 0) {
    const last = sortedPeriods[sortedPeriods.length - 1]
    const lastLangs = bucket.get(last)
    if (lastLangs) {
      for (const lang of lastLangs.keys()) {
        if (!languages.includes(lang)) continue
        let appearedBefore = false
        for (let i = 0; i < sortedPeriods.length - 1; i++) {
          if (bucket.get(sortedPeriods[i])?.has(lang)) {
            appearedBefore = true
            break
          }
        }
        if (!appearedBefore) newLanguages.add(lang)
      }
    }
  }

  return { languages, periods: sortedPeriods, series, newLanguages }
}

/**
 * 按天聚合提交，用于热力图与时间轴单日详情。
 */
export function computeDailyBuckets(input: AnalyticsInput): Map<string, DailyBucket> {
  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  // 注意：热力图按天统计提交数时，不在 fork 间去重 SHA——
  // 同一 SHA 出现在 fork 与上游属于不同仓库的活动，但对“我今天提交了几次”而言应去重。
  commits = dedupeCommits(commits, reposById)

  const map = new Map<string, DailyBucket>()
  for (const c of commits) {
    const key = localDateKey(c.authoredAt, input.tz)
    if (!map.has(key)) {
      map.set(key, { date: key, commits: [], additions: 0, deletions: 0 })
    }
    const b = map.get(key)!
    b.commits.push(c)
    b.additions += c.additions
    b.deletions += c.deletions
  }

  // GitHub 列表接口不返回逐提交行数，additions/deletions 来自 stats/contributors 周聚合。
  // 这里把每周的行数平均分摊到该周内“有提交”的天上；无提交的周不计入，保持与活跃日历一致。
  // Gitee 的提交行数已在同步时通过详情接口写入 c.additions/deletions，上面的循环已累加。
  if (input.scope === 'all' || input.scope === 'github') {
    const ghStats = input.repoStats.filter(s => s.platform === 'github' && repoIds.has(s.repoId))
    for (const stat of ghStats) {
      for (const w of stat.weeks) {
        if (!w.a && !w.d) continue
        const weekStart = dayjs.unix(w.w)
        const daysInWeek: string[] = []
        for (let i = 0; i < 7; i++) {
          const key = localDateKey(weekStart.add(i, 'day').toDate(), input.tz)
          if (map.has(key) && map.get(key)!.commits.some(c => c.platform === 'github')) {
            daysInWeek.push(key)
          }
        }
        if (daysInWeek.length === 0) continue
        const perDayA = w.a / daysInWeek.length
        const perDayD = w.d / daysInWeek.length
        for (const key of daysInWeek) {
          const b = map.get(key)!
          b.additions += perDayA
          b.deletions += perDayD
        }
      }
    }
  }

  return map
}

/**
 * 把每日桶转换成热力图点，并按时间范围截断。
 */
export function computeHeatmap(
  input: AnalyticsInput,
  range: '1y' | '2y' | 'all' = '1y',
): HeatmapPoint[] {
  const buckets = computeDailyBuckets(input)
  const now = dayjs()
  let start: dayjs.Dayjs
  if (range === '1y') start = now.subtract(1, 'year')
  else if (range === '2y') start = now.subtract(2, 'year')
  else {
    const all = [...buckets.keys()].sort()
    start = all.length ? dayjs(all[0]) : now.subtract(1, 'year')
  }

  const points: HeatmapPoint[] = []
  let cursor = start.startOf('day')
  const end = now.endOf('day')
  while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
    const key = cursor.format('YYYY-MM-DD')
    const b = buckets.get(key)
    points.push({
      date: key,
      commits: b?.commits.length ?? 0,
      additions: Math.round(b?.additions ?? 0),
      deletions: Math.round(b?.deletions ?? 0),
    })
    cursor = cursor.add(1, 'day')
  }
  return points
}

/** 判断是否为 merge commit（基于 message 约定）。 */
export function isMergeCommit(message: string): boolean {
  const firstLine = message.split('\n', 1)[0].trim().toLowerCase()
  return (
    firstLine.startsWith('merge pull request')
    || firstLine.startsWith('merge branch')
    || firstLine.startsWith('merge remote')
    || firstLine.startsWith('merge commit')
    || firstLine.startsWith('merge ')
    || /^merge\s/.test(firstLine)
  )
}
