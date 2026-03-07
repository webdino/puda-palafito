export const constants = {
  defaultSharedContext: `この要約は、カスタムAI（Gems）の知識ベースとして使用します。専門用語を保持し、重要な数値や定義を省略しないでください。`,
  mapContext: (title: string) =>
    `タイトル「${title}」の記事の一部です。このセクションから重要な事実を抽出してください。`,
  reduceContext: (title: string) =>
    `タイトル「${title}」の各セクションから抽出された重要項目のリストです。情報を一切削らず、全ての項目を保持したまま、重複だけを整理して箇条書きで出力してください。要約して短くしてはいけません。`,
  optionPagePath: "options.html",
} as const;
