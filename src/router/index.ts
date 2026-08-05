import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '数据看板' },
      },
      {
        path: 'repos',
        name: 'repos',
        component: () => import('@/views/ReposView.vue'),
        meta: { title: '仓库列表' },
      },
      {
        path: 'timeline',
        name: 'timeline',
        component: () => import('@/views/TimelineView.vue'),
        meta: { title: '提交时间轴' },
      },
      {
        path: 'collaboration',
        name: 'collaboration',
        component: () => import('@/views/CollaborationView.vue'),
        meta: { title: '协作网络' },
      },
      {
        path: 'yearbook',
        name: 'yearbook',
        component: () => import('@/views/YearbookView.vue'),
        meta: { title: '年度报告' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置' },
      },
    ],
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
