function setup() {
  createCanvas(windowWidth, windowHeight);  // キャンバスの大きさ
  background(245); // 薄グレー
  strokeWeight(.5); // 線の太さ
}

function draw() {
  // 青っぽい色
  let r = random(0, 100);
  let g = random(0, 100);
  let b = random(150, 255);
  stroke(r, g, b);
  
  // 左端から、右端へ、y座標はランダムで
  let x1 = 0;
  let y1 = random(height);
  let x2 = width;
  let y2 = random(height);
  line(x1, y1, x2, y2);
}