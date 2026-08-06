import AnalyticsWorker from './analytics.worker.ts?worker'

type WorkerReq =
  | { type: 'yearbook', payload: unknown }
  | { type: 'badges', payload: unknown }
  | { type: 'collaboration', payload: unknown }
  | { type: 'dailyBuckets', payload: unknown }

let worker: Worker | null = null
let seq = 0
const pending = new Map<string, { resolve: (v: unknown) => void, reject: (e: Error) => void }>()

function getWorker() {
  if (!worker) {
    worker = new AnalyticsWorker()
    worker.onmessage = (ev: MessageEvent<{ id: string, ok: boolean, result?: unknown, error?: string }>) => {
      const job = pending.get(ev.data.id)
      if (!job) return
      pending.delete(ev.data.id)
      if (ev.data.ok) job.resolve(ev.data.result)
      else job.reject(new Error(ev.data.error || 'worker failed'))
    }
    worker.onerror = (err) => {
      for (const [, job] of pending) job.reject(new Error(err.message || 'worker error'))
      pending.clear()
    }
  }
  return worker
}

/** 在 Worker 中跑纯计算；失败时由调用方自行回退主线程 */
export function runInAnalyticsWorker<T>(req: WorkerReq): Promise<T> {
  const id = `w-${++seq}`
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: v => resolve(v as T), reject })
    getWorker().postMessage({ id, ...req })
  })
}
