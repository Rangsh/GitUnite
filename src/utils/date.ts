import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import weekday from 'dayjs/plugin/weekday'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import isoWeek from 'dayjs/plugin/isoWeek'
import advancedFormat from 'dayjs/plugin/advancedFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(weekday)
dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)
dayjs.extend(advancedFormat)

/**
 * 返回用于统计的目标时区（IANA 名称）。
 * 传入 tzOverride 优先；空字符串 / 空白 / 非法 IANA 回退浏览器时区。
 */
export function resolveTimezone(tzOverride?: string): string {
  const fallback = (() => {
    try {
      return dayjs.tz.guess() || 'UTC'
    }
    catch {
      return 'UTC'
    }
  })()
  if (!tzOverride || !tzOverride.trim()) return fallback
  const candidate = tzOverride.trim()
  try {
    // Intl 对非法 IANA 会抛 RangeError
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  }
  catch {
    return fallback
  }
}

/** 校验 IANA 时区名是否可用 */
export function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return true // 空 = 自动
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() }).format(new Date())
    return true
  }
  catch {
    return false
  }
}

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export interface TzHelpers {
  dateKey: (utcIso: string | Date) => string
  hour: (utcIso: string | Date) => number
  dayOfWeek: (utcIso: string | Date) => number
}

/**
 * 批量统计时复用同一套 Intl formatter，避免每条 commit 都走 dayjs.tz（主线程杀手）。
 */
export function createTzHelpers(tzOverride?: string): TzHelpers {
  const tz = resolveTimezone(tzOverride)
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  })
  const weekFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  })

  return {
    dateKey: (utcIso) => dateFmt.format(new Date(utcIso)),
    hour: (utcIso) => Number(hourFmt.format(new Date(utcIso))),
    dayOfWeek: (utcIso) => weekdayIndex[weekFmt.format(new Date(utcIso))] ?? 0,
  }
}

/**
 * 将 UTC 时间转换为目标时区的 dayjs 对象。
 */
export function toLocal(utcIso: string | Date, tz?: string): dayjs.Dayjs {
  return dayjs.utc(utcIso).tz(resolveTimezone(tz))
}

/**
 * 返回 YYYY-MM-DD 格式的本地日期字符串（用于按天聚合 / 去重）。
 */
export function localDateKey(utcIso: string | Date, tz?: string): string {
  return createTzHelpers(tz).dateKey(utcIso)
}

/**
 * 返回本地小时 0-23。
 */
export function localHour(utcIso: string | Date, tz?: string): number {
  return createTzHelpers(tz).hour(utcIso)
}

/**
 * 返回本地星期几，0=周日 … 6=周六。
 */
export function localDayOfWeek(utcIso: string | Date, tz?: string): number {
  return createTzHelpers(tz).dayOfWeek(utcIso)
}

/**
 * 判断 b 是否为 a 的后一天。
 */
export function isNextDay(a: string, b: string): boolean {
  return dayjs(b).diff(dayjs(a), 'day') === 1
}

/** 字节数格式化为人类可读字符串。 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

/** 千分位数字格式化。 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN')
}

/** 毫秒时长格式化为“x 天 y 小时”。 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

export { dayjs }
