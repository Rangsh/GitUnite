import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { i18n } from '@/i18n'

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
        meta: { titleKey: 'nav.dashboard' },
      },
      {
        path: 'repos',
        name: 'repos',
        component: () => import('@/views/ReposView.vue'),
        meta: { titleKey: 'nav.repos' },
      },
      {
        path: 'timeline',
        name: 'timeline',
        component: () => import('@/views/TimelineView.vue'),
        meta: { titleKey: 'nav.timeline' },
      },
      {
        path: 'contributions',
        name: 'contributions',
        component: () => import('@/views/ContributionsView.vue'),
        meta: { titleKey: 'nav.contributions' },
      },
      {
        path: 'collaboration',
        name: 'collaboration',
        component: () => import('@/views/CollaborationView.vue'),
        meta: { titleKey: 'nav.collaboration' },
      },
      {
        path: 'yearbook',
        name: 'yearbook',
        component: () => import('@/views/YearbookView.vue'),
        meta: { titleKey: 'nav.yearbook' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { titleKey: 'nav.settings' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  const key = to.meta.titleKey as string | undefined
  const title = key ? String(i18n.global.t(key)) : 'GitUnite'
  document.title = `${title} · GitUnite`
})

export default router
