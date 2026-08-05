/**
 * 跨标签页同步互斥锁。
 * 优先 Web Locks API；不支持时退化为 localStorage 心跳锁。
 * 避免多标签同时同步把平台配额打穿。
 */

const LOCK_NAME = 'gitunite-sync'
const STORAGE_KEY = 'gitunite:sync:tab-lock'
const HEARTBEAT_MS = 2_000
const STALE_MS = 8_000

export interface SyncLockHandle {
  release: () => void
}

interface StorageLockPayload {
  owner: string
  expiresAt: number
}

function storageRead(): StorageLockPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StorageLockPayload
  }
  catch {
    return null
  }
}

function storageWrite(payload: StorageLockPayload | null) {
  try {
    if (!payload) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // 隐私模式等写失败时放行，避免卡死
  }
}

function acquireViaStorage(): SyncLockHandle | null {
  const now = Date.now()
  const existing = storageRead()
  if (existing && existing.expiresAt > now) return null

  const owner = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  storageWrite({ owner, expiresAt: now + STALE_MS })

  // 竞态复核
  const verify = storageRead()
  if (!verify || verify.owner !== owner) return null

  const timer = window.setInterval(() => {
    const cur = storageRead()
    if (cur?.owner !== owner) return
    storageWrite({ owner, expiresAt: Date.now() + STALE_MS })
  }, HEARTBEAT_MS)

  return {
    release: () => {
      window.clearInterval(timer)
      const cur = storageRead()
      if (cur?.owner === owner) storageWrite(null)
    },
  }
}

/**
 * 尝试获取同步锁。拿不到表示其他标签页正在同步。
 */
export async function tryAcquireSyncLock(): Promise<SyncLockHandle | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) {
    let releaseHold: (() => void) | undefined
    const hold = new Promise<void>((resolve) => {
      releaseHold = resolve
    })

    let granted = false
    const lockDone = locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return
      granted = true
      await hold
    })

    // 等回调执行完 ifAvailable 判定
    await Promise.resolve()
    await new Promise<void>(r => setTimeout(r, 0))

    if (!granted) {
      void lockDone
      return null
    }

    return {
      release: () => {
        releaseHold?.()
        void lockDone
      },
    }
  }

  return acquireViaStorage()
}
