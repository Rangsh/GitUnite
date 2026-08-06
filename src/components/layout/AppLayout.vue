<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  NConfigProvider, NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NIcon, NText, NTag, darkTheme, type GlobalThemeOverrides,
} from 'naive-ui'
import {
  Award,
  CalendarDays,
  FolderGit2,
  GitBranch,
  GitPullRequestCreateArrow,
  LayoutDashboard,
  Network,
  Settings,
} from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()
const sync = useSyncStore()
const { isDark } = storeToRefs(ui)
const { running, activeProgress, lastSyncedAt } = storeToRefs(sync)

function iconOf(Icon: Component) {
  return () => h(NIcon, null, { default: () => h(Icon) })
}

const menuOptions = computed(() => [
  { label: t('nav.dashboard'), key: '/dashboard', icon: iconOf(LayoutDashboard) },
  { label: t('nav.repos'), key: '/repos', icon: iconOf(FolderGit2) },
  { label: t('nav.timeline'), key: '/timeline', icon: iconOf(CalendarDays) },
  { label: t('nav.contributions'), key: '/contributions', icon: iconOf(GitPullRequestCreateArrow) },
  { label: t('nav.collaboration'), key: '/collaboration', icon: iconOf(Network) },
  { label: t('nav.yearbook'), key: '/yearbook', icon: iconOf(Award) },
  { label: t('nav.settings'), key: '/settings', icon: iconOf(Settings) },
])

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  if (isDark.value) {
    return {
      common: {
        primaryColor: '#14b8a6',
        primaryColorHover: '#2dd4bf',
        primaryColorPressed: '#0d9488',
        primaryColorSuppl: '#14b8a6',
        borderRadius: '10px',
        fontFamily: '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
      },
      Menu: {
        itemTextColor: '#94a3b8',
        itemTextColorHover: '#f1f5f9',
        itemTextColorActive: '#f8fafc',
        itemTextColorActiveHover: '#f8fafc',
        itemIconColor: '#64748b',
        itemIconColorHover: '#2dd4bf',
        itemIconColorActive: '#2dd4bf',
        itemIconColorActiveHover: '#2dd4bf',
        itemColorActive: 'rgba(20, 184, 166, 0.16)',
        itemColorActiveHover: 'rgba(20, 184, 166, 0.22)',
        itemColorHover: 'rgba(148, 163, 184, 0.08)',
        borderRadius: '10px',
      },
      Layout: {
        siderColor: '#0f172a',
        headerColor: 'rgba(15,23,42,0.85)',
      },
    }
  }
  return {
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
  }
})

const pageTitle = computed(() => {
  const key = route.meta.titleKey as string | undefined
  return key ? t(key) : 'GitUnite'
})

const connectionChips = computed(() => {
  const chips: { label: string, ok: boolean }[] = []
  if (auth.isConnected('github')) chips.push({ label: t('common.github'), ok: true })
  if (auth.isConnected('gitee')) chips.push({ label: t('common.gitee'), ok: true })
  if (!chips.length) chips.push({ label: t('layout.notConnectedChip'), ok: false })
  return chips
})

const syncHint = computed(() => {
  void locale.value
  if (running.value && activeProgress.value) return activeProgress.value.message
  if (lastSyncedAt.value) {
    try {
      return t('layout.lastSynced', {
        time: new Date(lastSyncedAt.value).toLocaleString(
          locale.value === 'zh-CN' ? 'zh-CN' : 'en-US',
        ),
      })
    }
    catch {
      return t('common.syncing')
    }
  }
  return auth.anyConnected ? t('layout.neverSynced') : t('layout.connectFirst')
})

function handleMenuSelect(key: string) {
  if (route.path === key) return
  void router.push(key)
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <NLayout class="h-full" has-sider>
      <NLayoutSider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="232"
        show-trigger="bar"
        :native-scrollbar="false"
        :content-style="isDark
          ? 'display: flex; flex-direction: column; background: #0f172a;'
          : 'display: flex; flex-direction: column; background: #fff;'"
      >
        <div class="flex items-center gap-2.5 px-5 py-5 shrink-0">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            :class="isDark ? 'bg-brand-600' : 'bg-ink-900'"
          >
            <GitBranch :size="18" />
          </div>
          <div class="leading-tight">
            <NText strong class="text-[15px] tracking-tight">GitUnite</NText>
            <div class="text-[10px] font-medium uppercase tracking-wider text-ink-400">
              {{ t('layout.tagline') }}
            </div>
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
          class="flex items-center justify-between gap-4 px-6 backdrop-blur-md shrink-0"
          :style="isDark
            ? 'height: 56px; background: rgba(15,23,42,0.82); border-color: #1e293b;'
            : 'height: 56px; background: rgba(255,255,255,0.72); border-color: #e2e8f0;'"
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{{ pageTitle }}</div>
            <div class="truncate text-[11px] text-ink-400">{{ syncHint }}</div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <NTag
              v-for="c in connectionChips"
              :key="c.label"
              size="small"
              :type="c.ok ? 'success' : 'default'"
              :bordered="false"
              class="!rounded-lg"
            >
              {{ c.label }}
            </NTag>
            <NTag
              v-if="running"
              size="small"
              type="info"
              :bordered="false"
              class="!rounded-lg"
            >
              {{ t('layout.syncing') }}
            </NTag>
          </div>
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
