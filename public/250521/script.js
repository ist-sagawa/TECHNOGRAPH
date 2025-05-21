let faceParts = [];
let mayu_l = [];
let mayu_r = [];
let eye_l = [];
let eye_r = [];
let nose = [];
let mouth = [];
let currentPart = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastChangeTime = 0;
let changeInterval = 100; // ミリ秒単位（1秒）

console.log("script.js");

function preload() {
  console.log("preload");
  // 顔のパーツを読み込む（2種類ずつからランダムに選択）
  mayu_l = [
    loadImage(`/250521/mayu_l_1.png`),
    loadImage(`/250521/mayu_l_2.png`),
  ]
  mayu_r = [
    loadImage(`/250521/mayu_r_1.png`),
    loadImage(`/250521/mayu_r_2.png`),
  ]
  eye_l = [
    loadImage(`/250521/eye_l_1.png`),
    loadImage(`/250521/eye_l_2.png`),
  ]
  eye_r = [
    loadImage(`/250521/eye_r_1.png`),
    loadImage(`/250521/eye_r_2.png`),
  ]
  nose = [
    loadImage(`/250521/nose_1.png`),
    loadImage(`/250521/nose_2.png`),
  ]
  mouth = [
    loadImage(`/250521/mouse_1.png`),
    loadImage(`/250521/mouse_2.png`),
  ]
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  lastChangeTime = millis();
  // 顔のパーツを描画
  fukuwarai();
}

function fukuwarai() {
  background(0);

  // 顔のパーツを描画
  imageMode(CENTER);
  image(shuffle(mayu_l)[0], width * (0.35+Math.random()*0.1 - 0.05), height * (0.2+Math.random()*0.1 - 0.05), 300*Math.random()+50, 100*Math.random()+50);
  image(shuffle(mayu_r)[0], width * (0.65+Math.random()*0.1 - 0.05), height * (0.2+Math.random()*0.1 - 0.05), 300*Math.random()+50, 100*Math.random()+50);
  image(shuffle(eye_l)[0], width * (0.35+Math.random()*0.1 - 0.05), height * (0.4+Math.random()*0.1 - 0.05), 200*Math.random()+100, 200*Math.random()+50);
  image(shuffle(eye_r)[0], width * (0.65+Math.random()*0.1 - 0.05), height * (0.4+Math.random()*0.1 - 0.05), 200*Math.random()+100, 200*Math.random()+50);
  image(shuffle(nose)[0], width * (0.5+Math.random()*0.1 - 0.05), height * (0.55+Math.random()*0.1 - 0.05), 200*Math.random()+50, 50*Math.random()+250);
  image(shuffle(mouth)[0], width * (0.5+Math.random()*0.1 - 0.05), height * (0.8+Math.random()*0.1 - 0.05), 200*Math.random()+150, 300*Math.random()+50);
}

function draw() {
  let currentTime = millis();
  if (currentTime - lastChangeTime >= changeInterval) {
    fukuwarai();
    lastChangeTime = currentTime;
    if(Math.random() > 0.5) {
      changeInterval = random(50, 300); // 100ミリ秒から2秒の間でランダム
    }
  }
  
  // ドラッグ中のパーツを描画
  if (isDragging && currentPart) {
    imageMode(CENTER);
    image(currentPart.img, mouseX + dragOffsetX, mouseY + dragOffsetY, currentPart.width, currentPart.height);
  }
}

function mousePressed() {
  fukuwarai();
}

function mouseReleased() {
  if (isDragging && currentPart) {
    // ドラッグ終了時の位置を更新
    currentPart.x = mouseX + dragOffsetX;
    currentPart.y = mouseY + dragOffsetY;
  }
  isDragging = false;
  currentPart = null;
}

function mouseDragged() {
  // ドラッグ中の処理はdraw()で行う

}
