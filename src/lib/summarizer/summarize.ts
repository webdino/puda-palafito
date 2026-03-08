import { RecursiveCharacterTextSplitter } from "../textSplitter";
import { createDefaultSummarizer, createMapSummarizer, createReduceSummarizer } from "./create";
import { fitsInQuota } from "./validation";

function combineMapSummarizedText(summarizedChunks: string[]) {
  return summarizedChunks
    .map((content, index) => {
      const sectionNumber = index + 1;
      const totalSections = summarizedChunks.length;

      // 区切り線とセクション情報を付与（AIの注意をリセットさせる）
      return `### データセクション [${sectionNumber}/${totalSections}]\n${content.trim()}`;
    })
    .join("\n");
}

export async function mapReduceSummarize(title: string, text: string): Promise<string> {
  console.log(`Map-Reduceで要約する: text length: ${text.length}`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 750,
  });

  const chunks = splitter.splitText(text);
  console.log(`Chunk count: ${chunks.length}`);
  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: ${chunk.length}`);
  });

  const mapSummarizer = await createMapSummarizer(title);
  const summarizedChunks = await Promise.all(chunks.map((chunk) => mapSummarizer.summarize(chunk)));
  mapSummarizer.destroy();

  summarizedChunks.forEach((chunk, index) => {
    console.log(`Summarized chunk ${index + 1}: ${chunk.length}`);
    console.log(chunk);
  });

  const combinedText = combineMapSummarizedText(summarizedChunks);
  console.log(`combineText: ${combinedText}`);

  const reduceSummarizer = await createReduceSummarizer(title);
  if (await fitsInQuota(reduceSummarizer, combinedText)) {
    const result = await reduceSummarizer.summarize(combinedText);
    reduceSummarizer.destroy();
    console.log(`Map-Reduce result: ${result}`);
    return result;
  }

  // 結合後もquotaを超える場合はトーナメント方式で再帰的に要約
  reduceSummarizer.destroy();
  console.log(`結合テキストがまだ大きいため再帰: combined length: ${combinedText.length}`);
  return mapReduceSummarize(title, combinedText);
}

export async function summarize(title: string, text: string): Promise<string> {
  const summarizer = await createDefaultSummarizer();
  const fit = await fitsInQuota(summarizer, text);
  summarizer.destroy();

  if (fit) {
    console.log(`通常の要約処理: text length: ${text.length}`);
    const summarizer = await createDefaultSummarizer();
    try {
      const result = await summarizer.summarize(text);
      summarizer.destroy();
      return result;
    } catch (e) {
      console.error(`要約失敗: ${e}  text length: ${text.length}`);
      summarizer.destroy();
    }
  }

  return mapReduceSummarize(title, text);
}
