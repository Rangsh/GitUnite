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
 * 传入 tzOverride 优先；否则回退到浏览器猜测时区。
 */
export function resolveTimezone(tzOverride?: string): string {
  if (tzOverride && tzOverride.trim()) return tzOverride.trim()
  return dayjs.tz.guess()
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
  return toLocal(utcIso, tz).format('YYYY-MM-DD')
}

/**
 * 返回本地小时 0-23。
 */
export function localHour(utcIso: string | Date, tz?: string): number {
  return toLocal(utcIso, tz).hour()
}

/**
 * 返回本地星期几，0=周日 … 6=周六。
 */
export function localDayOfWeek(utcIso: string | Date, tz?: string): number {
  return toLocal(utcIso, tz).day()
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
