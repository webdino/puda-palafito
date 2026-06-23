import { getMessage } from '../i18n';

// The Chrome Summarizer API only supports these output languages. Passing an
// unsupported (or empty) code makes the request "have no output language",
// degrading quality/availability — so we always normalize to a supported one.
const SUPPORTED_OUTPUT_LANGUAGES = ['de', 'en', 'es', 'fr', 'ja'];

export function toSupportedOutputLanguage(code: string): string {
	const base = (code || '').toLowerCase().split('-')[0];
	return SUPPORTED_OUTPUT_LANGUAGES.includes(base) ? base : 'en';
}

// Core options must be identical between `Summarizer.availability()` and
// `Summarizer.create()`, so they are produced by a single factory.
export function createCoreOptions(outputLanguage: string): SummarizerCreateCoreOptions {
	return {
		type: 'key-points',
		format: 'plain-text',
		outputLanguage: toSupportedOutputLanguage(outputLanguage),
	};
}

export function createDefaultOptions(
	outputLanguage: string,
	monitorCallback?: CreateMonitorCallback,
): SummarizerCreateOptions {
	return {
		...createCoreOptions(outputLanguage),
		length: 'medium',
		sharedContext: getMessage('summarizerSharedContext'),
		monitor: monitorCallback,
	};
}

export function createMapOptions(title: string, outputLanguage: string): SummarizerCreateOptions {
	return {
		...createCoreOptions(outputLanguage),
		length: 'medium',
		sharedContext: getMessage('summarizerMapContext', title),
	};
}
