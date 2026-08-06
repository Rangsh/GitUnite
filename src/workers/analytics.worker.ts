/// <reference lib="webworker" />
/**
 * 重计算 Worker：年鉴 / 徽章 / 协作图等纯函数可在此执行，避免阻塞主线程。
 * 主线程通过 postMessage({ id, type, payload }) 调用，回 { id, ok, result|error }。
 */
import { computeYearbook, type YearbookInput, type YearbookData } from '../utils/yearbook'
import { evaluateBadges, type BadgeInput, type BadgeStatus } from '../utils/badges'
import { computeCollaboration, type CollaborationInput, type CollaborationGraph } from '../utils/collaboration'
import { computeDailyBuckets, type AnalyticsInput } from '../utils/analytics'

type Req =
  | { id: string, type: 'yearbook', payload: YearbookInput }
  | { id: string, type: 'badges', payload: BadgeInput }
  | { id: string, type: 'collaboration', payload: CollaborationInput }
  | { id: string, type: 'dailyBuckets', payload: AnalyticsInput }

type Out =
  | { id: string, ok: true, result: YearbookData | BadgeStatus[] | CollaborationGraph | ReturnType<typeof computeDailyBuckets> }
  | { id: string, ok: false, error: string }

self.onmessage = (ev: MessageEvent<Req>) => {
  const msg = ev.data
  try {
    let result: Out['ok'] extends true ? never : unknown
    switch (msg.type) {
      case 'yearbook':
        result = computeYearbook(msg.payload)
        break
      case 'badges':
        result = evaluateBadges(msg.payload)
        break
      case 'collaboration':
        result = computeCollaboration(msg.payload)
        break
      case 'dailyBuckets':
        result = computeDailyBuckets(msg.payload)
        break
      default:
        throw new Error(`unknown worker type`)
    }
    const out: Out = { id: msg.id, ok: true, result: result as any }
    self.postMessage(out)
  }
  catch (e) {
    const out: Out = { id: msg.id, ok: false, error: (e as Error).message || String(e) }
    self.postMessage(out)
  }
}

export {}
