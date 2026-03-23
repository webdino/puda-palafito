import { storage } from "@wxt-dev/storage";
import { StorageKeys } from "@/storage";

export function stripQueryParams(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

const SENSITIVE_PATH_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/register/i,
  /\/password/i,
  /\/checkout/i,
  /\/payment/i,
  /\/account\/security/i,
];

function isSensitivePath(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
  } catch {
    return false;
  }
}

/**
 * ドメインフィルタのマッチング
 * - domains が空配列の場合は全ドメインを記録する（フィルタなし）
 * - 非空の場合は domains のいずれかにマッチするURLは記録しない（denylist）
 * - サブドメインも含めてマッチする（例: "example.com" は "www.example.com" にもマッチ）
 */
function isAllowedByDomainFilter(url: string, domains: string[]): boolean {
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

/**
 * 録画をしてよいURLか判定する
 * @param url 検証対象のURL
 * @returns 録画をしてよい場合はtrue、そうでない場合はfalse
 */
export async function isAvailableUrl(url: string): Promise<boolean> {
  const domainFilter = (await storage.getItem<string[]>(StorageKeys.domainFilter)) ?? [];
  return !isSensitivePath(url) && isAllowedByDomainFilter(url, domainFilter);
}
