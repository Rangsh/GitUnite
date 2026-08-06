/**
 * commit message 词云：纯本地分词与词频统计，不做中文分词（避免引入大体积词典），
 * 中文按 2–4 字 n-gram 粗切，英文按单词切分。
 */

// PRD 点名的停用词 + 常见无信息量词
const STOPWORDS = new Set([
  // PRD 指定
  'merge', 'fix', 'update',
  // git / 通用动词
  'add', 'added', 'adding', 'remove', 'removed', 'removing', 'delete', 'deleted',
  'change', 'changed', 'changes', 'modify', 'modified', 'refactor', 'refactored',
  'wip', 'init', 'initial', 'commit', 'commits', 'committed', 'push', 'pull',
  'issue', 'issues', 'bug', 'bugs', 'feature', 'features', 'test', 'tests',
  'docs', 'doc', 'readme', 'chore', 'build', 'ci', 'release', 'version', 'bump',
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'at', 'with',
  'from', 'by', 'is', 'are', 'was', 'were', 'be', 'as', 'that', 'this', 'it',
  'into', 'not', 'no', 'so', 'if', 'then', 'than', 'but', 'up', 'down',
  // 中文常见无意义词
  '修复', '更新', '提交', '修改', '新增', '删除', '调整', '优化', '完善',
  '合并', '测试', '发布', '版本', '代码', '文件', '问题', '功能', '支持',
])

export interface WordWeight {
  name: string
  value: number
}

/**
 * 从一批 commit message 中提取词频。
 * @param messages 提交信息
 * @param topN 返回前 N 个词
 */
export function buildWordCloud(messages: string[], topN = 60): WordWeight[] {
  const freq = new Map<string, number>()

  for (const raw of messages) {
    if (!raw) continue
    // 只取首行（标题），正文通常是噪音
    const line = raw.split('\n', 1)[0].toLowerCase()
    if (!line) continue

    // 1) 拉丁单词（含连字符/数字），长度 >= 2
    const latin = line.match(/[a-z][a-z0-9._-]{1,}/g) ?? []
    for (const w of latin) {
      if (STOPWORDS.has(w)) continue
      if (/^\d+$/.test(w)) continue
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }

    // 2) 中文连续片段：做 2 字 bigram，兼顾辨识度与不引入分词库
    const cjkRuns = line.match(/[一-龥]+/g) ?? []
    for (const run of cjkRuns) {
      if (run.length < 2) continue
      for (let i = 0; i < run.length - 1; i++) {
        const gram = run.slice(i, i + 2)
        if (STOPWORDS.has(gram)) continue
        freq.set(gram, (freq.get(gram) ?? 0) + 1)
      }
    }
  }

  return [...freq.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter(w => w.value >= 2) // 至少出现 2 次，避免一次性词铺满
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
}
