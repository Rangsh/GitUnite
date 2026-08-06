<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  NSpace, NButton, NInput, NTag, NAlert, NAvatar, NPopconfirm,
} from 'naive-ui'
import { useMessage } from 'naive-ui'
import { Github, Gitee } from '@/components/common/PlatformIcon'
import { useAuthStore } from '@/stores/auth'
import { rateLimitState } from '@/api/rateLimit'
import type { Platform } from '@/api/types'

const { t } = useI18n()
const message = useMessage()
const auth = useAuthStore()
const { connecting } = storeToRefs(auth)

const tokenInputs = ref<Record<Platform, string>>({ github: '', gitee: '' })
const errorMsgs = ref<Record<Platform, string>>({ github: '', gitee: '' })

const platforms = computed(() => [
  {
    key: 'github' as const,
    label: t('common.github'),
    placeholder: t('account.placeholderGithub'),
    link: 'https://github.com/settings/tokens',
  },
  {
    key: 'gitee' as const,
    label: t('common.gitee'),
    placeholder: t('account.placeholderGitee'),
    link: 'https://gitee.com/profile/personal_access_tokens',
  },
])

function platformName(platform: Platform) {
  return platform === 'github' ? t('common.github') : t('common.gitee')
}

function user(platform: Platform) {
  return auth.user(platform)
}
function isConnected(platform: Platform) {
  return auth.isConnected(platform)
}

async function connect(platform: Platform) {
  const token = tokenInputs.value[platform].trim()
  if (!token) {
    message.warning(t('account.enterToken'))
    return
  }
  errorMsgs.value[platform] = ''
  try {
    await auth.connect(platform, token)
    tokenInputs.value[platform] = ''
    message.success(t('account.connectOk', { name: platformName(platform) }))
  }
  catch (err: any) {
    const status = err?.response?.status
    const detail = status === 401 ? t('account.tokenInvalid') : (err?.message || t('account.tokenInvalid'))
    errorMsgs.value[platform] = detail
    message.error(t('account.connectFail', { name: platformName(platform), detail }))
  }
}

async function disconnect(platform: Platform) {
  await auth.disconnect(platform)
  message.info(t('account.disconnectOk', { name: platformName(platform) }))
}

// 直接从 HTTP 拦截器维护的响应式状态读取。
// GitHub 另有 /rate_limit 主动刷新；Gitee 无独立接口，依赖响应头被动填充。
const quotaText = computed(() => (platform: Platform) => {
  const rl = rateLimitState[platform]
  if (!rl || !Number.isFinite(rl.limit) || rl.limit <= 0) {
    return t('account.quotaLoading')
  }
  return t('account.quota', { remaining: rl.remaining, limit: rl.limit })
})
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel">
    <div class="border-b border-ink-100 px-5 py-4">
      <h2 class="m-0 text-base font-semibold text-ink-900">{{ t('account.title') }}</h2>
      <p class="mt-1 text-xs text-ink-400">
        {{ t('account.subtitle') }}
      </p>
    </div>
    <div class="space-y-5 px-5 py-4">
      <NAlert type="info" :show-icon="false" class="!rounded-xl">
        {{ t('account.alertReadonly') }}
      </NAlert>
      <div
        v-for="p in platforms"
        :key="p.key"
        class="rounded-xl border border-ink-100 bg-ink-50/50 p-4"
      >
        <div class="mb-3 flex items-center gap-2">
          <component :is="p.key === 'github' ? Github : Gitee" :size="20" />
          <span class="font-medium text-ink-900">{{ p.label }}</span>
          <NTag v-if="isConnected(p.key)" type="success" size="small" :bordered="false" class="!rounded-lg">{{ t('common.connected') }}</NTag>
          <NTag v-else type="default" size="small" :bordered="false" class="!rounded-lg">{{ t('common.notConnected') }}</NTag>
          <span v-if="isConnected(p.key)" class="ml-auto text-xs text-ink-400">{{ quotaText(p.key) }}</span>
        </div>

        <div v-if="isConnected(p.key)" class="flex flex-wrap items-center gap-3">
          <NAvatar round :size="40" :src="user(p.key)?.avatarUrl" />
          <div class="min-w-0 flex-1">
            <div class="font-medium text-ink-900">{{ user(p.key)?.name || user(p.key)?.login }}</div>
            <a :href="user(p.key)?.htmlUrl" target="_blank" class="text-xs text-ink-400 hover:underline">
              @{{ user(p.key)?.login }}
            </a>
          </div>
          <NButton tag="a" :href="p.link" target="_blank" quaternary size="small">{{ t('account.reconnectToken') }}</NButton>
          <NPopconfirm @positive-click="disconnect(p.key)">
            <template #trigger>
              <NButton type="error" ghost size="small">{{ t('account.disconnect') }}</NButton>
            </template>
            {{ t('account.disconnectConfirm') }}
          </NPopconfirm>
        </div>

        <NSpace v-else>
          <NInput
            v-model:value="tokenInputs[p.key]"
            type="password"
            show-password-on="click"
            :placeholder="p.placeholder"
            class="flex-1"
            :status="errorMsgs[p.key] ? 'error' : undefined"
            @keyup.enter="connect(p.key)"
          />
          <NButton type="primary" :loading="connecting[p.key]" @click="connect(p.key)">{{ t('account.connect') }}</NButton>
          <NButton tag="a" :href="p.link" target="_blank" quaternary>{{ t('account.getToken') }}</NButton>
        </NSpace>
        <div v-if="errorMsgs[p.key]" class="mt-1 text-xs text-red-500">{{ errorMsgs[p.key] }}</div>
      </div>
    </div>
  </section>
</template>
