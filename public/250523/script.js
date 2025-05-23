// パーティクルシステム関連の変数
let particles = []; // パーティクルオブジェクトを格納する配列
let maxParticles = 3500; // 最大パーティクル数
let boundaryCircle; // 境界円のオブジェクト
let lastParticleTime = 0; // 最後にパーティクルを生成した時間
let particleInterval = 20; // パーティクル生成の間隔（ミリ秒）
let particlesPerInterval = 20; // 1回の生成で追加するパーティクル数
let initialParticlesGenerated = 0; // 初期パーティクルの生成数を追跡
let initialParticleInterval = 10; // 初期パーティクル生成の間隔（ミリ秒）
let boundaryShape = 'circle'; // 現在の境界形状
let lastShapeChangeTime = 0; // 最後に形状を変更した時間
let shapeChangeInterval = 4000; // 形状変更の間隔（ミリ秒）
// 形状ごとのスケール変数を追加
let circleScale = 1.0;
let triangleScale = 1.0;
let squareScale = 1.0;

// Particleクラスの定義
class Particle {
  constructor(x, y, color) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D(); // ランダムな方向に移動
    this.vel.mult(random(1, 15)); // 速度をランダムに調整
    this.color = color; // パーティクルの色
    this.lifespan = 1000; // 生存期間（透明度として使用）
    this.size = random(1, 2); // パーティクルのサイズ
  }

  update() {
    this.pos.add(this.vel);
    this.lifespan -= 1.5;

    let distToCenter = dist(this.pos.x, this.pos.y, boundaryCircle.x, boundaryCircle.y);
    let isOutside = false;
    let reflectNormal = null;
    let reflectPos = null;

    switch(boundaryShape) {
      case 'circle':
        isOutside = distToCenter > boundaryCircle.r * circleScale;
        if (isOutside) {
          let angle = atan2(this.pos.y - boundaryCircle.y, this.pos.x - boundaryCircle.x);
          reflectPos = createVector(
            boundaryCircle.x + cos(angle) * boundaryCircle.r * circleScale * 0.9,
            boundaryCircle.y + sin(angle) * boundaryCircle.r * circleScale * 0.9
          );
          reflectNormal = p5.Vector.sub(reflectPos, createVector(boundaryCircle.x, boundaryCircle.y)).normalize();
        }
        break;
      case 'triangle': {
        let [top, left, right] = getTriangleVertices(triangleScale);
        let area = this.triangleArea(top.x, top.y, left.x, left.y, right.x, right.y);
        let area1 = this.triangleArea(this.pos.x, this.pos.y, left.x, left.y, right.x, right.y);
        let area2 = this.triangleArea(top.x, top.y, this.pos.x, this.pos.y, right.x, right.y);
        let area3 = this.triangleArea(top.x, top.y, left.x, left.y, this.pos.x, this.pos.y);
        isOutside = Math.abs((area1 + area2 + area3) - area) > 0.1;
        if (isOutside) {
          let p = createVector(this.pos.x, this.pos.y);
          let cp1 = this.closestPointOnLine(p, top, left);
          let cp2 = this.closestPointOnLine(p, left, right);
          let cp3 = this.closestPointOnLine(p, right, top);
          let d1 = p5.Vector.dist(p, cp1);
          let d2 = p5.Vector.dist(p, cp2);
          let d3 = p5.Vector.dist(p, cp3);
          let minD = min(d1, d2, d3);
          if (minD === d1) {
            reflectPos = p5.Vector.lerp(cp1, top, 0.01);
            reflectNormal = p5.Vector.sub(left, top).rotate(HALF_PI).normalize();
          } else if (minD === d2) {
            reflectPos = p5.Vector.lerp(cp2, left, 0.01);
            reflectNormal = p5.Vector.sub(right, left).rotate(HALF_PI).normalize();
          } else {
            reflectPos = p5.Vector.lerp(cp3, right, 0.01);
            reflectNormal = p5.Vector.sub(top, right).rotate(HALF_PI).normalize();
          }
        }
        break;
      }
      case 'square': {
        let squareSize = boundaryCircle.r * 1.5 * squareScale;
        isOutside = abs(this.pos.x - boundaryCircle.x) > squareSize/2 || 
                   abs(this.pos.y - boundaryCircle.y) > squareSize/2;
        if (isOutside) {
          let minX = boundaryCircle.x - squareSize/2;
          let maxX = boundaryCircle.x + squareSize/2;
          let minY = boundaryCircle.y - squareSize/2;
          let maxY = boundaryCircle.y + squareSize/2;
          let x = constrain(this.pos.x, minX, maxX);
          let y = constrain(this.pos.y, minY, maxY);
          reflectPos = createVector(x, y);
          if (abs(this.pos.x - minX) < 1) reflectNormal = createVector(-1, 0);
          else if (abs(this.pos.x - maxX) < 1) reflectNormal = createVector(1, 0);
          else if (abs(this.pos.y - minY) < 1) reflectNormal = createVector(0, -1);
          else reflectNormal = createVector(0, 1);
        }
        break;
      }
    }
    if (isOutside && reflectPos && reflectNormal) {
      this.pos.x = reflectPos.x;
      this.pos.y = reflectPos.y;
      this.vel.reflect(reflectNormal);
      this.vel.mult(random(0.8, 1.0));
    }
  }

  // 点と線分との距離を計算する補助関数
  distToLine(x, y, x1, y1, x2, y2) {
    let A = x - x1;
    let B = y - y1;
    let C = x2 - x1;
    let D = y2 - y1;

    let dot = A * C + B * D;
    let len_sq = C * C + D * D;
    let param = -1;

    if (len_sq != 0) {
      param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    let dx = x - xx;
    let dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  // 三角形の面積を計算する補助関数
  triangleArea(x1, y1, x2, y2, x3, y3) {
    return abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
  }

  // 線分ab上の最近点を返す
  closestPointOnLine(p, a, b) {
    let ap = p5.Vector.sub(p, a);
    let ab = p5.Vector.sub(b, a);
    let t = ap.dot(ab) / ab.magSq();
    t = constrain(t, 0, 1);
    return p5.Vector.add(a, ab.mult(t));
  }

  display() {
    noStroke();
    // HSBモードで色を設定（透明度も考慮）
    let displayColor = color(0, 0, 100, this.lifespan); // 白色（HSB: 0,0,100）
    fill(displayColor);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }

  isDead() {
    return this.lifespan < 0;
  }
}

// 三角形の頂点を返す関数を追加
function getTriangleVertices(scale = 1.0) {
  let R = boundaryCircle.r * scale;
  let cx = boundaryCircle.x;
  let cy = boundaryCircle.y;
  let angleOffset = -PI / 2;
  // 重心が中心に来るようにy座標を上に補正
  // let centerOffsetY = R / 2;
  let centerOffsetY = (R - (R * sin(PI / 6))) / 2;

  let top = createVector(
    cx + R * cos(angleOffset),
    cy + R * sin(angleOffset) + centerOffsetY
  );
  let left = createVector(
    cx + R * cos(angleOffset + TWO_PI / 3),
    cy + R * sin(angleOffset + TWO_PI / 3) + centerOffsetY
  );
  let right = createVector(
    cx + R * cos(angleOffset + 2 * TWO_PI / 3),
    cy + R * sin(angleOffset + 2 * TWO_PI / 3) + centerOffsetY
  );
  return [top, left, right];
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 255); // 透明度も考慮してカラーモードを設定
  background(0);
  
  // 境界円の初期化
  boundaryCircle = {
    x: width / 2,
    y: height / 2,
    r: min(width, height) * 0.4 // 画面の小さい方の40%を半径とする
  };
  
  // 初期パーティクルは生成せず、draw関数内で段階的に生成
  lastParticleTime = millis();
  // 初期スケールもランダムに
  circleScale = random(0.1, 1.4);
  triangleScale = random(0.1, 1.4);
  squareScale = random(0.1, 1.4);
}

function draw() {
  // 背景を少しずつ描画して軌跡を残す（透明度付きの背景）
  background(0, 10); // 透明度を低く設定

  let currentTime = millis();

  // --- 境界線の形状変更 --- //
  if (currentTime - lastShapeChangeTime > shapeChangeInterval) {
    switch(boundaryShape) {
      case 'circle':
        boundaryShape = 'triangle';
        triangleScale = random(0.1, 1.4);
        break;
      case 'triangle':
        boundaryShape = 'square';
        squareScale = random(0.1, 1.4);
        break;
      case 'square':
        boundaryShape = 'circle';
        circleScale = random(0.1, 1.4);
        break;
    }
    lastShapeChangeTime = currentTime;
  }

  // // --- デバッグ用：境界線を描画 --- //
  // noFill();
  // stroke(255, 100); // 白く半透明の線
  // switch(boundaryShape) {
  //   case 'circle':
  //     ellipse(boundaryCircle.x, boundaryCircle.y, boundaryCircle.r * 2 * circleScale);
  //     break;
  //   case 'triangle': {
  //     let [top, left, right] = getTriangleVertices(triangleScale);
  //     triangle(top.x, top.y, left.x, left.y, right.x, right.y);
  //     break;
  //   }
  //   case 'square':
  //     let squareSize = boundaryCircle.r * 1.5 * squareScale;
  //     rectMode(CENTER);
  //     rect(boundaryCircle.x, boundaryCircle.y, squareSize, squareSize);
  //     break;
  // }
  // // ---------------------------------- //

  // 初期パーティクルの段階的な生成
  if (initialParticlesGenerated < maxParticles && currentTime - lastParticleTime > initialParticleInterval) {
    for(let i = 0; i < particlesPerInterval; i++) {
      let angle = random(TWO_PI);
      let distance = random(boundaryCircle.r * 0.8);
      let x = boundaryCircle.x + cos(angle) * distance;
      let y = boundaryCircle.y + sin(angle) * distance;
      let randomColor = color(0, 0, 100);
      particles.push(new Particle(x, y, randomColor));
      initialParticlesGenerated++;
    }
    lastParticleTime = currentTime;
  }

  // パーティクルの更新と表示
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();

    // 生存期間が終了したパーティクルを配列から削除
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
  
  // 初期パーティクルの生成が完了したら、通常のパーティクル生成に切り替え
  if (initialParticlesGenerated >= maxParticles && currentTime - lastParticleTime > particleInterval && particles.length < maxParticles) {
    for(let i = 0; i < particlesPerInterval; i++) {
      let angle = random(TWO_PI);
      let distance = random(boundaryCircle.r * 0.8);
      let x = boundaryCircle.x + cos(angle) * distance;
      let y = boundaryCircle.y + sin(angle) * distance;
      let randomColor = color(0, 0, 100);
      particles.push(new Particle(x, y, randomColor));
    }
    lastParticleTime = currentTime;
  }
}

function mousePressed() {
  // マウスクリックでパーティクルを追加
  let numParticlesToAdd = 50; // クリックで追加するパーティクル数
  for(let i = 0; i < numParticlesToAdd; i++){
    // クリック位置周辺にパーティクルを生成
    let particleX = mouseX + random(-20, 20);
    let particleY = mouseY + random(-20, 20);
    let randomColor = color(0, 0, 100);
    particles.push(new Particle(particleX, particleY, randomColor));
  }
}
