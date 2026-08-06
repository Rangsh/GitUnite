<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { NButton, NText } from 'naive-ui'
import {
  FileJson, FileSpreadsheet, Share2, Download,
} from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import {
  exportCommitsCsv, exportJson, exportReposCsv, type ExportInput,
} from '@/utils/export'
import type { AnalyticsScope } from '@/utils/analytics'
import ShareDialog from '@/components/share/ShareDialog.vue'

const { t } = useI18n()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()
const { timezone } = storeToRefs(ui)

const scope = ref<AnalyticsScope>('all')
const shareShow = ref(false)

function buildInput(): ExportInput {
  return {
    repos: analytics.repos,
    commits: analytics.commits,
    issues: analytics.issues,
    repoStats: analytics.repoStats,
    codeDetailEnabled: ui.codeDetailEnabled,
    scope: scope.value,
    tz: timezone.value,
  }
}

function onExportJson() {
  exportJson(buildInput())
}
function onExportCommitsCsv() {
  exportCommitsCsv(buildInput())
}
function onExportReposCsv() {
  exportReposCsv(buildInput())
}

const scopeTabs = computed(() => [
  { label: t('common.aggregate'), value: 'all' as const },
  { label: t('common.github'), value: 'github' as const, disabled: !auth.isConnected('github') },
  { label: t('common.gitee'), value: 'gitee' as const, disabled: !auth.isConnected('gitee') },
])
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
    <div class="border-b border-ink-100 px-5 py-4">
      <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-ink-900">
        <Download :size="17" /> {{ t('export.title') }}
      </h2>
      <p class="mt-0.5 text-xs text-ink-400">{{ t('export.subtitle') }}</p>
    </div>

    <div class="space-y-5 px-5 py-4">
      <!-- 范围 -->
      <div class="flex flex-wrap items-center gap-3">
        <NText depth="3" class="text-xs">{{ t('export.scope') }}</NText>
        <div class="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
          <button
            v-for="tab in scopeTabs"
            :key="tab.value"
            type="button"
            class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
            :class="scope === tab.value
              ? 'bg-white text-ink-900 shadow-sm'
              : tab.disabled ? 'cursor-not-allowed text-ink-300' : 'text-ink-500 hover:bg-ink-50'"
            :disabled="tab.disabled"
            @click="scope = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- 导出按钮 -->
      <div class="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          class="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          @click="onExportJson"
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <FileJson :size="17" />
          </span>
          <span>
            <span class="block text-sm font-medium text-ink-900">{{ t('export.jsonTitle') }}</span>
            <span class="block text-xs text-ink-400">{{ t('export.jsonDesc') }}</span>
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          @click="onExportCommitsCsv"
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <FileSpreadsheet :size="17" />
          </span>
          <span>
            <span class="block text-sm font-medium text-ink-900">{{ t('export.commitsTitle') }}</span>
            <span class="block text-xs text-ink-400">{{ t('export.commitsDesc') }}</span>
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
          @click="onExportReposCsv"
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <FileSpreadsheet :size="17" />
          </span>
          <span>
            <span class="block text-sm font-medium text-ink-900">{{ t('export.reposTitle') }}</span>
            <span class="block text-xs text-ink-400">{{ t('export.reposDesc') }}</span>
          </span>
        </button>
      </div>

      <div class="border-t border-ink-100 pt-4">
        <NButton type="primary" class="!rounded-xl" @click="shareShow = true">
          <template #icon><Share2 :size="15" /></template>
          {{ t('export.shareBtn') }}
        </NButton>
        <NText depth="3" class="ml-3 text-xs">{{ t('export.shareHint') }}</NText>
      </div>
    </div>

    <ShareDialog v-model:show="shareShow" />
  </section>
</template>
