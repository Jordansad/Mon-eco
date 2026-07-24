import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const icon = readFileSync(path.join(__dirname, 'icon-source.svg'));
const maskable = readFileSync(path.join(__dirname, 'icon-maskable-source.svg'));

async function render(svgBuffer, size, outFile) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, outFile));
  console.log('✓', outFile);
}

await render(icon, 192, 'icon-192.png');
await render(icon, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
await render(icon, 180, 'apple-touch-icon.png');

console.log('Icônes générées dans public/icons/');
