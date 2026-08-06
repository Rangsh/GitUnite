# GitUnite

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> Local-first coding archive for **GitHub** & **Gitee** — no backend, no data upload.

GitUnite runs entirely in your browser. Paste a Personal Access Token, sync repos and commits into IndexedDB, then explore dashboards, heatmaps, PR/Issue stats, yearbook stories, and shareable PNG cards.

**中文说明见下方；English first for GitHub discoverability.**

## Features

- **Privacy first** — Tokens and analytics stay in the browser (`localStorage` + IndexedDB)
- **Dual platforms** — GitHub + Gitee with per-platform or combined views
- **Dashboards** — Commits, lines of code, activity hours, language mix, contribution heatmap
- **Timeline** — Day-level commit browsing with search and merge filters
- **PR / Issue** — Created / merged / closed stats and top contribution repos
- **Yearbook & badges** — Annual story, word cloud, local achievement badges
- **Export & share** — JSON / CSV (UTF-8 BOM) and 1200×630 PNG share cards
- **i18n & theme** — 简体中文 / English; light / dark / system theme

## Quick start

```bash
# Requires Node.js 18+ and pnpm
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173), go to **Settings**, and paste your tokens.

### Build

```bash
pnpm build
pnpm preview
```

### Token scopes (read-only)

| Platform | Minimum | For PR / Issue |
| --- | --- | --- |
| **GitHub** Fine-grained | Contents, Metadata | Pull requests, Issues |
| **Gitee** personal token | `projects`, `user_info` | `pull_requests`, `issues` |

> Never paste tokens on untrusted devices or browsers with untrusted extensions.

## Tech stack

Vue 3 · TypeScript · Vite · Pinia · Vue Router · vue-i18n · Naive UI · Tailwind CSS · ECharts · Dexie · axios · dayjs · Papa Parse · html-to-image

Product scope: [产品需求文档.md](./产品需求文档.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs are welcome.

## License

[MIT](./LICENSE) © 2026 Rangsh

---

## 中文简介

GitUnite 是一个**纯前端、本地运行**的 GitHub / Gitee 个人编码数据看板。Token 与业务数据不会上传到任何服务器。

```bash
pnpm install
pnpm dev
```

在「设置」中粘贴 PAT 后同步即可。界面支持中英文与浅色 / 深色 / 跟随系统。

详细需求见 [产品需求文档.md](./产品需求文档.md)，参与开发请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。
