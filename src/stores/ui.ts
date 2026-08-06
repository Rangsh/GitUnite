import { defineStore } from 'pinia'
import { computed } from 'vue'
import { usePreferredDark, useStorage } from '@vueuse/core'
import type { Platform } from '@/api/types'
import { setAppLocale, type AppLocale, detectDefaultLocale } from '@/i18n'

export type ThemeMode = 'light' | 'dark' | 'system'

const codeDetailEnabled = useStorage<boolean>('gitunite:ui:codeDetail.v2', false)
const timezone = useStorage<string>('gitunite:ui:timezone', '')
/** light | dark | system（跟随系统） */
const theme = useStorage<ThemeMode>('gitunite:ui:theme', 'system')
const locale = useStorage<AppLocale>('gitunite:ui:locale', detectDefaultLocale())
const prIssueScopeMissing = useStorage<Record<Platform, boolean>>(
  'gitunite:ui:prIssueScopeMissing.v1',
  { github: false, gitee: false },
)

const prefersDark = usePreferredDark()

export const useUiStore = defineStore('ui', () => {
  const isDark = computed(() =>
    theme.value === 'dark' || (theme.value === 'system' && prefersDark.value))

  function setLocale(next: AppLocale) {
    locale.value = next
    setAppLocale(next)
  }

  // 启动时同步 html lang 与 vue-i18n
  setAppLocale(locale.value)

  return {
    codeDetailEnabled,
    timezone,
    theme,
    locale,
    prIssueScopeMissing,
    isDark,
    setLocale,
  }
})
