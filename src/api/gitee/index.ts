import type { PlatformAdapter, UnifiedUser, UnifiedRepo, UnifiedCommit, UnifiedIssue } from '../types'
import { createGiteeClient } from './client'

const giteeAdapter: PlatformAdapter = {
  platform: 'gitee',

  async validateToken(token: string): Promise<UnifiedUser> {
    const client = createGiteeClient(token)
    const { data } = await client.get('/user')
    return {
      id: `gitee:${data.id}`,
      platform: 'gitee',
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    }
  },

  async listRepos(_token: string): Promise<UnifiedRepo[]> {
    // TODO(M2): 分页拉取 /user/repos?type=all&per_page=100，再合并 /search/repositories 中贡献过的仓库
    return []
  },

  async listCommits(_token: string, _repo: UnifiedRepo, _userLogin: string, _since?: string): Promise<UnifiedCommit[]> {
    // TODO(M2): 分页拉取 /repos/{owner}/{repo}/commits?author=<userLogin>&since=<since>
    // 若开启代码明细，再对每个 SHA 调 /repos/{owner}/{repo}/commits/{sha} 取 stats.additions/deletions
    return []
  },

  // Gitee 无 stats/contributors 聚合接口，不实现 getWeeklyStats

  async listPullRequestsAndIssues(_token: string, _repo: UnifiedRepo, _userLogin: string): Promise<UnifiedIssue[]> {
    // TODO(M5): /repos/{owner}/{repo}/pulls?creator=<user> 与 issues
    return []
  },

  async getRateLimit(_token: string) {
    // TODO(M2): Gitee 无专门的 rate_limit 接口，从响应头 rate-limit-limit / rate-limit-remaining 读取
    return { limit: 0, remaining: 0, resetAt: '' }
  },
}

export default giteeAdapter
