import { type Browser, browser } from "wxt/browser";
import { constants } from "@/constants";

async function getOpenedOptionsTab() {
  const optionUrl = chrome.runtime.getURL(constants.optionPagePath);
  const tabs = await browser.tabs.query({ url: optionUrl });
  return tabs;
}

function createOptionsTab() {
  const optionUrl = chrome.runtime.getURL(constants.optionPagePath);
  return browser.tabs.create({ url: optionUrl });
}

export function openTab(tab: Browser.tabs.Tab) {
  if (tab.id === undefined) return;
  browser.tabs.update(tab.id, { active: true });
}

export async function openOptionsTab() {
  const tabs = await getOpenedOptionsTab();
  if (tabs.length > 0) {
    openTab(tabs[0]);
    return;
  }
  createOptionsTab().catch((e) => {
    console.log(e);
  });
}
