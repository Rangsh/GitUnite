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

/**
 * 通用分页器：按 perPage 顺序拉取，直到下一页为空或达到 maxPages。
 * 解析 Link header 中 rel="next" 判断是否还有下一页；没有 Link header 时退化为
 * "本页返回数量 < perPage 即结束"。
 */
export async function paginateAll<T>(opts: PaginateOptions<T>): Promise<T[]> {
  const { http, url, perPage, maxPages = 100, params = {}, hasNext, signal } = opts
  const results: T[] = []

  for (let page = 1; page <= maxPages; page++) {
    if (signal?.aborted) break
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
      : link.includes('rel="next"')
        ? true
        : items.length >= perPage

    if (!hasNextPage) break
  }
  return results
}
