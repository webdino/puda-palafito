/**
 * ドメインフィルタのマッチング
 * - domains が空配列の場合は全ドメインを記録する（フィルタなし）
 * - 非空の場合は domains のいずれかにマッチするURLは記録しない（denylist）
 * - サブドメインも含めてマッチする（例: "example.com" は "www.example.com" にもマッチ）
 */
export function matchesDomainFilter(url: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  try {
    const hostname = new URL(url).hostname;
    const isDenied = domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    return !isDenied;
  } catch {
    return false;
  }
}
