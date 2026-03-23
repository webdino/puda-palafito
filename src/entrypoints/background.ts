import { storage } from "@wxt-dev/storage";
import { defineBackground } from "wxt/utils/define-background";
import { uploadJsonToDrive } from "@/lib/drive/api";
import { setActiveIcon, setInactiveIcon } from "@/lib/icon";
import { summarize } from "@/lib/summarizer/summarize";
import { isSummarizerAvailable, isSummarizerSupported } from "@/lib/summarizer/validation";
import { openOptionsTab } from "@/lib/tabs";
import { stripQueryParams } from "@/lib/url";
import type { PageVisitedPayload } from "@/message/data";
import { defaultDomainFilter } from "../constants";
import {
  registerContentToBackgroundListener,
  registerOptionsToBackgroundListener,
} from "../message/events";
import { createSavedContentData, type SavedContentsData, StorageKeys } from "../storage";

async function saveContentData(payload: PageVisitedPayload) {
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

    const sanitizedList = updatedList.map((item) => ({
      ...item,
      url: stripQueryParams(item.url),
    }));
    const fileId = await uploadJsonToDrive(backupFileName, sanitizedList, folderId);
    if (fileId) {
      console.info("Successfully synced to Google Drive:", fileId);
    } else {
      console.warn("Could not sync to Google Drive. Check authentication.");
    }
  }
}

async function saveForLocalStorage(
  payload: PageVisitedPayload,
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

async function updateIconStatus() {
  try {
    let available = false;
    if (isSummarizerSupported()) {
      available = await isSummarizerAvailable();
    }

    const recordingEnabled = (await storage.getItem<boolean>(StorageKeys.recordingEnabled)) ?? true;

    if (available && recordingEnabled) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      setActiveIcon();
    } else {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      setInactiveIcon();
    }
  } catch (_e) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    setInactiveIcon();
  }
}

async function deleteItem(id: string) {
  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);
  const list: SavedContentsData = item ?? [];
  const filteredList = list.filter((entry) => entry.id !== id);
  await storage.setItem(StorageKeys.savedContentsDataKey, filteredList);

  // TODO: Google Drive上のファイルも削除する
}

async function deleteAllItems() {
  await storage.setItem(StorageKeys.savedContentsDataKey, []);
  // TODO: Google Drive上のファイルも削除する
}

export default defineBackground(() => {
  console.info("Background service worker loaded.");

  // 起動時にモデル準備状態を確認してバッジとパネル動作を初期化
  // openPanelOnActionClick: true  → クリックで直接パネルが開く (onClicked は発火しない)
  // openPanelOnActionClick: false → onClicked が発火 → オプション画面を開く
  updateIconStatus();

  // Options画面からモデルDL完了通知を受け取ったらパネル動作とバッジを更新
  registerOptionsToBackgroundListener({
    modelReady() {
      updateIconStatus();
    },
    driveFolderIdUpdated() {
      updateIconStatus();
    },
    deleteItem(id) {
      deleteItem(id).catch((e) => {
        console.error("Failed to delete item:", e);
      });
    },
    deleteAllItems() {
      deleteAllItems().catch((e) => {
        console.error("Failed to delete all items:", e);
      });
    },
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

  registerContentToBackgroundListener({
    pageVisited(payload) {
      console.info("Received page visit from content script:", payload.title);
      saveContentData(payload).catch((e) => {
        console.log(e);
      });
    },
  });
});
