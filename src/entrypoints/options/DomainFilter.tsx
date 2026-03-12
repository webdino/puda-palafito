import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { storage } from "@wxt-dev/storage";
import { StorageKeys } from "@/storage";

export function DomainFilter() {
  const [domains, setDomains] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storage
      .getItem<string[]>(StorageKeys.domainFilter)
      .then((saved) => setDomains(saved ?? []));
  }, []);

  async function saveDomains(updated: string[]) {
    setDomains(updated);
    await storage.setItem(StorageKeys.domainFilter, updated);
  }

  function handleAdd() {
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setError("ドメインを入力してください");
      inputRef.current?.focus();
      return;
    }

    // プロトコルが含まれていたら弾く
    if (trimmed.includes("://")) {
      setError('プロトコル（"https://" など）は不要です。ホスト名のみ入力してください');
      inputRef.current?.focus();
      return;
    }

    if (domains.includes(trimmed)) {
      setError("そのドメインはすでに追加されています");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setInputValue("");
    saveDomains([...domains, trimmed]);
  }

  function handleDelete(domain: string) {
    saveDomains(domains.filter((d) => d !== domain));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleAdd();
    }
  }

  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 20, borderBottom: "1px solid #ccc", paddingBottom: 8 }}>
        ドメインフィルタ
      </h2>
      <p style={{ fontSize: 14, color: "#555", marginTop: 0, marginBottom: 16 }}>
        記録するサイトのドメインを指定します。サブドメインも含めてマッチします（例: "example.com"
        は "www.example.com" にもマッチ）。
      </p>

      {/* 入力欄 */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="example.com"
            aria-label="追加するドメイン"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 12px",
              fontSize: 14,
              border: error ? "1px solid #dc3545" : "1px solid #ccc",
              borderRadius: 6,
              outline: "none",
            }}
          />
          {error && (
            <p
              role="alert"
              style={{ margin: "4px 0 0 0", fontSize: 13, color: "#dc3545" }}
            >
              {error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="追加"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: "bold",
            cursor: "pointer",
            borderRadius: 6,
            border: "none",
            backgroundColor: "#0d6efd",
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={16} />
          追加
        </button>
      </div>

      {/* ドメインリスト */}
      {domains.length === 0 ? (
        <p
          style={{
            fontSize: 14,
            color: "#666",
            padding: "12px 16px",
            backgroundColor: "#f4f4f4",
            borderRadius: 6,
            margin: 0,
          }}
        >
          空の場合はすべてのサイトを記録します
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {domains.map((domain) => (
            <li
              key={domain}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                backgroundColor: "#f4f4f4",
                borderRadius: 6,
                fontSize: 14,
                fontFamily: "monospace",
              }}
            >
              <span>{domain}</span>
              <button
                type="button"
                onClick={() => handleDelete(domain)}
                aria-label={`${domain} を削除`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  backgroundColor: "#fff",
                  color: "#888",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
