// public/251118/script.js

// ===== 設定パラメーター =====
const CONFIG = {
  // 画像設定
  IMAGE_COUNT: 19,
  IMAGE_PATH: '/251120/',
  
  // グリッド設定
  GRID_LINES_MIN: 2, // 縦横のライン数の最小値
  GRID_LINES_MAX: 50, // 縦横のライン数の最大値
  MIN_LINE_SPACING: 0, // ライン間の最小間隔（ピクセル）
  SELECTED_CELLS_MIN: 1, // 選択するセルの最小数
  SELECTED_CELLS_MAX: 300, // 選択するセルの最大数
  LINE_SPEED_MIN: 0, // ラインの最小速度（ピクセル/フレーム）
  LINE_SPEED_MAX: 12.0, // ラインの最大速度（ピクセル/フレーム）
  LINE_SPEED_ARRAY: [0, 0.3,0.8,1.6,3.0,12.0],
  LINE_SPEED_DIFFERENT_PROBABILITY: 0.1, // ラインの速度を異なる確率（フレームごと）
  
  // セル画像の動的変更設定（アニメーション中）
  IMAGE_CHANGE_PROBABILITY: 0.2, // 画像が変わる確率（フレームごと）
  IMAGE_REMOVE_PROBABILITY: 0.01, // 画像が消える確率（フレームごと）
  IMAGE_ADD_PROBABILITY: 0.2, // 新しい画像が追加される確率（フレームごと）
  IMAGE_UPDATE_INTERVAL: 2, // 画像更新の間隔（フレーム数）
  RESET_PROBABILITY: 0.05, // 完全リセットの確率（フレームごと、0で無効）
  IMAGE_RANDOM_OFFSET: true, // 画像のトリミング位置をランダムにする
  IMAGE_OFFSET_RANGE: 0.2, // オフセットの範囲（0.0〜1.0、0.5で±50%）
  
  // 線の設定
  LINE_COLOR: [180, 180, 180],
  LINE_WEIGHT: .5 // 線の太さ
};

// ===== グローバル変数 ===== 
let images = [];
let gridCells = []; // セル配列
let selectedCells = []; // 選択されたセル
let verticalLines = []; // 縦のライン位置
let horizontalLines = []; // 横のライン位置

// 線の表示状態
let showLines = true; // 線を表示するかどうか

// アニメーション関連
let isAnimating = false; // アニメーション中かどうか
let lineVelocities = { vertical: [], horizontal: [] }; // 各ラインの速度
let selectedCellIndices = []; // 選択されたセルのグリッド位置 [{row, col, imageIndex}]
let gridStructure = { rows: 0, cols: 0 }; // グリッド構造を記録
let frameCount = 0; // フレームカウンター（画像更新用）

// ===== 共通ユーティリティ関数 =====
// セル内に画像を描画（cover方式、クリッピング付き、ランダムオフセット対応）
function drawImageInCell(img, x, y, w, h, offsetX = 0, offsetY = 0) {
  if (!img || img.width === 0) return;
  
  const imgAspect = img.width / img.height;
  const cellAspect = w / h;
  
  let drawW, drawH, drawX, drawY;
  
  if (imgAspect > cellAspect) {
    // 画像の方が横長 → 高さに合わせる
    drawH = h;
    drawW = drawH * imgAspect;
    const maxOffsetX = (drawW - w) * CONFIG.IMAGE_OFFSET_RANGE;
    drawX = x - (drawW - w) / 2 + (offsetX * maxOffsetX);
    drawY = y;
  } else {
    // セルの方が横長 → 幅に合わせる
    drawW = w;
    drawH = drawW / imgAspect;
    drawX = x;
    const maxOffsetY = (drawH - h) * CONFIG.IMAGE_OFFSET_RANGE;
    drawY = y - (drawH - h) / 2 + (offsetY * maxOffsetY);
  }
  
  // クリッピングマスクを作成
  push();
  noStroke();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(x, y, w, h);
  drawingContext.clip();
  
  // 画像を描画
  image(img, drawX, drawY, drawW, drawH);
  
  drawingContext.restore();
  pop();
}

// 線を描画（共通設定を使用）
function drawLineWithConfig(x1, y1, x2, y2) {
  if (!showLines) return;
  
  stroke(CONFIG.LINE_COLOR[0], CONFIG.LINE_COLOR[1], CONFIG.LINE_COLOR[2]);
  strokeWeight(CONFIG.LINE_WEIGHT);
  line(x1, y1, x2, y2);
  noStroke();
}

// ===== セルクラス =====
class GridCell {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.imageIndex = null;
    this.isSelected = false;
    this.imageOffsetX = 0; // 画像のXオフセット（-1.0〜1.0）
    this.imageOffsetY = 0; // 画像のYオフセット（-1.0〜1.0）
  }

  // セルを描画
  draw() {
    if (this.isSelected && this.imageIndex !== null) {
      // 画像を描画
      const img = images[this.imageIndex];
      drawImageInCell(img, this.x, this.y, this.w, this.h, this.imageOffsetX, this.imageOffsetY);
    }
  }
}

// ===== p5.js関数 =====
function preload() {
  // 画像を読み込む
  for (let i = 1; i <= CONFIG.IMAGE_COUNT; i++) {
    images.push(loadImage(`${CONFIG.IMAGE_PATH}lion${i}.avif`));
  }
}

// ランダムグリッドを生成
function generateGrid() {
  gridCells = [];
  selectedCells = [];
  
  // ランダムな数の縦横ラインを生成
  const numVerticalLines = floor(random(CONFIG.GRID_LINES_MIN, CONFIG.GRID_LINES_MAX + 1));
  const numHorizontalLines = floor(random(CONFIG.GRID_LINES_MIN, CONFIG.GRID_LINES_MAX + 1));
  
  // 縦のライン位置をランダムに生成（最小間隔を保つ）
  const verticalLinesLocal = generateRandomLines(numVerticalLines, width, CONFIG.MIN_LINE_SPACING);
  verticalLinesLocal.sort((a, b) => a - b);
  
  // 横のライン位置をランダムに生成（最小間隔を保つ）
  const horizontalLinesLocal = generateRandomLines(numHorizontalLines, height, CONFIG.MIN_LINE_SPACING);
  horizontalLinesLocal.sort((a, b) => a - b);
  
  // グリッドラインを保存（描画用）
  verticalLines = verticalLinesLocal;
  horizontalLines = horizontalLinesLocal;
  
  // ラインの速度を初期化
  initializeLineVelocities();
  
  // すべてのセルを生成
  const allLinesX = [0, ...verticalLinesLocal, width];
  const allLinesY = [0, ...horizontalLinesLocal, height];
  
  for (let i = 0; i < allLinesY.length - 1; i++) {
    for (let j = 0; j < allLinesX.length - 1; j++) {
      const x = allLinesX[j];
      const y = allLinesY[i];
      const w = allLinesX[j + 1] - allLinesX[j];
      const h = allLinesY[i + 1] - allLinesY[i];
      
      const cell = new GridCell(x, y, w, h);
      gridCells.push(cell);
    }
  }
  
  // ランダムにセルを選択（10〜20個）
  const numSelected = floor(random(CONFIG.SELECTED_CELLS_MIN, CONFIG.SELECTED_CELLS_MAX + 1));
  const shuffled = [...gridCells].sort(() => random() - 0.5);
  
  // 選択されたセルのグリッド位置を記録
  selectedCellIndices = [];
  selectedCells = [];
  
  for (let i = 0; i < numSelected && i < shuffled.length; i++) {
    const cell = shuffled[i];
    cell.isSelected = true;
    cell.imageIndex = floor(random(CONFIG.IMAGE_COUNT));
    // 画像のオフセットをランダムに設定
    if (CONFIG.IMAGE_RANDOM_OFFSET) {
      cell.imageOffsetX = random(-1, 1);
      cell.imageOffsetY = random(-1, 1);
    }
    selectedCells.push(cell);
    
    // セルの位置からグリッドインデックスを取得
    let row = -1, col = -1;
    for (let r = 0; r < allLinesY.length - 1; r++) {
      if (abs(cell.y - allLinesY[r]) < 1) {
        row = r;
        break;
      }
    }
    for (let c = 0; c < allLinesX.length - 1; c++) {
      if (abs(cell.x - allLinesX[c]) < 1) {
        col = c;
        break;
      }
    }
    
    if (row >= 0 && col >= 0) {
      selectedCellIndices.push({ row, col, imageIndex: cell.imageIndex });
    }
  }
  
  // グリッド構造を記録
  gridStructure.rows = allLinesY.length - 1;
  gridStructure.cols = allLinesX.length - 1;
}

// ラインの位置からセルを再生成（選択状態を保持）
function updateCellsFromLines() {
  gridCells = [];
  
  const allLinesX = [0, ...verticalLines, width];
  const allLinesY = [0, ...horizontalLines, height];
  
  const numRows = allLinesY.length - 1;
  const numCols = allLinesX.length - 1;
  
  // すべてのセルを再生成
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const x = allLinesX[j];
      const y = allLinesY[i];
      const w = allLinesX[j + 1] - allLinesX[j];
      const h = allLinesY[i + 1] - allLinesY[i];
      
      const cell = new GridCell(x, y, w, h);
      gridCells.push(cell);
    }
  }
  
  // 既存の選択されたセルが空の場合、またはグリッド構造が変わった場合は新しく選択
  if (selectedCellIndices.length === 0 || 
      numRows !== gridStructure.rows || 
      numCols !== gridStructure.cols) {
    // ランダムにセルを選択（10〜20個）
    const numSelected = floor(random(CONFIG.SELECTED_CELLS_MIN, CONFIG.SELECTED_CELLS_MAX + 1));
    const shuffled = [...gridCells].sort(() => random() - 0.5);
    
    selectedCellIndices = [];
    selectedCells = [];
    
    for (let i = 0; i < numSelected && i < shuffled.length; i++) {
      const cell = shuffled[i];
      cell.isSelected = true;
      cell.imageIndex = floor(random(CONFIG.IMAGE_COUNT));
      // 画像のオフセットをランダムに設定
      if (CONFIG.IMAGE_RANDOM_OFFSET) {
        cell.imageOffsetX = random(-1, 1);
        cell.imageOffsetY = random(-1, 1);
      }
      selectedCells.push(cell);
      
      // グリッド内での位置を計算して記録
      let row = -1, col = -1;
      for (let r = 0; r < numRows; r++) {
        if (abs(cell.y - allLinesY[r]) < 1) {
          row = r;
          break;
        }
      }
      for (let c = 0; c < numCols; c++) {
        if (abs(cell.x - allLinesX[c]) < 1) {
          col = c;
          break;
        }
      }
      
      if (row >= 0 && col >= 0) {
        selectedCellIndices.push({ row, col, imageIndex: cell.imageIndex });
      }
    }
    
    // グリッド構造を記録
    gridStructure.rows = numRows;
    gridStructure.cols = numCols;
  } else {
    // 既存の選択位置に基づいてセルを選択（動的に変更可能）
    selectedCells = [];
    
    // アニメーション中は画像を動的に変更
    if (isAnimating && frameCount % CONFIG.IMAGE_UPDATE_INTERVAL === 0) {
      updateCellImages();
    }
    
    for (const selectedIndex of selectedCellIndices) {
      // グリッド位置が有効な範囲内かチェック
      if (selectedIndex.row < numRows && selectedIndex.col < numCols) {
        // グリッド位置からセルを取得
        const cellIndex = selectedIndex.row * numCols + selectedIndex.col;
        if (cellIndex < gridCells.length) {
          const cell = gridCells[cellIndex];
          cell.isSelected = true;
          cell.imageIndex = selectedIndex.imageIndex;
          // オフセットを設定（初回またはランダムオフセットが有効な場合）
          if (CONFIG.IMAGE_RANDOM_OFFSET && (cell.imageOffsetX === 0 && cell.imageOffsetY === 0)) {
            cell.imageOffsetX = random(-1, 1);
            cell.imageOffsetY = random(-1, 1);
          }
          selectedCells.push(cell);
        }
      }
    }
  }
  
  frameCount++;
}

// セルの画像を動的に更新（切り替え、維持、削除、追加）
function updateCellImages() {
  const numRows = gridStructure.rows;
  const numCols = gridStructure.cols;
  
  // 既存のセルの画像を変更または削除
  for (let i = selectedCellIndices.length - 1; i >= 0; i--) {
    const selectedIndex = selectedCellIndices[i];
    const rand = random();
    
    // 最小数を維持するため、削除前にチェック
    const canRemove = selectedCellIndices.length > CONFIG.SELECTED_CELLS_MIN;
    
    if (canRemove && rand < CONFIG.IMAGE_REMOVE_PROBABILITY) {
      // 画像を削除（最小数を下回らない場合のみ）
      selectedCellIndices.splice(i, 1);
    } else if (rand < CONFIG.IMAGE_REMOVE_PROBABILITY + CONFIG.IMAGE_CHANGE_PROBABILITY) {
      // 画像を変更
      selectedIndex.imageIndex = floor(random(CONFIG.IMAGE_COUNT));
      // オフセットも更新（ランダムオフセットが有効な場合）
      if (CONFIG.IMAGE_RANDOM_OFFSET) {
        // グリッド位置からセルを取得
        const cellIndex = selectedIndex.row * numCols + selectedIndex.col;
        if (cellIndex < gridCells.length) {
          const cell = gridCells[cellIndex];
          cell.imageIndex = selectedIndex.imageIndex;
          cell.imageOffsetX = random(-1, 1);
          cell.imageOffsetY = random(-1, 1);
        }
      }
    }
    // それ以外は維持（何もしない）
  }
  
  // 新しいセルに画像を追加
  if (gridCells.length > selectedCellIndices.length) {
    // 選択されていないセルを探す
    const unselectedCells = [];
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const isSelected = selectedCellIndices.some(s => s.row === row && s.col === col);
        if (!isSelected) {
          unselectedCells.push({ row, col });
        }
      }
    }
    
    // 最大数に達していない場合、追加の確率で追加
    if (selectedCellIndices.length < CONFIG.SELECTED_CELLS_MAX && unselectedCells.length > 0) {
      if (random() < CONFIG.IMAGE_ADD_PROBABILITY) {
        const newCell = unselectedCells[floor(random(unselectedCells.length))];
        const imageIndex = floor(random(CONFIG.IMAGE_COUNT));
        selectedCellIndices.push({
          row: newCell.row,
          col: newCell.col,
          imageIndex: imageIndex
        });
        // 対応するセルにオフセットを設定
        const cellIndex = newCell.row * numCols + newCell.col;
        if (cellIndex < gridCells.length) {
          const cell = gridCells[cellIndex];
          cell.imageIndex = imageIndex;
          if (CONFIG.IMAGE_RANDOM_OFFSET) {
            cell.imageOffsetX = random(-1, 1);
            cell.imageOffsetY = random(-1, 1);
          }
        }
      }
    }
    
    // 最小数を下回っている場合は自動的に追加
    while (selectedCellIndices.length < CONFIG.SELECTED_CELLS_MIN && unselectedCells.length > 0) {
      const newCell = unselectedCells[floor(random(unselectedCells.length))];
      const imageIndex = floor(random(CONFIG.IMAGE_COUNT));
      selectedCellIndices.push({
        row: newCell.row,
        col: newCell.col,
        imageIndex: imageIndex
      });
      // 対応するセルにオフセットを設定
      const cellIndex = newCell.row * numCols + newCell.col;
      if (cellIndex < gridCells.length) {
        const cell = gridCells[cellIndex];
        cell.imageIndex = imageIndex;
        if (CONFIG.IMAGE_RANDOM_OFFSET) {
          cell.imageOffsetX = random(-1, 1);
          cell.imageOffsetY = random(-1, 1);
        }
      }
      // 追加したセルをリストから削除
      const index = unselectedCells.findIndex(c => c.row === newCell.row && c.col === newCell.col);
      if (index >= 0) {
        unselectedCells.splice(index, 1);
      }
    }
  }
}

// ランダムなライン位置を生成（最小間隔を保つ）
function generateRandomLines(count, maxSize, minSpacing) {
  const lines = [];
  const maxAttempts = 1000;
  let attempts = 0;
  
  while (lines.length < count && attempts < maxAttempts) {
    const pos = random(minSpacing, maxSize - minSpacing);
    let valid = true;
    
    // 既存のラインとの距離をチェック
    for (const existingLine of lines) {
      if (abs(pos - existingLine) < minSpacing) {
        valid = false;
        break;
      }
    }
    
    if (valid) {
      lines.push(pos);
    }
    
    attempts++;
  }
  
  return lines;
}


// グリッドラインを描画
function drawGridLines() {
  // 縦のライン
  for (const x of verticalLines) {
    drawLineWithConfig(x, 0, x, height);
  }
  
  // 横のライン
  for (const y of horizontalLines) {
    drawLineWithConfig(0, y, width, y);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  
  // グリッドを生成
  generateGrid();
  
  // ローディング表示を非表示
  const loadingEl = document.getElementById('p5_loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  
  // アニメーションを開始
  isAnimating = true;
  loop();
}

function draw() {
  background(0);
  
  // 最初のフレームでは描画のみ（アニメーション更新は次のフレームから）
  if (frameCount === 0) {
    // まずグリッドラインを描画
    drawGridLines();
    // 選択されたセルに画像を描画
    selectedCells.forEach(cell => cell.draw());
    frameCount++;
    return;
  }
  
  // 完全リセットのチェック（確率ベース）
  if (isAnimating && CONFIG.RESET_PROBABILITY > 0 && random() < CONFIG.RESET_PROBABILITY) {
    fullReset();
  }
  
  // アニメーション中はラインを更新
  if (isAnimating) {
    updateLinePositions();
  }
  
  // まずグリッドラインを描画
  drawGridLines();
  // 選択されたセルに画像を描画
  selectedCells.forEach(cell => cell.draw());
  
  // アニメーション中は再描画が必要
  if (isAnimating) {
    loop();
  } else {
    // アニメーションは不要なので、一度だけ描画
    noLoop();
  }
  
  frameCount++;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  // リサイズ時にグリッドを再生成
  generateGrid();
  
  redraw();
}

// 完全リセット（グリッドを再生成）
function fullReset() {
  // グリッドを完全に再生成
  generateGrid();
  // フレームカウンターをリセット
  frameCount = 0;
}

// キーボードイベント
function keyPressed() {
  // スペースキーでグリッドを再生成
  if (key === ' ') {
    isAnimating = false; // アニメーションを停止
    generateGrid();
    redraw();
  }
  // dキーで線の表示/非表示を切り替え
  else if (key === 'd' || key === 'D') {
    showLines = !showLines;
    redraw();
  }
  // sキーでアニメーションの開始/停止
  else if (key === 's' || key === 'S') {
    isAnimating = !isAnimating;
    if (isAnimating) {
      loop();
    } else {
      noLoop();
      redraw();
    }
  }
}

// ラインの速度を初期化
function initializeLineVelocities() {
  lineVelocities.vertical = [];
  lineVelocities.horizontal = [];
  const speed = random(CONFIG.LINE_SPEED_ARRAY);
  // 縦のラインの速度を初期化
  for (let i = 0; i < verticalLines.length; i++) {
    let tarSpeed = 0;
    let differentSpeed = null;
    if(random() < CONFIG.LINE_SPEED_DIFFERENT_PROBABILITY){
      differentSpeed = random(CONFIG.LINE_SPEED_MIN, CONFIG.LINE_SPEED_MAX);
    }
    if(differentSpeed){
      tarSpeed = differentSpeed;
    }else{
      tarSpeed = speed;
    }
    const direction = random() > 0.5 ? 1 : -1;
    lineVelocities.vertical.push(tarSpeed * direction);
  }
  
  // 横のラインの速度を初期化
  for (let i = 0; i < horizontalLines.length; i++) {
    let tarSpeed = 0;
    let differentSpeed = null;
    if(random() < CONFIG.LINE_SPEED_DIFFERENT_PROBABILITY){
      differentSpeed = random(CONFIG.LINE_SPEED_MIN, CONFIG.LINE_SPEED_MAX);
    }
    if(differentSpeed){
      tarSpeed = differentSpeed;
    }else{
      tarSpeed = speed;
    }
    const direction = random() > 0.5 ? 1 : -1;
    lineVelocities.horizontal.push(tarSpeed * direction);
  }
}

// ラインの位置を制約（境界のみチェック、ライン同士は跨いでもOK）
function constrainLinePosition(lineType, index, newPos) {
  const maxSize = lineType === 'vertical' ? width : height;
  const margin = 10; // 画面端からの最小マージン
  
  // 境界のみチェック（ライン同士は跨いでもOK）
  return constrain(newPos, margin, maxSize - margin);
}

// ラインの位置を更新（アニメーション用）
function updateLinePositions() {
  // 縦のラインを更新
  const verticalPairs = verticalLines.map((pos, i) => ({
    pos: pos + lineVelocities.vertical[i],
    vel: lineVelocities.vertical[i],
    index: i
  }));
  
  for (let i = 0; i < verticalPairs.length; i++) {
    const constrainedPos = constrainLinePosition('vertical', i, verticalPairs[i].pos);
    
    // 境界に当たったら方向を反転
    if (constrainedPos !== verticalPairs[i].pos) {
      verticalPairs[i].vel *= -1;
      verticalPairs[i].pos = constrainLinePosition('vertical', i, verticalLines[i] + verticalPairs[i].vel);
    }
    
    verticalPairs[i].pos = constrainedPos;
  }
  
  // ソート（ラインの順序を保つ）
  verticalPairs.sort((a, b) => a.pos - b.pos);
  verticalLines = verticalPairs.map(p => p.pos);
  lineVelocities.vertical = verticalPairs.map(p => p.vel);
  
  // 横のラインを更新
  const horizontalPairs = horizontalLines.map((pos, i) => ({
    pos: pos + lineVelocities.horizontal[i],
    vel: lineVelocities.horizontal[i],
    index: i
  }));
  
  for (let i = 0; i < horizontalPairs.length; i++) {
    const constrainedPos = constrainLinePosition('horizontal', i, horizontalPairs[i].pos);
    
    // 境界に当たったら方向を反転
    if (constrainedPos !== horizontalPairs[i].pos) {
      horizontalPairs[i].vel *= -1;
      horizontalPairs[i].pos = constrainLinePosition('horizontal', i, horizontalLines[i] + horizontalPairs[i].vel);
    }
    
    horizontalPairs[i].pos = constrainedPos;
  }
  
  // ソート（ラインの順序を保つ）
  horizontalPairs.sort((a, b) => a.pos - b.pos);
  horizontalLines = horizontalPairs.map(p => p.pos);
  lineVelocities.horizontal = horizontalPairs.map(p => p.vel);
  
  // セルを再生成
  updateCellsFromLines();
}


