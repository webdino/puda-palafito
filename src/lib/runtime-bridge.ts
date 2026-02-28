export type ContentToBackgroundMessage = {
  type: 'FETCH_EXTERNAL';
  requestId: string;
  url: string;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
};

export type BackgroundToContentMessage = {
  type: 'FETCH_RESULT';
  requestId: string;
  ok: boolean;
  status: number;
  body: string;
};
