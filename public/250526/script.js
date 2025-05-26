// 色面のアニメーション関連の変数
let colorBlocks = []; // 色面のオブジェクトを格納する配列
let blockInterval = 500; // 色面を生成する間隔（ミリ秒）
let lastBlockTime = 0; // 最後に色面を生成した時間
let angle = 0; // 揺れの角度
let angleSpeed = 0.01; // 揺れの速度
let angleRange = 280; // 揺れの範囲を大きく

// ColorBlockクラスの定義
class ColorBlock {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    // 画面の対角線の長さを計算
    let diagonal = sqrt(width * width + height * height);
    this.maxRadius = diagonal; // 画面の対角線と同じ半径
    this.speed = 4; // 拡大速度
    this.fillColor = color(random(0, 360), 80, 100); // カラフルな塗り
    // 塗り色より少し濃い色を設定
    this.strokeColor = color(hue(this.fillColor), saturation(this.fillColor), brightness(this.fillColor) * 0);
  }

  update() {
    // 半径を拡大
    this.radius += this.speed;
  }

  display() {
    // 塗りを設定
    fill(this.fillColor);
    // 縁の色を設定
    stroke(this.strokeColor);
    strokeWeight(2);
    // 指定された位置から円を描画
    ellipse(this.x, this.y, this.radius * 2);
  }

  isDead() {
    return this.radius >= this.maxRadius;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100); // HSBカラーモードを設定
  background(255);
  lastBlockTime = millis();
}

function draw() {
  // 背景を白に設定（透明度を設定して軌跡を残す）
  background(255, 10);

  let currentTime = millis();

  // 揺れの角度を更新
  angle += angleSpeed;

  // 新しい色面の生成（500ミリ秒ごとに確実に生成）
  if (currentTime - lastBlockTime > blockInterval) {
    // 揺れの計算
    let offsetX = sin(angle) * angleRange;
    // 画面中央から円を生成（X座標に揺れを加える）
    colorBlocks.push(new ColorBlock(width/2 + offsetX, height/2));
    lastBlockTime = currentTime;
  }

  // 色面の更新と表示（古い順に描画）
  for (let i = 0; i < colorBlocks.length; i++) {
    colorBlocks[i].update();
    colorBlocks[i].display();
  }

  // 最大半径に達した色面を削除（後ろから削除）
  for (let i = colorBlocks.length - 1; i >= 0; i--) {
    if (colorBlocks[i].isDead()) {
      colorBlocks.splice(i, 1);
    }
  }
}

function mousePressed() {
  // マウスクリックで色面を追加
  colorBlocks.push(new ColorBlock(mouseX, mouseY));
}

// ウィンドウサイズが変更された時の処理
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
