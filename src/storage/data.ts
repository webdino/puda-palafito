import type { SendMainContentsPayload } from "@/message/data";

export type SavedContentData = SendMainContentsPayload & {
  id: string;
};

export function createSavedContentData(payload: SendMainContentsPayload): SavedContentData {
  return {
    ...payload,
    id: crypto.randomUUID(),
  };
}

export type SavedContentsData = Array<SavedContentData>;
