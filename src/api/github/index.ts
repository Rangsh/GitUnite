import type {
  AdapterRequestOptions,
  PlatformAdapter,
  UnifiedCommit,
  UnifiedIssue,
  UnifiedRepo,
  UnifiedUser,
} from '../types'
import { setRateLimit, updateRateLimitFromHeaders } from '../rateLimit'
import { pickPrimaryLanguage, normalizeLanguageMap, normalizeCommitDate } from '../primaryLanguage'
import { paginateAll } from '../paginate'
import { createGithubClient } from './client'

interface GithubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  private: boolean
  fork: boolean
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
  html_url: string
  permissions?: { pull: boolean, push: boolean, admin: boolean }
}

interface GithubCommit {
  sha: string
  commit: {
    message: string
    author: { name: string, date: string } | null
  }
  author: { login: string | null } | null
  html_url: string
  stats?: { additions: number, deletions: number, total: number }
  files?: { filename: string }[]
}

interface GithubContributorStats {
  author: { login: string | null, id: number } | null
  total: number
  weeks: { w: number, a: number, d: number, c: number }[]
}

const githubAdapter: PlatformAdapter = {
  platform: 'github',

  async validateToken(token, opts): Promise<UnifiedUser> {
    const client = createGithubClient(token)
    const { data, headers } = await client.get<{
      id: number
      login: string
      name: string | null
      avatar_url: string
      html_url: string
    }>('/user', { signal: opts?.signal })
    updateRateLimitFromHeaders('github', headers as Record<string, string | undefined>)
    return {
      id: `github:${data.id}`,
      platform: 'github',
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    }
  },

  async listRepos(token, opts): Promise<UnifiedRepo[]> {
    const client = createGithubClient(token)
    const includeLanguages = opts?.includeLanguages === true

    // /user/repos 覆盖自有、协作者、组织成员仓库。
    // 注：提过 PR 但不是协作者的外部仓库留到 M5 PR/Issue 统计阶段通过 Search API 补齐，
    // 避免首次同步就消耗 Search 接口限流（30 次/分钟）导致整体卡住。
    const { items: ownRepos } = await paginateAll<GithubRepo>({
      http: client,
      url: '/user/repos',
      perPage: 100,
      maxPages: 50,
      signal: opts?.signal,
      params: {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
      },
    })

    const me = await this.validateToken(token, opts).catch(() => null)

    let languagesResults: Record<string, number>[] = ownRepos.map(() => ({}))
    if (includeLanguages) {
      languagesResults = await Promise.all(
        ownRepos.map(async (r) => {
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

    return ownRepos.map((r, i) => mapRepo(r, languagesResults[i], me?.login))
  },

  async getRepoLanguages(token, fullName, opts) {
    const client = createGithubClient(token)
    const { data } = await client.get(`/repos/${fullName}/languages`, { signal: opts?.signal })
    return normalizeLanguageMap(data)
  },

  async listCommits(token, repo, userLogin, since?, opts?) {
    const client = createGithubClient(token)
    const params: Record<string, unknown> = { author: userLogin }
    if (since) params.since = since
    if (opts?.until) params.until = opts.until
    // 增量通常很少页；全量也封顶，避免异常仓库打穿配额
    const maxPages = opts?.maxPages ?? (since || opts?.until ? 20 : 40)
    const { items, truncated } = await paginateAll<GithubCommit>({
      http: client,
      url: `/repos/${repo.fullName}/commits`,
      perPage: 100,
      maxPages,
      signal: opts?.signal,
      params,
    })

    return {
      commits: items.filter(c => !!c.commit.author).map(c => mapCommit(c, repo)),
      truncated,
    }
  },

  async getCommitDetail(token, repo, sha, opts) {
    const client = createGithubClient(token)
    try {
      const { data } = await client.get<GithubCommit>(
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

  async getWeeklyStats(token, repo, userLogin, opts) {
    const client = createGithubClient(token)
    // GitHub 在统计未就绪时返回 202，需要轮询（次数从严）
    for (let attempt = 0; attempt < 3; attempt++) {
      if (opts?.signal?.aborted) return null
      try {
        const res = await client.get<GithubContributorStats[]>(
          `/repos/${repo.fullName}/stats/contributors`,
          {
            signal: opts?.signal,
            validateStatus: (s: number) => s === 200 || s === 202 || s === 204,
          },
        )
        if (res.status === 202) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
          continue
        }
        if (res.status === 204 || !Array.isArray(res.data)) return null
        const mine = res.data.find(s => s.author?.login?.toLowerCase() === userLogin.toLowerCase())
        if (!mine) return null
        return {
          additions: mine.weeks.reduce((sum, w) => sum + w.a, 0),
          deletions: mine.weeks.reduce((sum, w) => sum + w.d, 0),
          weeks: mine.weeks,
        }
      }
      catch {
        return null
      }
    }
    return null
  },

  async listPullRequestsAndIssues(token, repo, userLogin, opts): Promise<UnifiedIssue[]> {
    const client = createGithubClient(token)
    const prs = await searchIssues(client, `repo:${repo.fullName} type:pr author:${userLogin}`, opts)
    const issues = await searchIssues(client, `repo:${repo.fullName} type:issue author:${userLogin}`, opts)
    return [...prs, ...issues]
  },

  async getRateLimit(token, opts) {
    const client = createGithubClient(token)
    const { data, headers } = await client.get<{
      resources: { core: { limit: number, remaining: number, reset: number } }
    }>('/rate_limit', { signal: opts?.signal })
    updateRateLimitFromHeaders('github', headers as Record<string, string | undefined>)
    const core = data.resources.core
    const info = {
      limit: core.limit,
      remaining: core.remaining,
      resetAt: new Date(core.reset * 1000).toISOString(),
    }
    setRateLimit('github', info)
    return info
  },
}

async function searchIssues(
  client: ReturnType<typeof createGithubClient>,
  q: string,
  opts?: AdapterRequestOptions,
): Promise<UnifiedIssue[]> {
  const all: UnifiedIssue[] = []
  for (let page = 1; page <= 10; page++) {
    if (opts?.signal?.aborted) break
    const { data } = await client.get<{
      items: Array<{
        number: number
        title: string
        state: string
        pull_request?: { merged_at: string | null }
        created_at: string
        closed_at: string | null
        html_url: string
      }>
    }>('/search/issues', { params: { q, per_page: 100, page }, signal: opts?.signal })
    const items = data.items ?? []
    for (const it of items) {
      const isPr = !!it.pull_request
      all.push({
        id: `github:${it.html_url}`,
        repoId: '',
        platform: 'github',
        number: it.number,
        type: isPr ? 'pr' : 'issue',
        state: isPr && it.pull_request?.merged_at ? 'merged' : it.state === 'closed' ? 'closed' : 'open',
        title: it.title,
        createdAt: it.created_at,
        closedAt: it.closed_at,
        mergedAt: it.pull_request?.merged_at ?? null,
        htmlUrl: it.html_url,
      })
    }
    if (items.length < 100) break
  }
  return all
}

function mapRepo(r: GithubRepo, languages: Record<string, number>, myLogin?: string): UnifiedRepo {
  const isOwned = r.owner.login.toLowerCase() === myLogin?.toLowerCase()
  // /user/repos?affiliation=owner,collaborator,organization_member 返回的都是
  // 当前用户有权限的仓库，因此 isContributed 全部为 true。
  // 角色细化用于展示标签，不影响筛选。
  let role: UnifiedRepo['role']
  if (isOwned) role = 'owned'
  else if (r.fork) role = 'fork'
  else role = 'organization'
  return {
    id: `github:${r.id}`,
    platform: 'github',
    owner: r.owner.login,
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

function mapCommit(c: GithubCommit, repo: UnifiedRepo): UnifiedCommit {
  return {
    id: `github:${repo.id}:${c.sha}`,
    repoId: repo.id,
    platform: 'github',
    sha: c.sha,
    message: c.commit.message,
    authorLogin: c.author?.login ?? null,
    authorName: c.commit.author?.name ?? null,
    authoredAt: normalizeCommitDate(c.commit.author?.date),
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    filesChanged: c.files?.length ?? 0,
    htmlUrl: c.html_url,
  }
}

export default githubAdapter
