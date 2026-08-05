import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import type { Platform, UnifiedUser } from '@/api/types'
import { getAdapter } from '@/api'

interface AuthState {
  tokens: Record<Platform, string>
  users: Record<Platform, UnifiedUser | null>
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState & {
    githubToken: string
    giteeToken: string
  } => ({
    // useStorage 响应式持久化到 LocalStorage
    githubToken: useStorage('gitunite:token:github', '').value,
    giteeToken: useStorage('gitunite:token:gitee', '').value,
    tokens: { github: '', gitee: '' },
    users: { github: null, gitee: null },
  }),

  getters: {
    isConnected: state => (platform: Platform) => !!state.tokens[platform],
    anyConnected: state => !!state.tokens.github || !!state.tokens.gitee,
  },

  actions: {
    setToken(platform: Platform, token: string) {
      this.tokens[platform] = token
      if (platform === 'github') this.githubToken = token
      else this.giteeToken = token
    },

    async connect(platform: Platform, token: string): Promise<UnifiedUser> {
      const adapter = getAdapter(platform)
      const user = await adapter.validateToken(token)
      this.setToken(platform, token)
      this.users[platform] = user
      return user
    },

    async disconnect(platform: Platform) {
      this.tokens[platform] = ''
      this.users[platform] = null
      if (platform === 'github') this.githubToken = ''
      else this.giteeToken = ''
      // TODO(M2): 同时通过 db 清掉该平台的 repos / commits / issues / cursors
    },
  },
})
