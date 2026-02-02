import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const INPUT_DIR = path.join(PROJECT_ROOT, 'public', 'crystalizer', 'source');
const OUTPUT_DIR = path.join(INPUT_DIR, 'thumbs');

const THUMB_SIZE = 96; // thumbnail box size (px)
const WEBP_QUALITY = 60;
const WEBP_EFFORT = 5;

const IMAGE_EXT_PRIORITY = ['avif', 'webp', 'png', 'jpg', 'jpeg', 'gif'];
const IMAGE_EXT_SET = new Set(IMAGE_EXT_PRIORITY);

function extOf(filename) {
  const m = /\.([^.]+)$/.exec(filename);
  return (m ? m[1] : '').toLowerCase();
}

function stemOf(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

function pickBetter(a, b) {
  const ai = IMAGE_EXT_PRIORITY.indexOf(a.ext);
  const bi = IMAGE_EXT_PRIORITY.indexOf(b.ext);
  if (ai === -1 && bi === -1) return a;
  if (ai === -1) return b;
  if (bi === -1) return a;
  return ai <= bi ? a : b;
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const dirents = await fs.readdir(INPUT_DIR, { withFileTypes: true });
const files = dirents
  .filter((d) => d.isFile())
  .map((d) => d.name)
  .filter((name) => IMAGE_EXT_SET.has(extOf(name)));

// Pick one "best" file per stem
const bestByStem = new Map();
for (const name of files) {
  const ext = extOf(name);
  const stem = stemOf(name);
  const prev = bestByStem.get(stem);
  if (!prev) bestByStem.set(stem, { name, ext });
  else bestByStem.set(stem, pickBetter(prev, { name, ext }));
}

let processed = 0;
let skipped = 0;
let failed = 0;

for (const [stem, pick] of bestByStem.entries()) {
  const inputPath = path.join(INPUT_DIR, pick.name);
  const outPath = path.join(OUTPUT_DIR, `${stem}.webp`);

  try {
    // Skip if output exists and is newer than input
    const [inStat, outStat] = await Promise.all([
      fs.stat(inputPath),
      fs.stat(outPath).catch(() => null)
    ]);
    if (outStat && outStat.mtimeMs >= inStat.mtimeMs) {
      skipped++;
      continue;
    }

    await sharp(inputPath)
      .resize(THUMB_SIZE, THUMB_SIZE, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true
      })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(outPath);

    processed++;
  } catch (err) {
    failed++;
    console.error('[crystalizer thumbs] failed:', pick.name, err?.message || err);
  }
}

console.log(
  `[crystalizer] thumbs: generated ${processed}, skipped ${skipped}, failed ${failed} -> ${path.relative(
    PROJECT_ROOT,
    OUTPUT_DIR
  )}`
);
