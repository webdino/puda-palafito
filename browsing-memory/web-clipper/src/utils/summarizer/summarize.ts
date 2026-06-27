import { RecursiveCharacterTextSplitter } from '../text-splitter';
import { createDefaultSummarizer, createMapSummarizer } from './create';
import { fitsInQuota } from './validation';

function combineMapSummarizedText(summarizedChunks: string[]): string {
	return summarizedChunks.join('\n');
}

// Split text that exceeds the model's input quota into chunks, summarize each,
// then join the chunk summaries (map step only — no reduce).
export async function mapSummarizeAndJoin(title: string, text: string, outputLanguage: string): Promise<string> {
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 3000,
		chunkOverlap: 750,
	});

	const chunks = splitter.splitText(text);
	if (chunks.length === 1) {
		throw new Error(`Text cannot be split further but exceeds the quota: text length: ${text.length}`);
	}

	const mapSummarizer = await createMapSummarizer(title, outputLanguage);
	let summarizedChunks: string[];
	try {
		summarizedChunks = await Promise.all(chunks.map((chunk) => mapSummarizer.summarize(chunk)));
	} finally {
		mapSummarizer.destroy();
	}

	return combineMapSummarizedText(summarizedChunks);
}

// Summarize `text` with the Chrome built-in Summarizer. Returns '' on any failure
// (caller treats an empty result as "no summary").
export async function summarize(title: string, text: string, outputLanguage: string): Promise<string> {
	const summarizer = await createDefaultSummarizer(outputLanguage);
	try {
		if (await fitsInQuota(summarizer, text)) {
			return await summarizer.summarize(text);
		}
	} catch (e) {
		if (e instanceof Error && e.name === 'NotReadableError') {
			return '';
		}
		console.error(
			`Summarization failed: ${e instanceof Error ? `${e.name} ${e.message}` : e}  text length: ${text.length}`,
		);
		return '';
	} finally {
		summarizer.destroy();
	}

	try {
		return await mapSummarizeAndJoin(title, text, outputLanguage);
	} catch (e) {
		console.error(`Map summarization failed: ${e}`);
		return '';
	}
}
