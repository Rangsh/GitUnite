import type { Platform, PlatformAdapter } from './types'
import githubAdapter from './github'
import giteeAdapter from './gitee'

export * from './types'

const adapters: Record<Platform, PlatformAdapter> = {
  github: githubAdapter,
  gitee: giteeAdapter,
}

export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform]
}
