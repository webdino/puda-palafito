import { defineBackground } from "wxt/utils/define-background";
import { registerBackgroundListener, registerModelReadyListener } from "../message/events";

// import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../lib/runtime-bridge';

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
    },
  });
});
