import { CopyButton } from "./CopyButton";

const ON_DEVICE_INTERNALS_URL = "chrome://on-device-internals";

function ComponentsHintCard() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-xs font-semibold text-amber-800">モデルのダウンロード確認</p>
      <p className="text-xs text-amber-700 leading-relaxed">
        Gemini Nano のダウンロード状態や利用可否を確認できます。
      </p>
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 rounded-lg font-mono text-xs text-amber-700 select-all">
        <span className="flex-1">{ON_DEVICE_INTERNALS_URL}</span>
        <CopyButton url={ON_DEVICE_INTERNALS_URL} />
      </div>
    </div>
  );
}

function SetupGuideContent() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50">
        <h2 className="text-base font-semibold text-emerald-800">
          Chrome ビルトイン AI のセットアップ
        </h2>
        <p className="text-xs text-emerald-700 mt-1 font-medium">フラグ設定は不要です</p>
        <p className="text-xs text-emerald-600 mt-0.5">
          バージョン 138 以降では Summarizer API がデフォルトで有効です。
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <ol className="flex flex-col gap-3 list-decimal list-inside">
          <li className="flex flex-col gap-1">
            <strong className="text-sm text-slate-700">モデルのダウンロードを待つ</strong>
            <p className="text-xs text-slate-500 ml-4">
              初回利用時は Gemini Nano
              モデルが自動でダウンロードされます。数分かかる場合があります。
            </p>
          </li>
        </ol>

        <ComponentsHintCard />
      </div>
    </div>
  );
}

export function SetupGuide({ chromeVersion }: { chromeVersion: number | null }) {
  if (chromeVersion !== null && chromeVersion < 138) {
    return null;
  }

  return <SetupGuideContent />;
}
