import { useCallback, useState } from "react";

export function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        marginLeft: 8,
        padding: "2px 10px",
        fontSize: 12,
        cursor: "pointer",
        borderRadius: 4,
        border: "1px solid #aaa",
        backgroundColor: copied ? "#c3e6cb" : "#fff",
        color: copied ? "#155724" : "#333",
        transition: "background-color 0.2s",
      }}
    >
      {copied ? "✅ コピー済み" : "コピー"}
    </button>
  );
}
