<script setup lang="ts">
import { ref } from 'vue'
import { NCard, NSpace, NButton, NInput, NTag, NAlert } from 'naive-ui'
import { Github, Gitee } from '@/components/common/PlatformIcon'

const githubToken = ref('')
const giteeToken = ref('')
const githubStatus = ref<'idle' | 'valid' | 'invalid'>('idle')
const giteeStatus = ref<'idle' | 'valid' | 'invalid'>('idle')

// TODO(M1): 调用 auth store 的 validateAndSave，实际校验 /user 接口
function connectGithub() {
  if (!githubToken.value) return
  githubStatus.value = 'valid'
}
function connectGitee() {
  if (!giteeToken.value) return
  giteeStatus.value = 'valid'
}
</script>

<template>
  <NCard title="账户接入" size="small">
    <NAlert type="info" :show-icon="false" class="mb-4">
      令牌仅保存在浏览器本地存储，不会上传到任何服务器。生成令牌时请只勾选只读权限。
    </NAlert>
    <NSpace vertical size="large">
      <div>
        <div class="mb-2 flex items-center gap-2">
          <Github :size="20" />
          <span class="font-medium">GitHub</span>
          <NTag v-if="githubStatus === 'valid'" type="success" size="small">已连接</NTag>
          <NTag v-else-if="githubStatus === 'invalid'" type="error" size="small">令牌无效</NTag>
        </div>
        <NSpace>
          <NInput
            v-model:value="githubToken"
            type="password"
            show-password-on="click"
            placeholder="ghp_xxxxxxxx 或 github_pat_xxxxxxxx"
            class="flex-1"
          />
          <NButton type="primary" @click="connectGithub">连接</NButton>
        </NSpace>
      </div>
      <div>
        <div class="mb-2 flex items-center gap-2">
          <Gitee :size="20" />
          <span class="font-medium">Gitee</span>
          <NTag v-if="giteeStatus === 'valid'" type="success" size="small">已连接</NTag>
          <NTag v-else-if="giteeStatus === 'invalid'" type="error" size="small">令牌无效</NTag>
        </div>
        <NSpace>
          <NInput
            v-model:value="giteeToken"
            type="password"
            show-password-on="click"
            placeholder="Gitee 私人令牌"
            class="flex-1"
          />
          <NButton type="primary" @click="connectGitee">连接</NButton>
        </NSpace>
      </div>
    </NSpace>
  </NCard>
</template>
