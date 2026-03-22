import { storage } from "@wxt-dev/storage";
import { Circle, Pause, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { isAllowedByDomainFilter } from "@/lib/domain-filter";
import { openOptionsTab } from "@/lib/tabs";
import { isSensitivePath } from "@/lib/url";
import { notifyDeleteAllItems, notifyDeleteItem } from "@/message/events";
import { type SavedContentsData, StorageKeys } from "@/storage";
import { ContentCard } from "./ContentCard";

export function App() {
  const [contentsData, setContentsData] = useState<SavedContentsData>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isRecordingSkipped, setIsRecordingSkipped] = useState(false);

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

  function handleDelete(id: string) {
    notifyDeleteItem(id);
  }

  function handleDeleteAll() {
    if (!window.confirm("すべての記録を削除しますか？この操作は元に戻せません。")) return;
    notifyDeleteAllItems();
  }

  function handleRecordingToggle() {
    setRecordingEnabled((prev) => {
      const next = !prev;
      storage.setItem(StorageKeys.recordingEnabled, next);
      return next;
    });
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

  useEffect(() => {
    async function checkActiveTab() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url ?? "";
      const domainFilter = (await storage.getItem<string[]>(StorageKeys.domainFilter)) ?? [];
      setIsRecordingSkipped(isSensitivePath(url) || !isAllowedByDomainFilter(url, domainFilter));
    }

    checkActiveTab();

    function onActivated() {
      checkActiveTab();
    }

    function onUpdated(
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) {
      if (changeInfo.status === "complete" && tab.active) {
        checkActiveTab();
      }
    }

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);

    const unwatchDomainFilter = storage.watch<string[]>(StorageKeys.domainFilter, () => {
      checkActiveTab();
    });

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      unwatchDomainFilter();
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
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={contentsData.length === 0}
              className="text-xs font-medium px-3 py-1.5 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>🗑️</span>
              全削除
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 flex flex-col gap-3">
        {recordingEnabled && isRecordingSkipped && (
          <output
            aria-live="polite"
            className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800"
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              ⚠️
            </span>
            <p className="text-xs leading-relaxed">このページは記録対象外です。</p>
          </output>
        )}
        {contentsData.length > 0 ? (
          contentsData.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              copiedId={copiedId}
              expandedIds={expandedIds}
              onCopy={handleCopy}
              onToggleExpanded={toggleExpanded}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-20 gap-2">
            <div className="text-3xl">📭</div>
            <p className="text-sm text-slate-400">まだ記録されたページはありません。</p>
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
