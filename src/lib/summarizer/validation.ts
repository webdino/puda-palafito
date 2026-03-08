import { createCoreOptions } from "./options";

// ブラウザがサポートしているかチェック
export function isSummarizerSupported(): boolean {
  return "Summarizer" in self;
}

// Summarizerが利用可能かチェック
export async function isSummarizerAvailable(): Promise<boolean> {
  if (!isSummarizerSupported()) {
    return false;
  }
  const coreOptions = createCoreOptions();
  return (await Summarizer.availability(coreOptions)) === "available";
}

export async function fitsInQuota(summarizer: Summarizer, text: string): Promise<boolean> {
  const inputUsage = await summarizer.measureInputUsage(text);
  return inputUsage < summarizer.inputQuota;
}
