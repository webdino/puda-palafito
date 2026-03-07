import type { SendMainContentsPayload } from "@/message/data";

export type StorablePayload = Omit<SendMainContentsPayload, "renderedText">;

export type SavedContentData = StorablePayload & {
  id: string;
};

export function createSavedContentData(payload: SendMainContentsPayload): SavedContentData {
  return {
    id: crypto.randomUUID(),
    title: payload.title,
    url: payload.url,
    text: payload.text,
    createdAt: payload.createdAt,
  };
}

export type SavedContentsData = Array<SavedContentData>;

// 要約のデバッグ用 SummarizeAPIのパフォーマンス計測データ
export type SummarizedPerformance = {
  url: string;
  text: string;
  summarizedText: string;
  summarizeTime: number;
  summarizeSuccess: boolean;
};

export type SummarizedPerformanceData = Array<SummarizedPerformance>;
