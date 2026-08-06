/// <reference lib="webworker" />
/**
 * 重计算 Worker：只跑可 structured-clone 的纯数据结果。
 * 含 Vue 组件（徽章 icon）或 Map 的结果留在主线程。
 */
import { computeYearbook, type YearbookInput, type YearbookData } from '../utils/yearbook'
import { computeDailyBuckets, type AnalyticsInput, type DailyBucket } from '../utils/analytics'

type Req =
  | { id: string, type: 'yearbook', payload: YearbookInput }
  | { id: string, type: 'dailyBuckets', payload: AnalyticsInput }

type Out =
  | { id: string, ok: true, result: YearbookData | Map<string, DailyBucket> }
  | { id: string, ok: false, error: string }

self.onmessage = (ev: MessageEvent<Req>) => {
  const msg = ev.data
  try {
    let result: YearbookData | Map<string, DailyBucket>
    switch (msg.type) {
      case 'yearbook':
        result = computeYearbook(msg.payload)
        break
      case 'dailyBuckets':
        result = computeDailyBuckets(msg.payload)
        break
      default:
        throw new Error('unknown worker type')
    }
    const out: Out = { id: msg.id, ok: true, result }
    self.postMessage(out)
  }
  catch (e) {
    const out: Out = { id: msg.id, ok: false, error: (e as Error).message || String(e) }
    self.postMessage(out)
  }
}

export {}
