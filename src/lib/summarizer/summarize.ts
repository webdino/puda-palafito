import { RecursiveCharacterTextSplitter } from "../textSplitter";
import { createDefaultSummarizer, createMapSummarizer, createReduceSummarizer } from "./create";
import { fitsInQuota } from "./validation";

function combineMapSummarizedText(summarizedChunks: string[]) {
  const totalSections = summarizedChunks.length;
  return summarizedChunks
    .map((content, index) => {
      // 区切り線とセクション情報を付与（AIの注意をリセットさせる）
      return `### データセクション [${index + 1}/${totalSections}]\n${content.trim()}`;
    })
    .join("\n");
}

const MAX_RECURSION_DEPTH = 5;

export async function mapReduceSummarize(title: string, text: string, depth = 0): Promise<string> {
  if (depth >= MAX_RECURSION_DEPTH) {
    throw new Error(`mapReduceSummarize: 最大再帰深度 (${MAX_RECURSION_DEPTH}) に達しました`);
  }
  console.log(`Map-Reduceで要約する: text length: ${text.length}, depth: ${depth}`);

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

  const combinedText = combineMapSummarizedText(summarizedChunks);
  console.log(`combineText: ${combinedText}`);

  const reduceSummarizer = await createReduceSummarizer(title);
  try {
    if (await fitsInQuota(reduceSummarizer, combinedText)) {
      const result = await reduceSummarizer.summarize(combinedText);
      console.log(`Map-Reduce result: ${result}`);
      return result;
    }
  } finally {
    reduceSummarizer.destroy();
  }

  // 結合後もquotaを超える場合はトーナメント方式で再帰的に要約
  console.log(`結合テキストがまだ大きいため再帰: combined length: ${combinedText.length}`);
  return mapReduceSummarize(title, combinedText, depth + 1);
}

export async function summarize(title: string, text: string): Promise<string> {
  const summarizer = await createDefaultSummarizer();
  try {
    if (await fitsInQuota(summarizer, text)) {
      console.log(`通常の要約処理: text length: ${text.length}`);
      return await summarizer.summarize(text);
    }
  } catch (e) {
    console.error(`要約失敗: ${e}  text length: ${text.length}`);
    return "";
  } finally {
    summarizer.destroy();
  }

  try {
    return await mapReduceSummarize(title, text);
  } catch (e) {
    console.error(`Map-Reduce要約失敗: ${e}`);
    return "";
  }
}
