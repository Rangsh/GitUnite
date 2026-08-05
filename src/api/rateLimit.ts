import { reactive } from 'vue'
import type { Platform } from './types'

export interface RateLimitState {
  limit: number
  remaining: number
  resetAt: string
}

// 适配器与 HTTP 拦截器共享的可变配额状态；store 也从这里读
export const rateLimitState = reactive<Record<Platform, RateLimitState | null>>({
  github: null,
  gitee: null,
})

export function updateRateLimitFromHeaders(
  platform: Platform,
  headers: Record<string, string | undefined>,
) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = headers[k.toLowerCase()]
      if (v !== undefined && v !== null) return v
    }
    return undefined
  }

  // GitHub: x-ratelimit-limit / x-ratelimit-remaining / x-ratelimit-reset (unix seconds)
  // Gitee:   rate-limit-limit / rate-limit-remaining / rate-limit-reset (unix seconds)
  const limitRaw = get('x-ratelimit-limit', 'rate-limit-limit')
  const remainingRaw = get('x-ratelimit-remaining', 'rate-limit-remaining')
  const resetRaw = get('x-ratelimit-reset', 'rate-limit-reset')

  if (!limitRaw || !remainingRaw || !resetRaw) return

  const limit = Number(limitRaw)
  const remaining = Number(remainingRaw)
  const resetSec = Number(resetRaw)
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(resetSec)) return

  rateLimitState[platform] = {
    limit,
    remaining,
    resetAt: new Date(resetSec * 1000).toISOString(),
  }
}

export function setRateLimit(platform: Platform, info: RateLimitState | null) {
  rateLimitState[platform] = info
}
