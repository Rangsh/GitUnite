import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

// 模块级持久化状态，保证跨 store 实例共享同一份 LocalStorage 数据
const codeDetailEnabled = useStorage<boolean>('gitunite:ui:codeDetail', true)
const autoIncrementalSync = useStorage<boolean>('gitunite:ui:autoSync', true)
const timezone = useStorage<string>('gitunite:ui:timezone', '')
const theme = useStorage<'light' | 'dark'>('gitunite:ui:theme', 'light')

export const useUiStore = defineStore('ui', {
  state: () => ({
    codeDetailEnabled,
    autoIncrementalSync,
    timezone,
    theme,
  }),
})
