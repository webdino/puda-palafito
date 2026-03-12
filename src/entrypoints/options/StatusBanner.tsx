export function StatusBanner({
  isAvailable,
  errorDetails,
}: {
  isAvailable: boolean | null;
  errorDetails: string | null;
}) {
  if (isAvailable === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="animate-spin">⟳</span>
        AI の利用可否を確認中...
      </div>
    );
  }

  if (isAvailable) {
    return (
      <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <span className="text-lg leading-none mt-0.5">✅</span>
        <div>
          <p className="font-semibold text-emerald-800 text-sm">Summarizer API は利用可能です</p>
          <p className="text-emerald-700 text-xs mt-0.5">AI 機能は正常に動作しています。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
      <span className="text-lg leading-none mt-0.5">❌</span>
      <div>
        <p className="font-semibold text-red-800 text-sm">Summarizer API は利用できません</p>
        {errorDetails && (
          <p className="text-red-700 text-xs font-mono mt-1 opacity-80">エラー: {errorDetails}</p>
        )}
      </div>
    </div>
  );
}
