import { type Browser, browser } from "wxt/browser";
import { constants } from "@/constants";

export async function getOpenedOptionsTab() {
  const optionUrl = chrome.runtime.getURL(constants.optionPagePath);
  const tabs = await browser.tabs.query({ url: optionUrl });
  return tabs;
}

export function createOptionsTab() {
  const optionUrl = chrome.runtime.getURL(constants.optionPagePath);
  browser.tabs.create({ url: optionUrl });
}

export function openTab(tab: Browser.tabs.Tab) {
  browser.tabs.update(tab.id, { active: true });
}
