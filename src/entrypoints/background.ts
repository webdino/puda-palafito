import { storage } from "@wxt-dev/storage";
import { defineBackground } from "wxt/utils/define-background";
import type { SendMainContentsPayload } from "@/message/data";
import { registerBackgroundListener, registerModelReadyListener } from "../message/events";
import { createSavedContentData, type SavedContentsData, StorageKeys } from "../storage";

// import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../lib/runtime-bridge';

async function saveContentData(payload: SendMainContentsPayload) {
  const saveData = createSavedContentData(payload);
  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);

  const list: SavedContentsData = item ?? [];
  list.unshift(saveData);

  // 一定件を超えたら古いものから削除
  const maxCount = Number(import.meta.env.WXT_SAVED_CONTENTS_MAX_COUNT || 1000);
  if (list.length > maxCount) {
    list.splice(maxCount);
  }

  await storage.setItem(StorageKeys.savedContentsDataKey, list);
}

export default defineBackground(() => {
  console.info("Background service worker loaded.");

  // モデルが未ダウンロードであることを示すバッジを表示
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });

  // Options画面からモデルDL完了通知を受け取ったらバッジを削除
  registerModelReadyListener(() => {
    chrome.action.setBadgeText({ text: "" });
  });

  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    console.info("Extension installed/updated:", details.reason);
  });

  registerBackgroundListener({
    mainContents(payload) {
      console.info("Received main contents from content script:", payload.title);
      saveContentData(payload);
    },
  });
});
