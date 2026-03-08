import { defineExtensionMessaging } from "@webext-core/messaging";
import {
  ContentToBackgroundMessageKeys,
  type ContentToBackgroundProtocolMap,
  OptionsToBackgroundMessageKeys,
  type OptionsToBackgroundProtocolMap,
  type SendMainContentsPayload,
} from "./data";

const { sendMessage: backgroundSender, onMessage: backgroundListener } =
  defineExtensionMessaging<ContentToBackgroundProtocolMap>();

const { sendMessage: optionsSender, onMessage: optionsListener } =
  defineExtensionMessaging<OptionsToBackgroundProtocolMap>();

export function sendMainContentsToBackground(payload: SendMainContentsPayload) {
  backgroundSender(ContentToBackgroundMessageKeys.mainContents, payload);
}

export function registerBackgroundListener(callback: ContentToBackgroundProtocolMap) {
  backgroundListener(ContentToBackgroundMessageKeys.mainContents, ({ data }) => {
    callback.mainContents(data);
  });
}

export function notifyModelReady() {
  optionsSender(OptionsToBackgroundMessageKeys.modelReady, undefined);
}

export function registerModelReadyListener(callback: () => void) {
  optionsListener(OptionsToBackgroundMessageKeys.modelReady, () => {
    callback();
  });
}
