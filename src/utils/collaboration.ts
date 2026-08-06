import type { Platform, UnifiedCommit, UnifiedRepo } from '@/api/types'
import { dedupeCommits, filterRepos, type AnalyticsScope } from './analytics'

export type CollabCategory = 'me' | 'repo' | 'collaborator'

export interface CollabNode {
  id: string
  name: string
  category: CollabCategory
  /** 用于节点归一化大小的数值 */
  value: number
  symbolSize: number
  platform?: Platform
  repoId?: string
}

export interface CollabEdge {
  source: string
  target: string
  /** 边粗度权重 */
  value: number
}

export interface CollaboratorInfo {
  key: string
  name: string
  platform: Platform
  sharedRepoIds: string[]
  sharedCommits: number
}

export interface CollaborationGraph {
  nodes: CollabNode[]
  edges: CollabEdge[]
  repos: UnifiedRepo[]
  collaborators: CollaboratorInfo[]
  /** 协作者 -> 共同提交（用于双击抽屉） */
  collaboratorCommits: Map<string, UnifiedCommit[]>
  truncated: { collaborators: number }
  /**
   * 当前同步只拉「我」的提交，协作者节点通常为空。
   * UI 应提示：二级协作者需额外数据源（M5），现仅为仓库关系图。
   */
  collaboratorsUnavailable: boolean
}

export interface CollaborationInput {
  repos: UnifiedRepo[]
  commits: UnifiedCommit[]
  scope: AnalyticsScope
  /** 当前用户在各平台的登录名，用于把“我”从协作者中排除 */
  me: Partial<Record<Platform, string | null>>
  /** 是否包含二级协作者节点 */
  includeCollaborators?: boolean
  /** 协作者节点上限，避免超大图卡顿 */
  maxCollaborators?: number
}

const ME_NODE_ID = '__me__'

/** sqrt 归一化到 [min,max] */
function normalize(values: number[], min: number, max: number): (v: number) => number {
  if (!values.length) return () => (min + max) / 2
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  if (hi === lo) return () => (min + max) / 2
  const sLo = Math.sqrt(lo)
  const sHi = Math.sqrt(hi)
  return (v: number) => {
    const t = (Math.sqrt(v) - sLo) / (sHi - sLo)
    return min + t * (max - min)
  }
}

function authorKeyOf(c: UnifiedCommit, meLogin?: string | null): string | null {
  // 仅信任平台 login；无 login 的 authorName 可能是显示名，不能当成协作者身份
  const login = (c.authorLogin || '').trim()
  if (!login) return null
  if (meLogin && login.toLowerCase() === meLogin.toLowerCase()) return null
  return `${c.platform}:${login.toLowerCase()}`
}

export function computeCollaboration(input: CollaborationInput): CollaborationGraph {
  const repos = filterRepos(input.repos, input.scope)
  const repoIds = new Set(repos.map(r => r.id))
  const reposById = new Map(repos.map(r => [r.id, r]))
  let commits = input.commits.filter(c => repoIds.has(c.repoId))
  if (input.scope !== 'all') commits = commits.filter(c => c.platform === input.scope)
  commits = dedupeCommits(commits, reposById)

  // 每个仓库中“我”的提交数
  const myCommitsByRepo = new Map<string, number>()
  for (const c of commits) {
    myCommitsByRepo.set(c.repoId, (myCommitsByRepo.get(c.repoId) ?? 0) + 1)
  }

  const activeRepos = repos.filter(r => (myCommitsByRepo.get(r.id) ?? 0) > 0)

  // 协作者聚合
  const collabMap = new Map<string, { name: string, platform: Platform, repos: Map<string, number>, commits: UnifiedCommit[] }>()
  for (const c of commits) {
    const meLogin = input.me[c.platform]
    const key = authorKeyOf(c, meLogin)
    if (!key) continue
    if (!collabMap.has(key)) {
      collabMap.set(key, {
        name: (c.authorLogin || c.authorName || '').trim(),
        platform: c.platform,
        repos: new Map(),
        commits: [],
      })
    }
    const entry = collabMap.get(key)!
    entry.repos.set(c.repoId, (entry.repos.get(c.repoId) ?? 0) + 1)
    entry.commits.push(c)
  }

  const collaborators: CollaboratorInfo[] = [...collabMap.entries()]
    .map(([key, v]) => ({
      key,
      name: v.name,
      platform: v.platform,
      sharedRepoIds: [...v.repos.keys()],
      sharedCommits: [...v.repos.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.sharedCommits - a.sharedCommits)

  const maxCollab = input.maxCollaborators ?? 60
  const includeCollab = input.includeCollaborators !== false
  const visibleCollabs = includeCollab ? collaborators.slice(0, maxCollab) : []

  // 节点大小归一化
  const repoScale = normalize(activeRepos.map(r => myCommitsByRepo.get(r.id) ?? 0), 18, 44)
  const collabScale = normalize(visibleCollabs.map(c => c.sharedCommits), 12, 30)

  const nodes: CollabNode[] = []
  const edges: CollabEdge[] = []

  // 中心：我
  nodes.push({
    id: ME_NODE_ID,
    name: '我',
    category: 'me',
    value: commits.length,
    symbolSize: 46,
  })

  // 一级：仓库
  for (const repo of activeRepos) {
    const count = myCommitsByRepo.get(repo.id) ?? 0
    nodes.push({
      id: repo.id,
      name: repo.name,
      category: 'repo',
      value: count,
      symbolSize: repoScale(count),
      platform: repo.platform,
      repoId: repo.id,
    })
    edges.push({ source: ME_NODE_ID, target: repo.id, value: count })
  }

  // 二级：协作者
  const collaboratorCommits = new Map<string, UnifiedCommit[]>()
  for (const c of visibleCollabs) {
    nodes.push({
      id: c.key,
      name: c.name,
      category: 'collaborator',
      value: c.sharedCommits,
      symbolSize: collabScale(c.sharedCommits),
      platform: c.platform,
    })
    // PRD：用户—协作者边粗度 = 共同仓库数
    edges.push({ source: ME_NODE_ID, target: c.key, value: c.sharedRepoIds.length })
    collaboratorCommits.set(c.key, collabMap.get(c.key)!.commits)
  }

  return {
    nodes,
    edges,
    repos: activeRepos,
    collaborators: visibleCollabs,
    collaboratorCommits,
    truncated: { collaborators: Math.max(0, collaborators.length - visibleCollabs.length) },
    // 同步层只缓存当前用户提交；打开协作者开关却无人时，对用户诚实降级
    collaboratorsUnavailable: includeCollab && collaborators.length === 0 && activeRepos.length > 0,
  }
}

export { ME_NODE_ID }
