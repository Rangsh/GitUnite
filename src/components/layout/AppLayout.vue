<script setup lang="ts">
import { h, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu, NIcon, NText } from 'naive-ui'
import * as icons from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

interface MenuItem {
  label: string
  key: string
  icon: string
}
const menuOptions: MenuItem[] = [
  { label: '数据看板', key: '/dashboard', icon: 'LayoutDashboard' },
  { label: '仓库列表', key: '/repos', icon: 'FolderGit2' },
  { label: '提交时间轴', key: '/timeline', icon: 'CalendarDays' },
  { label: '协作网络', key: '/collaboration', icon: 'Network' },
  { label: '年度报告', key: '/yearbook', icon: 'Award' },
  { label: '设置', key: '/settings', icon: 'Settings' },
]

function renderIcon(name: string) {
  return () => h(NIcon, null, { default: () => h(icons[name as keyof typeof icons] as Component) })
}

function handleMenuSelect(key: string) {
  router.push(key)
}
</script>

<template>
  <NLayout class="h-full" has-sider>
    <NLayoutSider bordered collapse-mode="width" :collapsed-width="64" :width="220" show-trigger="bar">
      <div class="flex items-center gap-2 px-4 py-5">
        <component :is="icons.GitBranch" :size="24" class="text-brand-600" />
        <NText strong class="text-lg">GitUnite</NText>
      </div>
      <NMenu
        :value="route.path"
        :options="menuOptions.map((o) => ({ ...o, icon: renderIcon(o.icon) }))"
        @update:value="handleMenuSelect"
      />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered class="flex items-center px-6" style="height: 56px">
        <NText depth="2">多平台代码仓库聚合分析 · 本地运行</NText>
      </NLayoutHeader>
      <NLayoutContent class="p-6" content-style="background: transparent">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
