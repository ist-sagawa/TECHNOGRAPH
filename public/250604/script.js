// public/250604/script.js 

let img;
let theShader;
let shaderGraphics; // 画像処理用オフスクリーンバッファ

const initialGridSize = { cols: 4, rows: 5 }; // グリッドの初期分割数
let currentGridSize = { cols: initialGridSize.cols, rows: initialGridSize.rows };

let lastGridChangeTime = 0;
const gridChangeInterval = 1000; // グリッド変更間隔 (ミリ秒) - ユーザー設定に合わせて1000ms

let shaderTimeSeed = 0; // シェーダーに渡す最終的なシード値
let animationPhaseEndTime = 0; // 現在のグリッドインターバルにおけるアニメーションフェーズの終了時刻
const animationDurationRatio = 0.2; // gridChangeIntervalに対するアニメーション期間の割合 (例: 20%)

function preload() {
  // 画像のパスは /japan.webp と仮定 (publicフォルダ直下)
  // もし異なる場合は、正しいパスに変更してください。
  img = loadImage('/250604/japan.webp');
  theShader = loadShader('/250604/shader.vert', '/250604/shader.frag');
}

function setup() {
  createCanvas(windowWidth, windowHeight); // メインキャンバスをウィンドウサイズに
  // shaderGraphics は画像の元の解像度で作成
  shaderGraphics = createGraphics(img.width, img.height, WEBGL);
  shaderGraphics.noStroke(); // shaderGraphicsの枠線はなし
  lastGridChangeTime = millis(); // 最初のグリッド変更タイミングのために初期化
  animationPhaseEndTime = lastGridChangeTime + gridChangeInterval * animationDurationRatio;
  shaderTimeSeed = millis() / 5000.0; // 初期シード
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // ウィンドウリサイズ時にキャンバスもリサイズ
}

function draw() {
  background(0); // メインキャンバスを黒でクリア (画像がウィンドウより小さい場合のため)
  let currentTime = millis();

  // --- グリッドサイズの周期的変更 ---
  if (currentTime - lastGridChangeTime > gridChangeInterval) {
    currentGridSize.cols = floor(random(1, 9)); // ユーザー設定に合わせて1から15
    currentGridSize.rows = floor(random(1, 6)); // ユーザー設定に合わせて1から15
    lastGridChangeTime = currentTime;
    // 新しいインターバルのアニメーション終了時刻を計算
    animationPhaseEndTime = currentTime + gridChangeInterval * animationDurationRatio;
    // グリッド変更直後も shaderTimeSeed が動的に更新されるように、この後のif文で処理される
  }

  // --- timeSeed の更新ロジック ---
  if (currentTime < animationPhaseEndTime) {
    // アニメーションフェーズ中: shaderTimeSeedを動的に更新
    shaderTimeSeed = currentTime / 5000.0;
  } 
  // animationPhaseEndTime を過ぎたら、shaderTimeSeed は更新されず、
  // アニメーションフェーズの最後に設定された値が維持される。

  // --- shaderGraphicsへの描画処理 ---
  shaderGraphics.shader(theShader);
  theShader.setUniform('tex0', img);
  theShader.setUniform('gridSize', [parseFloat(currentGridSize.cols), parseFloat(currentGridSize.rows)]);
  theShader.setUniform('u_time_seed', shaderTimeSeed);

  shaderGraphics.beginShape();
  // shaderGraphics全体を覆う四角形。頂点座標はshaderGraphicsの幅・高さを基準にする
  shaderGraphics.vertex(-shaderGraphics.width / 2, -shaderGraphics.height / 2, 0, 0, 0); // 左上
  shaderGraphics.vertex(shaderGraphics.width / 2, -shaderGraphics.height / 2, 0, 1, 0);  // 右上
  shaderGraphics.vertex(shaderGraphics.width / 2, shaderGraphics.height / 2, 0, 1, 1);   // 右下
  shaderGraphics.vertex(-shaderGraphics.width / 2, shaderGraphics.height / 2, 0, 0, 1);  // 左下
  shaderGraphics.endShape(CLOSE);
  // --- shaderGraphicsへの描画終了 ---

  // --- shaderGraphicsの内容をメインキャンバスに中央揃えで描画 ---
  let canvasW = width;    // メインキャンバスの幅 (windowWidth)
  let canvasH = height;   // メインキャンバスの高さ (windowHeight)
  let imageW = shaderGraphics.width;  // 表示する画像の幅 (img.width)
  let imageH = shaderGraphics.height; // 表示する画像の高さ (img.height)

  // アスペクト比を保ったまま最大スケールを計算
  let scale = Math.min(canvasW / imageW, canvasH / imageH);

  let dispW = imageW * scale; // 表示上の幅
  let dispH = imageH * scale; // 表示上の高さ

  // 中央揃えのためのオフセット計算
  let dispX = (canvasW - dispW) / 2;
  let dispY = (canvasH - dispH) / 2;

  image(shaderGraphics, dispX, dispY, dispW, dispH);
}

