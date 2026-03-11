/**
 * Google OAuth2 認証ユーティリティ
 */

/**
 * Chrome Identity API を使用して Google OAuth2 の認証トークンを取得します。
 *
 * @param interactive trueの場合、必要に応じてユーザーにログインプロンプトを表示します。
 *                    falseの場合、バックグラウンドでのサイレントトークン取得を試みます。
 * @returns 取得したアクセストークン。取得失敗時は null
 */
export async function getGoogleAuthToken(interactive = true): Promise<string | null> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (tokenInfo: unknown) => {
      if (chrome.runtime.lastError) {
        console.error("Authentication failed:", chrome.runtime.lastError.message);
        if (interactive) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(null);
        }
        return;
      }
      // tokenが文字列のケースとオブジェクトのケースを吸収する（型定義の差異用）
      if (typeof tokenInfo === "string") {
        resolve(tokenInfo);
      } else if (
        tokenInfo &&
        typeof tokenInfo === "object" &&
        "token" in tokenInfo &&
        typeof (tokenInfo as Record<string, unknown>).token === "string"
      ) {
        resolve((tokenInfo as Record<string, unknown>).token as string);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * 現在のトークンを無効化（ログアウト）します。
 *
 * @param token 無効化するトークン
 */
export async function revokeGoogleAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      // サーバー側でもアクセスを破棄する
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
        .then(() => {
          console.info("Token revoked successfully.");
          resolve();
        })
        .catch((e) => {
          console.error("Failed to revoke token API:", e);
          resolve(); // エラーが起きてもキャッシュは消しているのでresolve
        });
    });
  });
}

/**
 * ユーザーが現在ログイン済み（トークンが取得可能）か確認します。
 * UIでの表示切り替え用に使用します。
 */
export async function checkLoginStatus(): Promise<boolean> {
  const token = await getGoogleAuthToken(false);
  return !!token;
}
