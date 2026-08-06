import type { Platform, UnifiedIssue, UnifiedRepo } from '@/api/types'
import { filterRepos, type AnalyticsScope } from './analytics'

export interface IssueTypeBreakdown {
  created: number
  merged: number
  /** closed 但未合并（仅对 PR 有意义；Issue 无 merged 概念，其 closed 即关闭） */
  closedUnmerged: number
  open: number
}

export interface RepoContributionRank {
  repoId: string
  fullName: string
  platform: Platform
  prCount: number
  issueCount: number
  total: number
  htmlUrl: string
}

export interface ContributionStats {
  hasData: boolean
  pr: IssueTypeBreakdown
  issue: IssueTypeBreakdown
  /** 已合并 PR 的合并耗时（毫秒）样本 */
  mergeDurations: number[]
  /** 中位数（毫秒） */
  mergeMedianMs: number | null
  /** 平均值（毫秒） */
  mergeMeanMs: number | null
  topRepos: RepoContributionRank[]
}

export interface ContributionInput {
  repos: UnifiedRepo[]
  issues: UnifiedIssue[]
  scope: AnalyticsScope
}

function median(sorted: number[]): number | null {
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function mean(arr: number[]): number | null {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** 从 html_url / 合成 repoId 推断仓库主页与 fullName（外部贡献仓不在 repos 列表时用） */
function repoMetaFromIssue(repoId: string, htmlUrl: string): { fullName: string, htmlUrl: string } {
  const ext = repoId.match(/^(?:github|gitee):ext:(.+)$/i)
  if (ext) {
    const fullName = ext[1]
    const host = repoId.startsWith('gitee') ? 'https://gitee.com' : 'https://github.com'
    return { fullName, htmlUrl: `${host}/${fullName}` }
  }
  const m = htmlUrl.match(/github\.com\/([^/]+\/[^/]+)/) || htmlUrl.match(/gitee\.com\/([^/]+\/[^/]+)/)
  if (m) {
    const host = htmlUrl.includes('gitee.com') ? 'https://gitee.com' : 'https://github.com'
    return { fullName: m[1], htmlUrl: `${host}/${m[1]}` }
  }
  return { fullName: htmlUrl || repoId, htmlUrl }
}

export function computeContributions(input: ContributionInput): ContributionStats {
  const scopePlatforms = input.scope === 'all' ? null : new Set([input.scope])
  const repos = filterRepos(input.repos, input.scope)
  const repoById = new Map(repos.map(r => [r.id, r]))

  let issues = input.issues
  if (scopePlatforms) issues = issues.filter(i => scopePlatforms.has(i.platform))

  const empty: ContributionStats = {
    hasData: false,
    pr: { created: 0, merged: 0, closedUnmerged: 0, open: 0 },
    issue: { created: 0, merged: 0, closedUnmerged: 0, open: 0 },
    mergeDurations: [],
    mergeMedianMs: null,
    mergeMeanMs: null,
    topRepos: [],
  }

  if (!issues.length) return empty

  const pr: IssueTypeBreakdown = { created: 0, merged: 0, closedUnmerged: 0, open: 0 }
  const issue: IssueTypeBreakdown = { created: 0, merged: 0, closedUnmerged: 0, open: 0 }
  const durations: number[] = []
  const byRepo = new Map<string, { pr: number, issue: number }>()

  for (const it of issues) {
    const target = it.type === 'pr' ? pr : issue
    target.created++
    if (it.state === 'merged') {
      target.merged++
      if (it.type === 'pr' && it.mergedAt) {
        const ms = new Date(it.mergedAt).getTime() - new Date(it.createdAt).getTime()
        if (Number.isFinite(ms) && ms >= 0) durations.push(ms)
      }
    }
    else if (it.state === 'closed') {
      target.closedUnmerged++
    }
    else {
      target.open++
    }

    const slot = byRepo.get(it.repoId) ?? { pr: 0, issue: 0 }
    if (it.type === 'pr') slot.pr++
    else slot.issue++
    byRepo.set(it.repoId, slot)
  }

  durations.sort((a, b) => a - b)

  const topRepos: RepoContributionRank[] = []
  for (const [repoId, counts] of byRepo) {
    const total = counts.pr + counts.issue
    const known = repoById.get(repoId)
    const sample = issues.find(i => i.repoId === repoId)
    const meta = known
      ? { fullName: known.fullName, htmlUrl: known.htmlUrl }
      : repoMetaFromIssue(repoId, sample?.htmlUrl ?? '')
    topRepos.push({
      repoId,
      fullName: meta.fullName,
      platform: known?.platform ?? (repoId.startsWith('gitee') ? 'gitee' : 'github'),
      prCount: counts.pr,
      issueCount: counts.issue,
      total,
      htmlUrl: meta.htmlUrl,
    })
  }
  topRepos.sort((a, b) => b.total - a.total || b.prCount - a.prCount)

  return {
    hasData: true,
    pr,
    issue,
    mergeDurations: durations,
    mergeMedianMs: median(durations),
    mergeMeanMs: mean(durations),
    topRepos: topRepos.slice(0, 10),
  }
}
