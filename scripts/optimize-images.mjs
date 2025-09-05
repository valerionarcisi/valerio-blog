#!/usr/bin/env node

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGE_DIR = join(__dirname, '../public/img');

async function optimizeImage(inputPath, outputPath, maxWidth = 1200, quality = 80) {
  try {
    await sharp(inputPath)
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality, progressive: true })
      .toFile(outputPath);
    
    const inputStats = await stat(inputPath);
    const outputStats = await stat(outputPath);
    
    const savings = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(1);
    console.log(`✓ ${inputPath} → ${outputPath} (${savings}% smaller)`);
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
      } else if (item.name.match(/\.(jpg|jpeg)$/i)) {
        const stats = await stat(fullPath);
        
        // Only optimize images larger than 200KB
        if (stats.size > 200 * 1024) {
          const backupPath = fullPath.replace(/\.(jpg|jpeg)$/i, '.original.$1');
          const tempPath = fullPath.replace(/\.(jpg|jpeg)$/i, '.optimized.$1');
          
          // Create optimized version
          await optimizeImage(fullPath, tempPath);
          
          // Rename original to backup and optimized to original
          await sharp(fullPath).toFile(backupPath);
          await sharp(tempPath).toFile(fullPath);
          
          // Clean up temp file
          await import('fs').then(fs => fs.promises.unlink(tempPath));
          
          console.log(`✓ Optimized ${item.name} (backup saved as .original)`);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error.message);
  }
}

console.log('🖼️  Starting image optimization...');
console.log(`📁 Processing directory: ${IMAGE_DIR}`);

await processDirectory(IMAGE_DIR);

console.log('✅ Image optimization complete!');