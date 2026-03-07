import { createCoreOptions } from "./options";

// ブラウザがサポートしているかチェック
function isSummarizerSupported(): boolean {
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
