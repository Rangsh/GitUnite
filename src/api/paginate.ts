import type { AxiosRequestConfig } from 'axios'
import type { PlatformHttp } from './http'

interface PaginateOptions<T> {
  http: PlatformHttp
  url: string
  /** 每页数量，不同平台上限不同 */
  perPage: number
  /** 最大页数保护，防止异常情况下无限翻页；默认 100 页 */
  maxPages?: number
  params?: Record<string, unknown>
  /** 解析 Link header 或直接根据返回数组长度判断是否还有下一页 */
  hasNext?: (page: number, items: T[], lastResponse: { link?: string }) => boolean
  signal?: AbortSignal
}

export interface PaginateResult<T> {
  items: T[]
  /**
   * 因 maxPages 提前停止，且服务端仍可能有下一页。
   * 调用方不应把「截断后的最新水位」当作完整历史已拉完。
   */
  truncated: boolean
}

/**
 * 通用分页器：按 perPage 顺序拉取，直到下一页为空或达到 maxPages。
 * 有 Link header 时只信任 rel="next"；否则用「本页满页」启发式。
 * 中途 Abort 会抛 AbortError，避免调用方把半截列表当成完整结果去删本地数据。
 */
export async function paginateAll<T>(opts: PaginateOptions<T>): Promise<PaginateResult<T>> {
  const { http, url, perPage, maxPages = 100, params = {}, hasNext, signal } = opts
  const results: T[] = []
  let truncated = false

  for (let page = 1; page <= maxPages; page++) {
    if (signal?.aborted) {
      throw new DOMException('同步已取消', 'AbortError')
    }
    const config: AxiosRequestConfig = {
      params: { ...params, per_page: perPage, page },
      signal,
    }
    const res = await http.get<T[]>(url, config)
    const items = res.data ?? []
    results.push(...items)

    const link = (res.headers?.link as string | undefined) ?? ''
    const hasNextPage = hasNext
      ? hasNext(page, items, { link })
      : link
        ? link.includes('rel="next"')
        : items.length >= perPage

    if (!hasNextPage) break
    if (page === maxPages) {
      truncated = true
      break
    }
  }
  return { items: results, truncated }
}
