import { createOptions } from "./options";

export function createSummarizer(monitorCallback?: CreateMonitorCallback) {
  return Summarizer.create(createOptions(monitorCallback));
}
