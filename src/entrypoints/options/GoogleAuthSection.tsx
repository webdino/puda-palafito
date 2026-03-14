import { storage } from "@wxt-dev/storage";
import { useEffect, useState } from "react";
import { checkLoginStatus, getGoogleAuthToken, revokeGoogleAuthToken } from "@/lib/auth/google";
import { getOrCreateDriveFolder } from "@/lib/drive/api";
import { notifyDriveFolderIdUpdated } from "@/message/events";
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
      const token = await getGoogleAuthToken(true);
      if (!token) {
        throw new Error("認証トークンが取得できませんでした。");
      }
      const folderId = await getOrCreateDriveFolder(trimmed, token);
      if (folderId) {
        await storage.setItem(StorageKeys.googleDriveFolderId, folderId);
        await storage.setItem(StorageKeys.googleDriveFolderName, trimmed);
        setSavedFolderName(trimmed);
        setInputFolderName("");
        notifyDriveFolderIdUpdated();
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
    notifyDriveFolderIdUpdated();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">Google Drive 連携</h2>
        <p className="text-xs text-slate-500 mt-1">
          要約した履歴を自分のGoogle Driveに自動バックアップするために連携してください。
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        {errorMsg && (
          <p role="alert" className="text-xs text-red-600">
            <strong>エラー:</strong> {errorMsg}
          </p>
        )}

        {isProcessing ? (
          <button
            type="button"
            disabled
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 opacity-60 cursor-not-allowed"
          >
            状態を確認中...
          </button>
        ) : isLoggedIn ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-emerald-600">連携済み</span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
              >
                ログアウト
              </button>
            </div>

            <div className="px-4 py-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-800">保存先フォルダ</h3>
              <p className="text-xs text-slate-500">
                指定した名前のフォルダをGoogle Drive直下に作成し、その中に保存します。
                <br />
                未設定の場合はアップロードが行われません。
              </p>

              {savedFolderName ? (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-semibold text-slate-700">📁 {savedFolderName}</span>
                  <button
                    type="button"
                    onClick={handleClearFolder}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-600 transition-colors"
                  >
                    解除する
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-start mt-1">
                  <div className="flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="例: Puda Palafito"
                      value={inputFolderName}
                      onChange={(e) => setInputFolderName(e.target.value)}
                      disabled={isSettingFolder}
                      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors bg-slate-50 ${
                        errorMsg
                          ? "border-red-400 bg-red-50 focus:border-red-500"
                          : "border-slate-200 focus:border-indigo-400 focus:bg-white"
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSetFolder}
                    disabled={isSettingFolder || !inputFolderName.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm self-start"
          >
            Google アカウントでログイン
          </button>
        )}
      </div>
    </div>
  );
}
