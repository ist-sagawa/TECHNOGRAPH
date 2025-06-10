let handImg;
let hands = []; // 複数の手を管理する配列
let maxHands = 80; // 最大手の数
let handSpawnInterval = 1000; // 新しい手が生まれる間隔（ミリ秒）
let lastHandSpawnTime = 0;

function preload() {
  // 手の画像を読み込み
  handImg = loadImage('/250610/hand.webp');
}

function setup() {
  // キャンバスを作成してcanvas-containerに追加
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  
  // 最初の手を追加
  addNewHand();
  
  // // ローディング表示を非表示にする
  // let loading = document.getElementById('p5_loading');
  // if (loading) {
  //   loading.style.display = 'none';
  // }
}

function draw() {
  // 背景をクリア（透明）
  background(0);
  
  // 新しい手を追加する時間チェック
  if (millis() - lastHandSpawnTime > handSpawnInterval && hands.length < maxHands) {
    addNewHand();
    lastHandSpawnTime = millis();
  }
  
  // すべての手を更新して描画
  for (let i = 0; i < hands.length; i++) {
    updateHand(hands[i]);
    drawHand(hands[i]);
  }
}

// 新しい手を追加する関数
function addNewHand() {
  // マウスがウィンドウ内にあるかチェック
  let isMouseInWindow = (mouseX >= 1 && mouseX <= width && mouseY >= 1 && mouseY <= height);
  console.log(isMouseInWindow,mouseX,mouseY,width,height);
  let newHand = {
    x: random(-width*2, width*2),
    y: random(-height*2, height*2),
    targetX: isMouseInWindow ? mouseX : width / 2,
    targetY: isMouseInWindow ? mouseY : height / 2,
    easing: random(0.01, 0.08), // それぞれ異なる追跡速度
    size: random(60, 400), // それぞれ異なるサイズ
    delay: random(0, 30), // 反応の遅延
    offset: random(50, 400), // マウスからの距離オフセット
    angle: 0,
    opacity: 255,
    hue: random(0, 360), // 色相をランダム化（オプション）
    birthTime: millis() // 生まれた時間
  };
  hands.push(newHand);
  
  // 手が増えるたびに生成間隔を少し短縮（最小1秒まで）
  handSpawnInterval = max(1000, handSpawnInterval * 0.9);
}

// 手の位置を更新する関数
function updateHand(hand) {
  // マウスがウィンドウ内にあるかチェック
  let isMouseInWindow = (mouseX >= 1 && mouseX <= width && mouseY >= 1 && mouseY <= height);
  
  // 目標位置を設定（マウスがウィンドウ内にない場合は画面中央）
  let targetMouseX = isMouseInWindow ? mouseX : width / 2;
  let targetMouseY = isMouseInWindow ? mouseY : height / 2;
  
  // マウス位置を目標位置として設定（オフセット付き）
  let offsetAngle = atan2(targetMouseY - hand.y, targetMouseX - hand.x) + random(-0.5, 0.5);
  hand.targetX = targetMouseX - cos(offsetAngle) * hand.offset;
  hand.targetY = targetMouseY - sin(offsetAngle) * hand.offset;
  
  // イージングを使って手の位置を滑らかに移動
  hand.x += (hand.targetX - hand.x) * hand.easing;
  hand.y += (hand.targetY - hand.y) * hand.easing;
  
  // 手から目標位置への角度を計算
  hand.angle = atan2(targetMouseY - hand.y, targetMouseX - hand.x);
  
  // 時間経過による透明度の変化（古い手は徐々に薄くなる）
  // let age = millis() - hand.birthTime;
  // if (age > 20000) { // 20秒後から薄くなり始める
  //   hand.opacity = max(50, 255 - (age - 20000) / 100);
  // }
}

// 手を描画する関数
function drawHand(hand) {
  push();
  translate(hand.x, hand.y);
  rotate(hand.angle);
  
  // 透明度を設定
  tint(255, hand.opacity);
  
  // 画像のサイズを調整
  let imgWidth = hand.size;
  let imgHeight = (handImg.height / handImg.width) * imgWidth;
  
  // 手の画像を描画（中心を基準にして、少し後ろに配置して指差し効果を演出）
  imageMode(CENTER);
  image(handImg, -imgWidth * 0.2, 0, imgWidth, imgHeight);
  
  // 色調をリセット
  noTint();
  pop();
}

function windowResized() {
  // ウィンドウサイズが変更された時にキャンバスもリサイズ
  resizeCanvas(windowWidth, windowHeight);
}

// マウスクリックで新しい手を即座に追加
function mousePressed() {
  if (hands.length < maxHands) {
    addNewHand();
  }
  return false;
}

// タッチデバイス対応
function touchStarted() {
  if (hands.length < maxHands) {
    addNewHand();
  }
  return false;
}

// キーボードでコントロール
function keyPressed() {
  if (key === ' ') {
    // スペースキーで新しい手を追加
    if (hands.length < maxHands) {
      addNewHand();
    }
  } else if (key === 'c' || key === 'C') {
    // Cキーですべての手をクリア
    hands = [];
    addNewHand(); // 最初の手を再追加
    handSpawnInterval = 3000; // 間隔をリセット
  } else if (key === 'f' || key === 'F') {
    // Fキーで手を一気に増やす
    for (let i = 0; i < 5 && hands.length < maxHands; i++) {
      addNewHand();
    }
  } else if (key === '1') {
    // 数字キーで最大手数を調整
    maxHands = 5;
  } else if (key === '2') {
    maxHands = 10;
  } else if (key === '3') {
    maxHands = 15;
  } else if (key === '4') {
    maxHands = 20;
  }
}
