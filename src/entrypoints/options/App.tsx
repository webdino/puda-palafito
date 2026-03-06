import { useEffect, useState } from "react";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import { SetupGuide } from "./SetupGuide";
import { StatusBanner } from "./StatusBanner";

function getChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\./);
  return match ? parseInt(match[1], 10) : null;
}

export function App() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const chromeVersion = getChromeVersion();

  useEffect(() => {
    async function checkStatus() {
      try {
        const available = await isSummarizerAvailable();
        setIsAvailable(available);
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
      <SetupGuide chromeVersion={chromeVersion} />
    </main>
  );
}
