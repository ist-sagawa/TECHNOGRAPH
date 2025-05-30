function setup() {
  createCanvas(windowWidth, windowHeight);
  background(245);
  strokeWeight(0.5);
}

function draw() {
  // 青系の色
  let r = random(0, 100);
  let g = random(0, 100);
  let b = random(150, 255);
  stroke(r, g, b);
  
  // ランダムに選んだ左端の y 座標
  let x1 = 0;
  let y1 = random(height);
  // 右端 x2
  let x2 = width;
  // マウス位置 (mouseX, mouseY) を通るように y2 を求める
	let ratio = (x2 - mouseX) / (mouseX - x1) // mouseXを境にした左右の長さの比率
	let underY = (mouseY - y1) * ratio
	let y2 = mouseY + underY
	line(x1, y1, x2, y2);
}
