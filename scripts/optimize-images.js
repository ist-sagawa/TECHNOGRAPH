#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定
const config = {
  // 品質設定
  jpeg: {
    quality: 80,
    progressive: true,
    mozjpeg: true
  },
  png: {
    quality: 80,
    compressionLevel: 9,
    palette: true
  },
  webp: {
    quality: 80,
    effort: 6
  },
  // リサイズ設定（必要に応じて）
  maxWidth: 1920,
  maxHeight: 1080,
  // 対象ディレクトリ
  sourceDir: path.join(__dirname, '../public'),
  // バックアップディレクトリ
  backupDir: path.join(__dirname, '../public-backup')
};

// ファイルサイズをフォーマット
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// ディレクトリを再帰的に取得
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// 画像ファイルをフィルタリング
function getImageFiles(files) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });
}

// バックアップ作成
async function createBackup() {
  if (!fs.existsSync(config.backupDir)) {
    console.log('🗂️  バックアップディレクトリを作成中...');
    fs.mkdirSync(config.backupDir, { recursive: true });
    
    // publicディレクトリをバックアップにコピー
    const copyRecursive = (src, dest) => {
      if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(file => {
          copyRecursive(path.join(src, file), path.join(dest, file));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    
    copyRecursive(config.sourceDir, config.backupDir);
    console.log('✅ バックアップが作成されました:', config.backupDir);
  } else {
    console.log('📁 バックアップディレクトリが既に存在します');
  }
}

// 画像最適化
async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const originalSize = fs.statSync(filePath).size;
  
  try {
    let image = sharp(filePath);
    
    // メタデータを取得
    const metadata = await image.metadata();
    
    // リサイズが必要な場合
    if (metadata.width > config.maxWidth || metadata.height > config.maxHeight) {
      image = image.resize(config.maxWidth, config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // フォーマット別の最適化
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        await image
          .jpeg(config.jpeg)
          .toFile(filePath + '.tmp');
        break;
        
      case '.png':
        await image
          .png(config.png)
          .toFile(filePath + '.tmp');
        break;
        
      default:
        console.log(`⏭️  スキップ: ${filePath} (対応していない形式)`);
        return null;
    }
    
    // 一時ファイルと元ファイルを入れ替え
    fs.renameSync(filePath + '.tmp', filePath);
    
    const newSize = fs.statSync(filePath).size;
    const savings = originalSize - newSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    
    return {
      file: path.relative(config.sourceDir, filePath),
      originalSize,
      newSize,
      savings,
      savingsPercent
    };
    
  } catch (error) {
    console.error(`❌ エラー: ${filePath}`, error.message);
    // 一時ファイルをクリーンアップ
    if (fs.existsSync(filePath + '.tmp')) {
      fs.unlinkSync(filePath + '.tmp');
    }
    return null;
  }
}

// WebP変換
async function convertToWebP(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const webpPath = filePath.replace(ext, '.webp');
  
  try {
    await sharp(filePath)
      .webp(config.webp)
      .toFile(webpPath);
      
    const originalSize = fs.statSync(filePath).size;
    const webpSize = fs.statSync(webpPath).size;
    const savings = originalSize - webpSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    
    return {
      original: path.relative(config.sourceDir, filePath),
      webp: path.relative(config.sourceDir, webpPath),
      originalSize,
      webpSize,
      savings,
      savingsPercent
    };
    
  } catch (error) {
    console.error(`❌ WebP変換エラー: ${filePath}`, error.message);
    return null;
  }
}

// メイン処理
async function main() {
  console.log('🖼️  画像最適化スクリプトを開始します...\n');
  
  // バックアップ作成
  await createBackup();
  
  // 画像ファイル取得
  const allFiles = getAllFiles(config.sourceDir);
  const imageFiles = getImageFiles(allFiles);
  
  console.log(`\n📊 対象画像ファイル: ${imageFiles.length}個\n`);
  
  const results = [];
  const webpResults = [];
  
  // プログレスバー用
  let processed = 0;
  
  for (const filePath of imageFiles) {
    const filename = path.relative(config.sourceDir, filePath);
    
    // 最適化実行
    console.log(`🔄 処理中: ${filename}`);
    const result = await optimizeImage(filePath);
    
    if (result) {
      results.push(result);
      console.log(`✅ 完了: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.newSize)} (${result.savingsPercent}% 削減)`);
      
      // WebP変換
      const webpResult = await convertToWebP(filePath);
      if (webpResult) {
        webpResults.push(webpResult);
        console.log(`🌐 WebP作成: ${formatFileSize(webpResult.originalSize)} → ${formatFileSize(webpResult.webpSize)} (${webpResult.savingsPercent}% 削減)`);
      }
    }
    
    processed++;
    console.log(`📈 進捗: ${processed}/${imageFiles.length}\n`);
  }
  
  // 結果の表示
  console.log('🎉 最適化完了!\n');
  
  // 統計情報
  const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalNewSize = results.reduce((sum, r) => sum + r.newSize, 0);
  const totalSavings = totalOriginalSize - totalNewSize;
  const totalSavingsPercent = Math.round((totalSavings / totalOriginalSize) * 100);
  
  console.log('📊 最適化結果:');
  console.log(`   処理ファイル数: ${results.length}個`);
  console.log(`   元のサイズ: ${formatFileSize(totalOriginalSize)}`);
  console.log(`   最適化後: ${formatFileSize(totalNewSize)}`);
  console.log(`   削減量: ${formatFileSize(totalSavings)} (${totalSavingsPercent}%)`);
  
  if (webpResults.length > 0) {
    const totalWebpSize = webpResults.reduce((sum, r) => sum + r.webpSize, 0);
    const totalWebpSavings = totalOriginalSize - totalWebpSize;
    const totalWebpSavingsPercent = Math.round((totalWebpSavings / totalOriginalSize) * 100);
    
    console.log(`\n🌐 WebP変換結果:`);
    console.log(`   変換ファイル数: ${webpResults.length}個`);
    console.log(`   WebPサイズ: ${formatFileSize(totalWebpSize)}`);
    console.log(`   削減量: ${formatFileSize(totalWebpSavings)} (${totalWebpSavingsPercent}%)`);
  }
  
  console.log(`\n💾 バックアップ: ${config.backupDir}`);
  console.log('⚠️  元のファイルは上記にバックアップされています');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

// スクリプト実行
main().catch(console.error); 