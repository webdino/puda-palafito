import { storage } from "@wxt-dev/storage";
import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { createSummarizer } from "@/lib/summarizer/create";
import { fitsInQuota, isSummarizerAvailable } from "@/lib/summarizer/validation";
import { createOptionsTab, getOpenedOptionsTab, openTab } from "@/lib/tabs";
import type { SendMainContentsPayload } from "@/message/data";
import { registerBackgroundListener, registerModelReadyListener } from "../message/events";
import {
  createSavedContentData,
  DebugStorageKeys,
  type SavedContentsData,
  StorageKeys,
  type SummarizedPerformance,
  type SummarizedPerformanceData,
} from "../storage";

// import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../lib/runtime-bridge';

async function saveContentData(payload: SendMainContentsPayload) {
  const summarizer = await createSummarizer();

  const startTime = Date.now();
  let summarizedText: string = "";

  // 要約の文字数制限をチェック
  const fit = await fitsInQuota(summarizer, payload.text);
  if (fit) {
    try {
      summarizedText = await summarizer.summarize(payload.text);
    } catch (e) {
      console.error(e);
    }
  }

  const summarizeTime = Date.now() - startTime;
  console.log(`text summary time: ${summarizeTime}`);

  const summarizePerformanceData: SummarizedPerformance = {
    url: payload.url,
    text: payload.text,
    summarizedText: summarizedText,
    summarizeTime: summarizeTime,
    summarizeSuccess: Boolean(summarizedText),
  };

  await saveForLocalStorage(payload);
  await saveDebugSummarizedData(summarizePerformanceData);
}

async function saveForLocalStorage(payload: SendMainContentsPayload) {
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

  let modelReady = false;

  // 起動時にモデル準備状態を確認してバッジを初期化
  if ("Summarizer" in self) {
    isSummarizerAvailable()
      .then((available) => {
        modelReady = available;
        if (!available) {
          chrome.action.setBadgeText({ text: "!" });
          chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
        }
      })
      .catch(() => {
        modelReady = false;
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
      });
  }

  // Options画面からモデルDL完了通知を受け取ったらバッジを削除
  registerModelReadyListener(() => {
    modelReady = true;
    chrome.action.setBadgeText({ text: "" });
  });

  // アイコンクリック時: モデル準備済みならサイドパネル、未準備ならオプション画面を開く
  chrome.action.onClicked.addListener(async (tab) => {
    if (modelReady) {
      if (tab.windowId) {
        chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } else {
      const tabs = await getOpenedOptionsTab();
      if (tabs.length > 0) {
        openTab(tabs[0]);
      } else {
        createOptionsTab();
      }
    }
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

async function saveDebugSummarizedData(data: SummarizedPerformance) {
  const item = await storage.getItem<SummarizedPerformanceData>(
    DebugStorageKeys.summarizedResultKey,
  );

  const list: SummarizedPerformanceData = item ?? [];
  list.unshift(data);

  // 一定件を超えたら古いものから削除
  const maxCount = Number(import.meta.env.WXT_SAVED_CONTENTS_MAX_COUNT || 1000);
  if (list.length > maxCount) {
    list.splice(maxCount);
  }

  await storage.setItem(DebugStorageKeys.summarizedResultKey, list);
}
