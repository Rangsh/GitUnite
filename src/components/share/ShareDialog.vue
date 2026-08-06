<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NModal, NSwitch, NButton, NAlert, NSpin, NText,
} from 'naive-ui'
import { toPng } from 'html-to-image'
import { Download, Copy, EyeOff, ShieldAlert } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/composables/useFeedback'
import { computeActivity, computeBasicStats, computeLanguages } from '@/utils/analytics'
import { evaluateBadges } from '@/utils/badges'
import { resolveTimezone, dayjs } from '@/utils/date'
import ShareCard from './ShareCard.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const { t } = useI18n()
const analytics = useAnalyticsStore()
const ui = useUiStore()
const auth = useAuthStore()

const hideIdentity = ref(false)
const avatarDataUrl = ref<string | null>(null)
const generating = ref(false)
const cardRef = ref<InstanceType<typeof ShareCard> | null>(null)

const year = computed(() => dayjs().tz(resolveTimezone(ui.timezone)).year())

const shareData = computed(() => {
  const base = {
    repos: analytics.repos,
    commits: analytics.commits,
    repoStats: analytics.repoStats,
    codeDetailEnabled: ui.codeDetailEnabled,
    scope: 'all' as const,
    tz: ui.timezone,
  }
  const basic = computeBasicStats(base)
  const activity = computeActivity(base)
  const languages = computeLanguages(base)
  const badges = evaluateBadges({ ...base, me: {
    github: auth.user('github')?.login ?? null,
    gitee: auth.user('gitee')?.login ?? null,
  } })
  const earned = badges.filter(b => b.earned).map(b => ({ id: b.id, name: b.name }))

  // 优先 GitHub 身份，否则 Gitee
  const gh = auth.user('github')
  const gt = auth.user('gitee')
  const nickname = gh?.name || gh?.login || gt?.name || gt?.login || 'Developer'

  return {
    avatarUrl: avatarDataUrl.value,
    nickname,
    hideIdentity: hideIdentity.value,
    totalCommits: basic.commitCount,
    languageCount: languages.length,
    activeDays: activity.activeDays,
    longestStreak: activity.longestStreak,
    topLanguages: languages.slice(0, 3).map(l => ({ language: l.language, percentage: l.percentage })),
    earnedBadges: earned,
    year: year.value,
  }
})

// 头像跨域转 DataURL，避免 canvas 污染；失败则用文字头像
async function loadAvatar() {
  const user = auth.user('github') ?? auth.user('gitee')
  if (!user?.avatarUrl || hideIdentity.value) {
    avatarDataUrl.value = null
    return
  }
  try {
    const res = await fetch(user.avatarUrl, { mode: 'cors' })
    if (!res.ok) throw new Error('avatar fetch failed')
    const blob = await res.blob()
    avatarDataUrl.value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  catch {
    avatarDataUrl.value = null
  }
}

watch(
  () => [props.show, hideIdentity.value],
  ([show]) => {
    if (show) void loadAvatar()
  },
  { immediate: true },
)

function doClose() {
  emit('update:show', false)
}

async function renderPng(): Promise<Blob | null> {
  const node = (cardRef.value as unknown as { $el?: HTMLElement })?.$el
  if (!node) return null
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
    // 徽章 webp 与头像均为同域 / dataURL，无需额外处理
  })
  const res = await fetch(dataUrl)
  return await res.blob()
}

async function download() {
  try {
    generating.value = true
    const blob = await renderPng()
    if (!blob) {
      message.error(t('share.genFail'))
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gitunite-share-${year.value}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.success(t('share.downloadOk'))
  }
  catch (e) {
    console.error('[share] download failed', e)
    message.error(t('share.downloadFail', { message: (e as Error).message }))
  }
  finally {
    generating.value = false
  }
}

async function copy() {
  try {
    generating.value = true
    const blob = await renderPng()
    if (!blob) {
      message.error(t('share.genFail'))
      return
    }
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard image write not supported')
    }
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    message.success(t('share.copyOk'))
  }
  catch (e) {
    console.error('[share] copy failed', e)
    message.error(t('share.copyFail', { message: (e as Error).message }))
  }
  finally {
    generating.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="doClose"
    style="width: 720px; max-width: 94vw;"
    :bordered="false"
    preset="card"
    :title="t('share.title')"
  >
    <div class="space-y-4">
      <NAlert type="warning" :show-icon="true" class="!rounded-xl">
        <template #icon><ShieldAlert :size="16" /></template>
        {{ t('share.privacyAlert') }}
      </NAlert>

      <label class="flex cursor-pointer items-center justify-between rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3">
        <span class="flex items-center gap-2 text-sm text-ink-700">
          <EyeOff :size="15" class="text-ink-400" />
          {{ t('share.hideIdentity') }}
        </span>
        <NSwitch v-model:value="hideIdentity" />
      </label>

      <!-- 预览：1200x630 缩放到 600 宽显示（截图仍按原始 1200x630 @2x） -->
      <div class="overflow-hidden rounded-xl border border-ink-200 bg-ink-100/60 p-3">
        <NSpin :show="generating">
          <div class="mx-auto" style="width: 600px; height: 315px; overflow: hidden;">
            <div style="transform: scale(0.5); transform-origin: top left; width: 1200px; height: 630px;">
              <ShareCard ref="cardRef" :data="shareData" />
            </div>
          </div>
        </NSpin>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <NText depth="3" class="mr-auto text-xs">{{ t('share.previewHint') }}</NText>
        <NButton class="!rounded-lg" @click="copy">
          <template #icon><Copy :size="15" /></template>
          {{ t('share.copyClipboard') }}
        </NButton>
        <NButton type="primary" class="!rounded-lg" :loading="generating" @click="download">
          <template #icon><Download :size="15" /></template>
          {{ t('share.downloadPng') }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>
