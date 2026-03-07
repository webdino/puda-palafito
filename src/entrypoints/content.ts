import { Readability } from "@mozilla/readability";
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
      // ReadabilityはDOMを破壊的に変更する可能性があるため、cloneしてからパースする
      const documentClone = document.cloneNode(true) as Document;
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article) {
        const renderedText = document.body.innerText;
        const mainContent: SendMainContentsPayload = {
          title: article.title ?? "",
          url: window.location.href,
          text: article.textContent ?? "",
          renderedText,
          createdAt: Date.now(),
        };

        sendMainContentsToBackground(mainContent);

        console.info("Extracted main contents:", article.title);
        console.log(article.textContent);
        console.log("Rendered text:", renderedText);
      } else {
        console.warn("Failed to extract main content from this page.");
      }
    });
  },
});
