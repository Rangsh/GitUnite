import type { Component } from 'vue'
import {
  Code2, Flame, GitCommitHorizontal, GitPullRequest, GraduationCap,
  Layers, Moon, Sunrise, Trophy, Zap,
} from 'lucide-vue-next'
import type { Platform, UnifiedCommit, UnifiedRepo } from '@/api/types'
import type { RepoWeeklyStat } from '@/db/schema'
import {
  computeDailyBuckets, dedupeCommits, filterRepos,
} from './analytics'
import { createTzHelpers, dayjs } from './date'

export type BadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'default'

export interface BadgeDef {
  id: string
  name: string
  description: string
  target: number
  icon: Component
  tone: BadgeTone
}

export interface BadgeStatus extends BadgeDef {
  earned: boolean
  /** 达成日期（依据提交数据推算，YYYY-MM-DD） */
  achievedAt: string | null
  /** 0–1 进度 */
  progress: number
  /** 当前度量值 */
  metric: number
  /** 度量值展示文案 */
  metricLabel: string
}

export const BADGES: BadgeDef[] = [
  {
    id: 'night-owl',
    name: '夜猫子',
    description: '本地时间 0–6 点提交 ≥ 100 次',
    target: 100,
    icon: Moon,
    tone: 'info',
  },
  {
    id: 'early-bird',
    name: '早起鸟',
    description: '本地时间 5–8 点提交 ≥ 100 次',
    target: 100,
    icon: Sunrise,
    tone: 'warning',
  },
  {
    id: 'fullstack-explorer',
    name: '全栈探索者',
    description: '累计使用 ≥ 5 种语言',
    target: 5,
    icon: Layers,
    tone: 'accent',
  },
  {
    id: 'language-master',
    name: '语言大师',
    description: '累计使用 ≥ 10 种语言',
    target: 10,
    icon: GraduationCap,
    tone: 'success',
  },
  {
    id: 'oss-contributor',
    name: '开源贡献者',
    description: '向 ≥ 3 个非自有仓库贡献过提交',
    target: 3,
    icon: GitPullRequest,
    tone: 'accent',
  },
  {
    id: 'power-coder',
    name: '码力全开',
    description: '单日提交 ≥ 20 次',
    target: 20,
    icon: Zap,
    tone: 'warning',
  },
  {
    id: 'streak-king',
    name: '连续提交王',
    description: '连续 30 天有提交',
    target: 30,
    icon: Flame,
    tone: 'danger',
  },
  {
    id: 'hundred-day',
    name: '百日坚持',
    description: '连续 100 天有提交',
    target: 100,
    icon: Trophy,
    tone: 'success',
  },
  {
    id: 'thousand-commits',
    name: '千提交',
    description: '累计提交 ≥ 1000 次',
    target: 1000,
    icon: GitCommitHorizontal,
    tone: 'accent',
  },
  {
    id: 'tenk-lines',
    name: '万行代码',
    description: '累计新增 ≥ 10000 行',
    target: 10000,
    icon: Code2,
    tone: 'info',
  },
]

export const BADGE_BY_ID = new Map(BADGES.map(b => [b.id, b]))

export interface BadgeInput {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  repoStats: RepoWeeklyStat[]
  codeDetailEnabled: boolean
  tz?: string
  me?: Partial<Record<Platform, string | null>>
}

interface Prepared {
  commits: UnifiedCommit[]
  reposById: Map<string, UnifiedRepo>
  tz: ReturnType<typeof createTzHelpers>
  dateKeys: string[]
  /** 每日本地提交数 */
  perDay: Map<string, number>
}

function prepare(input: BadgeInput): Prepared {
  const repos = filterRepos(input.repos, 'all')
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits
  commits = dedupeCommits(commits, reposById)
  const tz = createTzHelpers(input.tz)
  const perDay = new Map<string, number>()
  for (const c of commits) {
    if (!c.authoredAt || Number.isNaN(new Date(c.authoredAt).getTime())) continue
    const key = tz.dateKey(c.authoredAt)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const dateKeys = [...perDay.keys()].sort()
  return { commits, reposById, tz, dateKeys, perDay }
}

function clampProgress(v: number, target: number): number {
  if (target <= 0) return v > 0 ? 1 : 0
  return Math.max(0, Math.min(1, v / target))
}

function nthDate(sortedCommits: UnifiedCommit[], n: number, tz: Prepared['tz']): string | null {
  if (sortedCommits.length < n) return null
  const c = sortedCommits[n - 1]
  return c.authoredAt ? tz.dateKey(c.authoredAt) : null
}

/** 首个达到 target 的连续提交天的日期（该天为连续段的第 target 天） */
function streakAchievedDate(dateKeys: string[], target: number): string | null {
  if (dateKeys.length < target) return null
  let run = 1
  for (let i = 1; i < dateKeys.length; i++) {
    if (dayjs(dateKeys[i]).diff(dayjs(dateKeys[i - 1]), 'day') === 1) {
      run++
      if (run >= target) return dateKeys[i]
    }
    else {
      run = 1
    }
  }
  return null
}

function longestStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0
  let longest = 1
  let run = 1
  for (let i = 1; i < dateKeys.length; i++) {
    if (dayjs(dateKeys[i]).diff(dayjs(dateKeys[i - 1]), 'day') === 1) {
      run++
      if (run > longest) longest = run
    }
    else {
      run = 1
    }
  }
  return longest
}

export function evaluateBadges(input: BadgeInput): BadgeStatus[] {
  const { commits, reposById, tz, dateKeys, perDay } = prepare(input)

  // 按时段
  let nightCount = 0
  let earlyCount = 0
  const nightCommits: UnifiedCommit[] = []
  const earlyCommits: UnifiedCommit[] = []
  for (const c of commits) {
    if (!c.authoredAt) continue
    const h = tz.hour(c.authoredAt)
    if (h < 6) {
      nightCount++
      nightCommits.push(c)
    }
    if (h >= 5 && h < 8) {
      earlyCount++
      earlyCommits.push(c)
    }
  }
  const byDateAsc = (a: UnifiedCommit, b: UnifiedCommit) =>
    new Date(a.authoredAt).getTime() - new Date(b.authoredAt).getTime()
  nightCommits.sort(byDateAsc)
  earlyCommits.sort(byDateAsc)

  // 语言：在“我有提交”的仓库中统计 distinct 语言及最早出现日期
  const activeRepoIds = new Set(commits.map(c => c.repoId))
  const langFirstDate = new Map<string, string>()
  const languages = new Set<string>()
  for (const c of commits) {
    const repo = reposById.get(c.repoId)
    if (!repo) continue
    const langs = Object.keys(repo.languages ?? {})
    if (!langs.length && repo.language) langs.push(repo.language)
    const key = c.authoredAt ? tz.dateKey(c.authoredAt) : ''
    for (const lang of langs) {
      languages.add(lang)
      if (key) {
        const prev = langFirstDate.get(lang)
        if (!prev || key < prev) langFirstDate.set(lang, key)
      }
    }
  }
  const langByDate = [...langFirstDate.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1))

  // 外部贡献仓库（非自有、非 fork；含被标记为 pr_contributed 的）
  const externalRepos: UnifiedRepo[] = []
  for (const repo of reposById.values()) {
    if (!activeRepoIds.has(repo.id)) continue
    if (repo.role === 'pr_contributed' || (!repo.isOwned && !repo.isFork)) {
      externalRepos.push(repo)
    }
  }
  const externalFirstDate = new Map<string, string>()
  for (const c of commits) {
    const repo = reposById.get(c.repoId)
    if (!repo) continue
    if (repo.role === 'pr_contributed' || (!repo.isOwned && !repo.isFork)) {
      const key = c.authoredAt ? tz.dateKey(c.authoredAt) : ''
      if (key) {
        const prev = externalFirstDate.get(repo.id)
        if (!prev || key < prev) externalFirstDate.set(repo.id, key)
      }
    }
  }
  const externalByDate = [...externalFirstDate.values()].sort()

  // 单日峰值
  let maxDay = 0
  let maxDayDate: string | null = null
  for (const [key, n] of perDay) {
    if (n > maxDay) {
      maxDay = n
      maxDayDate = key
    }
  }

  const streak = longestStreak(dateKeys)

  // 累计新增行（GitHub 周聚合分摊 + Gitee 逐提交）
  const buckets = computeDailyBuckets({
    repos: input.repos,
    commits: input.commits,
    repoStats: input.repoStats,
    codeDetailEnabled: input.codeDetailEnabled,
    scope: 'all',
    tz: input.tz,
  })
  let totalAdditions = 0
  for (const b of buckets.values()) totalAdditions += b.additions
  totalAdditions = Math.round(totalAdditions)
  // 万行达成日期：按天累加新增行
  let tenkDate: string | null = null
  let acc = 0
  for (const key of [...buckets.keys()].sort()) {
    acc += Math.round(buckets.get(key)!.additions)
    if (acc >= 10000) {
      tenkDate = key
      break
    }
  }

  const allSorted = [...commits].sort(byDateAsc)

  const statuses: BadgeStatus[] = []
  const push = (def: BadgeDef, metric: number, metricLabel: string, achievedAt: string | null) => {
    statuses.push({
      ...def,
      metric,
      metricLabel,
      progress: clampProgress(metric, def.target),
      earned: metric >= def.target,
      achievedAt: metric >= def.target ? achievedAt : null,
    })
  }

  push(BADGES[0], nightCount, `${nightCount} / 100 次深夜提交`, nthDate(nightCommits, 100, tz))
  push(BADGES[1], earlyCount, `${earlyCount} / 100 次清晨提交`, nthDate(earlyCommits, 100, tz))
  push(BADGES[2], languages.size, `${languages.size} / 5 种语言`, langByDate[4]?.[1] ?? null)
  push(BADGES[3], languages.size, `${languages.size} / 10 种语言`, langByDate[9]?.[1] ?? null)
  push(
    BADGES[4],
    externalRepos.length,
    `${externalRepos.length} / 3 个外部仓库`,
    externalByDate[2] ?? null,
  )
  push(BADGES[5], maxDay, maxDay >= 20 ? `最高 ${maxDay} 次/天` : `${maxDay} / 20 次`, maxDayDate)
  push(BADGES[6], streak, `${streak} / 30 天`, streakAchievedDate(dateKeys, 30))
  push(BADGES[7], streak, `${streak} / 100 天`, streakAchievedDate(dateKeys, 100))
  push(BADGES[8], commits.length, `${commits.length} / 1000 次提交`, nthDate(allSorted, 1000, tz))
  push(BADGES[9], totalAdditions, `${totalAdditions.toLocaleString()} / 10000 行`, tenkDate)

  return statuses
}
