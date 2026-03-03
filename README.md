# puda-palafito

<p align="center">
  <img src="./docs/logo.png" width="256">
</p>

WXT + React + TypeScript を使った Chrome 優先の拡張機能開発。  
閲覧ページの本文抽出を行い、Google Driveに保存をする。  

## Requirements

- Node.js 24.x
  - こちらを参考にインストールしてください
  - https://learn.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-windows
- Corepack
- pnpm 10.x

## Setup

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
cp .env.sample .env
```

`.env` ファイルが作成されたら、必要に応じて設定値を変更してください。

## Development

```bash
pnpm dev
```

Firefox で開発実行する場合:

```bash
pnpm dev:firefox
```

## Build

Chrome 用ビルド:

```bash
pnpm build:chrome
```

Firefox 用ビルド:

```bash
pnpm build:firefox
```

共通ビルド:

```bash
pnpm build
```

公開用 zip:

```bash
pnpm zip
```

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Firefox Compatibility Check (`web-ext`: Firefox向け)

```bash
pnpm build:firefox
pnpm compat:firefox:lint
pnpm compat:firefox:run
```

## Structure

- `src/entrypoints/background.ts`: service worker entrypoint
- `src/entrypoints/content.ts`: content script entrypoint
- `src/entrypoints/popup/*`: popup UI (React)
- `src/lib/*`: shared utility and tests
- `.output/*`: build artifacts
