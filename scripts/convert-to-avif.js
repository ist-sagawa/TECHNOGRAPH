import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const targetDir = args[0];
if (!targetDir) {
  console.error('Usage: node scripts/convert-to-avif.js <directory_path> [--quality=60] [--max-dim=1920]');
  process.exit(1);
}

const getArgValue = (prefix, fallback) => {
  const hit = args.find((a) => String(a || '').startsWith(prefix));
  if (!hit) return fallback;
  const v = String(hit).slice(prefix.length);
  return v ? v : fallback;
};

const quality = Math.max(1, Math.min(100, Number(getArgValue('--quality=', '60')) || 60));
const maxDim = Math.max(1, Number(getArgValue('--max-dim=', '1920')) || 1920);

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
      const inStat = fs.statSync(inputPath);
      const outStat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
      if (outStat && outStat.mtimeMs >= inStat.mtimeMs) {
        console.log(`⏭️  Skip (up-to-date): ${file}`);
        continue;
      }

      const info = await sharp(inputPath)
        // Match client-side MAX_DIM behavior: keep sources within a reasonable bound
        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
        .avif({ quality })
        .toFile(outputPath);
      
      const originalSize = fs.statSync(inputPath).size;
      const newSize = info.size;
      const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
      
      console.log(`✅ ${file} -> ${path.basename(outputPath)} (${reduction}% reduction, q=${quality}, max=${maxDim})`);
    } catch (err) {
      console.error(`❌ Failed to convert ${file}:`, err.message);
    }
  }
  
  console.log('\n✨ Conversion complete!');
}

convert().catch(console.error);
