import { storage } from "@wxt-dev/storage";
import { ChevronDown, ChevronRight, Circle, Pause, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { openOptionsTab } from "@/lib/tabs";
import { isAvailableUrl } from "@/lib/url";
import { notifyDeleteAllItems, notifyDeleteItem } from "@/message/events";
import { type SavedContentData, type SavedContentsData, StorageKeys } from "@/storage";
import { ContentCard } from "./ContentCard";

export function App() {
  const [contentsData, setContentsData] = useState<SavedContentsData>([]);
  const [urlFilter, setUrlFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isRecordingSkipped, setIsRecordingSkipped] = useState(false);
  const [expandedDateFolders, setExpandedDateFolders] = useState<Set<string>>(new Set());
  const hasAutoExpanded = useRef(false);
  const previousSortedDates = useRef<string[]>([]);

  const filteredContentsData = useMemo(() => {
    if (!urlFilter) return contentsData;
    const search = urlFilter.toLowerCase();
    return contentsData.filter((item) => item.url.toLowerCase().includes(search));
  }, [contentsData, urlFilter]);

  const groupedData = useMemo(() => {
    const groups: Record<string, SavedContentData[]> = {};
    for (const item of filteredContentsData) {
      const date = new Date(item.createdAt);
      // NOTE: 意図的にユーザー環境のローカル・タイムゾーン基準で日付をグループ化しています。
      // 閲覧履歴として直感的な日付（UTC等で朝のデータが前日扱いになるのを防ぐため）にするための仕様です。
      const yyyy = date.getFullYear();
      const MM = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}/${MM}/${dd}`;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    }
    return groups;
  }, [filteredContentsData]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedData).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [groupedData]);

  useEffect(() => {
    if (sortedDates.length === 0) return;

    if (!hasAutoExpanded.current) {
      // 最初の読み込み時に最新の日付フォルダを一度だけ開く
      setExpandedDateFolders(new Set([sortedDates[0]]));
      hasAutoExpanded.current = true;
    } else {
      // 稼働中に新しいデータ（今日初めての記録など）が追加され、手前に新しい日付グループが発生した場合は自動展開する
      const prev = previousSortedDates.current;
      const latest = sortedDates[0];
      if (prev.length > 0 && prev[0] !== latest && !prev.includes(latest)) {
        setExpandedDateFolders((current) => {
          const next = new Set(current);
          next.add(latest);
          return next;
        });
      }
    }

    // 比較用に状態を保存
    previousSortedDates.current = sortedDates;
  }, [sortedDates]);

  function toggleDateFolder(dateStr: string) {
    setExpandedDateFolders((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  }

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
      const available = await isAvailableUrl(url);
      setIsRecordingSkipped(!available);
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
      <header className="sticky top-0 z-10 px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-slate-800">記録ページ</h1>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-600 rounded-full">
              {filteredContentsData.length}
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
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
            placeholder="URLでフィルタ..."
            className="w-full text-sm pl-9 pr-3 py-1.5 bg-slate-100 border border-transparent rounded-lg focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
          />
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
        {sortedDates.length > 0 ? (
          sortedDates.map((dateStr) => {
            const items = groupedData[dateStr];
            const isExpanded = expandedDateFolders.has(dateStr);
            const regionId = `folder-${dateStr.replace(/\//g, "-")}`;

            return (
              <div key={dateStr} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleDateFolder(dateStr)}
                  aria-expanded={isExpanded}
                  aria-controls={regionId}
                  className="flex items-center gap-2 px-2 py-1.5 text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors font-semibold"
                >
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-slate-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight
                      size={18}
                      className="text-slate-400 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-sm">{dateStr}</span>
                  <span className="text-xs text-slate-500 font-normal ml-auto bg-slate-200/60 px-2.5 py-0.5 rounded-full">
                    {items.length}件
                  </span>
                </button>

                <section
                  id={regionId}
                  hidden={!isExpanded}
                  aria-label={`${dateStr}の記録一覧`}
                  className={`${!isExpanded ? "hidden " : ""}flex flex-col gap-3 pl-3 ml-2.5 border-l-2 border-slate-200/60`}
                >
                  {items.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      copiedId={copiedId}
                      expandedIds={expandedIds}
                      onCopy={handleCopy}
                      onToggleExpanded={toggleExpanded}
                      onDelete={handleDelete}
                    />
                  ))}
                </section>
              </div>
            );
          })
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
