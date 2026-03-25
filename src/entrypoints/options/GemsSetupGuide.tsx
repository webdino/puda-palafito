import { Check, ChevronDown, ChevronRight, Clipboard } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const CUSTOM_INSTRUCTIONS = `## 役割

あなたは、ユーザーの過去のインプット（巡回ログ）を基に、興味・関心を理解し、それに基づいて応答を最適化するアシスタントです。

単なる情報検索ではなく、蓄積された記憶を統合し、ユーザーにとって関連性の高い情報を提供します。

---

## 記憶の扱い

入力されるJSONデータ（id, title, url, text, createdAt）は記憶の材料として扱います。

* JSONをそのまま保持するのではなく、類似情報を統合し、概念レベルの知識として再構築してください
* 同一または類似トピックはまとめて扱い、冗長な情報は圧縮してください
* ノイズ（UI要素、装飾テキスト、無関係な情報）は除外してください

---

## 情報抽出ルール

以下の観点を優先して記憶を構築してください：

* 頻出トピック（ユーザーが繰り返し触れている内容）
* 新規性のある情報（これまでにない概念や技術）
* 過去の記憶との関連性
* 実用性の高い情報

---

## 鮮度と整合性

* createdAtは情報の優先度判断に使用してください
* ただし、最新であることのみを理由に事実として扱わず、内容の整合性や信頼性も考慮してください
* 記憶同士に矛盾がある場合は、頻度が高い情報または新しい情報を優先してください

---

## 応答ルール

* 正確性を最優先としてください
* ユーザーの質問に関連する情報のみを使用してください
* 過去の記憶は必要な場合のみ参照してください（無関係な情報は持ち出さない）
* 不明な場合は推測せず「不明」と明確に回答してください

---

## 提案ルール
提案は以下のいずれかに該当する場合のみ行う：

- 既存の興味・関心と強く関連する内容
- 既存の興味と接点を持ち、新しい分野に広がる可能性がある内容

間接的な提案を行う場合は、
既存の興味との関連性を明確に説明する

完全に無関係な提案は禁止する

---

## 出典の扱い

* 通常の回答では出典（URLなど）は明示しないでください
* ただし、必要に応じて根拠（タイトルや識別情報）を提示できる状態を維持してください

---`;

function CopyInstructionsButton() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(CUSTOM_INSTRUCTIONS).then(
      () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setCopied(true);
        setFailed(false);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      },
      () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setCopied(false);
        setFailed(true);
        timerRef.current = setTimeout(() => setFailed(false), 2000);
      },
    );
  }, []);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "コピー済み" : failed ? "コピー失敗" : "コピー"}
      aria-label={copied ? "コピー済み" : failed ? "コピー失敗" : "指示文をコピー"}
      className={`shrink-0 p-1.5 rounded transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 ${
        copied
          ? "bg-emerald-100 border-emerald-300 text-emerald-600"
          : failed
            ? "bg-red-100 border-red-300 text-red-600"
            : "bg-white border-slate-300 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      }`}
    >
      {copied ? <Check size={13} /> : <Clipboard size={13} />}
    </button>
  );
}

function InstructionsBlock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded overflow-hidden bg-slate-50">
      <div className="flex items-start justify-between gap-2 px-2 pt-1.5">
        <pre
          id="instructions-text"
          className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words flex-1 font-sans transition-all ${
            open ? "" : "line-clamp-3"
          }`}
        >
          {CUSTOM_INSTRUCTIONS}
        </pre>
        <CopyInstructionsButton />
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="instructions-text"
        className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>{open ? "閉じる" : "すべて表示"}</span>
      </button>
    </div>
  );
}

export function GemsSetupGuide() {
  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">Gemsの設定</h2>
        <p className="text-xs text-slate-500 mt-1">
          拡張機能が同期したナレッジをGemに紐付けるための設定手順です。
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* STEP 1 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              1
            </span>
            <span className="text-sm font-semibold text-slate-800">Gem管理画面へのアクセス</span>
          </div>
          <p className="text-xs text-slate-600 pl-7">
            Geminiの左サイドバーにあるメニューから操作します。
          </p>
          <ul className="pl-7 flex flex-col gap-1">
            <li className="text-xs text-slate-600">
              画面左上の「作成したもの」セクションを探します。
            </li>
            <li className="text-xs text-slate-600">
              <strong className="font-semibold">Gem &gt;</strong>{" "}
              と書かれたメニュー項目をクリックしてください。
            </li>
            <li className="text-xs text-slate-600">
              画面中央（または右側）に「Gem」の管理画面が開きます。
            </li>
          </ul>
        </div>

        {/* STEP 2 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              2
            </span>
            <span className="text-sm font-semibold text-slate-800">新規作成</span>
          </div>
          <p className="text-xs text-slate-600 pl-7">
            「マイ Gem」セクション右側の <strong className="font-semibold">＋ Gem を作成</strong>{" "}
            ボタンをクリックします。
          </p>
        </div>

        {/* STEP 3 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              3
            </span>
            <span className="text-sm font-semibold text-slate-800">指示とナレッジの設定</span>
          </div>
          <p className="text-xs text-slate-600 pl-7">
            開いた作成画面で、以下の2点を設定してください。
          </p>
          <ul className="pl-7 flex flex-col gap-2">
            <li className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">カスタム指示欄：</span>
              <span className="text-xs text-slate-600">
                以下のテキストをそのまま貼り付けてください。
              </span>
              <InstructionsBlock />
            </li>
            <li className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">知識欄：</span>
              <ul className="flex flex-col gap-1">
                <li className="text-xs text-slate-600">
                  「Gem が参照するファイルを追加します」横の{" "}
                  <strong className="font-semibold">＋</strong> アイコンをクリック。
                </li>
                <li className="text-xs text-slate-600">「Google ドライブ」を選択。</li>
                <li className="text-xs text-slate-600">
                  拡張機能が自動作成したフォルダ（例：Puda
                  Palafito）を開き、中のファイルを選択します。
                </li>
              </ul>
            </li>
          </ul>
        </div>

        {/* STEP 4 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              4
            </span>
            <span className="text-sm font-semibold text-slate-800">保存</span>
          </div>
          <p className="text-xs text-slate-600 pl-7">
            画面右上の <strong className="font-semibold">保存</strong> をクリックして完了です。
          </p>
        </div>
      </div>
    </div>
  );
}
