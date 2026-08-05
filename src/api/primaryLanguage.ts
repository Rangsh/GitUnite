/** 从语言字节分布中取占比最高的作为主语言 */
export function pickPrimaryLanguage(
  declared: string | null | undefined,
  languages: Record<string, number>,
): string | null {
  if (declared) return declared

  let best: string | null = null
  let max = -1
  for (const [name, bytes] of Object.entries(languages)) {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes)) continue
    if (bytes > max) {
      max = bytes
      best = name
    }
  }
  return best
}

interface GiteeLanguageItem {
  language?: string
  bytes?: number
  percent?: number
}

/**
 * 统一各平台 languages 接口返回值。
 * - GitHub: `{ "Java": 12345 }`
 * - Gitee:  `{ "languages": [{ "language": "Java", "bytes": 12345, "percent": 100 }] }`
 */
export function normalizeLanguageMap(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object') return {}

  const obj = data as Record<string, unknown>
  if (Array.isArray(obj.languages)) {
    const result: Record<string, number> = {}
    for (const raw of obj.languages) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as GiteeLanguageItem
      if (!item.language) continue
      const weight = typeof item.bytes === 'number'
        ? item.bytes
        : typeof item.percent === 'number'
          ? item.percent
          : NaN
      if (!Number.isFinite(weight)) continue
      result[item.language] = weight
    }
    return result
  }

  const result: Record<string, number> = {}
  for (const [name, value] of Object.entries(obj)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[name] = value
    }
  }
  return result
}
