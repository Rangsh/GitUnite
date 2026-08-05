import type { Platform } from '@/api/types'
import { getAdapter } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

/**
 * 同步引擎：负责按平台顺序拉取仓库列表、提交明细与代码量统计，
 * 控制并发与限流，写入 IndexedDB 并通过 syncStore 暴露进度。
 *
 * 具体实现见 M2，此处仅为骨架。
 */
export async function syncPlatform(_platform: Platform): Promise<void> {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const token = auth.tokens[_platform]
  if (!token) throw new Error(`未连接 ${_platform} 账号`)

  // 适配器实例：M2 同步流程中使用，保留引用避免误删
  void getAdapter(_platform)
  const user = auth.users[_platform]
  if (!user) throw new Error('用户信息缺失，请重新连接账号')

  sync.setProgress({
    platform: _platform,
    phase: 'repos',
    total: 0,
    current: 0,
    message: '正在拉取仓库列表…',
  })

  // TODO(M2):
  // 1. 分页拉取 repos，写入 repoRepo
  // 2. 对每个 repo 拉取 commits（并发：github<=4, gitee<=2），读取 cursor 做 since 增量
  // 3. GitHub: 先 stats/contributors 拿到周聚合，再 listCommits
  // 4. Gitee: 若 ui.codeDetailEnabled=false，跳过详情请求，只记提交数
  // 5. 每完成一个 repo 更新 cursorRepo 与 sync 进度
  // 6. 遇 403/429 时读取 Retry-After / x-ratelimit-reset，等待后继续
  // 7. 错误写入 sync.progress，允许下次从 cursor 续传
}

export async function syncAll() {
  await Promise.allSettled([
    useAuthStore().tokens.github ? syncPlatform('github') : Promise.resolve(),
    useAuthStore().tokens.gitee ? syncPlatform('gitee') : Promise.resolve(),
  ])
}
