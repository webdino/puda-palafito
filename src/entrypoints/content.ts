import { Readability } from "@mozilla/readability";
import { storage } from "@wxt-dev/storage";
import { defineContentScript } from "wxt/utils/define-content-script";
import { registerOnPageVisit } from "@/lib/page-visit-detection";
import type { SendMainContentsPayload } from "@/message/data";
import { sendMainContentsToBackground } from "@/message/events";
import { createSavedContentData, type SavedContentsData, StorageKeys } from "@/storage";

// Storageに保存する
async function saveContentData(mainContent: SendMainContentsPayload) {
  const saveData = createSavedContentData(mainContent);

  const item = await storage.getItem<SavedContentsData>(StorageKeys.savedContentsDataKey);
  if (item) {
    item.unshift(saveData);

    // 一定件を超えたら古いものから削除
    const maxCount = Number(import.meta.env.WXT_SAVED_CONTENTS_MAX_COUNT || 1000);
    if (item.length > maxCount) {
      item.splice(maxCount);
    }

    await storage.setItem(StorageKeys.savedContentsDataKey, item);
  } else {
    const newData: SavedContentsData = [];
    newData.push(saveData);
    await storage.setItem(StorageKeys.savedContentsDataKey, newData);
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.info("Content script loaded:", window.location.href);

    registerOnPageVisit(async () => {
      // ReadabilityはDOMを破壊的に変更する可能性があるため、cloneしてからパースする
      const documentClone = document.cloneNode(true) as Document;
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article) {
        const mainContent: SendMainContentsPayload = {
          title: article.title ?? "",
          url: window.location.href,
          text: article.textContent ?? "",
          createdAt: Date.now(),
        };

        sendMainContentsToBackground(mainContent);

        await saveContentData(mainContent);

        console.info("Extracted main contents:", article.title);
        console.log(article.textContent);
      } else {
        console.warn("Failed to extract main content from this page.");
      }
    });
  },
});
