import type { PageVisitedPayload } from "@/message/data";

export type SavedContentData = PageVisitedPayload & {
  id: string;
};

export function createSavedContentData(
  payload: PageVisitedPayload,
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
