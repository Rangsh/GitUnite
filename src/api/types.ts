/** 支持的代码托管平台 */
export type Platform = 'github' | 'gitee'

/** 贡献类型标签 */
export type RepoRole = 'owned' | 'organization' | 'fork' | 'pr_contributed'

/** 统一用户 */
export interface UnifiedUser {
  /** `${platform}:${login}` */
  id: string
  platform: Platform
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
}

/** 统一仓库 */
export interface UnifiedRepo {
  /** `${platform}:${id}` */
  id: string
  platform: Platform
  owner: string
  name: string
  fullName: string
  description: string | null
  /** 主语言 */
  language: string | null
  /** 全部语言字节数 */
  languages: Record<string, number>
  stargazersCount: number
  forksCount: number
  isPrivate: boolean
  isFork: boolean
  isOwned: boolean
  isContributed: boolean
  role: RepoRole
  updatedAt: string
  htmlUrl: string
}

/** 统一提交 */
export interface UnifiedCommit {
  /** `${platform}:${repoId}:${sha}` */
  id: string
  repoId: string
  platform: Platform
  sha: string
  message: string
  authorLogin: string | null
  authorName: string | null
  authoredAt: string
  additions: number
  deletions: number
  filesChanged: number
  htmlUrl: string
}

/** 统一 PR / Issue */
export interface UnifiedIssue {
  id: string
  repoId: string
  platform: Platform
  number: number
  type: 'pr' | 'issue'
  state: 'open' | 'closed' | 'merged'
  title: string
  createdAt: string
  closedAt: string | null
  mergedAt: string | null
  htmlUrl: string
}

/** 同步游标，记录每个仓库的断点 */
export interface SyncCursor {
  /** 复合主键 [platform+repoId] */
  platform: Platform
  repoId: string
  lastCommitSha: string | null
  lastSyncedAt: string | null
  etag: string | null
}

/** 平台适配器接口 */
/** 适配器请求公共选项（取消、分页上限等） */
export interface AdapterRequestOptions {
  signal?: AbortSignal
}

export interface PlatformAdapter {
  platform: Platform

  /** 校验 Token 是否有效，返回用户信息 */
  validateToken(token: string, opts?: AdapterRequestOptions): Promise<UnifiedUser>

  /**
   * 拉取当前用户的全部仓库（含私有、组织、fork）。
   * includeLanguages 默认 false：语言字节分布由同步层按需增量补齐，避免每次全量打接口。
   */
  listRepos(
    token: string,
    opts?: AdapterRequestOptions & { includeLanguages?: boolean },
  ): Promise<UnifiedRepo[]>

  /** 拉取单个仓库的语言字节分布（成本：1 次请求） */
  getRepoLanguages?(
    token: string,
    fullName: string,
    opts?: AdapterRequestOptions,
  ): Promise<Record<string, number>>

  /** 拉取指定仓库中当前用户的提交明细（不含逐提交的代码行统计） */
  listCommits(
    token: string,
    repo: UnifiedRepo,
    userLogin: string,
    since?: string,
    opts?: AdapterRequestOptions & { maxPages?: number },
  ): Promise<UnifiedCommit[]>

  /** 拉取单个提交的详情，补齐 additions/deletions/filesChanged（成本较高，按需调用） */
  getCommitDetail?(
    token: string,
    repo: UnifiedRepo,
    sha: string,
    opts?: AdapterRequestOptions,
  ): Promise<{ additions: number, deletions: number, filesChanged: number } | null>

  /** 拉取指定仓库的按周聚合代码量（GitHub 支持，Gitee 不支持） */
  getWeeklyStats?(
    token: string,
    repo: UnifiedRepo,
    userLogin: string,
    opts?: AdapterRequestOptions,
  ): Promise<{ additions: number; deletions: number; weeks: { w: number, a: number; d: number, c: number }[] } | null>

  /** 拉取指定仓库中当前用户的 PR / Issue */
  listPullRequestsAndIssues?(
    token: string,
    repo: UnifiedRepo,
    userLogin: string,
    opts?: AdapterRequestOptions,
  ): Promise<UnifiedIssue[]>

  /**
   * 获取剩余 API 配额信息。
   * 平台不支持单独查询时返回 null（如 Gitee，其配额仅能从响应头被动读取）。
   */
  getRateLimit(token: string, opts?: AdapterRequestOptions): Promise<{ limit: number, remaining: number, resetAt: string } | null>
}
