import { constants } from "@/constants";

export function createCoreOptions(): SummarizerCreateCoreOptions {
  return {
    type: "key-points",
    format: "plain-text",
    outputLanguage: "ja",
    length: "medium",
  };
}

export function createOptions(monitorCallback?: CreateMonitorCallback): SummarizerCreateOptions {
  return {
    ...createCoreOptions(),
    sharedContext: constants.sharedContext,
    monitor: monitorCallback,
  };
}
