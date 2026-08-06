import { createPlatformHttp, type PlatformHttp } from '../http'

export const GITEE_API = 'https://gitee.com/api/v5'

export function createGiteeClient(token: string): PlatformHttp {
  // 优先走 Authorization 头，避免 Token 出现在 URL / 代理日志中
  return createPlatformHttp({
    platform: 'gitee',
    baseURL: GITEE_API,
    authStyle: 'token',
    token,
  })
}
