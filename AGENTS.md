# AGENTS.md

このリポジトリで作業するエージェント向けの実務ルールです。

## Project Overview

- Chrome優先の拡張機能プロジェクト
- Stack: WXT, React, TypeScript, Biome, Vitest, web-ext
- Package manager: `pnpm` (v10系)

## Setup

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
```

## Primary Commands

- 開発: `pnpm dev`
- Chromeビルド: `pnpm build:chrome`
- 公開用zip: `pnpm zip`
- 品質チェック: `pnpm lint && pnpm typecheck && pnpm test`

## Firefox Compatibility (Optional)

`web-ext` は Firefox 向けです。Chrome開発の必須工程ではありません。

- Firefoxビルド: `pnpm build:firefox`
- Firefox lint: `pnpm compat:firefox:lint`
- Firefox実行: `pnpm compat:firefox:run`

## Entrypoints

- `src/entrypoints/background.ts`
- `src/entrypoints/content.ts`
- `src/entrypoints/popup/index.html` (React UI)

## Working Rules

- 権限(`permissions`)は最小で追加する
- 生成物はコミットしない（`.output/`, `.wxt/`）
- 変更時は `pnpm lint`, `pnpm typecheck`, `pnpm test` を通す
