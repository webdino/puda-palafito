// @ts-nocheck
/* biome-ignore lint: This is a standalone automation script */
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runCrawl() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || "sites/list.json";
  const listPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(__dirname, inputPath);

  if (!(await fs.stat(listPath).catch(() => false))) {
    console.error(`Error: File not found at ${listPath}`);
    process.exit(1);
  }

  const urlList = JSON.parse(await fs.readFile(listPath, "utf-8"));

  const extensionPath = path.resolve(__dirname, "../.output/chrome-mv3");
  const userDataDir = path.join(os.tmpdir(), "playwright-crawl-profile");
  const downloadsPath = path.resolve(process.cwd(), "downloads");
  await fs.mkdir(downloadsPath, { recursive: true });

  const executablePath = process.env.CHROME_PATH || undefined;

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    downloadsPath,
    acceptDownloads: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const page = await context.newPage();

  // Service Worker (background) を取得
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent("serviceworker");
  }

  // クロール開始前にストレージをクリア（拡張機能ページ経由）
  const extensionId = background.url().split("/")[2];
  const helperPage = await context.newPage();
  await helperPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "load" });
  await helperPage.evaluate(() => chrome.storage.local.clear());
  await helperPage.close();

  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i];
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error(`Failed to visit ${url}:`, error);
    }
  }

  await new Promise(() => {}); // プロセスが終了するまで待機
}

runCrawl().catch(console.error);
