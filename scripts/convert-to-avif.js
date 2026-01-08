import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node scripts/convert-to-avif.js <directory_path>');
  process.exit(1);
}

const dirPath = path.resolve(targetDir);

if (!fs.existsSync(dirPath)) {
  console.error(`Directory not found: ${dirPath}`);
  process.exit(1);
}

const files = fs.readdirSync(dirPath);
const imageFiles = files.filter(file => {
  const ext = path.extname(file).toLowerCase();
  return ['.jpg', '.jpeg', '.png'].includes(ext);
});

if (imageFiles.length === 0) {
  console.log('No images found to convert.');
  process.exit(0);
}

async function convert() {
  console.log(`🚀 Starting conversion of ${imageFiles.length} images in ${dirPath}...\n`);
  
  for (const file of imageFiles) {
    const inputPath = path.join(dirPath, file);
    const outputPath = path.join(dirPath, file.replace(path.extname(file), '.avif'));
    
    try {
      const info = await sharp(inputPath)
        .avif({ quality: 60 })
        .toFile(outputPath);
      
      const originalSize = fs.statSync(inputPath).size;
      const newSize = info.size;
      const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
      
      console.log(`✅ ${file} -> ${path.basename(outputPath)} (${reduction}% reduction)`);
    } catch (err) {
      console.error(`❌ Failed to convert ${file}:`, err.message);
    }
  }
  
  console.log('\n✨ Conversion complete!');
}

convert().catch(console.error);
