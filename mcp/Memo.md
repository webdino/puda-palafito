# 雑メモ

## Obsidian Web Clipperの設定
### テンプレート
必ずしも必要ではない。保存クリップの見かけの問題

- ノート名
  デフォルトでは {{title}}だが、日時とタイトルの頭20文字にしてみた
  ```
  {{date|date:"YYYYMMDDHHmmss"}}_{{title|slice:0,20}}
  ```

- プロパティ
  `created` は日付のみだったが、時分秒も入れるようにしてみた
  ```
  {{date|date:"YYYY-MM-DD HH:mm:ss"}}
  ```
