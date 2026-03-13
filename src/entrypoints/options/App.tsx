import { useEffect, useState } from "react";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import { notifyModelReady } from "@/message/events";
import { GoogleAuthSection } from "./GoogleAuthSection";
import { ModelDownloadProgress } from "./ModelDownloadProgress";
import { SetupGuide } from "./SetupGuide";
import { StatusBanner } from "./StatusBanner";

function getChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function App() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const chromeVersion = getChromeVersion();

  useEffect(() => {
    async function checkStatus() {
      try {
        const available = await isSummarizerAvailable();
        setIsAvailable(available);
        if (available) notifyModelReady();
      } catch (err: unknown) {
        setIsAvailable(false);
        setErrorDetails(err instanceof Error ? err.message : String(err));
      }
    }
    checkStatus();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Puda Palafito 設定</h1>
        <div style={{ fontSize: 14, color: "#666" }}>
          ご利用の Chrome バージョン: <strong>{chromeVersion ?? "不明"}</strong>
        </div>
      </div>

      <StatusBanner isAvailable={isAvailable} errorDetails={errorDetails} />

      {isAvailable === false && (
        <>
          <ModelDownloadProgress
            started={downloadStarted}
            onDownloadDone={() => {
              setIsAvailable(true);
              notifyModelReady();
            }}
          />
          {!downloadStarted && (
            <button
              type="button"
              onClick={() => setDownloadStarted(true)}
              style={{
                display: "block",
                marginBottom: 24,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: "bold",
                cursor: "pointer",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#0d6efd",
                color: "#fff",
              }}
            >
              モデルをダウンロードする
            </button>
          )}
        </>
      )}

      <SetupGuide chromeVersion={chromeVersion} />

      <GoogleAuthSection />
    </main>
  );
}
