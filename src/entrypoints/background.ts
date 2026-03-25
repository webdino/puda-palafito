import { storage } from "@wxt-dev/storage";
import { defineBackground } from "wxt/utils/define-background";
import { uploadJsonToDrive, ensureDriveRotationFiles } from "@/lib/drive/api";
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
import { getRotationConfig } from "@/lib/config";

async function saveContentData(payload: PageVisitedPayload) {
  const startTime = Date.now();
  const summarizedText = await summarize(payload.title, payload.text);
  const summarizeTime = Date.now() - startTime;
  console.log(`text summary time: ${summarizeTime}`);

  const result = await saveForLocalStorage(payload, summarizedText);
  if (result && result.updatedList.length > 0) {
    await syncListToDrive(result.updatedList, result.modifiedIndices);
  }
}

async function syncListToDrive(list: SavedContentsData, targetIndices?: number[]) {
  const folderId = await storage.getItem<string>(StorageKeys.googleDriveFolderId);
  if (!folderId) {
    console.info("Google Drive backup skipped: Destination folder is not configured.");
    return;
  }

  const baseName = import.meta.env.WXT_EXPORT_FILE_NAME || "history.json";
  const baseFileName = baseName.replace(/\.json$/i, "");
  
  const { maxFiles } = getRotationConfig();
  let rawIndices = targetIndices && targetIndices.length > 0
    ? targetIndices
    : list.map((item) => item.driveFileIndex || 1);

  if (rawIndices.length === 0) {
    rawIndices = [1];
  }

  const indicesToSync = Array.from(new Set(
    rawIndices.map((i) => {
      if (i < 1 || i > maxFiles || !Number.isFinite(i)) return 1;
      return i;
    })
  ));

  // リストを1回走査し、インデックスごとのバケットを作成 (計算量を O(n*m) から O(n+m) に最適化)
  const bucketMap = new Map<number, SavedContentsData>();
  for (const item of list) {
    const idx = item.driveFileIndex || 1;
    let bucket = bucketMap.get(idx);
    if (!bucket) {
      bucket = [];
      bucketMap.set(idx, bucket);
    }
    bucket.push(item);
  }

  for (const index of indicesToSync) {
    const backupFileName = `${baseFileName}_${index}.json`;
    const bucketItems = bucketMap.get(index) || [];
    
    const sanitizedList = bucketItems.map((item) => ({
      ...item,
      url: stripQueryParams(item.url),
    }));

    const fileId = await uploadJsonToDrive(backupFileName, sanitizedList, folderId);
    if (fileId) {
      console.info(`Successfully synced to Google Drive [${backupFileName}]:`, fileId);
    } else {
      console.warn(`Could not sync to Google Drive [${backupFileName}]. Check authentication.`);
    }
  }
}

async function saveForLocalStorage(
  payload: PageVisitedPayload,
  summarizedText: string,
): Promise<{ updatedList: SavedContentsData; modifiedIndices: number[] } | null> {
  const saveData = createSavedContentData(payload, summarizedText);
  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);
  const list: SavedContentsData = item ?? [];

  const { maxFiles, recordLimit } = getRotationConfig();

  const storedIndex = await storage.getItem<number>(StorageKeys.driveRotationIndex);
  let currentFileIndex = storedIndex ?? 1;
  if (!Number.isInteger(currentFileIndex) || currentFileIndex < 1 || currentFileIndex > maxFiles) {
    currentFileIndex = 1;
  }

  const currentBucketCount = list.filter((x) => (x.driveFileIndex || 1) === currentFileIndex).length;

  const modifiedIndices = new Set<number>();

  if (currentBucketCount >= recordLimit) {
    currentFileIndex = (currentFileIndex % maxFiles) + 1;
    for (let i = list.length - 1; i >= 0; i--) {
      if ((list[i].driveFileIndex || 1) === currentFileIndex) {
        list.splice(i, 1);
      }
    }
  }

  saveData.driveFileIndex = currentFileIndex;
  list.unshift(saveData);
  modifiedIndices.add(currentFileIndex);

  const bucketCounts = new Map<number, number>();
  for (let i = 0; i < list.length; i++) {
    const idx = list[i].driveFileIndex || 1;
    if (idx < 1 || idx > maxFiles) {
      list.splice(i, 1);
      i--;
      continue;
    }
    const currentCount = bucketCounts.get(idx) || 0;
    if (currentCount >= recordLimit) {
      list.splice(i, 1);
      i--;
      modifiedIndices.add(idx);
    } else {
      bucketCounts.set(idx, currentCount + 1);
    }
  }

  await storage.setItem(StorageKeys.driveRotationIndex, currentFileIndex);
  await storage.setItem(StorageKeys.savedContentsDataKey, list);
  return { updatedList: list, modifiedIndices: Array.from(modifiedIndices) };
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

async function deleteSavedItem(id: string) {
  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);
  const list: SavedContentsData = item ?? [];
  
  const targetEntry = list.find((entry) => entry.id === id);
  if (!targetEntry) return;

  const targetIndex = targetEntry.driveFileIndex || 1;
  const filteredList = list.filter((entry) => entry.id !== id);
  
  await storage.setItem(StorageKeys.savedContentsDataKey, filteredList);
  await syncListToDrive(filteredList, [targetIndex]);
}

async function deleteAllSavedItems() {
  await storage.setItem(StorageKeys.savedContentsDataKey, []);
  await storage.setItem(StorageKeys.driveRotationIndex, 1);
  
  const folderId = await storage.getItem<string>(StorageKeys.googleDriveFolderId);
  if (folderId) {
    const { maxFiles } = getRotationConfig();
    const baseName = import.meta.env.WXT_EXPORT_FILE_NAME || "history.json";
    const baseFileName = baseName.replace(/\.json$/i, "");
    for (let i = 1; i <= maxFiles; i++) {
       await uploadJsonToDrive(`${baseFileName}_${i}.json`, [], folderId);
    }
  }
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
    async driveFolderIdUpdated() {
      updateIconStatus();
      try {
        const folderId = await storage.getItem<string>(StorageKeys.googleDriveFolderId);
        if (!folderId) return;

        await ensureDriveRotationFiles(folderId);
        const list = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);
        await syncListToDrive(list ?? []);
      } catch (e) {
        console.error("Exception during driveFolderIdUpdated flow:", e);
      }
    },
    deleteItem(id) {
      deleteSavedItem(id).catch((e) => {
        console.error("Failed to delete item:", e);
      });
    },
    deleteAllItems() {
      deleteAllSavedItems().catch((e) => {
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
