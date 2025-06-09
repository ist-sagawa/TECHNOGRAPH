let fruits = [];
let gridSize = 100; // グリッドのサイズ
let grid = []; // グリッドの状態を保持する配列
let lastUpdateTime = 0; // 最後の更新時間
let updateInterval = 10; // 更新間隔（ミリ秒）
let cols = 20; // 固定の列数
let rows = 20; // 固定の行数


function preload() {
  // ローカルのフルーツ画像を読み込む
  for (let i = 1; i <= 8; i++) {
    fruits.push(loadImage(`/250520/Fruits${i}.png`));
  }
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    initializeGrid();
}

function initializeGrid() {
    // グリッドの初期化
    for (let i = 0; i < rows; i++) {
        grid[i] = [];
        for (let j = 0; j < cols; j++) {
            grid[i][j] = null; // 初期状態は空
        }
    }
}

function draw() {
  background(240);
  
  // 一定間隔で新しいフルーツを追加
  let currentTime = millis();
  if (currentTime - lastUpdateTime > updateInterval) {
    addNewFruit();
    lastUpdateTime = currentTime;
  }
  
  // グリッドの描画
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j] !== null) {
        imageMode(CORNER);
        image(grid[i][j], 
          j * gridSize, 
          i * gridSize, 
          gridSize, 
          gridSize
        );
      }
    }
  }
}

function addNewFruit() {
    // 空いているグリッドを探す
    let emptyCells = [];
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            if (grid[i][j] === null) {
                emptyCells.push({row: i, col: j});
            }
        }
    }
    
    // 空いているセルがあれば、ランダムに1つ選んでフルーツを配置
    if (emptyCells.length > 0) {
        let randomCell = random(emptyCells);
        grid[randomCell.row][randomCell.col] = random(fruits);
    } else {
        // 全て埋まったらリセット
        initializeGrid();
    }
}

function mousePressed() {
    // クリックした位置のグリッドを計算
    let col = floor(mouseX / gridSize);
    let row = floor(mouseY / gridSize);
    
    // グリッドの範囲内かチェック
    if (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length) {
        // クリックした位置に新しいフルーツを配置
        grid[row][col] = random(fruits);
    }
}
