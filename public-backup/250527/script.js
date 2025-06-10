// アニメーション関連の変数
let balls = [];
let maxBalls = 24;
let floorY;
let lastDropTime = 0;
let dropInterval = 300; // 500msごと

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  floorY = height;
  balls = [];
  lastDropTime = millis();
}

function createBall() {
  let radius = random(10, 200);
  let gray = random(30, 230);
  return {
    pos: createVector(random(radius, width - radius), -radius),
    vel: createVector(0, random(2, 8)),
    radius: radius,
    color: color(gray),
    gravity: random(0.2, 0.6),
    bounce: random(0.6, 0.9)
  };
}

function draw() {
  background(0);
  noFill();
  stroke(100);
  strokeWeight(1);
  rect(0, floorY, width, height - floorY);

  // 500msごとに新しいボールを追加
  if (millis() - lastDropTime > dropInterval) {
    balls.push(createBall());
    lastDropTime = millis();
    if (balls.length > maxBalls) balls.shift();
  }

  // ボール同士の衝突判定
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      collideBalls(balls[i], balls[j]);
    }
  }

  // ボールの更新・描画
  for (let ball of balls) {
    updateBall(ball);
    drawBall(ball);
  }
}

function updateBall(ball) {
  ball.vel.y += ball.gravity;
  ball.pos.add(ball.vel);

  // 床との衝突判定
  if (ball.pos.y + ball.radius > floorY) {
    ball.pos.y = floorY - ball.radius;
    ball.vel.y *= -ball.bounce;
    ball.vel.x *= 0.98;
    if (abs(ball.vel.y) < 1) ball.vel.y = 0;
  }
  // 画面端との衝突判定
  if (ball.pos.x < ball.radius) {
    ball.pos.x = ball.radius;
    ball.vel.x *= -0.8;
  }
  if (ball.pos.x > width - ball.radius) {
    ball.pos.x = width - ball.radius;
    ball.vel.x *= -0.8;
  }
}

function drawBall(ball) {
  // fill(ball.color);
  stroke(ball.color);
  noFill();
  ellipse(ball.pos.x, ball.pos.y, ball.radius * 2);
}

function collideBalls(b1, b2) {
  let distVec = p5.Vector.sub(b2.pos, b1.pos);
  let dist = distVec.mag();
  let minDist = b1.radius + b2.radius;
  if (dist < minDist && dist > 0) {
    let overlap = minDist - dist;
    let correction = distVec.copy().setMag(overlap / 2);
    b1.pos.sub(correction);
    b2.pos.add(correction);
    let normal = distVec.copy().normalize();
    let relVel = p5.Vector.sub(b2.vel, b1.vel);
    let sepVel = relVel.dot(normal);
    if (sepVel < 0) {
      let bounce = 0.9;
      let impulse = (-(1 + bounce) * sepVel) / (1 / b1.radius + 1 / b2.radius);
      let impulseVec = normal.copy().mult(impulse);
      b1.vel.sub(impulseVec.copy().div(b1.radius));
      b2.vel.add(impulseVec.copy().div(b2.radius));
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
