import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Platform, UnifiedRepo } from '@/api/types'
import { db } from '@/db/schema'

export type RepoFilter = 'all' | Platform
export type RepoSort = 'updated' | 'stars' | 'name' | 'commits'

async function aggregateCommitCounts(): Promise<Record<string, number>> {
  const map: Record<string, number> = {}
  await db.commits.each((c) => {
    map[c.repoId] = (map[c.repoId] ?? 0) + 1
  })
  return map
}

export const useReposStore = defineStore('repos', () => {
  const repos = ref<UnifiedRepo[]>([])
  const loading = ref(false)
  const filter = ref<RepoFilter>('all')
  const keyword = ref('')
  const language = ref<string | null>(null)
  const sort = ref<RepoSort>('updated')
  const contributedOnly = ref(false)
  const commitCounts = ref<Record<string, number>>({})

  const languages = computed(() => {
    const set = new Set<string>()
    for (const r of repos.value) {
      if (r.language) set.add(r.language)
    }
    return [...set].sort()
  })

  const filtered = computed(() => {
    let list = repos.value
    if (filter.value !== 'all') list = list.filter(r => r.platform === filter.value)
    if (contributedOnly.value) list = list.filter(r => r.isContributed)
    if (language.value) list = list.filter(r => r.language === language.value)
    const kw = keyword.value.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        r => r.name.toLowerCase().includes(kw) || r.fullName.toLowerCase().includes(kw)
          || (r.description?.toLowerCase().includes(kw) ?? false),
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sort.value) {
        case 'stars':
          return b.stargazersCount - a.stargazersCount
        case 'name':
          return a.fullName.localeCompare(b.fullName)
        case 'commits':
          return (commitCounts.value[b.id] ?? 0) - (commitCounts.value[a.id] ?? 0)
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })
    return sorted
  })

  async function load() {
    loading.value = true
    try {
      const [all, counts] = await Promise.all([
        db.repos.toArray(),
        aggregateCommitCounts(),
      ])
      repos.value = all
      commitCounts.value = counts
    }
    finally {
      loading.value = false
    }
  }

  async function refreshCommitCounts() {
    commitCounts.value = await aggregateCommitCounts()
  }

  return {
    repos,
    loading,
    filter,
    keyword,
    language,
    sort,
    contributedOnly,
    commitCounts,
    languages,
    filtered,
    load,
    refreshCommitCounts,
  }
})
