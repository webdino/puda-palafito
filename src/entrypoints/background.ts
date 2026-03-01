import { defineBackground } from "wxt/utils/define-background";
import { registerBackgroundListener } from "../message/events";

// import type { BackgroundToContentMessage, ContentToBackgroundMessage } from '../lib/runtime-bridge';

export default defineBackground(() => {
  console.info("Background service worker loaded.");

  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    console.info("Extension installed/updated:", details.reason);
  });

  registerBackgroundListener({
    mainContents(payload) {
      console.info("Received main contents from content script:", payload.title);
    },
  });
});
