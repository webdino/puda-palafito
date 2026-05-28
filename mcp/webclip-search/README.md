# webclip-search

Obsidian WebClipファイルを検索するMCPサーバ

## 機能

- **list_files**: すべてのWebClipファイルとメタデータを一覧表示
- **search_by_date**: 作成日の範囲でファイルを検索
- **search_by_source**: ソースURLでファイルを検索（部分一致）
- **get_contents**: 特定のファイルの内容を取得（フロントマター + 本文の先頭N文字）

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `WEBCLIP_DIR` | WebClipファイルが保存されているディレクトリのパス（必須） |

## インストール

```bash
cd mcp/webclip-search
uv sync
```

## 使用方法

### Cursorでの設定

`mcp.json` または Cursor の MCP 設定に以下を追加：

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

### Claude Desktopでの設定

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

### get_contents

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `filename` | string | 取得するファイル名（例: `example.md`） |
| `max_chars` | integer | 本文の最大文字数（デフォルト: 2000） |
