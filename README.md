# GitUnite

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> 本地优先的 GitHub / Gitee 个人编码档案 — 无后端、不上传数据。

GitUnite 在浏览器里运行：粘贴 Personal Access Token，把仓库与提交同步到 IndexedDB，即可查看看板、热力图、PR/Issue、年度报告，并导出数据或生成分享卡片。

## 特性

- **隐私优先** — Token 与分析数据只存在本机（`localStorage` + IndexedDB）
- **双平台聚合** — GitHub + Gitee，支持单平台 / 聚合视角
- **多维看板** — 提交、代码量、活跃时段、语言分布、贡献热力图
- **提交时间轴** — 按日浏览，支持搜索与 Merge 过滤
- **PR / Issue** — 创建 / 合并 / 关闭统计与贡献仓库 Top 10
- **年度报告与徽章** — 年鉴故事、词云、本地成就徽章
- **导出与分享** — JSON / CSV（UTF-8 BOM）、1200×630 PNG 分享卡
- **国际化与主题** — 简体中文 / English；浅色 / 深色 / 跟随系统

## 快速开始

```bash
# 需要 Node.js 18+ 与 pnpm
pnpm install
pnpm dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)，进入「设置」粘贴 Token 即可。

### 构建

```bash
pnpm build
pnpm preview
```

### Token 权限（只读）

| 平台 | 最低权限 | 需要 PR / Issue 时追加 |
| --- | --- | --- |
| **GitHub** Fine-grained | Contents、Metadata | Pull requests、Issues |
| **Gitee** 私人令牌 | `projects`、`user_info` | `pull_requests`、`issues` |

> 请勿在不可信设备或装有不可信扩展的浏览器中粘贴 Token。

## 技术栈

Vue 3 · TypeScript · Vite · Pinia · Vue Router · vue-i18n · Naive UI · Tailwind CSS · ECharts · Dexie · axios · dayjs · Papa Parse · html-to-image

产品范围见 [产品需求文档.md](./产品需求文档.md)。

## 参与贡献

请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。欢迎 Issue 与 Pull Request。

- GitHub：https://github.com/Rangsh/GitUnite
- Gitee：https://gitee.com/tiantiankun/git-unite

## 开源协议

[MIT](./LICENSE) © 2026 Rangsh

---

## English

GitUnite is a **local-first** GitHub & Gitee coding archive that runs entirely in your browser — no backend, no data upload. See features and setup above; contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md).
