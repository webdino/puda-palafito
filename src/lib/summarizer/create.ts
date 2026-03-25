import { createDefaultOptions, createMapOptions, createReduceOptions } from "./options";

export function createDefaultSummarizer(monitorCallback?: CreateMonitorCallback) {
  return Summarizer.create(createDefaultOptions(monitorCallback));
}

export function createMapSummarizer(title: string) {
  return Summarizer.create(createMapOptions(title));
}
