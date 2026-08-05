import { createPlatformHttp, type PlatformHttp } from '../http'

export const GITHUB_API = 'https://api.github.com'

// Token 每次请求都从闭包外重新读取，避免 Token 更新后 client 不感知
export function createGithubClient(token: string): PlatformHttp {
  return createPlatformHttp({
    platform: 'github',
    baseURL: GITHUB_API,
    authStyle: 'header',
    token,
  })
}
