# webclip-search

 WebClipファイルを検索するMCPサーバ

## 機能

- **list_files**: すべてのWebClipファイルとメタデータを一覧表示
- **search_by_date**: 作成日の範囲でファイルを検索
- **search_by_source**: ソースURLでファイルを検索（部分一致）
- **search_fulltext**: 本文に含まれるテキストでファイルを検索（部分一致、大文字小文字区別なし）
- **search_semantic**: 本文チャンクの意味的類似度でファイルを検索
- **index_status**: セマンティックインデックスの状態と frontmatter カバレッジを表示
- **get_contents**: 特定のファイルの内容を取得（フロントマター + 本文の先頭N文字）

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `WEBCLIP_DIR` | WebClipファイルが保存されているディレクトリのパス（必須） |
| `WEBCLIP_INDEX_PATH` | セマンティックインデックス JSON のパス（省略時: `{WEBCLIP_DIR}/.webclip-semantic-index.json`） |
| `WEBCLIP_EMBED_MODEL` | 埋め込みモデル名（省略時: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`） |
| `WEBCLIP_MAX_CHUNK_CHARS` | 本文チャンクの最大文字数（省略時: `2000`） |
| `WEBCLIP_MAX_CHUNKS_PER_FILE` | 1ファイルあたりの最大チャンク数（省略時: `30`） |

## インストール

```bash
cd mcp/webclip-search
uv sync
```

### MCPB（.mcpb）パッケージの作成
必要なファイル: `manifest.json`, `pyproject.toml`, `uv.lock`, `src/`, `.mcpbignore`

```bash
cd mcp/webclip-search
npm install -g @anthropic-ai/mcpb   # 初回のみ
mcpb validate .
mcpb pack .
```

生成された `webclip-search.mcpb` を Claude Desktop にインストールします。


## インストール方法

### MCBPファイルを使用してインストールする場合

- ファイル→設定…→拡張機能→詳細設定→「拡張機能をインストール」をクリック
  MCBP ファイルを選択してインストールする
  インストール時に WebClip ディレクトリの設定を求められます。

- エラーが出て有効化できない場合:
  最新の "Microsoft Visual C++ Redistributable for Visual Studio 2015-2022 (x64)" を Microsoft からダウンロード/インストールしてから、Claude を再起動してみてください



### Claude Desktop に手動設定する場合

設定ファイルの場所：
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

設定内容：

```json
{
  "mcpServers": {
    "webclip-search": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/mcp/webclip-search", "webclip-search"],
      "env": {
        "WEBCLIP_DIR": "/path/to/your/obsidian/webclips"
      }
    }
  }
}
```

**注意**: パスは環境に合わせて書き換えてください。

## ツール詳細

### list_files

パラメータなし。すべてのWebClipファイルを一覧表示します。

### search_by_date

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `start_date` | string | 開始日（YYYY-MM-DD形式、この日を含む） |
| `end_date` | string | 終了日（YYYY-MM-DD形式、この日を含む） |

### search_by_source

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `url` | string | 検索するURLパターン（部分一致） |

### search_fulltext

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `query` | string | 本文から検索するテキスト（部分一致、大文字小文字区別なし） |

### search_semantic

本文 Markdown をチャンク化して埋め込み、クエリとのコサイン類似度で検索します。初回実行時はモデルのダウンロードとインデックス構築のため時間がかかります。変更されたファイルのみ差分更新されます。

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `query` | string | 自然言語の検索クエリ |
| `top_k` | integer | 返すファイル数の上限（デフォルト: 10） |
| `rebuild_index` | boolean | インデックスを全件再構築する（デフォルト: false） |

各 frontmatter の `title` / `description` / `summary`（存在する場合）はチャンクの文脈として付加されますが、検索の主体は本文です。

### index_status

パラメータなし。インデックスパス、チャンク数、未更新ファイル数、`summary` / `description` の有無などを表示します。

### get_contents

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `filename` | string | 取得するファイル名（例: `example.md`） |
| `max_chars` | integer | 本文の最大文字数（デフォルト: 2000） |
