#!/usr/bin/env node

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get directory from command line or use default
// eslint-disable-next-line no-undef
const targetDir = process.argv[2] || join(__dirname, '../public/images/blog/caramella-fano');

async function optimizeImage(inputPath, outputPath, maxWidth = 1920, quality = 85) {
  try {
    const info = await sharp(inputPath).metadata();

    await sharp(inputPath)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality, progressive: true })
      .toFile(outputPath);

    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);

    const sizeBefore = (inputStats.size / 1024 / 1024).toFixed(2);
    const sizeAfter = (outputStats.size / 1024 / 1024).toFixed(2);
    const savings = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(1);

    console.log(`✓ ${inputPath.split('/').pop()}`);
    console.log(`  ${sizeBefore}MB → ${sizeAfter}MB (${savings}% smaller)`);
    console.log(`  ${info.width}x${info.height} → optimized for web\n`);
  } catch (error) {
    console.error(`✗ Error optimizing ${inputPath}:`, error.message);
  }
}

async function processDirectory(dir) {
  try {
    const items = await readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(dir, item.name);

      if (item.isDirectory()) {
        await processDirectory(fullPath);
      } else if (item.name.match(/\.(jpg|jpeg|JPG|JPEG)$/i) && !item.name.includes('optimized')) {
        const stats = await stat(fullPath);

        // Optimize all images
        if (stats.size > 100 * 1024) {
          const outputPath = fullPath.replace(/\.(jpg|jpeg|JPG|JPEG)$/i, '-optimized.jpg');
          await optimizeImage(fullPath, outputPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error.message);
  }
}

console.log('🖼️  Ottimizzazione immagini per il blog...');
console.log(`📁 Directory: ${targetDir}\n`);

await processDirectory(targetDir);

console.log('✅ Ottimizzazione completata!');
