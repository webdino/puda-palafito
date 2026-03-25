import { storage } from "@wxt-dev/storage";
import { defineContentScript } from "wxt/utils/define-content-script";
import { registerOnPageVisit } from "@/lib/page-visit-detection";
import { getEnabledSensitiveInfoTypes, maskSensitiveInfo } from "@/lib/sensitiveInfo";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import { isAvailableUrl } from "@/lib/url";
import type { PageVisitedPayload } from "@/message/data";
import { sendPageVisited } from "@/message/events";
import { StorageKeys } from "@/storage";

// 拡張機能の設定が記録可能な状態かを返す
async function isRecordingAvailable() {
  const summarizerAvailable = await isSummarizerAvailable();
  const recordingEnabled = (await storage.getItem<boolean>(StorageKeys.recordingEnabled)) ?? true;
  return summarizerAvailable && recordingEnabled;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.info("Content script loaded:", window.location.href);

    registerOnPageVisit(async () => {
      if (!(await isRecordingAvailable())) {
        return;
      }

      // 録画をしてよいURLか判定する
      if (!(await isAvailableUrl(window.location.href))) {
        return;
      }

      const enabledSensitiveInfoTypes = await getEnabledSensitiveInfoTypes();

      const title = document.title;
      const renderedText = document.body.innerText;
      const maskedText = maskSensitiveInfo(renderedText, enabledSensitiveInfoTypes);
      const mainContent: PageVisitedPayload = {
        title: maskSensitiveInfo(title, enabledSensitiveInfoTypes),
        url: window.location.href,
        text: maskedText,
        createdAt: Date.now(),
      };

      sendPageVisited(mainContent);
    });
  },
});
