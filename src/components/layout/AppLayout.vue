<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NIcon, NText, type GlobalThemeOverrides,
} from 'naive-ui'
import {
  Award,
  CalendarDays,
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  Network,
  Settings,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

function iconOf(Icon: Component) {
  return () => h(NIcon, null, { default: () => h(Icon) })
}

const menuOptions = [
  { label: '数据看板', key: '/dashboard', icon: iconOf(LayoutDashboard) },
  { label: '仓库列表', key: '/repos', icon: iconOf(FolderGit2) },
  { label: '提交时间轴', key: '/timeline', icon: iconOf(CalendarDays) },
  { label: '协作网络', key: '/collaboration', icon: iconOf(Network) },
  { label: '年度报告', key: '/yearbook', icon: iconOf(Award) },
  { label: '设置', key: '/settings', icon: iconOf(Settings) },
]

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    primaryColor: '#0d9488',
    primaryColorHover: '#0f766e',
    primaryColorPressed: '#115e59',
    primaryColorSuppl: '#14b8a6',
    borderRadius: '10px',
    fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  Menu: {
    itemTextColor: '#64748b',
    itemTextColorHover: '#0f172a',
    itemTextColorActive: '#0f172a',
    itemTextColorActiveHover: '#0f172a',
    itemIconColor: '#94a3b8',
    itemIconColorHover: '#0d9488',
    itemIconColorActive: '#0d9488',
    itemIconColorActiveHover: '#0d9488',
    itemColorActive: 'rgba(13, 148, 136, 0.1)',
    itemColorActiveHover: 'rgba(13, 148, 136, 0.14)',
    itemColorHover: 'rgba(15, 23, 42, 0.04)',
    borderRadius: '10px',
  },
  Layout: {
    siderColor: '#ffffff',
    headerColor: 'rgba(255,255,255,0.8)',
  },
}))

function handleMenuSelect(key: string) {
  if (route.path === key) return
  void router.push(key)
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NLayout class="h-full" has-sider>
      <NLayoutSider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="232"
        show-trigger="bar"
        :native-scrollbar="false"
        content-style="display: flex; flex-direction: column; background: #fff;"
      >
        <div class="flex items-center gap-2.5 px-5 py-5 shrink-0">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
            <GitBranch :size="18" />
          </div>
          <div class="leading-tight">
            <NText strong class="text-[15px] tracking-tight">GitUnite</NText>
            <div class="text-[10px] font-medium uppercase tracking-wider text-ink-400">Local Archive</div>
          </div>
        </div>
        <NMenu
          :value="route.path"
          :options="menuOptions"
          :collapsed-width="64"
          :collapsed-icon-size="20"
          class="px-2"
          @update:value="handleMenuSelect"
        />
      </NLayoutSider>
      <NLayout class="h-full !bg-transparent">
        <NLayoutHeader
          bordered
          class="flex items-center px-6 backdrop-blur-md shrink-0"
          style="height: 56px; background: rgba(255,255,255,0.72); border-color: #e2e8f0;"
        >
          <NText class="!text-ink-500 text-sm">多平台代码仓库聚合分析 · 本地运行</NText>
        </NLayoutHeader>
        <NLayoutContent
          class="h-full"
          content-style="padding: 24px; min-height: calc(100vh - 56px); background: transparent;"
          :native-scrollbar="false"
        >
          <RouterView />
        </NLayoutContent>
      </NLayout>
    </NLayout>
  </NConfigProvider>
</template>
