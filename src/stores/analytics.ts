import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef } from 'vue'
import type { UnifiedCommit, UnifiedIssue, UnifiedRepo } from '@/api/types'
import { normalizeCommitDate } from '@/api/primaryLanguage'
import { commitRepo, issueRepo, repoRepo, repoStatRepo } from '@/db/repositories'
import type { RepoWeeklyStat } from '@/db/schema'

/**
 * 分析看板的数据源：一次性把仓库、提交、PR/Issue、周统计载入内存。
 * 大数组必须用 shallowRef + markRaw，避免深度代理卡死主线程。
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  const repos = shallowRef<UnifiedRepo[]>([])
  const commits = shallowRef<UnifiedCommit[]>([])
  const issues = shallowRef<UnifiedIssue[]>([])
  const repoStats = shallowRef<RepoWeeklyStat[]>([])
  const loading = ref(false)
  const loadedAt = ref<number | null>(null)

  let inflight: Promise<void> | null = null
  let queuedForce = false

  async function load(force = false) {
    if (!force && loadedAt.value && !inflight) return

    if (inflight) {
      if (force) queuedForce = true
      await inflight
      if (queuedForce) {
        queuedForce = false
        await load(true)
      }
      return
    }

    // 有缓存时静默更新，避免进页/切换路由时全屏转圈像“自动刷新”
    const initial = !loadedAt.value
    if (initial) loading.value = true

    inflight = doFetch()
    try {
      await inflight
    }
    finally {
      inflight = null
    }

    if (queuedForce) {
      queuedForce = false
      await load(true)
    }
  }

  async function doFetch() {
    try {
      const [r, c, i, s] = await Promise.all([
        repoRepo.all(),
        commitRepo.all(),
        issueRepo.all(),
        repoStatRepo.all(),
      ])
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      repos.value = markRaw(r)
      // 纠正历史脏数据：非 ISO 日期会导致活跃度全部算空
      commits.value = markRaw(c.map(commit => ({
        ...commit,
        authoredAt: normalizeCommitDate(commit.authoredAt) || commit.authoredAt,
      })))
      issues.value = markRaw(i)
      repoStats.value = markRaw(s)
      loadedAt.value = Date.now()
    }
    finally {
      loading.value = false
    }
  }

  async function refresh() {
    await load(true)
  }

  function reset() {
    repos.value = []
    commits.value = []
    issues.value = []
    repoStats.value = []
    loadedAt.value = null
  }

  return {
    repos,
    commits,
    issues,
    repoStats,
    loading,
    loadedAt,
    load,
    refresh,
    reset,
  }
})
