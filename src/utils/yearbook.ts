import type { UnifiedCommit, UnifiedRepo } from '@/api/types'
import type { RepoWeeklyStat } from '@/db/schema'
import {
  dedupeCommits, filterRepos, type AnalyticsScope,
} from './analytics'
import { createTzHelpers, dayjs, resolveTimezone } from './date'
import { buildWordCloud, type WordWeight } from './wordcloud'

export interface YearbookInput {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  repoStats: RepoWeeklyStat[]
  codeDetailEnabled: boolean
  scope: AnalyticsScope
  tz?: string
  year: number
}

export interface YearbookData {
  year: number
  hasData: boolean
  commitCount: number
  additions: number
  deletions: number
  activeDays: number
  activeDaysRatio: number
  longestStreak: number
  longestStreakStart: string | null
  longestStreakEnd: string | null
  mostActiveMonth: number | null
  mostActiveWeekday: number | null
  mostActiveHour: number | null
  lateNightRatio: number
  weekendRatio: number
  newLanguages: string[]
  topLanguages: { language: string, count: number }[]
  contributedRepoCount: number
  newRepoCount: number
  words: WordWeight[]
}

const EMPTY_BASE = {
  hasData: false,
  commitCount: 0,
  additions: 0,
  deletions: 0,
  activeDays: 0,
  activeDaysRatio: 0,
  longestStreak: 0,
  longestStreakStart: null,
  longestStreakEnd: null,
  mostActiveMonth: null,
  mostActiveWeekday: null,
  mostActiveHour: null,
  lateNightRatio: 0,
  weekendRatio: 0,
  newLanguages: [],
  topLanguages: [],
  contributedRepoCount: 0,
  newRepoCount: 0,
  words: [],
}

function scopedCommits(input: YearbookInput): { commits: UnifiedCommit[], reposById: Map<string, UnifiedRepo> } {
  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  commits = dedupeCommits(commits, reposById)
  return { commits, reposById }
}

export function computeYearbook(input: YearbookInput): YearbookData {
  const { commits, reposById } = scopedCommits(input)
  const yearPrefix = `${input.year}-`
  const tz = createTzHelpers(input.tz)

  const yearCommits = commits.filter((c) => {
    if (!c.authoredAt || Number.isNaN(new Date(c.authoredAt).getTime())) return false
    return tz.dateKey(c.authoredAt).startsWith(yearPrefix)
  })

  if (yearCommits.length === 0) {
    return { year: input.year, ...EMPTY_BASE }
  }

  // 按天 / 月 / 星期 / 小时 聚合
  const daySet = new Set<string>()
  const monthCount = new Array(12).fill(0)
  const weekdayCount = new Array(7).fill(0)
  const hourCount = new Array(24).fill(0)
  let lateNight = 0
  let weekend = 0
  let additions = 0
  let deletions = 0

  // 按仓库累加 Gitee 逐提交行数（GitHub 走周统计分摊，见下方）
  const giteeAdditionsByDay = new Map<string, number>()
  const giteeDeletionsByDay = new Map<string, number>()

  for (const c of yearCommits) {
    const key = tz.dateKey(c.authoredAt)
    daySet.add(key)
    const month = Number(key.slice(5, 7)) - 1
    monthCount[month]++
    const wd = tz.dayOfWeek(c.authoredAt)
    weekdayCount[wd]++
    const hour = tz.hour(c.authoredAt)
    hourCount[hour]++
    if (hour < 6) lateNight++
    if (wd === 0 || wd === 6) weekend++
    if (c.platform === 'gitee') {
      giteeAdditionsByDay.set(key, (giteeAdditionsByDay.get(key) ?? 0) + (c.additions || 0))
      giteeDeletionsByDay.set(key, (giteeDeletionsByDay.get(key) ?? 0) + (c.deletions || 0))
    }
  }

  // GitHub 周聚合按“该年有提交的天”分摊到天
  const scopeRepos = filterRepos(input.repos, input.scope)
  const scopeRepoIds = new Set(scopeRepos.map(r => r.id))
  if (input.scope === 'all' || input.scope === 'github') {
    const ghStats = input.repoStats.filter(s => s.platform === 'github' && scopeRepoIds.has(s.repoId))
    for (const stat of ghStats) {
      for (const w of stat.weeks) {
        if (!w.a && !w.d) continue
        const weekStart = dayjs.unix(w.w)
        const daysInWeek: string[] = []
        for (let i = 0; i < 7; i++) {
          const key = tz.dateKey(weekStart.add(i, 'day').toDate())
          if (key.startsWith(yearPrefix) && daySet.has(key)) daysInWeek.push(key)
        }
        if (daysInWeek.length === 0) continue
        additions += w.a
        deletions += w.d
      }
    }
  }
  for (const v of giteeAdditionsByDay.values()) additions += v
  for (const v of giteeDeletionsByDay.values()) deletions += v

  // streak（只看该年的日期键）
  const days = [...daySet].sort()
  let longest = 1
  let longestStreakStart = days[0]
  let longestStreakEnd = days[0]
  let runStart = days[0]
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (dayjs(days[i]).diff(dayjs(days[i - 1]), 'day') === 1) {
      run++
    }
    else {
      run = 1
      runStart = days[i]
    }
    if (run > longest) {
      longest = run
      longestStreakStart = runStart
      longestStreakEnd = days[i]
    }
  }

  const isLeap = (input.year % 4 === 0 && input.year % 100 !== 0) || input.year % 400 === 0
  const daysInYear = isLeap ? 366 : 365

  // 语言：按仓库主语言的提交数；newLanguages 依据全历史首见年份
  const langCountYear = new Map<string, number>()
  const langFirstYear = new Map<string, number>()
  const repoFirstCommit = new Map<string, number>()
  for (const c of commits) {
    const repo = reposById.get(c.repoId)
    const lang = repo?.language || '未知'
    const y = Number(tz.dateKey(c.authoredAt).slice(0, 4))
    if (!Number.isNaN(y)) {
      const prev = langFirstYear.get(lang)
      if (!prev || y < prev) langFirstYear.set(lang, y)
      const prevRepo = repoFirstCommit.get(c.repoId)
      if (!prevRepo || y < prevRepo) repoFirstCommit.set(c.repoId, y)
    }
  }
  for (const c of yearCommits) {
    const repo = reposById.get(c.repoId)
    const lang = repo?.language || '未知'
    langCountYear.set(lang, (langCountYear.get(lang) ?? 0) + 1)
  }
  const topLanguages = [...langCountYear.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, count }))
  const newLanguages = [...langFirstYear.entries()]
    .filter(([, y]) => y === input.year)
    .map(([lang]) => lang)
    .sort()

  const yearRepoIds = new Set(yearCommits.map(c => c.repoId))
  const contributedYear = yearRepoIds.size
  let newRepoCount = 0
  for (const rid of yearRepoIds) {
    if (repoFirstCommit.get(rid) === input.year) newRepoCount++
  }

  const words = buildWordCloud(yearCommits.map(c => c.message), 60)

  const topIndex = (arr: number[]): number | null => {
    let best = -1
    let bestV = -1
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > bestV) {
        bestV = arr[i]
        best = i
      }
    }
    return bestV > 0 ? best : null
  }

  return {
    year: input.year,
    hasData: true,
    commitCount: yearCommits.length,
    additions: Math.round(additions),
    deletions: Math.round(deletions),
    activeDays: daySet.size,
    activeDaysRatio: daySet.size / daysInYear,
    longestStreak: longest,
    longestStreakStart,
    longestStreakEnd,
    mostActiveMonth: topIndex(monthCount),
    mostActiveWeekday: topIndex(weekdayCount),
    mostActiveHour: topIndex(hourCount),
    lateNightRatio: lateNight / yearCommits.length,
    weekendRatio: weekend / yearCommits.length,
    newLanguages,
    topLanguages,
    contributedRepoCount: contributedYear,
    newRepoCount,
    words,
  }
}

/** 可回溯的年份列表：从今年到最早提交年。 */
export function availableYears(commits: UnifiedCommit[], tz?: string): number[] {
  const zone = resolveTimezone(tz)
  const current = dayjs().tz(zone).year()
  const years = new Set<number>([current])
  const helper = createTzHelpers(tz)
  for (const c of commits) {
    if (!c.authoredAt) continue
    const y = Number(helper.dateKey(c.authoredAt).slice(0, 4))
    if (!Number.isNaN(y)) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}
