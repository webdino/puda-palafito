import { defineContentScript } from "wxt/utils/define-content-script";
import { registerOnPageVisit } from "@/lib/page-visit-detection";
import { isSummarizerAvailable } from "@/lib/summarizer/validation";
import type { SendMainContentsPayload } from "@/message/data";
import { sendMainContentsToBackground } from "@/message/events";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.info("Content script loaded:", window.location.href);

    registerOnPageVisit(async () => {
      const summarizerAvailable = await isSummarizerAvailable();
      // SummarizerAPIが準備できてなければ記録をスキップ
      if (!summarizerAvailable) {
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
