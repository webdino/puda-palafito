import { storage } from "@wxt-dev/storage";
import { useEffect, useState } from "react";
import { checkLoginStatus, getGoogleAuthToken, revokeGoogleAuthToken } from "@/lib/auth/google";
import { getOrCreateDriveFolder } from "@/lib/drive/api";
import { StorageKeys } from "@/storage";

export function GoogleAuthSection() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [savedFolderName, setSavedFolderName] = useState<string | null>(null);
  const [inputFolderName, setInputFolderName] = useState<string>("Puda Palafito");
  const [isSettingFolder, setIsSettingFolder] = useState<boolean>(false);

  useEffect(() => {
    checkLoginStatus().then((status) => {
      setIsLoggedIn(status);
      setIsProcessing(false);
    });

    storage.getItem<string>(StorageKeys.googleDriveFolderName).then((name) => {
      setSavedFolderName(name ?? null);
    });
  }, []);

  const handleLogin = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const token = await getGoogleAuthToken(true);
      setIsLoggedIn(!!token);
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Failed to login");
    } finally {
      setIsProcessing(false);
    }
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

  const handleSetFolder = async () => {
    const trimmed = inputFolderName.trim();
    if (!trimmed) {
      setErrorMsg("フォルダ名を入力してください");
      return;
    }

    setIsSettingFolder(true);
    setErrorMsg(null);
    try {
      const folderId = await getOrCreateDriveFolder(trimmed);
      if (folderId) {
        await storage.setItem(StorageKeys.googleDriveFolderId, folderId);
        await storage.setItem(StorageKeys.googleDriveFolderName, trimmed);
        setSavedFolderName(trimmed);
        setInputFolderName("");
      } else {
        setErrorMsg("フォルダの設定に失敗しました");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Failed to set folder");
    } finally {
      setIsSettingFolder(false);
    }
  };

  const handleClearFolder = async () => {
    await storage.removeItem(StorageKeys.googleDriveFolderId);
    await storage.removeItem(StorageKeys.googleDriveFolderName);
    setSavedFolderName(null);
  };

  return (
    <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Google Drive 連携</h2>
      <p style={{ fontSize: 14, color: "#666" }}>
        要約した履歴を自分のGoogle Driveに自動バックアップするために連携してください。
      </p>

      {errorMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: "8px 12px",
            backgroundColor: "#fde8e8",
            color: "#c81e1e",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          <strong>認証エラー:</strong> {errorMsg}
        </div>
      )}

      {isProcessing ? (
        <button type="button" disabled style={{ padding: "8px 16px" }}>
          状態を確認中...
        </button>
      ) : isLoggedIn ? (
        <div>
          <div style={{ marginBottom: 16 }}>
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

          <div
            style={{
              padding: 16,
              backgroundColor: "#f9f9f9",
              borderRadius: 4,
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 8 }}>保存先フォルダ</h3>
            <p style={{ fontSize: 13, color: "#666", marginTop: 0, marginBottom: 12 }}>
              指定した名前のフォルダをGoogle Drive直下に作成し、その中に保存します。
              <br />
              未設定の場合はマイドライブ直下にそのまま保存されます。
            </p>

            {savedFolderName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: "bold" }}>📁 {savedFolderName}</span>
                <button
                  type="button"
                  onClick={handleClearFolder}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    color: "#dc3545",
                    backgroundColor: "#fff",
                    border: "1px solid #dc3545",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  解除する
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="例: Puda Palafito"
                  value={inputFolderName}
                  onChange={(e) => setInputFolderName(e.target.value)}
                  disabled={isSettingFolder}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 4,
                    flex: 1,
                    maxWidth: 240,
                  }}
                />
                <button
                  type="button"
                  onClick={handleSetFolder}
                  disabled={isSettingFolder || !inputFolderName.trim()}
                  style={{
                    padding: "6px 16px",
                    cursor: isSettingFolder || !inputFolderName.trim() ? "not-allowed" : "pointer",
                    backgroundColor:
                      isSettingFolder || !inputFolderName.trim() ? "#ccc" : "#0d6efd",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                  }}
                >
                  {isSettingFolder ? "設定中..." : "設定する"}
                </button>
              </div>
            )}
          </div>
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
