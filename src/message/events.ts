import { defineExtensionMessaging } from "@webext-core/messaging";
import {
  ContentToBackgroundMessageKeys,
  type ContentToBackgroundProtocolMap,
  OptionsToBackgroundMessageKeys,
  type OptionsToBackgroundProtocolMap,
  type PageVisitedPayload,
} from "./data";

const { sendMessage: contentToBackgroundSender, onMessage: contentToBackgroundListener } =
  defineExtensionMessaging<ContentToBackgroundProtocolMap>();

const { sendMessage: optionsToBackgroundSender, onMessage: optionsToBackgroundListener } =
  defineExtensionMessaging<OptionsToBackgroundProtocolMap>();

export function sendPageVisited(payload: PageVisitedPayload) {
  contentToBackgroundSender(ContentToBackgroundMessageKeys.pageVisited, payload);
}

export function registerContentToBackgroundListener(callback: ContentToBackgroundProtocolMap) {
  contentToBackgroundListener(ContentToBackgroundMessageKeys.pageVisited, ({ data }) => {
    callback.pageVisited(data);
  });
}

export function notifyModelReady() {
  optionsToBackgroundSender(OptionsToBackgroundMessageKeys.modelReady, undefined);
}

export function registerOptionsToBackgroundListener(callback: OptionsToBackgroundProtocolMap) {
  optionsToBackgroundListener(OptionsToBackgroundMessageKeys.modelReady, () => {
    callback.modelReady();
  });
}
