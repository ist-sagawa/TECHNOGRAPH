let startHue = 0;
let endHue = 120; // 初期の色相差を調整
let hueSpeed1 = 2; // 速度を上げて動きを大きく
let hueSpeed2 = 2; // 速度を上げて動きを大きく

// Risoレイヤーを格納する変数を宣言
let fluorescentPinkLayer, blueLayer, yellowLayer;
let gradientBuffer; // オフスクリーンバッファ
let steamMaskImage; // SVGマスクイメージ用

// ハーフトーンの「型」を保存する変数
let pinkPattern, bluePattern, yellowPattern;

// 色相を最短経路で補間する関数
function lerpHueShortestPath(h1, h2, amt) {
  let diff = (h2 - h1 + 540) % 360 - 180; // h2からh1への最短角度差 (-180から180)
  let h = h1 + diff * amt;
  return (h % 360 + 360) % 360; // 結果を0-360の範囲に正規化
}

function preload() {
  steamMaskImage = loadImage('steam.svg');
}

function setup() {
  pixelDensity(1); // ドキュメント推奨の設定を追加
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  // Risoレイヤーを初期化
  fluorescentPinkLayer = new Riso('FLUORESCENTPINK');
  blueLayer = new Riso('BLUE');
  yellowLayer = new Riso('FLUORESCENTYELLOW');

  // 長方形のサイズをここで定義（gradientBufferと共通で使うため）
  let rectW = 500;
  let rectH = floor(height / 1);
  gradientBuffer = createGraphics(rectW, rectH);
  gradientBuffer.colorMode(HSB, 360, 100, 100, 100);
  gradientBuffer.noStroke();

  if (steamMaskImage) {
    steamMaskImage.resize(rectW, rectH); // マスクイメージをグラデーション領域のサイズに合わせる
  }
}

function draw() {
  clear();

  // 長方形の位置とサイズを再定義
  let rectWidth = 500;
  let rectHeight = floor(height / 1);
  let rectX = floor((width - rectWidth) / 2);
  let rectY = floor((height - rectHeight) / 2);

  // 1. gradientBufferに滑らかなグラデーションを描画
  gradientBuffer.clear(); // バッファをクリア
  startHue = (startHue + hueSpeed1) % 360;
  endHue = (endHue + hueSpeed2) % 360;

  let color1 = color(startHue, 100, 100);
  let color2 = color(endHue, 100, 100);

  let segments = 10;
  for (let i = 0; i < segments; i++) {
    let amt = map(i, 0, segments - 1, 0, 1);
    let currentHue = lerpHueShortestPath(startHue, endHue, amt);
    let currentGradientColor = color(currentHue, 100, 100);
    gradientBuffer.fill(currentGradientColor);
    gradientBuffer.rect(0, i * gradientBuffer.height / segments, gradientBuffer.width, gradientBuffer.height / segments);
  }

  clearRiso(); // 全リソレイヤーをクリア

  let halftoneIntensity = 120; 

  // 青レイヤーの処理
  let blueChannelImage = extractRGBChannel(gradientBuffer, 'blue');
  let halftonedBlueImage = halftoneImage(blueChannelImage, 'circle', 8, 45, halftoneIntensity);
  blueLayer.fill(255); 
  blueLayer.image(halftonedBlueImage, rectX, rectY, rectWidth, rectHeight);

  // 蛍光ピンクレイヤーの処理 (赤成分から)
  let redChannelImage = extractRGBChannel(gradientBuffer, 'red');
  let halftonedPinkImage = halftoneImage(redChannelImage, 'circle', 8, 15, halftoneIntensity); 
  fluorescentPinkLayer.fill(255); 
  fluorescentPinkLayer.image(halftonedPinkImage, rectX, rectY, rectWidth, rectHeight);

  // 黄色レイヤーの処理 (緑成分から)
  let greenChannelImage = extractRGBChannel(gradientBuffer, 'green');
  let halftonedYellowImage = halftoneImage(greenChannelImage, 'circle', 8, 75, halftoneIntensity); 
  yellowLayer.fill(255);
  yellowLayer.image(halftonedYellowImage, rectX, rectY, rectWidth, rectHeight);

  // 最終描画とマスク
  drawRiso(); 

  if (steamMaskImage) {
    let risoResult = get(rectX, rectY, rectWidth, rectHeight);
    risoResult.mask(steamMaskImage);
    clear(); // 白背景の代わりに透明でクリア
    image(risoResult, rectX, rectY);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // gradientBufferのサイズも追従
  let rectW = 500;
  let rectH = floor(height / 1);
  gradientBuffer.resizeCanvas(rectW, rectH);

  if (steamMaskImage) {
    steamMaskImage.resize(rectW, rectH); // ウィンドウリサイズ時にもマスクイメージを再リサイズ
  }
}
