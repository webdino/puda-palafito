import { storage } from "@wxt-dev/storage";
import { Circle, Pause, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { openOptionsTab } from "@/lib/tabs";
import { type SavedContentsData, StorageKeys } from "@/storage";

export function App() {
  const [contentsData, setContentsData] = useState<SavedContentsData>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  function handleRecordingToggle() {
    const nextState = !recordingEnabled;
    setRecordingEnabled(nextState);
    storage.setItem(StorageKeys.recordingEnabled, nextState);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    storage.getItem<boolean>(StorageKeys.recordingEnabled).then((val) => {
      setRecordingEnabled(val ?? true);
    });

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
            <h1 className="text-base font-semibold tracking-tight text-slate-800">記録ページ</h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-600 rounded-full">
              {contentsData.length}
            </span>
          </div>
          <div className="flex gap-2 items-center">
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
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full text-left px-4 py-3 bg-slate-50 border-t border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <p
                      className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap ${
                        expandedIds.has(item.id) ? "" : "line-clamp-3"
                      }`}
                    >
                      {item.text}
                    </p>
                  </button>
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
            <p className="text-sm text-slate-400">まだ記録された要約はありません。</p>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 px-4 py-3 bg-white/80 backdrop-blur border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={handleRecordingToggle}
          title={
            recordingEnabled ? "記録中 (クリックで一時停止)" : "一時停止中 (クリックで記録再開)"
          }
          aria-label={
            recordingEnabled ? "記録中（クリックで一時停止）" : "一時停止中（クリックで記録再開）"
          }
          aria-pressed={recordingEnabled}
          className={`p-1.5 rounded-lg transition-colors ${
            recordingEnabled ? "text-red-500 hover:bg-red-50" : "text-slate-400 hover:bg-slate-100"
          }`}
        >
          {recordingEnabled ? (
            <Circle size={16} className="fill-current animate-pulse" />
          ) : (
            <Pause size={16} className="fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={() => openOptionsTab()}
          aria-label="設定を開く"
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <Settings size={16} />
        </button>
      </footer>
    </div>
  );
}
