let lastChangeTime = 0;
let changeInterval = 300; // ミリ秒単位
let cols, rows; // 分割数（動的に変更）
let minDivisions = 1; // 最小分割数
let maxDivisions = 15; // 最大分割数
let colorPalette = []; // 色のパレット
let texts = ['2025','05', '22', 'COLOR', 'DIV']; // 表示するテキスト
let cellTexts = []; // セルごとのテキスト情報を保存

function preload() {
  console.log("preload");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  colorMode(HSB, 360, 100, 100);
  textAlign(CENTER, CENTER);
  textFont('scandia-web');
  
  // フォントの設定
  drawingContext.font = '700 16px scandia-web';
  drawingContext.letterSpacing = '0.2em';
  
  // カラーパレットの初期化
  colorPalette = [
    color(0, 0, 0),      // 黒
    color(0, 0, 20),     // ダークグレー
    color(0, 0, 40),     // グレー
    color(20, 100, 90),  // オレンジ
    color(225, 80, 90)   // 水色
  ];
  generateNewPattern();
}

function getRandomDivisions() {
  // 新しい分割数を生成
  cols = floor(random(minDivisions, maxDivisions + 1));
  rows = floor(random(minDivisions, maxDivisions + 1));
}

function generateNewPattern() {
  background(0);
  cellTexts = []; // テキスト情報をリセット
  
  // 新しい分割数を設定
  getRandomDivisions();
  
  // セルのサイズを計算（少し大きめに設定）
  let cellWidth = ceil(width / cols) + 1;
  let cellHeight = ceil(height / rows) + 1;
  
  // グリッドを生成
  for (let i = 0; i < cols; i++) {
    cellTexts[i] = [];
    for (let j = 0; j < rows; j++) {
      // セルの中心座標を計算
      let centerX = floor(i * cellWidth) + cellWidth/2;
      let centerY = floor(j * cellHeight) + cellHeight/2;
      
      // ランダムな色を選択
      let randomColor = colorPalette[floor(random(colorPalette.length))];
      
      // テキスト情報を保存
      if (random() < 0.1) {
        cellTexts[i][j] = {
          text: texts[floor(random(texts.length))],
          color: randomColor,
          x: centerX,
          y: centerY,
          size: min(cellWidth, cellHeight) * random(0.5, 1.5)
        };
      } else {
        cellTexts[i][j] = null;
      }
      
      // セルを描画
      fill(randomColor);
      noStroke();
      rect(floor(i * cellWidth), floor(j * cellHeight), cellWidth, cellHeight);
    }
  }
}

function draw() {
  // パターン全体の更新
  let currentTime = millis();
  if (currentTime - lastChangeTime >= changeInterval) {
    generateNewPattern();
    lastChangeTime = currentTime;
    return;
  }
  
  // 既存のテキストの更新
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let cell = cellTexts[i][j];
      if (cell) {
        // テキストの色を設定
        let b = cell.color.levels[2];
        fill(b < 128 ? color(0, 0, 100) : color(0, 0, 0));
        
        // フォントサイズを設定
        textSize(cell.size);
        
        // テキストを描画
        text(cell.text, cell.x, cell.y);
      }
    }
  }
}

function mousePressed() {
  generateNewPattern();
} 