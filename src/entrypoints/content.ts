import { storage } from "@wxt-dev/storage";
import { defineContentScript } from "wxt/utils/define-content-script";
import { isAllowedByDomainFilter } from "@/lib/domain-filter";
import { registerOnPageVisit } from "@/lib/page-visit-detection";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import type { SendMainContentsPayload } from "@/message/data";
import { sendMainContentsToBackground } from "@/message/events";
import { StorageKeys } from "@/storage";

// 拡張機能の設定が記録可能な状態かを返す
async function isRecordingAvailable() {
  const summarizerAvailable = await isSummarizerAvailable();
  const recordingEnabled = await storage.getItem<boolean>(StorageKeys.recordingEnabled);
  const driveFolderId = await storage.getItem<string>(StorageKeys.googleDriveFolderId);

  return summarizerAvailable && recordingEnabled && driveFolderId;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.info("Content script loaded:", window.location.href);

    registerOnPageVisit(async () => {
      if (!isRecordingAvailable()) {
        return;
      }

      const domainFilter = (await storage.getItem<string[]>(StorageKeys.domainFilter)) ?? [];
      // ドメインフィルタに一致しなければスキップ
      if (!isAllowedByDomainFilter(window.location.href, domainFilter)) {
        return;
      }

      const title = document.title;
      const renderedText = document.body.innerText;
      const mainContent: SendMainContentsPayload = {
        title: title ?? "",
        url: window.location.href,
        text: renderedText,
        createdAt: Date.now(),
      };

      sendMainContentsToBackground(mainContent);
    });
  },
});
