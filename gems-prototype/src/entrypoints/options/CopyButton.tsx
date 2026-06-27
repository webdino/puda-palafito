import { useCallback, useState } from "react";

export function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 px-2 py-0.5 text-xs rounded transition-colors border ${
        copied
          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
          : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {copied ? "✅ コピー済み" : "コピー"}
    </button>
  );
}
