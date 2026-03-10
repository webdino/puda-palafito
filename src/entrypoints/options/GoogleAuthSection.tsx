import { useEffect, useState } from "react";
import { checkLoginStatus, getGoogleAuthToken, revokeGoogleAuthToken } from "@/lib/auth/google";

export function GoogleAuthSection() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);

  useEffect(() => {
    checkLoginStatus().then((status) => {
      setIsLoggedIn(status);
      setIsProcessing(false);
    });
  }, []);

  const handleLogin = async () => {
    setIsProcessing(true);
    const token = await getGoogleAuthToken(true);
    setIsLoggedIn(!!token);
    setIsProcessing(false);
  };

  const handleLogout = async () => {
    setIsProcessing(true);
    const token = await getGoogleAuthToken(false);
    if (token) {
      await revokeGoogleAuthToken(token);
    }
    setIsLoggedIn(false);
    setIsProcessing(false);
  };

  return (
    <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Google Drive 連携</h2>
      <p style={{ fontSize: 14, color: "#666" }}>
        要約した履歴を自分のGoogle Driveに自動バックアップするために連携してください。
      </p>

      {isProcessing ? (
        <button disabled style={{ padding: "8px 16px" }}>
          状態を確認中...
        </button>
      ) : isLoggedIn ? (
        <div>
          <span style={{ color: "green", fontWeight: "bold", marginRight: 16 }}>連携済み</span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              backgroundColor: "#f8f9fa",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          >
            ログアウト
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLogin}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            backgroundColor: "#4285f4",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          Google アカウントでログイン
        </button>
      )}
    </div>
  );
}
