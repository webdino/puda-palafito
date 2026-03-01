import { Readability } from '@mozilla/readability';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { registerOnPageVisit } from '@/lib/page-visit-detection';
import { sendMainContentsToBackground } from '@/message/events';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.info('Content script loaded:', window.location.href);

    registerOnPageVisit(async () => {
      // ReadabilityはDOMを破壊的に変更する可能性があるため、cloneしてからパースする
      const documentClone = document.cloneNode(true) as Document;
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article) {
        sendMainContentsToBackground({
          title: article.title ?? '',
          url: window.location.href,
          text: article.textContent ?? '',
        });
        console.info('Extracted main contents:', article.title);
        console.log(article.textContent);
      } else {
        console.warn('Failed to extract main content from this page.');
      }
    });
  },
});
