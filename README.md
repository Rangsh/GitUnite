# GitUnite

> 多平台代码仓库聚合分析工具 · 纯前端 · 本地运行 · 隐私优先

GitUnite 在你的浏览器本地聚合 **GitHub** 与 **Gitee** 的仓库与提交数据，从代码量、活跃度、语言分布、协作网络、PR/Issue、年度报告等多个维度生成可视化的"编码档案"。

- 🔒 **纯前端、无后端**：所有数据只存在浏览器 IndexedDB，Token 不出本机
- 🐙 **双平台聚合**：GitHub + Gitee 统一视图，支持单平台/聚合切换
- 📊 **多维度看板**：基础统计、热力图、语言趋势、协作网络图、年度年鉴
- 🏅 **成就徽章**：本地计算的趣味徽章（夜猫子、连续提交王、万行代码……）
- 💾 **数据导出**：JSON / CSV 原始数据，可生成分享 PNG 卡片

## 快速开始

```bash
pnpm install
pnpm dev
```

浏览器打开 http://localhost:5173 ，在「设置」页粘贴 GitHub / Gitee 的 Personal Access Token 即可。

### Token 权限

- **GitHub Fine-grained token**：Contents: Read-only、Metadata: Read-only；需要 PR/Issue 统计时再加 Pull Requests: Read、Issues: Read
- **Gitee 私人令牌**：projects、user_info、pull_requests、issues（均只读）

## 技术栈

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Naive UI + Tailwind CSS + ECharts + Dexie.js + axios

详见 [产品需求文档.md](./产品需求文档.md)。

## 开发进度

- [x] M1 基础骨架
- [ ] M2 仓库与提交同步
- [ ] M3 核心看板
- [ ] M4 协作网络 & 年度报告
- [ ] M5 PR/Issue & 导出分享
- [ ] M6 打磨开源

## License

MIT
