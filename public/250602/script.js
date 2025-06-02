const RADIUS_MARGIN = 200
const MIN_DOT_RADIUS = 4
const MAX_DOT_RADIUS = 16
const WHITE = "#ffffff"
const DOTS = []
const DOT_COUNT = 10
let radius = 0

// const LINE_COUNT = 20 // 不要なため削除
const MIN_SPEED = 0.0001
const MAX_SPEED = 0.005
let lines = []

class Line{
  constructor(fromDot, toDot){
    this.fromDot = fromDot
    this.toDot = toDot
  }

  draw(){
    stroke(WHITE)
    strokeWeight(1)
    line(this.fromDot.x, this.fromDot.y, this.toDot.x, this.toDot.y)
  }
}

function setup() {
  createCanvas(windowWidth,windowHeight)
  radius = min(width,height) - RADIUS_MARGIN
  createDots()
  // createLines() // setup から呼び出しを削除
}

function createDots(){
  for(let i = 0; i < DOT_COUNT; i++){
    const initialAngle = random(0, 2 * PI)
    const speed = random(MIN_SPEED, MAX_SPEED) // 各ドットの回転速度を同じにするか、個別に設定できます
    DOTS.push(new Dot(initialAngle, speed))
  }
}

function createLines(){
  lines = [] // 既存の線をクリア
  if (DOTS.length < 2) return; // ドットが2つ未満の場合は線を描画しない

  for (let i = 0; i < DOTS.length; i++) {
    let currentDot = DOTS[i];
    let distances = []; // { dot: otherDot, distSq: dSq }

    for (let j = 0; j < DOTS.length; j++) {
      if (i === j) continue; // 同じドットは比較しない

      let otherDot = DOTS[j];
      const dSq = (currentDot.x - otherDot.x)**2 + (currentDot.y - otherDot.y)**2;
      distances.push({ dot: otherDot, distSq: dSq });
    }

    // 距離の降順（遠い順）でソート
    distances.sort((a, b) => b.distSq - a.distSq);

    // 4番目に遠い点に線を引く (インデックスは3)
    if (distances.length >= 4) {
      lines.push(new Line(currentDot, distances[3].dot));
    }

    // 8番目に遠い点に線を引く (インデックスは7)
    if (distances.length >= 8) {
      lines.push(new Line(currentDot, distances[7].dot));
    }
  }
}

class Dot{
  constructor(initialAngle, speed){
    this.initialAngle = initialAngle;
    this.angle = initialAngle;
    this.speed = speed;
    this.radius = random(MIN_DOT_RADIUS, MAX_DOT_RADIUS);
    // 初期位置の計算は move メソッドで行うか、ここで設定することも可能です
    // this.x = width/2 + cos(this.angle) * radius / 2;
    // this.y = height/2 + sin(this.angle) * radius / 2;
  }

  draw(){
    noStroke()
    fill(WHITE)
    ellipse(this.x, this.y, this.radius, this.radius)
  }

  move(){
    this.angle += this.speed;
    this.x = width/2 + cos(this.angle) * radius / 2;
    this.y = height/2 + sin(this.angle) * radius / 2;
  }
}

function drawCircle(){
  noFill()
  stroke(WHITE)
  strokeWeight(1)
  ellipse(width/2, height/2, radius, radius);
}

function draw() {
  // background()
  clear()
  createLines() // draw 関数内で呼び出すように変更
  drawCircle()
  DOTS.forEach(dot => {
    dot.move()
    dot.draw()
  })
  lines.forEach(line => {
    line.draw()
  })
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
} 