import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { rateLimitState, updateRateLimitFromHeaders } from './rateLimit'
import type { Platform } from './types'

// 平台级并发与限流配置
export const PLATFORM_CONCURRENCY: Record<Platform, number> = {
  github: 4,
  gitee: 2,
}

interface PlatformHttpOptions {
  platform: Platform
  baseURL: string
  headers?: Record<string, string>
  /** 每个请求是否附带 access_token query（Gitee 用） */
  authStyle?: 'header' | 'query'
  token: string
}

// 简单的延时
function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// 按平台的简单并发池
function createPool(limit: number) {
  let running = 0
  const queue: Array<() => void> = []
  return <T>(task: () => Promise<T>): Promise<T> => {
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
    return acquire().then(() => task().finally(release))
  }
}

// 内存 ETag 缓存：url -> { etag, data }
const etagCache = new Map<string, { etag: string, data: unknown }>()

// 标记被限流时的等待 Promise，避免并发重复等待
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

function withRetry(client: AxiosInstance, platform: Platform) {
  async function request<T>(config: AxiosRequestConfig, attempt = 0): Promise<AxiosResponse<T>> {
    const url = config.url ?? ''
    // ETag：GET 请求带上 If-None-Match
    if ((config.method ?? 'get').toLowerCase() === 'get' && etagCache.has(url)) {
      config.headers = {
        ...config.headers,
        'If-None-Match': etagCache.get(url)!.etag,
      }
    }

    try {
      const res = await client.request<T>(config)
      // 记录配额
      updateRateLimitFromHeaders(platform, res.headers as Record<string, string | undefined>)
      // 保存 ETag
      const etag = res.headers.etag
      if (etag && (config.method ?? 'get').toLowerCase() === 'get') {
        etagCache.set(url, { etag, data: res.data })
      }
      return res
    }
    catch (err) {
      if (!axios.isAxiosError(err) || !err.response) {
        // 网络错误：指数退避重试
        if (attempt < 3) {
          await sleep(2 ** attempt * 1000)
          return request<T>(config, attempt + 1)
        }
        throw err
      }

      const status = err.response.status
      updateRateLimitFromHeaders(platform, err.response.headers as Record<string, string | undefined>)

      // 304 命中缓存：直接返回缓存数据
      if (status === 304 && etagCache.has(url)) {
        return {
          ...err.response,
          data: etagCache.get(url)!.data as T,
          status: 200,
        } as AxiosResponse<T>
      }

      // 被限流
      if (status === 403 || status === 429) {
        // GitHub 滥用限流可能返回 403 + retry-after
        const retryAfter = err.response.headers['retry-after']
        const resetAt = retryAfter
          ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString()
          : rateLimitState[platform]?.resetAt
        await waitForRateLimitReset(platform, resetAt)
        return request<T>(config, attempt)
      }

      // 5xx 重试
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

  // Gitee 通过 query 参数带 token
  if (opts.authStyle === 'query') {
    client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      config.params = { ...(config.params ?? {}), access_token: opts.token }
      return config
    })
  }

  const pool = createPool(PLATFORM_CONCURRENCY[opts.platform])
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
