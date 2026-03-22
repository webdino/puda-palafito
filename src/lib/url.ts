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

export function isSensitivePath(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
  } catch {
    return false;
  }
}
