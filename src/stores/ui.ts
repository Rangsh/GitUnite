import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const useUiStore = defineStore('ui', {
  state: () => ({
    codeDetailEnabled: useStorage('gitunite:ui:codeDetail', true).value,
    autoIncrementalSync: useStorage('gitunite:ui:autoSync', true).value,
    timezone: useStorage('gitunite:ui:timezone', '').value,
    theme: useStorage<'light' | 'dark'>('gitunite:ui:theme', 'light').value,
  }),

  actions: {
    setCodeDetail(enabled: boolean) {
      this.codeDetailEnabled = enabled
    },
  },
})
