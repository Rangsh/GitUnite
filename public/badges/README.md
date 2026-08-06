# 成就徽章图片资源

文件名必须与徽章 id 一一对应。未放入图片时界面回退为 lucide 图标。

建议规格：
- 格式：**透明背景** WebP / PNG（alpha 通道，四角必须全透明）
- 形态：圆形或异形**实体奖章**剪影，像挂在衣服上的徽章——**不要**灰底、白底、棋盘格、圆角矩形底板
- 画布：192×192，主体居中，四周留透明边
- 界面用 `object-contain` + `drop-shadow` 展示，不给徽章再套色块底托

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

处理：素材需自带透明底；放入对应 `*.webp` 后即可使用。
