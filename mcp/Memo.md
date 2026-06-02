# 雑メモ

## Obsidian Web Clipperの設定
### テンプレート
- ノート名
  デフォルトでは {{title}}だが、日時とタイトルの頭20文字
  ```
  {{date|date:"YYYYMMDDHHmmss"}}_{{title|slice:0,20}}
  ```

- プロパティ
  `created` は日付のみだったが、時分秒も入れる
  ```
  {{date|date:"YYYY-MM-DD HH:mm:ss"}}
  ```
  - サマリー    (外部LLMの呼び出しが必要。インタープリターのところで設定しておく)
    ```
    summary: {{"a summary of the page, 日本語で"}}
    ```

    詳細設定のインタプリターコンテキストを{{content}} にする
      fullHTMLだとノイズだらけになる
