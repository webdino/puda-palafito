import { CopyButton } from "./CopyButton";

const FLAG_PROMPT = "chrome://flags/#prompt-api-for-gemini-nano";
const FLAG_SUMMARIZATION = "chrome://flags/#summarization-api-for-gemini-nano";

function FlagItem({ label, flag }: { label: string; flag: string }) {
  return (
    <li className="flex flex-col gap-1.5">
      <strong className="text-sm text-slate-700">{label}</strong>
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg font-mono text-xs text-slate-600 select-all">
        <span className="flex-1">{flag}</span>
        <CopyButton url={flag} />
      </div>
      <p className="text-xs text-slate-500">
        このフラグを <strong className="text-slate-600">有効（Enabled）</strong>{" "}
        に設定してください。
      </p>
    </li>
  );
}

export function SetupGuide({ chromeVersion }: { chromeVersion: number | null }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">
          Chrome ビルトイン AI を有効にする方法
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          <strong className="text-slate-600">Summarizer API</strong> は現在 Google Chrome
          の試験的機能です。以下の手順で有効にしてください。
        </p>
      </div>

      <ol className="flex flex-col gap-5 px-5 py-4">
        <li className="flex flex-col gap-1">
          <strong className="text-sm text-slate-700">
            対応している Chrome バージョンを使用する
          </strong>
          <p className="text-xs text-slate-500">
            Chrome Dev または Canary（バージョン 133 以降推奨、一部機能はバージョン 138
            以降が必要）。
          </p>
          <p className="text-xs text-slate-500">
            ご利用の Chrome バージョン:{" "}
            <strong className="text-slate-700">{chromeVersion ?? "不明"}</strong>
          </p>
        </li>
        <FlagItem label="Prompt API for Gemini Nano を有効にする" flag={FLAG_PROMPT} />
        <FlagItem label="Summarization API を有効にする" flag={FLAG_SUMMARIZATION} />
        <li className="flex flex-col gap-1">
          <strong className="text-sm text-slate-700">Chrome を再起動する</strong>
          <p className="text-xs text-slate-500">
            フラグページ下部に表示される「再起動（Relaunch）」ボタンをクリックしてください。
          </p>
        </li>
      </ol>

      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-500 leading-relaxed">
          フラグを有効にした後、Chrome がバックグラウンドで Gemini Nano
          モデルをダウンロードする場合があります。API
          が完全に利用可能になるまで数分かかることがあります。{" "}
          <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-600">
            chrome://components
          </code>{" "}
          を開き、<strong className="text-slate-600">Optimization Guide On Device Model</strong>{" "}
          が完全にダウンロードされていることを確認してください。
        </p>
      </div>
    </div>
  );
}
