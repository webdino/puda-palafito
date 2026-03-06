export type SendMainContentsPayload = {
  title: string;
  url: string;
  text: string;
  createdAt: number;
};

// content.tsからbackground.tsへのメッセージの型定義
export interface ContentToBackgroundProtocolMap {
  mainContents: (payload: SendMainContentsPayload) => void;
}
type ContentToBackgroundProtocolKeys = keyof ContentToBackgroundProtocolMap;

export const ContentToBackgroundMessageKeys = {
  mainContents: "mainContents",
} as const satisfies Record<string, ContentToBackgroundProtocolKeys>;

// options/UIからbackground.tsへのメッセージの型定義
export interface OptionsToBackgroundProtocolMap {
  modelReady: () => void;
}
type OptionsToBackgroundProtocolKeys = keyof OptionsToBackgroundProtocolMap;

export const OptionsToBackgroundMessageKeys = {
  modelReady: "modelReady",
} as const satisfies Record<string, OptionsToBackgroundProtocolKeys>;
