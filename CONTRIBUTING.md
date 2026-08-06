# Contributing to GitUnite

Thanks for your interest in contributing. This guide keeps the bar practical for a local-first Vue SPA.

## Development setup

**Requirements:** Node.js 18+, [pnpm](https://pnpm.io/)

```bash
git clone https://github.com/Rangsh/GitUnite.git
cd GitUnite
pnpm install
pnpm dev
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | `vue-tsc` + production build |
| `pnpm typecheck` | TypeScript only |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |

Mirror on Gitee: https://gitee.com/tiantiankun/git-unite

## How to contribute

1. **Open an issue** for bugs or larger features before a big PR when possible.
2. **Fork** and create a branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Keep PRs focused — one concern per PR beats a mega-diff.
4. Run `pnpm typecheck` (and `pnpm build` if you touch sync / i18n) before opening the PR.
5. Describe **what** changed and **how to verify** (screenshots help for UI).

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/), matching this repo:

```text
feat: add contributions empty-state sync hint
fix: clip GitHub weekly stats to synced commit window
docs: rewrite README for v1.0 release
chore: bump vue-i18n
```

## Project map

```text
src/
  api/          GitHub / Gitee adapters
  sync/         Sync engine & cross-tab lock
  db/           Dexie schema & repositories
  stores/       Pinia (auth, sync, analytics, ui)
  views/        Pages
  components/   UI pieces (charts, settings, share)
  i18n/         vue-i18n locales (zh-CN, en-US)
  utils/        Analytics, badges, export, …
```

## i18n

User-facing copy must go through `vue-i18n`.

1. Add keys to **both** `src/i18n/locales/zh-CN.ts` and `en-US.ts` (same tree).
2. Use `useI18n().t('…')` in components, or `t()` from `@/i18n` outside setup.
3. Prefer named interpolations: `t('layout.lastSynced', { time })`.

Do not leave new hardcoded Chinese/English strings in templates.

## Theme

Theme mode lives in `useUiStore().theme`: `light` | `dark` | `system`.
Resolved dark mode is `isDark` (system follows `prefers-color-scheme`). Prefer existing CSS variables / `dark:` utilities over one-off colors.

## Sync & privacy guidelines

- Never log tokens or put them in URLs when a header works.
- Do not delete local repos when a remote list fetch was truncated or aborted.
- Prefer incremental sync; heavy phases (PR/Issue, Gitee code detail) should stay behind explicit / full sync paths.
- Assume all data is personal — exports may include private repo names; warn in UI when adding share paths.

## Code style

- Match nearby file style; prefer small, readable changes over new abstractions.
- TypeScript strictness: avoid `any` unless bridging untyped libs.
- Comments: explain non-obvious *why*, not what the code already shows.
- Pre-commit may run `lint-staged` + ESLint fix.

## Reporting bugs

Include:

- Browser & OS
- Platform (GitHub / Gitee / both)
- Whether code-detail sync is on
- Steps to reproduce and console errors (redact tokens)

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
