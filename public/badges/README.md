# 成就徽章图片资源

把徽章图放在本目录，文件名必须与徽章 id 一一对应（见下表）。
未放入图片时，界面会自动回退为对应的 lucide 图标占位，不会报错。

建议规格：
- 格式：WebP（体积远小于 PNG）
- 尺寸：最长边 256px（界面按 64px 展示，适配 2x 屏）
- 透明背景；未达成状态会自动灰度，只需提供「点亮态」图

| 文件名 | 徽章 | 获得条件 |
| --- | --- | --- |
| `night-owl.webp` | 夜猫子 | 本地时间 0–6 点提交 ≥ 100 次 |
| `early-bird.webp` | 早起鸟 | 本地时间 5–8 点提交 ≥ 100 次 |
| `fullstack-explorer.webp` | 全栈探索者 | 累计使用 ≥ 5 种语言 |
| `language-master.webp` | 语言大师 | 累计使用 ≥ 10 种语言 |
| `oss-contributor.webp` | 开源贡献者 | 向 ≥ 3 个非自有仓库贡献过提交 |
| `power-coder.webp` | 码力全开 | 单日提交 ≥ 20 次 |
| `streak-king.webp` | 连续提交王 | 连续 30 天有提交 |
| `hundred-day.webp` | 百日坚持 | 连续 100 天有提交 |
| `thousand-commits.webp` | 千提交 | 累计提交 ≥ 1000 次 |
| `tenk-lines.webp` | 万行代码 | 累计新增 ≥ 10000 行 |
