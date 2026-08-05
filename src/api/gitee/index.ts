import type {
  PlatformAdapter,
  UnifiedCommit,
  UnifiedIssue,
  UnifiedRepo,
  UnifiedUser,
} from '../types'
import { setRateLimit, updateRateLimitFromHeaders } from '../rateLimit'
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

const giteeAdapter: PlatformAdapter = {
  platform: 'gitee',

  async validateToken(token): Promise<UnifiedUser> {
    const client = createGiteeClient(token)
    const { data, headers } = await client.get<{
      id: number
      login: string
      name: string
      avatar_url: string
      html_url: string
    }>('/user')
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

  async listRepos(token): Promise<UnifiedRepo[]> {
    const client = createGiteeClient(token)
    // type=all 同时覆盖自有与组织成员仓库
    const repos = await paginateAll<GiteeRepo>({
      http: client,
      url: '/user/repos',
      perPage: 100,
      maxPages: 100,
      params: { type: 'all', sort: 'updated' },
    })

    const me = await this.validateToken(token).catch(() => null)
    const seen = new Set<string>()
    const unique = repos.filter((r) => {
      const key = r.full_name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const languagesResults = await Promise.all(
      unique.map(async (r) => {
        try {
          const { data } = await client.get<Record<string, number>>(`/repos/${r.full_name}/languages`)
          return data ?? {}
        }
        catch {
          return {}
        }
      }),
    )

    return unique.map((r, i) => mapRepo(r, languagesResults[i], me?.login))
  },

  async listCommits(token, repo, userLogin, since?): Promise<UnifiedCommit[]> {
    const client = createGiteeClient(token)
    const commits = await paginateAll<GiteeCommit>({
      http: client,
      url: `/repos/${repo.fullName}/commits`,
      perPage: 100,
      maxPages: 100,
      params: { author: userLogin, since },
    })
    return commits
      .filter(c => !!c.commit.author)
      .map(c => mapCommit(c, repo))
  },

  async getCommitDetail(token, repo, sha) {
    const client = createGiteeClient(token)
    try {
      const { data } = await client.get<GiteeCommit>(`/repos/${repo.fullName}/commits/${sha}`)
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

  async listPullRequestsAndIssues(token, repo, userLogin): Promise<UnifiedIssue[]> {
    const client = createGiteeClient(token)
    const [prs, issues] = await Promise.all([
      paginateGiteeItems(client, `/repos/${repo.fullName}/pulls`, { creator: userLogin, state: 'all' }),
      paginateGiteeItems(client, `/repos/${repo.fullName}/issues`, { creator: userLogin, state: 'all' }),
    ])
    return [...prs, ...issues]
  },

  async getRateLimit(token) {
    // Gitee 无专门配额接口；用一次轻量请求读响应头填充
    const client = createGiteeClient(token)
    try {
      const { headers } = await client.get('/user')
      updateRateLimitFromHeaders('gitee', headers as Record<string, string | undefined>)
    }
    catch {
      // ignore
    }
    const info = {
      limit: 0,
      remaining: 0,
      resetAt: '',
    }
    setRateLimit('gitee', info)
    return info
  },
}

async function paginateGiteeItems(
  client: ReturnType<typeof createGiteeClient>,
  url: string,
  params: Record<string, unknown>,
): Promise<UnifiedIssue[]> {
  const result: UnifiedIssue[] = []
  for (let page = 1; page <= 100; page++) {
    const { data } = await client.get<Array<{
      number: number
      title: string
      state: string
      created_at: string
      closed_at: string | null
      html_url: string
      merged_at?: string | null
    }>>(url, { params: { ...params, per_page: 100, page } })
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
  const isOrg = !isOwned && !!r.permission?.push && !r.fork
  const isPrContributed = !isOwned && !isOrg && !r.fork
  return {
    id: `gitee:${r.id}`,
    platform: 'gitee',
    owner: r.namespace?.path ?? r.owner.login,
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

function mapCommit(c: GiteeCommit, repo: UnifiedRepo): UnifiedCommit {
  return {
    id: `gitee:${repo.id}:${c.sha}`,
    repoId: repo.id,
    platform: 'gitee',
    sha: c.sha,
    message: c.commit.message,
    authorLogin: c.author?.login ?? null,
    authorName: c.commit.author?.name ?? null,
    authoredAt: c.commit.author?.date ?? '',
    // Gitee 列表接口不返回 stats，需要按 SHA 调详情补齐；由同步引擎按开关决定是否调用
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    filesChanged: c.files?.length ?? 0,
    htmlUrl: c.html_url,
  }
}

export default giteeAdapter
