// 複数人を描画するスケッチ

let people = [];
const NUM_PEOPLE = 10;

// 角度の値を格納するグローバル変数 (setup内で初期化)
let UP_ARM_ANGLE, DOWN_ARM_ANGLE, UP_LEG_ANGLE, DOWN_LEG_ANGLE;
let RIGHT_UP_ARM_ANGLE, RIGHT_DOWN_ARM_ANGLE;

const SCALE_FACTOR = 2; // 人形の全体的なスケール
const MOVE_SPEED = 0.08; // 手足・頭・体が目標に近づく速さ
const HEAD_BASE_SIZE = 80 * SCALE_FACTOR; // 頭の基本サイズ
const HEAD_MOVE_AMOUNT = 15 * SCALE_FACTOR;
const PERSON_Y_MOVE_AMOUNT = 40 * SCALE_FACTOR;

const HEAD_ACTION_INTERVAL = 200;
const ACTION_INTERVAL = HEAD_ACTION_INTERVAL * 2;

let globalXOffset = 0;
const SWAY_AMOUNT = 200 * SCALE_FACTOR;
const SWAY_SPEED = 0.005;

// const HEAD_SHAPE_TYPES = ['random']; // 要素が1つなので、直接指定でもOK
// もしくは、この定数自体を削除し、setup内で直接 'random' を使う

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  UP_ARM_ANGLE = PI;
  DOWN_ARM_ANGLE = PI / 6;
  RIGHT_UP_ARM_ANGLE = -UP_ARM_ANGLE;
  RIGHT_DOWN_ARM_ANGLE = -DOWN_ARM_ANGLE;
  UP_LEG_ANGLE = -PI / 2.5;
  DOWN_LEG_ANGLE = PI / 6;

  let currentTime = millis();
  for (let i = 0; i < NUM_PEOPLE; i++) {
    // let shapeType = random(HEAD_SHAPE_TYPES); // HEAD_SHAPE_TYPES を使わない場合
    let shapeType = 'random'; // 常にランダムな三角形
    let randomPoints = {};
    if (shapeType === 'random') {
      const bottomX = random(-HEAD_BASE_SIZE / 5, HEAD_BASE_SIZE / 5);
      const bottomY = random(HEAD_BASE_SIZE * 0.4, HEAD_BASE_SIZE * 0.6);
      const topLeftX = random(-HEAD_BASE_SIZE * 0.7, -HEAD_BASE_SIZE * 0.3);
      const topLeftY = random(-HEAD_BASE_SIZE * 0.6, -HEAD_BASE_SIZE * 0.3);
      const topRightX = random(HEAD_BASE_SIZE * 0.3, HEAD_BASE_SIZE * 0.7);
      const topRightY = random(-HEAD_BASE_SIZE * 0.6, -HEAD_BASE_SIZE * 0.3);
      randomPoints = {
        x1: bottomX,
        y1: bottomY,
        x2: topLeftX,
        y2: topLeftY,
        x3: topRightX,
        y3: topRightY
      };
    }

    people.push({
      leftArmAngle: DOWN_ARM_ANGLE,
      rightArmAngle: RIGHT_DOWN_ARM_ANGLE,
      leftLegAngle: DOWN_LEG_ANGLE,
      rightLegAngle: DOWN_LEG_ANGLE,
      targetLeftArmAngle: random([UP_ARM_ANGLE, DOWN_ARM_ANGLE]),
      targetRightArmAngle: random([RIGHT_UP_ARM_ANGLE, RIGHT_DOWN_ARM_ANGLE]),
      targetLeftLegAngle: random([-UP_LEG_ANGLE, DOWN_LEG_ANGLE]),
      targetRightLegAngle: random([UP_LEG_ANGLE, DOWN_LEG_ANGLE]),
      headOffsetY: 0,
      targetHeadOffsetY: HEAD_MOVE_AMOUNT,
      personYOffset: 0,
      targetPersonYOffset: random([-PERSON_Y_MOVE_AMOUNT, PERSON_Y_MOVE_AMOUNT + 10]),
      nextActionTime: currentTime + ACTION_INTERVAL,
      nextActionTimeHead: currentTime + HEAD_ACTION_INTERVAL,
      h: random(360),
      s: random(70, 100),
      b: random(40, 100),
      hueChangeRate: random(-2, 2),
      headShapeType: shapeType, // 'random' が常にセットされる
      randomTrianglePoints: randomPoints,
      bodyWidth: random(80, 120),
    });
  }
}

function updatePerson(person) {
  let currentTime = millis();

  if (currentTime > person.nextActionTime) {
    person.targetLeftArmAngle = random([UP_ARM_ANGLE, DOWN_ARM_ANGLE]);
    person.targetRightArmAngle = random([RIGHT_UP_ARM_ANGLE, RIGHT_DOWN_ARM_ANGLE]);
    person.targetLeftLegAngle = random([-UP_LEG_ANGLE, DOWN_LEG_ANGLE]);
    person.targetRightLegAngle = random([UP_LEG_ANGLE, DOWN_LEG_ANGLE]);
    person.nextActionTime = currentTime + ACTION_INTERVAL;
  }

  if (currentTime > person.nextActionTimeHead) {
    person.targetHeadOffsetY = -person.targetHeadOffsetY;
    person.targetPersonYOffset = -person.targetPersonYOffset;
    person.nextActionTimeHead = currentTime + HEAD_ACTION_INTERVAL;
  }

  person.h += person.hueChangeRate;
  if (person.h > 360) person.h -= 360;
  if (person.h < 0) person.h += 360;

  person.leftArmAngle = lerp(person.leftArmAngle, person.targetLeftArmAngle, MOVE_SPEED);
  person.rightArmAngle = lerp(person.rightArmAngle, person.targetRightArmAngle, MOVE_SPEED);
  person.leftLegAngle = lerp(person.leftLegAngle, person.targetLeftLegAngle, MOVE_SPEED);
  person.rightLegAngle = lerp(person.rightLegAngle, person.targetRightLegAngle, MOVE_SPEED);
  person.headOffsetY = lerp(person.headOffsetY, person.targetHeadOffsetY, MOVE_SPEED);
  person.personYOffset = lerp(person.personYOffset, person.targetPersonYOffset, MOVE_SPEED);
}

function drawPerson(person) {
  fill(person.h, person.s, person.b);
  stroke(0);
  strokeWeight(1 * SCALE_FACTOR);

  // 左腕
  push();
  translate(-40 * SCALE_FACTOR, -50 * SCALE_FACTOR);
  rotate(person.leftArmAngle);
  rect(0, 0, 30 * SCALE_FACTOR, 100 * SCALE_FACTOR);
  ellipse(0, 100 * SCALE_FACTOR, 40 * SCALE_FACTOR, 40 * SCALE_FACTOR);
  pop();

  // 右腕
  push();
  translate(40 * SCALE_FACTOR, -50 * SCALE_FACTOR);
  rotate(person.rightArmAngle);
  rect(0, 0, 30 * SCALE_FACTOR, 100 * SCALE_FACTOR);
  ellipse(0, 100 * SCALE_FACTOR, 40 * SCALE_FACTOR, 40 * SCALE_FACTOR);
  pop();

  // 左足
  push();
  translate(-25 * SCALE_FACTOR, 50 * SCALE_FACTOR); // ユーザーによる変更を維持
  rotate(person.leftLegAngle);
  rect(0, 0, 40 * SCALE_FACTOR, 100 * SCALE_FACTOR);
  ellipse(0, 100 * SCALE_FACTOR, 40 * SCALE_FACTOR, 40 * SCALE_FACTOR);
  pop();

  // 右足
  push();
  translate(25 * SCALE_FACTOR, 50 * SCALE_FACTOR); // ユーザーによる変更を維持
  rotate(person.rightLegAngle);
  rect(0, 0, 40 * SCALE_FACTOR, 100 * SCALE_FACTOR);
  ellipse(0, 100 * SCALE_FACTOR, 40 * SCALE_FACTOR, 40 * SCALE_FACTOR);
  pop();

  // 体 (頭より先に描画)
  rectMode(CENTER);
  rect(0, 0, person.bodyWidth * SCALE_FACTOR, 150 * SCALE_FACTOR);

  // 頭の描画 (常にランダムな三角形を描画)
  let headY = -100 * SCALE_FACTOR + person.headOffsetY;
  push();
  translate(0, headY); 

  // 'isosceles' の分岐を削除し、常にランダムな三角形のロジックを実行
  // if (person.headShapeType === 'isosceles') { ... } else { ... } の構造を解消
  let p = person.randomTrianglePoints; 
  triangle(p.x1, p.y1, p.x2, p.y2, p.x3, p.y3);
  
  pop(); 
}

function draw() {
  background(0);
  
  // 全体のXオフセットを時間とともに更新 (sin波で揺れ)
  globalXOffset = sin(frameCount * SWAY_SPEED) * SWAY_AMOUNT;
  
  const personWidth = (100 + 40 + 40) * SCALE_FACTOR;
  const spacing = personWidth * 0.2;
  const totalWidth = (personWidth + spacing) * NUM_PEOPLE - spacing;
  let startX = (width - totalWidth) / 2;

  for (let i = 0; i < people.length; i++) {
    let p = people[i];
    updatePerson(p);
    
    push();
    // 各人形のX座標に globalXOffset を加算
    let currentPersonX = startX + i * (personWidth + spacing) + personWidth/2 + globalXOffset;
    translate(currentPersonX , height / 2 + p.personYOffset);
    drawPerson(p);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
} 