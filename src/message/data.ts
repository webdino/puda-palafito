export type PageVisitedPayload = {
  title: string;
  url: string;
  text: string;
  createdAt: number;
};

// content.tsからbackground.tsへのメッセージの型定義
export interface ContentToBackgroundProtocolMap {
  pageVisited: (payload: PageVisitedPayload) => void;
}
type ContentToBackgroundProtocolKeys = keyof ContentToBackgroundProtocolMap;

export const ContentToBackgroundMessageKeys = {
  pageVisited: "pageVisited",
} as const satisfies Record<string, ContentToBackgroundProtocolKeys>;

// options/UIからbackground.tsへのメッセージの型定義
export interface OptionsToBackgroundProtocolMap {
  modelReady: () => void;
  driveFolderIdUpdated: () => void;
  deleteItem: (id: string) => void;
}
type OptionsToBackgroundProtocolKeys = keyof OptionsToBackgroundProtocolMap;

export const OptionsToBackgroundMessageKeys = {
  modelReady: "modelReady",
  driveFolderIdUpdated: "driveFolderIdUpdated",
  deleteItem: "deleteItem",
} as const satisfies Record<string, OptionsToBackgroundProtocolKeys>;
