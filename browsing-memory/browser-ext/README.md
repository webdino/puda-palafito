# Browsing Memory

閲覧中のウェブページ本文をクリーンな Markdown ノートとして抽出・保存する Chrome 拡張機能です。  
出力したノートはMCPを利用することでLLMが閲覧したウェブページに関して質問ができるようになります。  

## What You Can Do

- 閲覧ページの本文を Markdown として記録する（自動保存に対応）
- AI（カスタム LLM / Chrome の Summarizer API）でページを要約する
- 保存先ディレクトリを指定してローカルにファイル保存する
- ドメインフィルターで自動保存の対象外とするサイトを設定する

## Requirements

- Node.js 24.x
  - こちらを参考にインストールしてください
  - <https://learn.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-windows>
- npm

## Local Setup

```bash
npm install
npm run build
```

ビルド成果物は `dist/`（Chrome）に出力されます。

## For Developers

### 開発用ビルド（ウォッチモード）

```bash
# Chrome（デフォルト）
npm run dev

# ターゲットを明示する場合
npm run dev:chrome
```

### 開発版拡張機能のロード

1. ターミナルで `npm run build`（または `npm run dev`）を実行します。
2. `chrome://extensions` を開きます。
3. **「デベロッパーモード」** を有効にします。
4. **「パッケージ化されていない拡張機能を読み込む」** を選択して `dist/` を指定します。

### CLI / API パッケージ

```bash
npm run build:cli
npm run build:api
```

### ローカライズ

```bash
npm run update-locales   # ロケールの更新
npm run check-strings    # 未使用文字列の検出
npm run add-locale       # ロケールの追加
```

ユーザーに表示する文字列は `src/_locales/<lang>/messages.json` に定義し、`getMessage('key')` 経由で参照します（ハードコード禁止）。

## Build

```bash
# 全ターゲットをビルド
npm run build

# 個別ターゲット
npm run build:chrome
```

## Quality Checks

```bash
npm test            # Vitest を実行
npm run test:watch  # ウォッチモード
```

単一のテストファイルを実行する場合:

```bash
npx vitest run src/utils/filters/date.test.ts
```

## Structure

- `src/background.ts`: service worker / バックグラウンドスクリプト
- `src/content.ts`: ウェブページに注入される content script
- `src/core/popup.ts`: ポップアップ / サイドパネルの UI ロジック
- `src/utils/*`: テンプレートエンジン・コンテンツ抽出などの共有ユーティリティとテスト
- `src/_locales/*`: ローカライズ用メッセージ
- `dist/*`: ビルド成果物

## Credits

本拡張機能は [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) をフォークして作成しています。
