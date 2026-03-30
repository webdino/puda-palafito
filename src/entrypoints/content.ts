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

      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      for (const el of Array.from(
        bodyClone.querySelectorAll('script, style, noscript, [hidden], [aria-hidden="true"]'),
      )) {
        el.remove();
      }
      for (const el of Array.from(bodyClone.querySelectorAll<HTMLInputElement>("input"))) {
        el.value = "";
      }
      for (const el of Array.from(bodyClone.querySelectorAll<HTMLTextAreaElement>("textarea"))) {
        el.textContent = "";
      }
      for (const el of Array.from(bodyClone.querySelectorAll<HTMLElement>("[contenteditable]"))) {
        el.textContent = "";
      }

      const enabledSensitiveInfoTypes = await getEnabledSensitiveInfoTypes();

      const title = document.title;
      const pageText = bodyClone.textContent ?? "";
      const maskedText = maskSensitiveInfo(pageText, enabledSensitiveInfoTypes);
      // SNSで共有されるdescriptionを取得する
      const ogDesc = document.querySelector<HTMLMetaElement>(
        'meta[property="og:description"]',
      )?.content;
      // 一般的なdescriptionを取得する
      const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
      // SNS向けのdescriptionがあればそれを優先する
      const description = ogDesc || metaDesc || "";
      const mainContent: PageVisitedPayload = {
        title: maskSensitiveInfo(title, enabledSensitiveInfoTypes),
        url: window.location.href,
        text: maskedText,
        description,
        createdAt: Date.now(),
      };

      sendPageVisited(mainContent);
    });
  },
});
