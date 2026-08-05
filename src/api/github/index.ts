import type {
  PlatformAdapter,
  UnifiedCommit,
  UnifiedIssue,
  UnifiedRepo,
  UnifiedUser,
} from '../types'
import { setRateLimit, updateRateLimitFromHeaders } from '../rateLimit'
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

  async validateToken(token): Promise<UnifiedUser> {
    const client = createGithubClient(token)
    const { data, headers } = await client.get<{
      id: number
      login: string
      name: string | null
      avatar_url: string
      html_url: string
    }>('/user')
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

  async listRepos(token): Promise<UnifiedRepo[]> {
    const client = createGithubClient(token)

    // 1. /user/repos 覆盖自有、组织、协作者仓库
    const ownRepos = await paginateAll<GithubRepo>({
      http: client,
      url: '/user/repos',
      perPage: 100,
      params: {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
      },
    })

    // 2. Search API 发现提过 PR 的仓库（Search 接口单独的速率限制，最多 1000 条，对个人用户足够）
    const prRepos = await fetchPrContributedRepos(client)

    // 3. 按 full_name 去重
    const byFullName = new Map<string, GithubRepo>()
    for (const r of ownRepos) byFullName.set(r.full_name.toLowerCase(), r)
    for (const r of prRepos) byFullName.set(r.full_name.toLowerCase(), r)

    // 4. 并发拉取 languages（受平台并发池限制）
    const repos = [...byFullName.values()]
    const languagesResults = await Promise.all(
      repos.map(async (r) => {
        try {
          const { data } = await client.get<Record<string, number>>(`/repos/${r.full_name}/languages`)
          return data ?? {}
        }
        catch {
          return {}
        }
      }),
    )

    const me = await this.validateToken(token).catch(() => null)

    return repos.map((r, i) => mapRepo(r, languagesResults[i], me?.login))
  },

  async listCommits(token, repo, userLogin, since?): Promise<UnifiedCommit[]> {
    const client = createGithubClient(token)
    const commits = await paginateAll<GithubCommit>({
      http: client,
      url: `/repos/${repo.fullName}/commits`,
      perPage: 100,
      params: { author: userLogin, since },
    })

    return commits
      .filter(c => !!c.commit.author)
      .map(c => mapCommit(c, repo))
  },

  async getCommitDetail(token, repo, sha) {
    const client = createGithubClient(token)
    try {
      const { data } = await client.get<GithubCommit>(`/repos/${repo.fullName}/commits/${sha}`)
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

  async getWeeklyStats(token, repo, userLogin) {
    const client = createGithubClient(token)
    // GitHub 在统计未就绪时返回 202，需要轮询
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await client.get<GithubContributorStats[]>(
          `/repos/${repo.fullName}/stats/contributors`,
          { validateStatus: (s: number) => s === 200 || s === 202 || s === 204 },
        )
        if (res.status === 202) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
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

  async listPullRequestsAndIssues(token, repo, userLogin): Promise<UnifiedIssue[]> {
    const client = createGithubClient(token)
    const prs = await searchIssues(client, `repo:${repo.fullName} type:pr author:${userLogin}`)
    const issues = await searchIssues(client, `repo:${repo.fullName} type:issue author:${userLogin}`)
    return [...prs, ...issues]
  },

  async getRateLimit(token) {
    const client = createGithubClient(token)
    const { data, headers } = await client.get<{
      resources: { core: { limit: number, remaining: number, reset: number } }
    }>('/rate_limit')
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

async function fetchPrContributedRepos(client: ReturnType<typeof createGithubClient>): Promise<GithubRepo[]> {
  // 利用 search/issues 找我评论或创建过 PR 的仓库，再补拉仓库详情
  const result = new Map<string, GithubRepo>()
  const queries = [
    'is:pr author:@me',
  ]
  for (const q of queries) {
    let page = 1
    while (page <= 10) {
      const { data } = await client.get<{
        items: Array<{ repository_url: string }>
      }>('/search/issues', {
        params: { q, per_page: 100, page },
      })
      const items = data.items ?? []
      for (const it of items) {
        const match = it.repository_url.match(/\/repos\/(.+)$/)
        if (!match) continue
        const fullName = match[1]
        if (result.has(fullName.toLowerCase())) continue
        try {
          const { data: repo } = await client.get<GithubRepo>(`/repos/${fullName}`)
          result.set(fullName.toLowerCase(), repo)
        }
        catch {
          // 忽略无权限/已删除仓库
        }
      }
      if (items.length < 100) break
      page++
    }
  }
  return [...result.values()]
}

async function searchIssues(
  client: ReturnType<typeof createGithubClient>,
  q: string,
): Promise<UnifiedIssue[]> {
  const all: UnifiedIssue[] = []
  for (let page = 1; page <= 10; page++) {
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
    }>('/search/issues', { params: { q, per_page: 100, page } })
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
  const isOrg = !isOwned && !!r.permissions?.push && !r.fork
  // PR 贡献仓库：不是自有、无 push 权限（只读）
  const isPrContributed = !isOwned && !isOrg && !r.fork && r.permissions?.pull === true && !r.permissions?.push
  return {
    id: `github:${r.id}`,
    platform: 'github',
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    language: r.language,
    languages,
    stargazersCount: r.stargazers_count,
    forksCount: r.forks_count,
    isPrivate: r.private,
    isFork: r.fork,
    isOwned,
    isContributed: isOwned || isOrg || isPrContributed,
    role: isOwned ? 'owned' : isOrg ? 'organization' : r.fork ? 'fork' : 'pr_contributed',
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
    authoredAt: c.commit.author?.date ?? '',
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    filesChanged: c.files?.length ?? 0,
    htmlUrl: c.html_url,
  }
}

export default githubAdapter
