import { createPlatformHttp, type PlatformHttp } from '../http'

export const GITEE_API = 'https://gitee.com/api/v5'

export function createGiteeClient(token: string): PlatformHttp {
  return createPlatformHttp({
    platform: 'gitee',
    baseURL: GITEE_API,
    authStyle: 'query',
    token,
  })
}
