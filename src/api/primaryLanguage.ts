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

/** 规范化提交时间：Gitee 有时返回 `2024-01-01 12:00:00 +0800` 这类非严格 ISO */
export function normalizeCommitDate(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return ''
  const s = raw.trim()
  // 已是可被 Date 解析的 ISO
  const direct = Date.parse(s)
  if (!Number.isNaN(direct)) return new Date(direct).toISOString()

  // `YYYY-MM-DD HH:mm:ss +0800` / `YYYY-MM-DD HH:mm:ss`
  const m = s.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-]\d{2}):?(\d{2})|Z)?/,
  )
  if (m) {
    const [, date, time, oh, om] = m
    const iso = oh != null
      ? `${date}T${time}${oh}:${om ?? '00'}`
      : `${date}T${time}Z`
    const t = Date.parse(iso)
    if (!Number.isNaN(t)) return new Date(t).toISOString()
  }
  return s
}

/** 判断提交是否属于指定用户（兼容 author.login 缺失、大小写不一致） */
export function isCommitByUser(
  commit: {
    author?: { login?: string | null } | null
    commit?: { author?: { name?: string | null, email?: string | null } | null }
  },
  userLogin: string,
): boolean {
  const login = userLogin.trim().toLowerCase()
  if (!login) return false
  const authorLogin = commit.author?.login?.trim().toLowerCase()
  if (authorLogin && authorLogin === login) return true
  // 部分 Gitee 提交 author 为 null，只在 commit.author.name 里带用户名
  const name = commit.commit?.author?.name?.trim().toLowerCase()
  if (name && name === login) return true
  return false
}
