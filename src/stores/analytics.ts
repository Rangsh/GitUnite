import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UnifiedCommit, UnifiedRepo } from '@/api/types'
import { commitRepo, repoRepo, repoStatRepo } from '@/db/repositories'
import type { RepoWeeklyStat } from '@/db/schema'

/**
 * 分析看板的数据源：一次性把仓库、提交、周统计载入内存。
 * 50 仓库 / 5000 提交规模下，内存占用可接受；后续若需要可放 Web Worker。
 */
export const useAnalyticsStore = defineStore('analytics', () => {
  const repos = ref<UnifiedRepo[]>([])
  const commits = ref<UnifiedCommit[]>([])
  const repoStats = ref<RepoWeeklyStat[]>([])
  const loading = ref(false)
  const loadedAt = ref<number | null>(null)

  async function load(force = false) {
    if (loading.value) return
    if (loadedAt.value && !force) return
    loading.value = true
    try {
      const [r, c, s] = await Promise.all([
        repoRepo.all(),
        commitRepo.all(),
        repoStatRepo.all(),
      ])
      repos.value = r
      commits.value = c
      repoStats.value = s
      loadedAt.value = Date.now()
    }
    finally {
      loading.value = false
    }
  }

  /** 同步完成后调用，强制重新载入。 */
  async function refresh() {
    await load(true)
  }

  function reset() {
    repos.value = []
    commits.value = []
    repoStats.value = []
    loadedAt.value = null
  }

  return {
    repos,
    commits,
    repoStats,
    loading,
    loadedAt,
    load,
    refresh,
    reset,
  }
})
