import { CopyButton } from "./CopyButton";

const FLAG_PROMPT = "chrome://flags/#prompt-api-for-gemini-nano";
const FLAG_SUMMARIZATION = "chrome://flags/#summarization-api-for-gemini-nano";

function FlagItem({ label, flag }: { label: string; flag: string }) {
  return (
    <li style={{ marginBottom: 16 }}>
      <strong>{label}</strong>
      <div
        style={{
          backgroundColor: "#f4f4f4",
          padding: "8px 12px",
          borderRadius: 4,
          marginTop: 6,
          userSelect: "all",
          fontFamily: "monospace",
        }}
      >
        {flag}
        <CopyButton url={flag} />
      </div>
      <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#555" }}>
        このフラグを <strong>有効（Enabled）</strong> に設定してください。
      </p>
    </li>
  );
}

export function SetupGuide({ chromeVersion }: { chromeVersion: number | null }) {
  return (
    <section>
      <h2 style={{ fontSize: 20, borderBottom: "1px solid #ccc", paddingBottom: 8 }}>
        Chrome ビルトイン AI を有効にする方法
      </h2>
      <p>
        <strong>Summarizer API</strong> は現在 Google Chrome の試験的機能です。
        利用するには、以下の手順で実験的フラグを有効にする必要があります。
      </p>

      <ol style={{ paddingLeft: 24 }}>
        <li style={{ marginBottom: 16 }}>
          <strong>対応している Chrome バージョンを使用する:</strong>
          <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#555" }}>
            Chrome Dev または Canary（バージョン 133 以降推奨、一部機能はバージョン 138
            以降が必要）。
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#555" }}>
            ご利用の Chrome バージョン: <strong>{chromeVersion ?? "不明"}</strong>
          </p>
        </li>
        <FlagItem label="Prompt API for Gemini Nano を有効にする:" flag={FLAG_PROMPT} />
        <FlagItem label="Summarization API を有効にする:" flag={FLAG_SUMMARIZATION} />
        <li>
          <strong>Chrome を再起動する:</strong>
          <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#555" }}>
            フラグページ下部に表示される「再起動（Relaunch）」ボタンをクリックしてください。
          </p>
        </li>
      </ol>

      <p style={{ marginTop: 24, fontSize: 14, color: "#666" }}>
        <em>
          注意: フラグを有効にした後、Chrome がバックグラウンドで Gemini Nano
          モデルをダウンロードする場合があります。 API
          が完全に利用可能になるまで数分かかることがあります。
          <br />
          <code>chrome://components</code> を開き、
          <strong>Optimization Guide On Device Model</strong>{" "}
          が完全にダウンロードされていることを確認してください。
        </em>
      </p>
    </section>
  );
}
