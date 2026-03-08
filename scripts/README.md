# Automation Scripts

このディレクトリには、開発中の拡張機能を使用したブラウザ自動操作スクリプトが含まれています。

## 構成

- `crawl.ts`: 指定したURLリストを巡回し、拡張機能の機能によってデータを抽出・保存した後、サイドパネルからデータをエクスポート（ダウンロード）するスクリプトです。
- `sites/`: 巡回対象のURLリスト（JSON形式）を格納するディレクトリです。

## 事前準備

### 1. 依存パッケージのインストール

スクリプトの実行に必要な `playwright` と、TypeScriptを直接実行するための `tsx` をインストールします。

```bash
pnpm add -D playwright tsx
```

### 2. 拡張機能のビルド

スクリプトはビルド済みの成果物（`.output/chrome-mv3`）を使用するため、実行前に必ずビルドを行ってください。

```bash
npm run build
```

## 使い方

### 実行方法

環境変数 `CHROME_PATH` に、お使いのブラウザ（Google Chrome等）のパスを指定して実行します。
第1引数に読み込むJSONファイルのパス（`scripts/` からの相対パス、または絶対パス）を指定できます。

#### Windows (PowerShell)

```powershell
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"

# デフォルト (scripts/sites/list.json) を使用
npx tsx scripts/crawl.ts

# 特定のファイルを指定
npx tsx scripts/crawl.ts sites/e-sports.json
```

#### macOS / Linux

```bash
# デフォルト (scripts/sites/list.json) を使用
CHROME_PATH="..." npx tsx scripts/crawl.ts

# 特定のファイルを指定
CHROME_PATH="..." npx tsx scripts/crawl.ts sites/e-sports.json
```

> [!NOTE]
> `CHROME_PATH` を指定しない場合、Playwrightが用意したデフォルトのChromiumを使用します。

### URLリスト（JSON）の形式

入力ファイルは、URLの文字列配列である必要があります。

```json
[
  "https://wxt.dev/",
  "https://playwright.dev/"
]
```

## 動作の流れ

1. 指定された入力ファイル（JSON）からURLリストを読み込みます。
2. 指定されたブラウザを、開発中の拡張機能が読み込まれた状態で起動します。
3. リスト内の各URLについて、以下の処理を繰り返します：
    - サイトを訪問し、3秒間待機します。
    - 拡張機能のサイドパネルに遷移します。
    - 「Export All」ボタンをクリックし、そのサイトの結果を個別にエクスポートします。
    - ダウンロードされたファイルを `downloads/` フォルダに保存します（ファイル名は `インデックス_ホスト名_元ファイル名`）。
4. 全URLの処理が終わると、ブラウザを閉じます。
