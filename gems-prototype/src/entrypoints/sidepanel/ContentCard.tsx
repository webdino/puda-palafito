import type React from "react";
import type { SavedContentsData } from "@/storage";

type Props = {
  item: SavedContentsData[number];
  copiedId: string | null;
  expandedIds: Set<string>;
  query: string;
  onCopy: (id: string, json: string) => void;
  onToggleExpanded: (id: string) => void;
  onDelete: (id: string) => void;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: split parts are positionally stable and never reordered
      <mark key={i} className="bg-yellow-200 text-inherit rounded-sm not-italic">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function ContentCard({
  item,
  copiedId,
  expandedIds,
  query,
  onCopy,
  onToggleExpanded,
  onDelete,
}: Props) {
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex flex-col gap-1">
        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
          {highlight(item.title, query)}
        </p>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline truncate w-full block"
        >
          {highlight(hostname, query)}
        </a>
      </div>
      {item.text && (
        <button
          type="button"
          onClick={() => onToggleExpanded(item.id)}
          className="w-full text-left px-4 py-3 bg-slate-50 border-t border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <p
            className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap ${
              expandedIds.has(item.id) ? "" : "line-clamp-3"
            }`}
          >
            {highlight(item.text, query)}
          </p>
        </button>
      )}
      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">{dateStr}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCopy(item.id, JSON.stringify(item, null, 2))}
            className="text-[11px] px-2 py-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            {copiedId === item.id ? "Copied!" : "Copy JSON"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label="削除"
            className="text-[11px] px-2 py-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
