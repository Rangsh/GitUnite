import Papa from 'papaparse'
import type { UnifiedCommit, UnifiedIssue, UnifiedRepo } from '@/api/types'
import type { RepoWeeklyStat } from '@/db/schema'
import {
  computeBasicStats, dedupeCommits, filterRepos, type AnalyticsScope,
} from './analytics'
import { createTzHelpers } from './date'

export interface ExportInput {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  issues: UnifiedIssue[]
  repoStats: RepoWeeklyStat[]
  codeDetailEnabled: boolean
  scope: AnalyticsScope
  tz?: string
}

interface ScopedData {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  issues: UnifiedIssue[]
}

function isExternalIssueRepo(repoId: string) {
  // GitHub Search 会带回不在 /user/repos 里的贡献仓，合成 id 形如 github:ext:owner/repo
  return repoId.includes(':ext:')
}

function scopeData(input: ExportInput): ScopedData {
  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  commits = dedupeCommits(commits, reposById)
  let issues = input.issues.filter(i =>
    repoIds.has(i.repoId) || isExternalIssueRepo(i.repoId))
  if (input.scope !== 'all') issues = issues.filter(i => i.platform === input.scope)
  return { repos, commits, issues }
}

function dateStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

/** 触发浏览器下载文本内容（UTF-8 BOM 由调用方决定是否加） */
function downloadText(filename: string, content: string, mime: string, withBom = false) {
  const blob = new Blob([withBom ? `\uFEFF${content}` : content], { type: mime })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 释放要延后，避免某些浏览器还没开始读
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 导出当前 scope 下的全部数据 + 聚合统计为 JSON */
export function exportJson(input: ExportInput) {
  const { repos, commits, issues } = scopeData(input)
  const stats = computeBasicStats({
    repos: input.repos,
    commits: input.commits,
    repoStats: input.repoStats,
    codeDetailEnabled: input.codeDetailEnabled,
    scope: input.scope,
    tz: input.tz,
  })
  const payload = {
    exportedAt: new Date().toISOString(),
    scope: input.scope,
    version: 1,
    summary: {
      repoCount: stats.repoCount,
      forkCount: stats.forkCount,
      commitCount: stats.commitCount,
      additions: stats.additions,
      deletions: stats.deletions,
      issueCount: issues.length,
    },
    repos,
    commits,
    issues,
  }
  downloadText(
    `gitunite-export-${dateStamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  )
}

interface CommitCsvRow {
  sha: string
  platform: string
  repo: string
  message: string
  date: string
  additions: number
  deletions: number
}

interface RepoCsvRow {
  platform: string
  fullName: string
  language: string
  stars: number
  isPrivate: string
  myCommits: number
}

/** 导出 commits.csv（UTF-8 BOM，Excel 直开中文不乱码） */
export function exportCommitsCsv(input: ExportInput) {
  const { repos, commits } = scopeData(input)
  const reposById = new Map(repos.map(r => [r.id, r]))
  const tz = createTzHelpers(input.tz)
  const rows: CommitCsvRow[] = commits.map(c => ({
    sha: c.sha,
    platform: c.platform,
    repo: reposById.get(c.repoId)?.fullName ?? c.repoId,
    message: c.message,
    date: tz.dateKey(c.authoredAt),
    additions: c.additions,
    deletions: c.deletions,
  }))
  const csv = Papa.unparse(rows, { quotes: [true, true, true, true, false, false, false] })
  downloadText(`commits-${dateStamp()}.csv`, csv, 'text/csv;charset=utf-8', true)
}

/** 导出 repos.csv（UTF-8 BOM） */
export function exportReposCsv(input: ExportInput) {
  const { repos, commits } = scopeData(input)
  const myCommitsByRepo = new Map<string, number>()
  for (const c of commits) {
    myCommitsByRepo.set(c.repoId, (myCommitsByRepo.get(c.repoId) ?? 0) + 1)
  }
  const rows: RepoCsvRow[] = repos.map(r => ({
    platform: r.platform,
    fullName: r.fullName,
    language: r.language ?? '',
    stars: r.stargazersCount,
    isPrivate: r.isPrivate ? '是' : '否',
    myCommits: myCommitsByRepo.get(r.id) ?? 0,
  }))
  const csv = Papa.unparse(rows)
  downloadText(`repos-${dateStamp()}.csv`, csv, 'text/csv;charset=utf-8', true)
}
