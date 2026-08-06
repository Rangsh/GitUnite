# 贡献指南

感谢你关注 GitUnite。本文说明如何在本仓库参与开发与提交流程。

## 开发环境

**要求：** Node.js 18+、[pnpm](https://pnpm.io/)

```bash
git clone https://github.com/Rangsh/GitUnite.git
cd GitUnite
pnpm install
pnpm dev
```

Gitee 镜像：https://gitee.com/tiantiankun/git-unite

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | `vue-tsc` + 生产构建 |
| `pnpm typecheck` | 仅类型检查 |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |

## 贡献流程

1. 较大改动或新功能，建议先开 Issue 讨论。
2. Fork 仓库，从 `main` 拉分支（建议 `feat/…`、`fix/…`、`docs/…`）。
3. 保持 PR 聚焦：一次只解决一类问题。
4. 提交前至少运行 `pnpm typecheck`；若改动同步 / i18n，建议再跑 `pnpm build`。
5. PR 描述写清**改了什么**、**如何验证**（界面改动附截图更佳）。

### 提交信息

遵循 [Conventional Commits](https://www.conventionalcommits.org/)，与本仓库历史一致：

```text
feat: 增加 PR/Issue 空态同步提示
fix: 按已同步提交时间窗裁剪 GitHub 周统计
docs: 重写 README 与中文贡献指南
chore: 升级 vue-i18n
```

## 目录结构（简要）

```text
src/
  api/            GitHub / Gitee 适配器与统一类型
  sync/           同步引擎、跨标签页锁、中止控制
  db/             Dexie schema 与 repositories
  stores/         Pinia（auth、sync、analytics、ui、repos）
  views/          路由页面
  components/     图表、布局、设置、分享、年鉴等
  composables/    useSync、反馈等
  i18n/           语言包（zh-CN、en-US）
  utils/          统计、徽章、导出、协作图等
  workers/        重计算 Worker（年鉴等）
public/
  badges/         成就徽章（透明底 WebP）
  branding/       封面、图标、favicon
docs/
  产品需求文档.md
  screenshots/    README 界面截图
```

## 国际化（i18n）

面向用户的文案必须走 `vue-i18n`：

1. 同时在 `src/i18n/locales/zh-CN.ts` 与 `en-US.ts` 增加**相同结构**的键。
2. 组件内用 `useI18n().t('…')`；非 setup 场景可用 `@/i18n` 的 `t()`。
3. 优先命名插值：`t('layout.lastSynced', { time })`。

不要在模板里新增长驻中英文硬编码。

## 主题

`useUiStore().theme`：`light` | `dark` | `system`。  
实际暗色由 `isDark` 解析（`system` 跟随 `prefers-color-scheme`）。优先使用现有 CSS 变量与 `dark:` 工具类。

## 同步与隐私

- Token 不要写入日志；能用请求头就不要拼进 URL。
- 远端仓库列表被截断或中止时，禁止误删本地已有仓库。
- 同步应由用户主动触发；PR/Issue、Gitee 代码明细等重请求放在完整同步路径。
- 导出可能包含私有仓库名，分享相关能力需有明确提示。

## 代码风格

- 贴合周边文件风格；能小改就不引入新抽象。
- 避免无必要的 `any`。
- 注释写**为什么**，不复述代码在做什么。
- 提交前可能触发 `lint-staged` + ESLint。

## 报告缺陷

请尽量提供：

- 浏览器与操作系统
- 平台（GitHub / Gitee / 双端）
- 是否开启「代码行明细同步」
- 复现步骤与控制台报错（**打码 Token**）

## 许可

提交代码即表示你同意以 [MIT License](./LICENSE) 授权你的贡献。
