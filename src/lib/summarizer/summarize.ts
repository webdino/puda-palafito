import { RecursiveCharacterTextSplitter } from "../textSplitter";
import { createDefaultSummarizer, createMapSummarizer, createReduceSummarizer } from "./create";
import { fitsInQuota } from "./validation";

export async function mapReduceSummarize(title: string, text: string) {
  console.log(`1回では要約できないのでMap-Reduceで要約する: text length: ${text.length}`);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 6000,
    chunkOverlap: 500,
  });

  try {
    const chunks = splitter.splitText(text);

    console.log(`Chunk count: ${chunks.length}`);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}: ${chunk.length}`);
    });

    const mapSummarizer = await createMapSummarizer(title);
    const summarizedChunks = await Promise.all(chunks.map((data) => mapSummarizer.summarize(data)));
    mapSummarizer.destroy();

    const combinedText = summarizedChunks.join("\n");
    console.log(`combineText: ${combinedText}`);
    const reduceSummarizer = await createReduceSummarizer(title);
    const result = await reduceSummarizer.summarize(combinedText);

    console.log(`Map-Reduce result: ${result}`);
    return result;
  } catch (e) {
    console.error(e);
  }
  return "";
}

export async function summarize(title: string, text: string) {
  const summarizer = await createDefaultSummarizer();

  const fit = await fitsInQuota(summarizer, text);
  // 1回で要約できるはずなので通常の要約処理を行う
  if (fit) {
    console.log(`1回で要約できるはずなので通常の要約処理を行う: text length: ${text.length}`);
    try {
      const summarizedText = await summarizer.summarize(text);
      summarizer.destroy();
      return summarizedText;
    } catch (e) {
      console.error(`要約失敗: ${e}  text length: ${text.length}`);
    }
  }

  summarizer.destroy();
  return mapReduceSummarize(title, text);
}
