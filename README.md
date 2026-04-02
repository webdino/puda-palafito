# puda-palafito

<p align="center">
  <img src="./docs/logo.png" width="256" alt="puda-palafito logo">
</p>

WXT + React + TypeScript を使った Chrome の拡張機能開発。  
閲覧ページの本文抽出を行い、Google Driveに保存をする。  

## Requirements

- Node.js 24.x
  - こちらを参考にインストールしてください
  - <https://learn.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-windows>
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

### 1. 開発用ブラウザの起動

Chrome の `Summarizer API` を使用するため、`pnpm dev` で自動的に立ち上がるブラウザではなく正式リリース版の Chrome を使用する。

プロジェクトルートにある `open-chrome-dev.bat` を使用してください。

```bash
# 通常起動
./open-chrome-dev.bat

# プロファイルを初期化して起動
./open-chrome-dev.bat --clear
```

**なぜこのバッチを使うのか:**

- **フラグの保持**: `pnpm dev` (WXT) で起動するブラウザは終了時にプロファイルがリセットされる場合があるため、`chrome://flags` で変更した試験的機能の設定を `.chrome-profile` ディレクトリに確実に永続化させる。
- **設定の隔離**: 常用している Chrome の設定や拡張機能と衝突させない。
- **絶対パス対応**: Windows 環境でプロファイルパスを正しく認識させるため。

### 2. 拡張機能のロード

1. ターミナルでビルドを実行します（ファイル変更を監視する場合）:

   ```bash
   pnpm build
   ```

2. `open-chrome-dev.bat` を実行します。

3. `chrome://extensions` を開き、**「パッケージ化されていない拡張機能を読み込む」** を選択して `.output/chrome-mv3-dev` を指定してください。

---

開発用 Chrome は `.chrome-profile` に保存されるプロファイルを使用します。
`chrome://flags` で有効にした設定はこのプロファイルに保持されます。

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
- `src/entrypoints/popup/*`: popup UI (React)
- `src/lib/*`: shared utility and tests
- `.output/*`: build artifacts
