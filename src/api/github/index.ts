import type { PlatformAdapter, UnifiedUser, UnifiedRepo, UnifiedCommit, UnifiedIssue } from '../types'
import { createGithubClient } from './client'

const githubAdapter: PlatformAdapter = {
  platform: 'github',

  async validateToken(token: string): Promise<UnifiedUser> {
    const client = createGithubClient(token)
    const { data } = await client.get('/user')
    return {
      id: `github:${data.id}`,
      platform: 'github',
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    }
  },

  async listRepos(_token: string): Promise<UnifiedRepo[]> {
    // TODO(M2): 分页拉取 /user/repos（per_page=100, affiliation=owner,collaborator,organization_member）
    // 再合并 Search API 发现的 PR 贡献仓库，调用 /repos/{owner}/{repo}/languages 填充 languages
    return []
  },

  async listCommits(_token: string, _repo: UnifiedRepo, _userLogin: string, _since?: string): Promise<UnifiedCommit[]> {
    // TODO(M2): 分页拉取 /repos/{owner}/{repo}/commits?author=<userLogin>&since=<since>
    return []
  },

  async getWeeklyStats(_token: string, _repo: UnifiedRepo, _userLogin: string) {
    // TODO(M2): GET /repos/{owner}/{repo}/stats/contributors，202 时退避重试，找到当前用户那一项
    return null
  },

  async listPullRequestsAndIssues(_token: string, _repo: UnifiedRepo, _userLogin: string): Promise<UnifiedIssue[]> {
    // TODO(M5): Search API: is:pr author:<user> repo:<fullName> 与 is:issue
    return []
  },

  async getRateLimit(token: string) {
    const client = createGithubClient(token)
    const { data } = await client.get('/rate_limit')
    const core = data.resources.core
    return {
      limit: core.limit,
      remaining: core.remaining,
      resetAt: new Date(core.reset * 1000).toISOString(),
    }
  },
}

export default githubAdapter
