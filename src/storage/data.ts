import { toLocalISOString } from "@/lib/date";
import type { PageVisitedPayload } from "@/message/data";

export type SavedContentData = Omit<PageVisitedPayload, "description"> & {
  id: string;
  driveFileIndex?: number;
  createdAtISO: string;
};

export function createSavedContentData(
  payload: PageVisitedPayload,
  summarizedText: string,
): SavedContentData {
  return {
    id: crypto.randomUUID(),
    title: payload.title,
    url: payload.url,
    text: summarizedText || payload.description, // 要約に失敗したらdescriptionを保存する
    createdAt: payload.createdAt,
    createdAtISO: toLocalISOString(new Date(payload.createdAt)),
  };
}

export type SavedContentsData = Array<SavedContentData>;
