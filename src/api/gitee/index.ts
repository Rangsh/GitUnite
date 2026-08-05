import type {
  AdapterRequestOptions,
  PlatformAdapter,
  UnifiedCommit,
  UnifiedIssue,
  UnifiedRepo,
  UnifiedUser,
} from '../types'
import { updateRateLimitFromHeaders } from '../rateLimit'
import { pickPrimaryLanguage, normalizeLanguageMap, normalizeCommitDate, isCommitByUser } from '../primaryLanguage'
import { paginateAll } from '../paginate'
import { createGiteeClient } from './client'

interface GiteeRepo {
  id: number
  name: string
  full_name: string
  namespace: { path: string }
  owner: { login: string }
  description: string | null
  private: boolean
  fork: boolean
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
  html_url: string
  permission?: { pull: boolean, push: boolean, admin: boolean }
}

interface GiteeCommit {
  sha: string
  commit: {
    message: string
    author: { name: string, date: string } | null
  }
  author: { login: string } | null
  html_url: string
  stats?: { additions: number, deletions: number, total: number }
  files?: { filename: string }[]
}

/** Gitee 无可靠 author 过滤时的分页硬顶（账号安全优先） */
const GITEE_COMMIT_MAX_PAGES_INCREMENTAL = 8
const GITEE_COMMIT_MAX_PAGES_FULL = 20

const giteeAdapter: PlatformAdapter = {
  platform: 'gitee',

  async validateToken(token, opts): Promise<UnifiedUser> {
    const client = createGiteeClient(token)
    const { data, headers } = await client.get<{
      id: number
      login: string
      name: string
      avatar_url: string
      html_url: string
    }>('/user', { signal: opts?.signal })
    updateRateLimitFromHeaders('gitee', headers as Record<string, string | undefined>)
    return {
      id: `gitee:${data.id}`,
      platform: 'gitee',
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    }
  },

  async listRepos(token, opts): Promise<UnifiedRepo[]> {
    const client = createGiteeClient(token)
    const includeLanguages = opts?.includeLanguages === true
    // type=all 同时覆盖自有与组织成员仓库
    const repos = await paginateAll<GiteeRepo>({
      http: client,
      url: '/user/repos',
      perPage: 100,
      maxPages: 50,
      signal: opts?.signal,
      params: { type: 'all', sort: 'updated' },
    })

    const me = await this.validateToken(token, opts).catch(() => null)
    const seen = new Set<string>()
    const unique = repos.filter((r) => {
      const key = r.full_name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    let languagesResults: Record<string, number>[] = unique.map(() => ({}))
    if (includeLanguages) {
      languagesResults = await Promise.all(
        unique.map(async (r) => {
          try {
            const { data } = await client.get(`/repos/${r.full_name}/languages`, { signal: opts?.signal })
            return normalizeLanguageMap(data)
          }
          catch {
            return {}
          }
        }),
      )
    }

    return unique.map((r, i) => mapRepo(r, languagesResults[i], me?.login))
  },

  async getRepoLanguages(token, fullName, opts) {
    const client = createGiteeClient(token)
    const { data } = await client.get(`/repos/${fullName}/languages`, { signal: opts?.signal })
    return normalizeLanguageMap(data)
  },

  async listCommits(token, repo, userLogin, since?, opts?): Promise<UnifiedCommit[]> {
    const client = createGiteeClient(token)
    const params: Record<string, unknown> = {}
    if (since) params.since = since

    // Gitee 的 author 查询参数经常直接返回空数组（与 GitHub 行为不一致）。
    // 策略：先不带 author 拉取，再在本地按 login / name 过滤。
    // 因此必须严控 maxPages，避免组织大仓把配额打穿。
    const maxPages = opts?.maxPages
      ?? (since ? GITEE_COMMIT_MAX_PAGES_INCREMENTAL : GITEE_COMMIT_MAX_PAGES_FULL)

    const raw = await paginateAll<GiteeCommit>({
      http: client,
      url: `/repos/${repo.fullName}/commits`,
      perPage: 100,
      maxPages,
      signal: opts?.signal,
      params,
    })

    return raw
      .filter(c => isCommitByUser(c, userLogin) && !!c.commit?.author?.date)
      .map(c => mapCommit(c, repo))
  },

  async getCommitDetail(token, repo, sha, opts) {
    const client = createGiteeClient(token)
    try {
      const { data } = await client.get<GiteeCommit>(
        `/repos/${repo.fullName}/commits/${sha}`,
        { signal: opts?.signal },
      )
      return {
        additions: data.stats?.additions ?? 0,
        deletions: data.stats?.deletions ?? 0,
        filesChanged: data.files?.length ?? 0,
      }
    }
    catch {
      return null
    }
  },

  async listPullRequestsAndIssues(token, repo, userLogin, opts): Promise<UnifiedIssue[]> {
    const client = createGiteeClient(token)
    const [prs, issues] = await Promise.all([
      paginateGiteeItems(client, `/repos/${repo.fullName}/pulls`, { creator: userLogin, state: 'all' }, opts),
      paginateGiteeItems(client, `/repos/${repo.fullName}/issues`, { creator: userLogin, state: 'all' }, opts),
    ])
    return [...prs, ...issues]
  },

  async getRateLimit() {
    // Gitee v5 不提供独立的配额查询接口；配额信息只能从各响应的
    // rate-limit-* 响应头被动读取（HTTP 拦截器已自动解析）。
    return null
  },
}

async function paginateGiteeItems(
  client: ReturnType<typeof createGiteeClient>,
  url: string,
  params: Record<string, unknown>,
  opts?: AdapterRequestOptions,
): Promise<UnifiedIssue[]> {
  const result: UnifiedIssue[] = []
  for (let page = 1; page <= 20; page++) {
    if (opts?.signal?.aborted) break
    const { data } = await client.get<Array<{
      number: number
      title: string
      state: string
      created_at: string
      closed_at: string | null
      html_url: string
      merged_at?: string | null
    }>>(url, { params: { ...params, per_page: 100, page }, signal: opts?.signal })
    const items = data ?? []
    const isPr = url.includes('/pulls')
    for (const it of items) {
      result.push({
        id: `gitee:${url}:${it.number}`,
        repoId: '',
        platform: 'gitee',
        number: it.number,
        type: isPr ? 'pr' : 'issue',
        state: isPr && it.merged_at ? 'merged' : it.state === 'closed' ? 'closed' : 'open',
        title: it.title,
        createdAt: it.created_at,
        closedAt: it.closed_at,
        mergedAt: it.merged_at ?? null,
        htmlUrl: it.html_url,
      })
    }
    if (items.length < 100) break
  }
  return result
}

function mapRepo(r: GiteeRepo, languages: Record<string, number>, myLogin?: string): UnifiedRepo {
  const isOwned = r.owner.login.toLowerCase() === myLogin?.toLowerCase()
  let role: UnifiedRepo['role']
  if (isOwned) role = 'owned'
  else if (r.fork) role = 'fork'
  else role = 'organization'
  return {
    id: `gitee:${r.id}`,
    platform: 'gitee',
    owner: r.namespace?.path ?? r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    language: pickPrimaryLanguage(r.language, languages),
    languages,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    isPrivate: r.private,
    isFork: r.fork,
    isOwned,
    isContributed: true,
    role,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
  }
}

function mapCommit(c: GiteeCommit, repo: UnifiedRepo): UnifiedCommit {
  return {
    id: `gitee:${repo.id}:${c.sha}`,
    repoId: repo.id,
    platform: 'gitee',
    sha: c.sha,
    message: c.commit.message,
    authorLogin: c.author?.login ?? null,
    authorName: c.commit.author?.name ?? null,
    authoredAt: normalizeCommitDate(c.commit.author?.date),
    // Gitee 列表接口不返回 stats，需要按 SHA 调详情补齐；由同步引擎按开关决定是否调用
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    filesChanged: c.files?.length ?? 0,
    htmlUrl: c.html_url,
  }
}

export default giteeAdapter
