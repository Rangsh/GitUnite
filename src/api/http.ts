import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { rateLimitState, readHeader, updateRateLimitFromHeaders } from './rateLimit'
import type { Platform } from './types'

/**
 * 平台级限流（保守值，优先保账号安全）：
 * - GitHub 认证用户约 5000/h，仍有 secondary / abuse 限流
 * - Gitee 更敏感，并发与间隔更严
 */
export const PLATFORM_CONCURRENCY: Record<Platform, number> = {
  github: 2,
  gitee: 1,
}

/** 两次真实发请求之间的最小间隔（毫秒） */
export const PLATFORM_MIN_INTERVAL_MS: Record<Platform, number> = {
  github: 200,
  gitee: 450,
}

/** remaining 降到该阈值及以下时，主动等到 reset，避免撞墙 */
const REMAINING_PAUSE_THRESHOLD = 8

/** 同一请求因限流最多等待重试次数（防止永久挂起） */
const MAX_RATE_LIMIT_RETRIES = 6

interface PlatformHttpOptions {
  platform: Platform
  baseURL: string
  headers?: Record<string, string>
  /** 每个请求是否附带 access_token query（Gitee 用） */
  authStyle?: 'header' | 'query'
  token: string
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * 并发池 + 最小发请求间隔。
 * 必须按平台单例共享，否则每次 createPlatformHttp 都会新建池，
 * Promise.all(N) 会绕过 concurrency 上限。
 */
function createPacedPool(limit: number, minIntervalMs: number) {
  let running = 0
  const queue: Array<() => void> = []
  let lastStartAt = 0
  let spacingTail: Promise<void> = Promise.resolve()

  const acquire = () =>
    new Promise<void>((resolve) => {
      if (running < limit) {
        running++
        resolve()
      }
      else {
        queue.push(resolve)
      }
    })

  const release = () => {
    running--
    const next = queue.shift()
    if (next) {
      running++
      next()
    }
  }

  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire()
    try {
      // 串行化「开始时刻」，保证任意两次请求启动至少间隔 minIntervalMs
      const turn = spacingTail.then(async () => {
        const wait = Math.max(0, lastStartAt + minIntervalMs - Date.now())
        if (wait > 0) await sleep(wait)
        lastStartAt = Date.now()
      })
      spacingTail = turn.catch(() => {})
      await turn
      return await task()
    }
    finally {
      release()
    }
  }
}

/** 每个平台一个共享池，跨所有 client 实例生效 */
const platformPools: Partial<Record<Platform, ReturnType<typeof createPacedPool>>> = {}

function getPlatformPool(platform: Platform) {
  if (!platformPools[platform]) {
    platformPools[platform] = createPacedPool(
      PLATFORM_CONCURRENCY[platform],
      PLATFORM_MIN_INTERVAL_MS[platform],
    )
  }
  return platformPools[platform]!
}

// 内存 ETag 缓存：cacheKey -> { etag, data }；LRU 上限防止长会话膨胀
const ETAG_CACHE_MAX = 500
const etagCache = new Map<string, { etag: string, data: unknown }>()

function stableSerializeParams(params: unknown): string {
  if (!params || typeof params !== 'object') return ''
  const entries = Object.entries(params as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('&')
}

function etagCacheKey(config: AxiosRequestConfig): string {
  const method = (config.method ?? 'get').toLowerCase()
  const url = config.url ?? ''
  const base = config.baseURL ?? ''
  return `${method}:${base}${url}?${stableSerializeParams(config.params)}`
}

function etagCacheSet(key: string, value: { etag: string, data: unknown }) {
  if (etagCache.has(key)) etagCache.delete(key)
  etagCache.set(key, value)
  while (etagCache.size > ETAG_CACHE_MAX) {
    const oldest = etagCache.keys().next().value
    if (oldest === undefined) break
    etagCache.delete(oldest)
  }
}

/** 断开账号 / 清数据时丢弃条件请求缓存，避免串平台脏读 */
export function clearEtagCache() {
  etagCache.clear()
}

const rateLimitWaiters: Partial<Record<Platform, Promise<void>>> = {}

async function waitForRateLimitReset(platform: Platform, resetAt?: string): Promise<void> {
  const state = rateLimitState[platform]
  const resetMs = resetAt
    ? new Date(resetAt).getTime()
    : state?.resetAt
      ? new Date(state.resetAt).getTime()
      : Date.now() + 30_000
  const waitMs = Math.max(1000, Math.min(resetMs - Date.now(), 60 * 60 * 1000))
  if (!rateLimitWaiters[platform]) {
    rateLimitWaiters[platform] = sleep(waitMs).finally(() => {
      rateLimitWaiters[platform] = undefined
    })
  }
  await rateLimitWaiters[platform]
}

/** 发请求前：配额将尽则主动等待，避免打满后被平台二次限流 */
async function ensureQuotaAvailable(platform: Platform): Promise<void> {
  const state = rateLimitState[platform]
  if (!state) return
  if (state.remaining > REMAINING_PAUSE_THRESHOLD) return
  const resetMs = new Date(state.resetAt).getTime()
  if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return
  await waitForRateLimitReset(platform, state.resetAt)
}

function isRateLimitResponse(
  status: number,
  headers: unknown,
  data: unknown,
): boolean {
  if (status === 429) return true
  if (status !== 403) return false

  const h = headers as Parameters<typeof readHeader>[0]
  const remaining = readHeader(h, 'x-ratelimit-remaining', 'rate-limit-remaining')
  if (remaining === '0') return true
  if (readHeader(h, 'retry-after')) return true

  const body = typeof data === 'string'
    ? data
    : data == null
      ? ''
      : JSON.stringify(data)
  const lower = body.toLowerCase()
  return (
    lower.includes('rate limit')
    || lower.includes('rate_limit')
    || lower.includes('secondary rate')
    || lower.includes('abuse')
    || lower.includes('访问频率')
    || lower.includes('请求过于频繁')
  )
}

function resolveRetryResetAt(headers: unknown): string | undefined {
  const h = headers as Parameters<typeof readHeader>[0]
  const retryAfter = readHeader(h, 'retry-after')
  if (retryAfter) {
    const sec = Number(retryAfter)
    if (Number.isFinite(sec) && sec >= 0) {
      return new Date(Date.now() + sec * 1000).toISOString()
    }
    const asDate = Date.parse(retryAfter)
    if (Number.isFinite(asDate)) return new Date(asDate).toISOString()
  }
  return undefined
}

function withRetry(client: AxiosInstance, platform: Platform) {
  async function request<T>(config: AxiosRequestConfig, attempt = 0): Promise<AxiosResponse<T>> {
    const cacheKey = etagCacheKey(config)
    if ((config.method ?? 'get').toLowerCase() === 'get' && etagCache.has(cacheKey)) {
      config.headers = {
        ...config.headers,
        'If-None-Match': etagCache.get(cacheKey)!.etag,
      }
    }

    await ensureQuotaAvailable(platform)

    try {
      const res = await client.request<T>(config)
      updateRateLimitFromHeaders(platform, res.headers as Record<string, string | undefined>)
      const etag = res.headers.etag
      if (etag && (config.method ?? 'get').toLowerCase() === 'get') {
        etagCacheSet(cacheKey, { etag, data: res.data })
      }
      return res
    }
    catch (err) {
      if (!axios.isAxiosError(err) || !err.response) {
        if (attempt < 3) {
          await sleep(2 ** attempt * 1000)
          return request<T>(config, attempt + 1)
        }
        throw err
      }

      const status = err.response.status
      updateRateLimitFromHeaders(platform, err.response.headers as Record<string, string | undefined>)

      if (status === 304 && etagCache.has(cacheKey)) {
        return {
          ...err.response,
          data: etagCache.get(cacheKey)!.data as T,
          status: 200,
        } as AxiosResponse<T>
      }

      if (isRateLimitResponse(status, err.response.headers, err.response.data)) {
        if (attempt >= MAX_RATE_LIMIT_RETRIES) throw err
        const resetAt = resolveRetryResetAt(err.response.headers)
          ?? rateLimitState[platform]?.resetAt
        await waitForRateLimitReset(platform, resetAt)
        return request<T>(config, attempt + 1)
      }

      // 普通 403（无权限等）直接失败，不再当限流无限重试
      if (status >= 500 && status < 600 && attempt < 3) {
        await sleep(2 ** attempt * 1000)
        return request<T>(config, attempt + 1)
      }

      throw err
    }
  }
  return request
}

export function createPlatformHttp(opts: PlatformHttpOptions) {
  const client = axios.create({
    baseURL: opts.baseURL,
    timeout: 20_000,
    headers: opts.authStyle === 'header'
      ? {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${opts.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...opts.headers,
        }
      : opts.headers,
  })

  if (opts.authStyle === 'query') {
    client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      config.params = { ...(config.params ?? {}), access_token: opts.token }
      return config
    })
  }

  const pool = getPlatformPool(opts.platform)
  const retryableRequest = withRetry(client, opts.platform)

  return {
    get<T = unknown>(url: string, config?: AxiosRequestConfig) {
      return pool(() => retryableRequest<T>({ ...config, url, method: 'GET' }))
    },
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
      return pool(() => retryableRequest<T>({ ...config, url, method: 'POST', data }))
    },
    raw: client,
  }
}

export type PlatformHttp = ReturnType<typeof createPlatformHttp>
