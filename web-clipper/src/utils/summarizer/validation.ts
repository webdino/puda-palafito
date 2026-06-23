import { createCoreOptions } from './options';

// Whether the browser exposes the built-in Summarizer API at all.
// `self` works in both window/popup and service-worker contexts.
export function isSummarizerSupported(): boolean {
	return 'Summarizer' in self;
}

// Raw availability string from the Summarizer API for the given output language.
// One of: 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'.
export async function getSummarizerAvailability(outputLanguage: string): Promise<string> {
	if (!isSummarizerSupported()) {
		return 'unsupported';
	}
	const coreOptions = createCoreOptions(outputLanguage);
	return await Summarizer.availability(coreOptions);
}

// Whether the on-device model is downloaded and ready to use right now.
export async function isSummarizerAvailable(outputLanguage: string): Promise<boolean> {
	return (await getSummarizerAvailability(outputLanguage)) === 'available';
}

export async function fitsInQuota(summarizer: Summarizer, text: string): Promise<boolean> {
	const inputUsage = await summarizer.measureInputUsage(text);
	return inputUsage < summarizer.inputQuota;
}
