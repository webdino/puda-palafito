import { storage } from "@wxt-dev/storage";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">ドメインフィルタ</h2>
        <p className="text-xs text-slate-500 mt-1">
          記録しないサイトのドメインを指定します。サブドメインも含めてマッチします（例:{" "}
          <code className="font-mono bg-slate-100 px-1 rounded">example.com</code> は{" "}
          <code className="font-mono bg-slate-100 px-1 rounded">www.example.com</code> にもマッチ）。
          空の場合はすべてのサイトを記録します。
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        {/* 入力欄 */}
        <div className="flex gap-2 items-start">
          <div className="flex-1">
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
              className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${
                error
                  ? "border-red-400 bg-red-50 focus:border-red-500"
                  : "border-slate-200 focus:border-indigo-400 focus:bg-white"
              } bg-slate-50`}
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shrink-0"
          >
            <Plus size={14} />
            追加
          </button>
        </div>

        {/* ドメインリスト */}
        {domains.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-3 bg-slate-50 rounded-lg border border-slate-100">
            ドメインが登録されていません — すべてのサイトを記録します
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {domains.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100"
              >
                <span className="text-sm font-mono text-slate-700">{domain}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(domain)}
                  aria-label={`${domain} を削除`}
                  className="flex items-center p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
