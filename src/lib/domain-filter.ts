/**
 * ドメインフィルタのマッチング
 * - domains が空配列の場合は全ドメインを対象とする（フィルタなし）
 * - 非空の場合は domains のいずれかにマッチするURLのみ対象とする（allowlist）
 * - サブドメインも含めてマッチする（例: "example.com" は "www.example.com" にもマッチ）
 */
export function matchesDomainFilter(url: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  try {
    const hostname = new URL(url).hostname;
    return domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
