import { createDefaultOptions, createMapOptions } from './options';

// `Summarizer.create()` triggers the on-device model download on first use
// (the monitor callback, if provided, receives `downloadprogress` events).
export function createDefaultSummarizer(outputLanguage: string, monitorCallback?: CreateMonitorCallback) {
	return Summarizer.create(createDefaultOptions(outputLanguage, monitorCallback));
}

export function createMapSummarizer(title: string, outputLanguage: string) {
	return Summarizer.create(createMapOptions(title, outputLanguage));
}
