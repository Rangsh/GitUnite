<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { NSelect, NSwitch, NText } from 'naive-ui'
import { useUiStore, type ThemeMode } from '@/stores/ui'
import { isValidTimezone, dayjs } from '@/utils/date'
import type { AppLocale } from '@/i18n'

const { t } = useI18n()
const ui = useUiStore()
const { codeDetailEnabled, timezone, theme, locale } = storeToRefs(ui)

const guessed = dayjs.tz.guess() || 'UTC'

const timezoneOptions = computed(() => {
  const commons = [
    guessed,
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Singapore',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
  ]
  const uniq = [...new Set(commons.filter(Boolean))]
  return [
    { label: t('settings.timezoneBrowserDefault', { tz: guessed }), value: '' },
    ...uniq.map(z => ({ label: z, value: z })),
  ]
})

const tzInvalid = computed(() => !!timezone.value && !isValidTimezone(timezone.value))

const themeOptions = computed(() => [
  { label: t('settings.themeLight'), value: 'light' satisfies ThemeMode },
  { label: t('settings.themeDark'), value: 'dark' satisfies ThemeMode },
  { label: t('settings.themeSystem'), value: 'system' satisfies ThemeMode },
])

const localeOptions = computed(() => [
  { label: '简体中文', value: 'zh-CN' satisfies AppLocale },
  { label: 'English', value: 'en-US' satisfies AppLocale },
])

function onLocaleUpdate(v: AppLocale) {
  ui.setLocale(v)
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel dark:border-ink-700 dark:bg-ink-900/40">
    <div class="border-b border-ink-100 px-5 py-4 dark:border-ink-800">
      <h2 class="m-0 text-base font-semibold text-ink-900 dark:text-ink-100">
        {{ t('settings.syncAppearanceTitle') }}
      </h2>
      <p class="mt-1 text-xs text-ink-400">{{ t('settings.syncAppearanceDesc') }}</p>
    </div>
    <div class="space-y-5 px-5 py-4">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <NText class="!text-ink-800 dark:!text-ink-100">{{ t('settings.codeDetail') }}</NText>
          <div class="mt-0.5 text-xs text-ink-400">{{ t('settings.codeDetailHint') }}</div>
        </div>
        <NSwitch v-model:value="codeDetailEnabled" />
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <NText class="!text-ink-800 dark:!text-ink-100">{{ t('settings.timezone') }}</NText>
          <div class="mt-0.5 text-xs text-ink-400">{{ t('settings.timezoneHint') }}</div>
          <div v-if="tzInvalid" class="mt-1 text-xs text-red-500">{{ t('settings.timezoneInvalid') }}</div>
        </div>
        <NSelect
          v-model:value="timezone"
          :options="timezoneOptions"
          filterable
          tag
          :placeholder="t('settings.timezonePlaceholder')"
          class="sm:max-w-[280px] w-full"
          :status="tzInvalid ? 'error' : undefined"
        />
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <NText class="!text-ink-800 dark:!text-ink-100">{{ t('settings.theme') }}</NText>
          <div class="mt-0.5 text-xs text-ink-400">{{ t('settings.themeHint') }}</div>
        </div>
        <NSelect
          v-model:value="theme"
          :options="themeOptions"
          class="sm:max-w-[180px] w-full"
        />
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <NText class="!text-ink-800 dark:!text-ink-100">{{ t('settings.language') }}</NText>
          <div class="mt-0.5 text-xs text-ink-400">{{ t('settings.languageHint') }}</div>
        </div>
        <NSelect
          :value="locale"
          :options="localeOptions"
          class="sm:max-w-[180px] w-full"
          @update:value="onLocaleUpdate"
        />
      </div>
    </div>
  </section>
</template>
