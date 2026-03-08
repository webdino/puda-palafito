import type { SendMainContentsPayload } from "@/message/data";

export type SavedContentData = SendMainContentsPayload & {
  id: string;
};

export function createSavedContentData(
  payload: SendMainContentsPayload,
  summarizedText: string,
): SavedContentData {
  return {
    id: crypto.randomUUID(),
    title: payload.title,
    url: payload.url,
    text: summarizedText,
    createdAt: payload.createdAt,
  };
}

export type SavedContentsData = Array<SavedContentData>;
