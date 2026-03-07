import { storage } from "@wxt-dev/storage";
import { useEffect, useState } from "react";
import { DebugStorageKeys, type SavedContentsData, StorageKeys } from "@/storage";

export function App() {
  const [contentsData, setContentsData] = useState<SavedContentsData>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCopy(id: string, json: string) {
    navigator.clipboard.writeText(json).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleExport() {
    if (contentsData.length === 0) return;
    const json = JSON.stringify(contentsData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = import.meta.env.WXT_EXPORT_FILE_NAME || "history.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // [DEBUG] >>> Debug Feature
  const [debugCopied, setDebugCopied] = useState(false);
  async function handleDebugCopy() {
    const data = await storage.getItem(DebugStorageKeys.summarizedResultKey);
    if (!data) {
      alert("No debug data found");
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setDebugCopied(true);
    setTimeout(() => setDebugCopied(false), 2000);
  }
  // [DEBUG] <<< Debug Feature

  useEffect(() => {
    storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey).then((data) => {
      setContentsData(data ?? []);
    });

    const unwatch = storage.watch<SavedContentsData>(
      StorageKeys.savedContentsDataKey,
      (newValue, oldValue) => {
        console.log("newValue", newValue);
        console.log("oldValue", oldValue);
        setContentsData(newValue ?? []);
      },
    );
    return () => {
      unwatch();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-10 px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-slate-800">
              Saved Contents
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-600 rounded-full">
              {contentsData.length}
            </span>
          </div>
          <div className="flex gap-2">
            {/* [DEBUG] >>> Debug Feature */}
            <button
              type="button"
              onClick={handleDebugCopy}
              className="text-[10px] font-medium px-2 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-all shadow-sm flex items-center gap-1"
            >
              <span>🐛</span>
              {debugCopied ? "Copied!" : "Debug JS"}
            </button>
            {/* [DEBUG] <<< Debug Feature */}
            <button
              type="button"
              onClick={handleExport}
              disabled={contentsData.length === 0}
              className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📥</span>
              Export All
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 flex flex-col gap-3">
        {contentsData.length > 0 ? (
          contentsData.map((item) => {
            const date = new Date(item.createdAt);
            const dateStr = Number.isNaN(item.createdAt) ? "—" : date.toLocaleString();
            const hostname = (() => {
              try {
                return new URL(item.url).hostname;
              } catch {
                return item.url;
              }
            })();
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="px-4 pt-4 pb-3 flex flex-col gap-1">
                  <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                    {item.title}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline truncate w-full block"
                  >
                    {hostname}
                  </a>
                </div>
                {item.text && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                )}
                <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400">{dateStr}</p>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, JSON.stringify(item, null, 2))}
                    className="text-[11px] px-2 py-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    {copiedId === item.id ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-20 gap-2">
            <div className="text-3xl">📭</div>
            <p className="text-sm text-slate-400">No contents saved yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
