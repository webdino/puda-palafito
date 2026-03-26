import { useEffect, useState } from "react";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import { notifyModelReady } from "@/message/events";
import { DomainFilter } from "./DomainFilter";
import { GoogleAuthSection } from "./GoogleAuthSection";
import { ModelDownloadProgress } from "./ModelDownloadProgress";
import { SensitiveInfoFilter } from "./SensitiveInfoFilter";
import { SetupGuide } from "./SetupGuide";
import { StatusBanner } from "./StatusBanner";

function getChromeVersion(): number | null {
  const match = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\./);
  return match ? parseInt(match[1], 10) : null;
}

type SetupPanelProps = {
  isAvailable: boolean | null;
  errorDetails: string | null;
  chromeVersion: number | null;
  onDownloadDone: () => void;
};

function SetupPanel({ isAvailable, errorDetails, chromeVersion, onDownloadDone }: SetupPanelProps) {
  const [downloadStarted, setDownloadStarted] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-slate-500">
        ご利用の Chrome バージョン:{" "}
        <strong className="text-slate-700">{chromeVersion ?? "不明"}</strong>
      </div>

      <StatusBanner isAvailable={isAvailable} errorDetails={errorDetails} />

      {isAvailable === false && (
        <div className="flex flex-col gap-4">
          <ModelDownloadProgress started={downloadStarted} onDownloadDone={onDownloadDone} />
          {!downloadStarted && (
            <button
              type="button"
              onClick={() => setDownloadStarted(true)}
              className="self-start flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              モデルをダウンロードする
            </button>
          )}
        </div>
      )}

      <SetupGuide chromeVersion={chromeVersion} />
    </div>
  );
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
        if (available) notifyModelReady();
      } catch (err: unknown) {
        setIsAvailable(false);
        setErrorDetails(err instanceof Error ? err.message : String(err));
      }
    }
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            Puda Palafito 設定
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {isAvailable === true ? (
          <div className="flex flex-col gap-6">
            <DomainFilter />
            <SensitiveInfoFilter />
            <GoogleAuthSection />
          </div>
        ) : (
          <SetupPanel
            isAvailable={isAvailable}
            errorDetails={errorDetails}
            chromeVersion={chromeVersion}
            onDownloadDone={() => {
              setIsAvailable(true);
              notifyModelReady();
            }}
          />
        )}
      </main>
    </div>
  );
}
