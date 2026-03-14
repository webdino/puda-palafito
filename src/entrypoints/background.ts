import { storage } from "@wxt-dev/storage";
import { defineBackground } from "wxt/utils/define-background";
import { summarize } from "@/lib/summarizer/summarize";
import { isSummarizerAvailable, isSummarizerSupported } from "@/lib/summarizer/validation";
import { openOptionsTab } from "@/lib/tabs";
import type { SendMainContentsPayload } from "@/message/data";
import { defaultDomainFilter } from "../constants";
import { registerBackgroundListener, registerModelReadyListener } from "../message/events";
import { createSavedContentData, type SavedContentsData, StorageKeys } from "../storage";

// import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../lib/runtime-bridge';

import { uploadJsonToDrive } from "@/lib/drive/api";
import { setActiveIcon, setInactiveIcon } from "@/lib/icon";

async function saveContentData(payload: SendMainContentsPayload) {
  const startTime = Date.now();
  const summarizedText = await summarize(payload.title, payload.text);
  const summarizeTime = Date.now() - startTime;
  console.log(`text summary time: ${summarizeTime}`);

  const updatedList = await saveForLocalStorage(payload, summarizedText);
  if (updatedList) {
    const backupFileName = import.meta.env.WXT_EXPORT_FILE_NAME || "history.json";

    // ユーザーが選択したGoogle DriveのフォルダIDを取得
    const folderId = await storage.getItem<string>(StorageKeys.googleDriveFolderId);

    // フォルダが未設定の場合はバックアップ処理をスキップ
    if (!folderId) {
      console.info("Google Drive backup skipped: Destination folder is not configured.");
      return;
    }

    const fileId = await uploadJsonToDrive(backupFileName, updatedList, folderId);
    if (fileId) {
      console.info("Successfully synced to Google Drive:", fileId);
    } else {
      console.warn("Could not sync to Google Drive. Check authentication.");
    }
  }
}

async function saveForLocalStorage(
  payload: SendMainContentsPayload,
  summarizedText: string,
): Promise<SavedContentsData | null> {
  const saveData = createSavedContentData(payload, summarizedText);
  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);

  const list: SavedContentsData = item ?? [];
  list.unshift(saveData);

  // 一定件を超えたら古いものから削除
  const maxCount = Number(import.meta.env.WXT_SAVED_CONTENTS_MAX_COUNT || 1000);
  if (list.length > maxCount) {
    list.splice(maxCount);
  }

  await storage.setItem(StorageKeys.savedContentsDataKey, list);
  return list;
}

export default defineBackground(() => {
  console.info("Background service worker loaded.");

  // 起動時にモデル準備状態を確認してバッジとパネル動作を初期化
  // openPanelOnActionClick: true  → クリックで直接パネルが開く (onClicked は発火しない)
  // openPanelOnActionClick: false → onClicked が発火 → オプション画面を開く
  if (isSummarizerSupported()) {
    isSummarizerAvailable()
      .then((available) => {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: available });
        if (!available) {
          setInactiveIcon();
        } else {
          setActiveIcon();
        }
      })
      .catch((e) => {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
        setInactiveIcon();
      });
  }

  // Options画面からモデルDL完了通知を受け取ったらパネル動作とバッジを更新
  registerModelReadyListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    setActiveIcon();
  });

  // onClicked はモデル未準備時のみ発火 (openPanelOnActionClick: false の場合)
  chrome.action.onClicked.addListener(() => {
    openOptionsTab();
  });

  chrome.runtime.onInstalled.addListener(async (details: chrome.runtime.InstalledDetails) => {
    console.info("Extension installed/updated:", details.reason);
    const existing = await storage.getItem<string[]>(StorageKeys.domainFilter);
    if (existing === null) {
      await storage.setItem(StorageKeys.domainFilter, defaultDomainFilter);
    }
  });

  registerBackgroundListener({
    mainContents(payload) {
      console.info("Received main contents from content script:", payload.title);
      saveContentData(payload).catch((e) => {
        console.log(e);
      });
    },
  });
});
