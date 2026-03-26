import { constants } from "@/constants";

export function createCoreOptions(): SummarizerCreateCoreOptions {
  return {
    type: "key-points",
    format: "plain-text",
    outputLanguage: "ja",
  };
}

export function createDefaultOptions(
  monitorCallback?: CreateMonitorCallback,
): SummarizerCreateOptions {
  return {
    ...createCoreOptions(),
    length: "medium",
    sharedContext: constants.defaultSharedContext,
    monitor: monitorCallback,
  };
}

export function createMapOptions(title: string): SummarizerCreateOptions {
  return {
    ...createCoreOptions(),
    length: "medium",
    sharedContext: constants.mapContext(title),
  };
}
