// ブラウザがサポートしているかチェック
function isSummarizerSupported(): boolean {
  return "Summarizer" in self;
}

// Summarizerが利用可能かチェック
export async function isSummarizerAvailable(): Promise<boolean> {
  if (!isSummarizerSupported()) {
    throw new Error("Summarizer is not supported");
  }
  return (await Summarizer.availability()) === "available";
}
