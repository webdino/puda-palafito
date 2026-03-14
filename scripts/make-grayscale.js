import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const sizes = [16, 24, 32, 48, 96, 128];

async function main() {
  for (const size of sizes) {
    const inPath = path.join(publicDir, `icon-${size}.png`);
    const outPath = path.join(publicDir, `icon-${size}-gray.png`);
    await sharp(inPath).grayscale().toFile(outPath);
    console.log(`Created ${path.basename(outPath)}`);
  }
}

main().catch(console.error);
