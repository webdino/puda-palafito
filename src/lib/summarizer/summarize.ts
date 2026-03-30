import { RecursiveCharacterTextSplitter } from "../textSplitter";
import { createDefaultSummarizer, createMapSummarizer } from "./create";
import { fitsInQuota } from "./validation";

function combineMapSummarizedText(summarizedChunks: string[]) {
  return summarizedChunks.join("\n");
}

export async function mapSummarizeAndJoin(title: string, text: string): Promise<string> {
  console.log(`Mapで要約して結合する: text length: ${text.length}`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 750,
  });

  const chunks = splitter.splitText(text);
  console.log(`Chunk count: ${chunks.length}`);
  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: ${chunk.length}`);
  });

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

  summarizedChunks.forEach((chunk, index) => {
    console.log(`Summarized chunk ${index + 1}: ${chunk.length}`);
    console.log(chunk);
  });

  return combineMapSummarizedText(summarizedChunks);
}

export async function summarize(title: string, text: string): Promise<string> {
  const summarizer = await createDefaultSummarizer();
  try {
    if (await fitsInQuota(summarizer, text)) {
      console.log(`通常の要約処理: text length: ${text.length}`);
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
