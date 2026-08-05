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

type HeaderSource =
  | Record<string, string | number | undefined | null>
  | {
    get?: (name: string) => unknown
    toJSON?: () => Record<string, unknown>
  }

/**
 * 兼容 AxiosHeaders 与普通对象。
 * AxiosHeaders 用原始大小写存 key（如 X-RateLimit-Limit），
 * 直接用 headers['x-ratelimit-limit'] 会得到 undefined，必须走 get() 或按 key 忽略大小写查找。
 */
function readHeader(headers: HeaderSource, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof headers.get === 'function') {
      const v = headers.get(key)
      if (v != null && v !== '') return String(v)
    }
  }

  const plain: Record<string, unknown> =
    typeof headers.toJSON === 'function'
      ? headers.toJSON()
      : (headers as Record<string, unknown>)

  const normalized = new Map<string, string>()
  for (const [k, v] of Object.entries(plain)) {
    if (v == null || v === '') continue
    // 跳过 AxiosHeaders 内部方法字段
    if (typeof v === 'function') continue
    normalized.set(k.toLowerCase(), String(v))
  }

  for (const key of keys) {
    const v = normalized.get(key.toLowerCase())
    if (v != null) return v
  }
  return undefined
}

export function updateRateLimitFromHeaders(
  platform: Platform,
  headers: HeaderSource,
) {
  // GitHub: x-ratelimit-limit / x-ratelimit-remaining / x-ratelimit-reset (unix seconds)
  // Gitee:   rate-limit-limit / rate-limit-remaining / rate-limit-reset (unix seconds)
  const limitRaw = readHeader(headers, 'x-ratelimit-limit', 'rate-limit-limit')
  const remainingRaw = readHeader(headers, 'x-ratelimit-remaining', 'rate-limit-remaining')
  const resetRaw = readHeader(headers, 'x-ratelimit-reset', 'rate-limit-reset')

  if (!limitRaw || remainingRaw == null || !resetRaw) return

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
