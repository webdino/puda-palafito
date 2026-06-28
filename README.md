# 概要

ブラウザの閲覧履歴を活用し、LLM がより便利な回答をしてくれることを目指すプロジェクト。

## サブプロジェクト

### browsing-memory

ブラウザ拡張機能で閲覧した各ページを Markdown としてローカルに保存し、MCP サーバーがそれを参照して回答するアプローチ。

- [`browsing-memory`](browsing-memory) — ブラウザ拡張機能とMCPサーバーをセットで利用する

### gems-prototype

ブラウザ拡張から Google Drive にページを保存し、Gems を使って回答するアプローチ。

- [`gems-prototype`](gems-prototype) — ブラウザ拡張機能と Gems 連携の試作
