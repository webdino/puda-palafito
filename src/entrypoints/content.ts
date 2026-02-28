import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMainContentsToBackground } from '../message/events';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.info('Content script loaded:', window.location.href);

    sendMainContentsToBackground({ text: 'hello world' });
  },
});
