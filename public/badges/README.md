# 成就徽章图片资源

文件名必须与徽章 id 一一对应。未放入图片时界面回退为 lucide 图标。

建议规格：
- 格式：透明背景 WebP
- 画布：192×192，主体居中（像真正的徽章，无灰底横幅）
- 界面按约 80px 展示（适配 2x）

| 文件名 | 徽章 |
| --- | --- |
| `night-owl.webp` | 夜猫子 |
| `early-bird.webp` | 早起鸟 |
| `fullstack-explorer.webp` | 全栈探索者 |
| `language-master.webp` | 语言大师 |
| `oss-contributor.webp` | 开源贡献者 |
| `power-coder.webp` | 码力全开 |
| `streak-king.webp` | 连续提交王 |
| `hundred-day.webp` | 百日坚持 |
| `thousand-commits.webp` | 千提交 |
| `tenk-lines.webp` | 万行代码 |

处理脚本：`scripts/process_badges.py`（去灰底、裁剪主体、压成 192 WebP）
