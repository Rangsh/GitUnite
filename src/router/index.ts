import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '数据看板', icon: 'LayoutDashboard' },
  },
  {
    path: '/repos',
    name: 'repos',
    component: () => import('@/views/ReposView.vue'),
    meta: { title: '仓库列表', icon: 'FolderGit2' },
  },
  {
    path: '/timeline',
    name: 'timeline',
    component: () => import('@/views/TimelineView.vue'),
    meta: { title: '提交时间轴', icon: 'CalendarDays' },
  },
  {
    path: '/collaboration',
    name: 'collaboration',
    component: () => import('@/views/CollaborationView.vue'),
    meta: { title: '协作网络', icon: 'Network' },
  },
  {
    path: '/yearbook',
    name: 'yearbook',
    component: () => import('@/views/YearbookView.vue'),
    meta: { title: '年度报告', icon: 'Award' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置', icon: 'Settings' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'GitUnite'} · GitUnite`
})

export default router
