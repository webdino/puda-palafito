import { RecursiveCharacterTextSplitter } from "../textSplitter";
import { createDefaultSummarizer, createMapSummarizer } from "./create";
import { fitsInQuota } from "./validation";

function combineMapSummarizedText(summarizedChunks: string[]) {
  return summarizedChunks.join("\n");
}

export async function mapSummarizeAndJoin(title: string, text: string): Promise<string> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 750,
  });

  const chunks = splitter.splitText(text);
  // ひとまずはエラーにするが頻発するならquotaからチャンクサイズを算出するほうが良いかも
  if (chunks.length === 1) {
    throw new Error(
      `テキストをこれ以上分割できませんがクォータを超えています: text length: ${text.length}`,
    );
  }

  const mapSummarizer = await createMapSummarizer(title);
  let summarizedChunks: string[];
  try {
    summarizedChunks = await Promise.all(chunks.map((chunk) => mapSummarizer.summarize(chunk)));
  } finally {
    mapSummarizer.destroy();
  }

  return combineMapSummarizedText(summarizedChunks);
}

export async function summarize(title: string, text: string): Promise<string> {
  const summarizer = await createDefaultSummarizer();
  try {
    if (await fitsInQuota(summarizer, text)) {
      return await summarizer.summarize(text);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "NotReadableError") {
      return "";
    }
    console.error(
      `要約失敗: ${e instanceof Error ? `${e.name} ${e.message}` : e}  text length: ${text.length}`,
    );
    return "";
  } finally {
    summarizer.destroy();
  }

  try {
    return await mapSummarizeAndJoin(title, text);
  } catch (e) {
    console.error(`Map-要約失敗: ${e}`);
    return "";
  }
}
