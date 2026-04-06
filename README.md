# puda-palafito

<p align="center">
  <img src="./docs/logo.png" width="256" alt="puda-palafito logo">
</p>

閲覧中のウェブページ本文を抽出し、Google Drive に保存する Chrome 拡張機能です。  
保存した情報は、Gemini の Gems に読み込ませる知識ソースとしても活用できます。

## What You Can Do

- 閲覧ページの本文を記録する
- 記録データを Google Drive に自動保存する
- 保存済みのファイルを Gems の知識として登録する

## Documents

- はじめに使い方を確認する: [docs/user-guide.md](./docs/user-guide.md)
- Google Drive API を設定する: [docs/google-drive-api-setup.md](./docs/google-drive-api-setup.md)
- Gems のセットアップ手順を確認する: [docs/gems-guide.md](./docs/gems-guide.md)

## Requirements

- Node.js 24.x
  - こちらを参考にインストールしてください
  - <https://learn.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-windows>
- Corepack
- pnpm 10.x

## Local Setup

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
cp .env.sample .env
pnpm build
```

`.env` ファイルが作成されたら、必要に応じて設定値を変更してください。  
Google Drive 連携に必要な OAuth クライアント ID の作成手順は [docs/google-drive-api-setup.md](./docs/google-drive-api-setup.md) を参照してください。

## For Developers

### 開発用ブラウザの起動

Chrome の `Summarizer API` を使用するため、`pnpm dev` で自動的に立ち上がるブラウザではなく正式リリース版の Chrome を使用します。

プロジェクトルートにある `open-chrome-dev.bat` を使用してください。

```bash
# 通常起動
./open-chrome-dev.bat

# プロファイルを初期化して起動
./open-chrome-dev.bat --clear
```

このバッチを使う理由:

- Summarizer API を利用するため
- 常用 Chrome の設定や拡張機能と衝突させないため
- Windows 環境でプロファイルパスを正しく認識させるため

### 開発版拡張機能のロード

1. ターミナルで `pnpm build` を実行します。
2. `open-chrome-dev.bat` を実行します。
3. `chrome://extensions` を開き、**「パッケージ化されていない拡張機能を読み込む」** を選択して `.output/chrome-mv3-dev` を指定します。

### 補足

- OAuth の承認: 開発中のアプリ（Unverified）であるため、ログイン時に警告が出ますが、自身で作成したクライアント ID を使用している場合はそのまま進めて問題ありません。
- 個人情報マスク設定: 動画内では「メールアドレス」「クレジットカード番号」「マイナンバー」などのマスク設定が有効になっています。これらは保存時に自動でフィルタリングされる対象となります。

## Build

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

## Structure

- `src/entrypoints/background.ts`: service worker entrypoint
- `src/entrypoints/content.ts`: content script entrypoint
- `src/lib/*`: shared utility and tests
- `.output/*`: build artifacts
