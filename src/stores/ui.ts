import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import type { Platform } from '@/api/types'

// 模块级持久化状态，保证跨 store 实例共享同一份 LocalStorage 数据
const codeDetailEnabled = useStorage<boolean>('gitunite:ui:codeDetail.v2', false)
const timezone = useStorage<string>('gitunite:ui:timezone', '')
const theme = useStorage<'light' | 'dark'>('gitunite:ui:theme', 'light')
// 该平台 Token 缺少 PR/Issue 读权限时为 true（由同步引擎探测写入），UI 据此显示引导
const prIssueScopeMissing = useStorage<Record<Platform, boolean>>(
  'gitunite:ui:prIssueScopeMissing.v1',
  { github: false, gitee: false },
)

export const useUiStore = defineStore('ui', {
  state: () => ({
    codeDetailEnabled,
    timezone,
    theme,
    prIssueScopeMissing,
  }),
})
