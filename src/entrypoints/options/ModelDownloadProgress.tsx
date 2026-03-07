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
        if (loaded >= total) {
          setState({ status: "done" });
          onDownloadDoneRef.current();
        } else {
          setState({ status: "downloading", loaded, total });
        }
      });
    };

    setState({ status: "downloading", loaded: 0, total: 0 });

    createDefaultSummarizer(monitor)
      .then((s) => {
        summarizer = s;
        if (!cancelled) setState({ status: "done" });
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
      <div
        style={{
          padding: 16,
          backgroundColor: "#fff3cd",
          color: "#856404",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
          モデルをダウンロード中... {percent}%
        </p>
        <div
          style={{
            height: 8,
            backgroundColor: "#fde8a4",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              backgroundColor: "#f5a623",
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: "#d4edda",
          color: "#155724",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <p style={{ margin: 0, fontWeight: "bold" }}>✅ モデルのダウンロードが完了しました</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "#f8d7da",
        color: "#721c24",
        borderRadius: 8,
        marginBottom: 24,
      }}
    >
      <p style={{ margin: 0, fontWeight: "bold" }}>モデルの読み込みに失敗しました</p>
      <p style={{ margin: "4px 0 0 0", fontSize: 13, fontFamily: "monospace" }}>{state.message}</p>
    </div>
  );
}
