import { defineExtensionMessaging } from "@webext-core/messaging";
import {
  ContentToBackgroundMessageKeys,
  type ContentToBackgroundProtocolMap,
  type SendMainContentsPayload,
} from "./data";

const { sendMessage: backgroundSender, onMessage: backgroundListener } =
  defineExtensionMessaging<ContentToBackgroundProtocolMap>();

export function sendMainContentsToBackground(payload: SendMainContentsPayload) {
  backgroundSender(ContentToBackgroundMessageKeys.mainContents, payload);
}

export function registerBackgroundListener(callback: ContentToBackgroundProtocolMap) {
  backgroundListener(ContentToBackgroundMessageKeys.mainContents, ({ data }) => {
    callback.mainContents(data);
  });
}
