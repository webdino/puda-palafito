# Browsing Memory

閲覧したウェブページをローカルに蓄積し、その内容をもとに LLM が回答できるようにする仕組み。

過去に見たページをまとめたり、思い出させたり（想起）といったユースケースを想定しています。

## 構成

2つの機能を組み合わせて動きます。

- **[browser-ext](./browser-ext)** — 閲覧中のページ本文をクリーンな Markdown としてローカルに保存するブラウザ拡張機能。
- **[mcp](./mcp/webclip-search)** — browser-ext が保存した Markdown を日付・URL・全文・意味的類似度で検索し、LLM（Claude Desktop など）の回答に利用する MCP サーバー。

両者は保存先ディレクトリを介してつながります。拡張機能が書き出した Markdown を、MCP サーバーが同じディレクトリから読み取って検索します。

## セットアップ

インストール方法や使い方、各機能の詳細はそれぞれの README を参照してください。

- 拡張機能: [browser-ext/README.md](./browser-ext/README.md)
- MCPサーバー: [mcp/README.md](./mcp/README.md)

## 利用例

### 特定内容の調査したまとめ

https://github.com/user-attachments/assets/d601b0c5-5574-4ebb-9cbc-4f8363831893

### 保存したページの削除

https://github.com/user-attachments/assets/1ebd6cf5-0f82-45ce-ac88-f64510b950d4

### 忘れた情報を探す

https://github.com/user-attachments/assets/21406adc-e804-4b41-b126-f4a32fd6028c
