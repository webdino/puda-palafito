import { useEffect, useRef, useState } from "react";
import { createDefaultSummarizer } from "@/lib/summarizer/create";

type DownloadState =
  | { status: "idle" }
  | { status: "downloading"; loaded: number; total: number }
  | { status: "done" }
  | { status: "error"; message: string };

type Props = {
  started: boolean;
  onDownloadDone: () => void;
};

export function ModelDownloadProgress({ started, onDownloadDone }: Props) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });

  const onDownloadDoneRef = useRef(onDownloadDone);
  onDownloadDoneRef.current = onDownloadDone;

  useEffect(() => {
    if (!started) return;

    let cancelled = false;
    let summarizer: Awaited<ReturnType<typeof createDefaultSummarizer>> | null = null;
    const monitor: CreateMonitorCallback = (m) => {
      m.addEventListener("downloadprogress", (e) => {
        if (cancelled) return;
        const { loaded, total } = e as Event & { loaded: number; total: number };
        setState({ status: "downloading", loaded, total });
      });
    };

    setState({ status: "downloading", loaded: 0, total: 0 });

    createDefaultSummarizer(monitor)
      .then((s) => {
        summarizer = s;
        if (!cancelled) {
          setState({ status: "done" });
          onDownloadDoneRef.current();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      cancelled = true;
      summarizer?.destroy();
    };
  }, [started]);

  if (state.status === "idle") return null;

  if (state.status === "downloading") {
    const percent = state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0;
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
        <p className="text-sm font-semibold text-amber-800">
          モデルをダウンロード中... {percent}%
        </p>
        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <span>✅</span>
        <p className="text-sm font-semibold text-emerald-800">モデルのダウンロードが完了しました</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-1">
      <p className="text-sm font-semibold text-red-800">モデルの読み込みに失敗しました</p>
      <p className="text-xs font-mono text-red-700">{state.message}</p>
    </div>
  );
}
