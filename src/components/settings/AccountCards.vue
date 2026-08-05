<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  NCard, NSpace, NButton, NInput, NTag, NAlert, NAvatar, NPopconfirm,
} from 'naive-ui'
import { useMessage } from 'naive-ui'
import { Github, Gitee } from '@/components/common/PlatformIcon'
import { useAuthStore } from '@/stores/auth'
import type { Platform } from '@/api/types'

const message = useMessage()
const auth = useAuthStore()
const { connecting } = storeToRefs(auth)

const tokenInputs = ref<Record<Platform, string>>({ github: '', gitee: '' })
const errorMsgs = ref<Record<Platform, string>>({ github: '', gitee: '' })

const platforms: Array<{ key: Platform, label: string, placeholder: string, link: string }> = [
  {
    key: 'github',
    label: 'GitHub',
    placeholder: 'ghp_xxxxxxxx 或 github_pat_xxxxxxxx',
    link: 'https://github.com/settings/tokens',
  },
  {
    key: 'gitee',
    label: 'Gitee',
    placeholder: 'Gitee 私人令牌',
    link: 'https://gitee.com/profile/personal_access_tokens',
  },
]

function user(platform: Platform) {
  return auth.user(platform)
}
function rateLimit(platform: Platform) {
  return auth.rateLimit(platform)
}
function isConnected(platform: Platform) {
  return auth.isConnected(platform)
}

async function connect(platform: Platform) {
  const token = tokenInputs.value[platform].trim()
  if (!token) {
    message.warning('请输入令牌')
    return
  }
  errorMsgs.value[platform] = ''
  try {
    await auth.connect(platform, token)
    tokenInputs.value[platform] = ''
    message.success(`${platform === 'github' ? 'GitHub' : 'Gitee'} 连接成功`)
  }
  catch (err: any) {
    const status = err?.response?.status
    const detail = status === 401 ? '令牌无效或已过期' : err?.message ?? '连接失败'
    errorMsgs.value[platform] = detail
    message.error(`${platform === 'github' ? 'GitHub' : 'Gitee'} 连接失败：${detail}`)
  }
}

async function disconnect(platform: Platform) {
  await auth.disconnect(platform)
  message.info(`${platform === 'github' ? 'GitHub' : 'Gitee'} 已断开`)
}

const quotaText = computed(() => (platform: Platform) => {
  const rl = rateLimit(platform)
  if (!rl || !rl.limit) return '配额: 获取中…'
  return `配额: ${rl.remaining}/${rl.limit}`
})
</script>

<template>
  <NCard title="账户接入" size="small">
    <NAlert type="info" :show-icon="false" class="mb-4">
      令牌仅保存在浏览器本地存储，不会上传到任何服务器。生成令牌时请只勾选只读权限。
    </NAlert>
    <NSpace vertical size="large">
      <div v-for="p in platforms" :key="p.key">
        <div class="mb-2 flex items-center gap-2">
          <component :is="p.key === 'github' ? Github : Gitee" :size="20" />
          <span class="font-medium">{{ p.label }}</span>
          <NTag v-if="isConnected(p.key)" type="success" size="small">已连接</NTag>
          <NTag v-else type="default" size="small">未连接</NTag>
          <span v-if="isConnected(p.key)" class="ml-auto text-xs text-gray-400">{{ quotaText(p.key) }}</span>
        </div>

        <!-- 已连接：显示用户信息 -->
        <div v-if="isConnected(p.key)" class="flex items-center gap-3">
          <NAvatar round :size="40" :src="user(p.key)?.avatarUrl" />
          <div class="flex-1">
            <div class="font-medium">{{ user(p.key)?.name || user(p.key)?.login }}</div>
            <a :href="user(p.key)?.htmlUrl" target="_blank" class="text-xs text-gray-400 hover:underline">
              @{{ user(p.key)?.login }}
            </a>
          </div>
          <NButton tag="a" :href="p.link" target="_blank" quaternary size="small">重新生成令牌</NButton>
          <NPopconfirm @positive-click="disconnect(p.key)">
            <template #trigger>
              <NButton type="error" ghost size="small">断开</NButton>
            </template>
            将同时清除该平台的全部本地缓存，确定？
          </NPopconfirm>
        </div>

        <!-- 未连接：输入令牌 -->
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
          <NButton type="primary" :loading="connecting[p.key]" @click="connect(p.key)">连接</NButton>
          <NButton tag="a" :href="p.link" target="_blank" quaternary>获取令牌</NButton>
        </NSpace>
        <div v-if="errorMsgs[p.key]" class="mt-1 text-xs text-red-400">{{ errorMsgs[p.key] }}</div>
      </div>
    </NSpace>
  </NCard>
</template>
