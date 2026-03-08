#!/usr/bin/env node
// Usage: node scripts/extract-urls.js <input.csv> [output.json]

import fs from "node:fs";
import path from "node:path";

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Usage: node extract-urls.js <input.csv> [output.json]");
  process.exit(1);
}

const outputFile =
  process.argv[3] ??
  path.join(
    path.dirname(inputFile),
    `${path.basename(inputFile, path.extname(inputFile))}_urls.json`,
  );

const content = fs.readFileSync(inputFile, "utf8");
const lines = content.trim().split("\n").slice(1); // skip header

const urls = lines
  .map((line) => {
    const match = line.match(/^[^,]*,\s*(https?:\/\/[^,]+),/);
    return match ? match[1].trim() : null;
  })
  .filter(Boolean);

fs.writeFileSync(outputFile, JSON.stringify(urls, null, 2));
console.log(`${urls.length} URLs -> ${outputFile}`);
