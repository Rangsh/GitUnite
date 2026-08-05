import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'
import type { Platform, UnifiedUser } from '@/api/types'
import { getAdapter } from '@/api'
import { setRateLimit } from '@/api/rateLimit'
import { db } from '@/db/schema'
import { useAnalyticsStore } from '@/stores/analytics'

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: string
}

// 用模块级 ref 持有持久化状态，保证 store 多次注册时仍共享同一份 LocalStorage 数据
const tokenStorage = {
  github: useStorage<string>('gitunite:token:github', ''),
  gitee: useStorage<string>('gitunite:token:gitee', ''),
}

// 内存态：用户信息与配额，不做持久化（启动时通过 restoreSession 重新拉取）
const users = ref<Record<Platform, UnifiedUser | null>>({ github: null, gitee: null })
const rateLimits = ref<Record<Platform, RateLimitInfo | null>>({ github: null, gitee: null })
const connecting = ref<Record<Platform, boolean>>({ github: false, gitee: false })

function tokenOf(platform: Platform) {
  return tokenStorage[platform].value
}

function setToken(platform: Platform, token: string) {
  tokenStorage[platform].value = token
}

function clearToken(platform: Platform) {
  tokenStorage[platform].value = ''
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // 将模块级 ref 拆成 state 字段，保证 Pinia devtools 可观察
    githubToken: tokenStorage.github,
    giteeToken: tokenStorage.gitee,
    users,
    rateLimits,
    connecting,
  }),

  getters: {
    tokens(): Record<Platform, string> {
      return { github: this.githubToken, gitee: this.giteeToken }
    },
    isConnected: state => (platform: Platform) => !!state[`${platform}Token` as 'githubToken' | 'giteeToken'],
    anyConnected(): boolean {
      return !!this.githubToken || !!this.giteeToken
    },
    user: state => (platform: Platform) => state.users[platform],
    rateLimit: state => (platform: Platform) => state.rateLimits[platform],
    isConnecting: state => (platform: Platform) => state.connecting[platform],
    // 倒计时秒数，供 UI 显示"xx秒后恢复"
    rateLimitCountdown(): (platform: Platform) => number {
      return (platform: Platform) => {
        const rl = this.rateLimits[platform]
        if (!rl?.resetAt) return 0
        const sec = Math.max(0, Math.ceil((new Date(rl.resetAt).getTime() - Date.now()) / 1000))
        return Number.isFinite(sec) ? sec : 0
      }
    },
  },

  actions: {
    async connect(platform: Platform, token: string): Promise<UnifiedUser> {
      this.connecting[platform] = true
      try {
        const adapter = getAdapter(platform)
        const user = await adapter.validateToken(token)
        setToken(platform, token)
        this.users[platform] = user
        await this.refreshRateLimit(platform)
        return user
      }
      finally {
        this.connecting[platform] = false
      }
    },

    async disconnect(platform: Platform) {
      clearToken(platform)
      this.users[platform] = null
      this.rateLimits[platform] = null
      setRateLimit(platform, null)
      // 同步清除该平台的全部缓存数据
      await Promise.all([
        db.repos.where('platform').equals(platform).delete(),
        db.commits.where('platform').equals(platform).delete(),
        db.issues.where('platform').equals(platform).delete(),
        db.cursors.where('platform').equals(platform).delete(),
        db.repoStats.where('platform').equals(platform).delete(),
      ])
      // 强制重载分析内存缓存，避免看板继续展示已断开平台的旧数据
      void useAnalyticsStore().refresh()
    },

    async refreshRateLimit(platform: Platform) {
      const token = tokenOf(platform)
      if (!token) return
      try {
        this.rateLimits[platform] = await getAdapter(platform).getRateLimit(token)
      }
      catch {
        // 配额拉取失败不影响主流程
      }
    },

    /** 启动时用本地 Token 恢复用户信息；Token 已失效则清除 */
    async restoreSession() {
      await Promise.all(
        (['github', 'gitee'] as Platform[]).map(async (platform) => {
          const token = tokenOf(platform)
          if (!token) return
          try {
            const user = await getAdapter(platform).validateToken(token)
            this.users[platform] = user
            await this.refreshRateLimit(platform)
          }
          catch {
            clearToken(platform)
            this.users[platform] = null
          }
        }),
      )
    },
  },
})

// 给非组件代码（同步引擎等）一个无 store 实例的取 token 途径
export function getToken(platform: Platform): string {
  return tokenOf(platform)
}
