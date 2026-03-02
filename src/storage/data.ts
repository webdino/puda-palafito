import type { SendMainContentsPayload } from "@/message/data";

export type SavedContentData = SendMainContentsPayload & {
  id: string;
  createdAt: number;
};

export function createSavedContentData(payload: SendMainContentsPayload): SavedContentData {
  return {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
}

export type SavedContentsData = Array<SavedContentData>;
