// パラメーター設定
const CONFIG = {
  // 基本設定
  maxLines: 40,           // 最大線数
  frameRate: 15,          // フレームレート
  
  // エリア設定
  areaRadiusRatio: 0.3,   // 画面サイズに対するエリア半径の比率
  areaMargin: 30,         // エリア境界からのマージン
  boundaryMargin: 5,      // 境界衝突判定のマージン
  
  // 線の動作設定
  speedMin: 10,            // 線の最小速度
  speedMax: 20,           // 線の最大速度
  maxAttempts: 24,        // 回避方向の最大試行回数
  
  // 衝突判定設定
  selfDistanceThreshold: 5,     // 自分自身との距離判定閾値
  pointDistanceThreshold: 5,   // 点との距離判定閾値
  selfCheckMinLength: 15,       // 自分自身チェックの最小長さ
  selfCheckGap: 10,            // 自分自身チェックのギャップ
  intersectCheckGap: 6,        // 交差チェックのギャップ
  
  // リセット・追加設定
  resetLineCount: 1000,         // リセットする線数
  addNewLinesThreshold: 15,     // 新しい線を追加する閾値
  newLinesToAdd: 10,            // 追加する線数
  maxTotalLines: 120,          // 最大総線数（maxLines * 3）
  minLineLength: 10,           // 削除しない最小線長
  
  // デバッグ表示設定
  debugTextSize: {
    info: 12,                  // 情報テキストサイズ
    collision: 10,             // 衝突タイプテキストサイズ
    attempts: 8,               // 試行回数テキストサイズ
    click: 10                  // クリック案内テキストサイズ
  },
  
  // 色設定
  colors: {
    background: 255,           // 背景色
    activeLine: [0],          // アクティブな線の色
    stuckLine: [0, 0, 255],   // 止まった線の色（青）
    debugText: [100, 100, 255], // デバッグテキストの色
    clickText: [150]          // クリック案内テキストの色
  }
};

// グローバル変数
let lines = [];
let frameCounter = 0;
let debugMode = false;
let totalLinesCreated = 0;
let areaRadius;
let areaCenterX, areaCenterY;

// =================
// 初期化関数
// =================

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  
  initializeDrawingArea();
  initializeCanvas();
}

function initializeDrawingArea() {
  calculateArea();
}

function initializeCanvas() {
  background(CONFIG.colors.background);
  frameRate(CONFIG.frameRate);
  
  // 初期線を作成
  for (let i = 0; i < CONFIG.maxLines; i++) {
    lines.push(createLine());
    totalLinesCreated++;
  }
}

// =================
// ウィンドウ管理
// =================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateArea();
}

function calculateArea() {
  areaRadius = min(width, height) * CONFIG.areaRadiusRatio;
  areaCenterX = width / 2;
  areaCenterY = height / 2;
}

// =================
// 線の生成と管理
// =================

function createLine() {
  const angle = random(TWO_PI);
  const distance = random(0, areaRadius - CONFIG.areaMargin);
  
  return {
    x: areaCenterX + cos(angle) * distance,
    y: areaCenterY + sin(angle) * distance,
    angle: random(TWO_PI),
    speed: random(CONFIG.speedMin, CONFIG.speedMax),
    length: 0,
    color: color(0),
    points: [],
    active: true,
    stuck: false,
    lastCollisionType: "",
    stuckAttempts: 0
  };
}

// =================
// メインループ
// =================

function draw() {
  frameCounter++;
  background(CONFIG.colors.background);
  
  updateLines();
  drawAllLines();
  manageLinePopulation();
  drawDebugInfo();
}

function updateLines() {
  lines.forEach((line, index) => {
    if (line.active && !line.stuck) {
      updateLinePosition(line, index);
    }
  });
}

function updateLinePosition(line, lineIndex) {
  let moved = false;
  let attempts = 0;
  
  while (!moved && attempts < CONFIG.maxAttempts) {
    const newPosition = calculateNewPosition(line);
    const collisionResult = checkCollisionRelaxed(line, newPosition.x, newPosition.y, lineIndex);
    
    if (!collisionResult.collision) {
      applyMovement(line, newPosition);
      moved = true;
    } else {
      handleCollision(line, collisionResult);
      attempts++;
    }
  }
  
  if (!moved) {
    stopLine(line);
  }
}

function calculateNewPosition(line) {
  return {
    x: line.x + cos(line.angle) * line.speed,
    y: line.y + sin(line.angle) * line.speed
  };
}

function applyMovement(line, newPosition) {
  line.x = newPosition.x;
  line.y = newPosition.y;
  line.points.push({x: line.x, y: line.y});
  line.length++;
  line.lastCollisionType = "";
  line.stuckAttempts = 0;
}

function handleCollision(line, collisionResult) {
  line.lastCollisionType = collisionResult.type;
  line.angle += TWO_PI / CONFIG.maxAttempts;
}

function stopLine(line) {
  line.stuckAttempts++;
  line.stuck = true;
  line.active = false;
}

// =================
// 衝突判定
// =================

function checkCollisionRelaxed(currentLine, newX, newY, lineIndex) {
  // 境界チェック
  if (checkBoundaryCollision(newX, newY)) {
    return {collision: true, type: "boundary"};
  }
  
  if (currentLine.points.length === 0) {
    return {collision: false};
  }
  
  // 自己衝突チェック
  const selfCollision = checkSelfCollision(currentLine, newX, newY);
  if (selfCollision.collision) {
    return selfCollision;
  }
  
  // 他の線との衝突チェック
  const otherCollision = checkOtherLinesCollision(currentLine, newX, newY, lineIndex);
  if (otherCollision.collision) {
    return otherCollision;
  }
  
  return {collision: false};
}

function checkBoundaryCollision(x, y) {
  const distanceFromCenter = dist(x, y, areaCenterX, areaCenterY);
  return distanceFromCenter > areaRadius - CONFIG.boundaryMargin;
}

function checkSelfCollision(line, newX, newY) {
  if (line.points.length <= CONFIG.selfCheckMinLength) {
    return {collision: false};
  }
  
  const currentPoint = line.points[line.points.length - 1];
  
  // 距離チェック
  for (let i = 0; i < line.points.length - CONFIG.selfCheckGap; i++) {
    const point = line.points[i];
    if (dist(newX, newY, point.x, point.y) < CONFIG.selfDistanceThreshold) {
      return {collision: true, type: "self_distance"};
    }
  }
  
  // 交差チェック
  for (let i = 0; i < line.points.length - CONFIG.intersectCheckGap; i++) {
    if (i < line.points.length - 1) {
      const segStart = line.points[i];
      const segEnd = line.points[i + 1];
      
      if (lineSegmentIntersect(currentPoint.x, currentPoint.y, newX, newY,
                              segStart.x, segStart.y, segEnd.x, segEnd.y)) {
        return {collision: true, type: "self_intersect"};
      }
    }
  }
  
  return {collision: false};
}

function checkOtherLinesCollision(currentLine, newX, newY, currentLineIndex) {
  const currentPoint = currentLine.points[currentLine.points.length - 1];
  
  for (let i = 0; i < lines.length; i++) {
    if (i === currentLineIndex) continue;
    
    const otherLine = lines[i];
    if (otherLine.points.length === 0) continue;
    
    // 点との距離チェック
    for (const point of otherLine.points) {
      if (dist(newX, newY, point.x, point.y) < CONFIG.pointDistanceThreshold) {
        return {collision: true, type: "point_distance"};
      }
    }
    
    // 線分交差チェック
    for (let j = 0; j < otherLine.points.length - 1; j++) {
      const segStart = otherLine.points[j];
      const segEnd = otherLine.points[j + 1];
      
      if (lineSegmentIntersect(currentPoint.x, currentPoint.y, newX, newY,
                              segStart.x, segStart.y, segEnd.x, segEnd.y)) {
        return {collision: true, type: "line_intersect"};
      }
    }
  }
  
  return {collision: false};
}

function lineSegmentIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (abs(denom) < 1e-10) {
    return false; // 平行線
  }
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// =================
// 描画関数
// =================

function drawAllLines() {
  lines.forEach((line, index) => {
    drawLine(line);
    if (debugMode) {
      drawLineDebugInfo(line);
    }
  });
}

function drawLine(line) {
  if (line.points.length < 2) return;
  
  // 色設定
  const lineColor = (line.stuck || !line.active) ? 
    CONFIG.colors.stuckLine : CONFIG.colors.activeLine;
  stroke(...lineColor);
  strokeWeight(1);
  noFill();
  
  // スプライン曲線で描画
  if (line.points.length >= 4) {
    drawSplineCurve(line.points);
  } else {
    drawStraightLine(line.points);
  }
}

function drawSplineCurve(points) {
  beginShape();
  
  // カトマル・ロム・スプライン用の制御点
  curveVertex(points[0].x, points[0].y);
  
  points.forEach(point => {
    curveVertex(point.x, point.y);
  });
  
  const lastPoint = points[points.length - 1];
  curveVertex(lastPoint.x, lastPoint.y);
  
  endShape();
}

function drawStraightLine(points) {
  beginShape();
  points.forEach(point => {
    vertex(point.x, point.y);
  });
  endShape();
}

function drawLineDebugInfo(line) {
  if (line.points.length === 0) return;
  
  const lastPoint = line.points[line.points.length - 1];
  fill(...CONFIG.colors.debugText);
  noStroke();
  
  // 衝突タイプ表示
  if (line.lastCollisionType) {
    textSize(CONFIG.debugTextSize.collision);
    text(line.lastCollisionType, lastPoint.x + 5, lastPoint.y - 5);
  }
  
  // 試行回数表示
  if (line.stuckAttempts > 0) {
    textSize(CONFIG.debugTextSize.attempts);
    text(`attempts: ${line.stuckAttempts}`, lastPoint.x + 5, lastPoint.y + 10);
  }
}

// =================
// 線の数管理
// =================

function manageLinePopulation() {
  addNewLinesIfNeeded();
  removeOldLinesIfNeeded();
  checkResetCondition();
}

function addNewLinesIfNeeded() {
  const activeLines = countActiveLines();
  
  if (activeLines <= CONFIG.addNewLinesThreshold) {
    for (let i = 0; i < CONFIG.newLinesToAdd; i++) {
      lines.push(createLine());
      totalLinesCreated++;
    }
    
    console.log(`新しい線を追加: ${activeLines} → ${activeLines + CONFIG.newLinesToAdd}`);
  }
}

function removeOldLinesIfNeeded() {
  if (lines.length > CONFIG.maxTotalLines) {
    const beforeCount = lines.length;
    lines = lines.filter(line => 
      line.active || line.length > CONFIG.minLineLength
    );
    console.log(`古い線を削除: ${beforeCount} → ${lines.length}`);
  }
}

function checkResetCondition() {
  if (totalLinesCreated > CONFIG.resetLineCount) {
    resetCanvas();
  }
}

function countActiveLines() {
  return lines.filter(line => line.active).length;
}

function resetCanvas() {
  lines = [];
  totalLinesCreated = 0;
  background(CONFIG.colors.background);
  
  for (let i = 0; i < CONFIG.maxLines; i++) {
    lines.push(createLine());
    totalLinesCreated++;
  }
  
  console.log("キャンバスをリセット");
}

// =================
// デバッグ表示
// =================

function drawDebugInfo() {
  if (debugMode) {
    drawDebugStats();
  }
  drawDebugToggleHint();
}

function drawDebugStats() {
  fill(...CONFIG.colors.debugText);
  noStroke();
  textSize(CONFIG.debugTextSize.info);
  
  const stats = [
    `Active lines: ${countActiveLines()}`,
    `Stuck lines: ${lines.filter(l => l.stuck).length}`,
    `Total lines: ${lines.length}`,
    `Created: ${totalLinesCreated}`
  ];
  
  stats.forEach((stat, index) => {
    text(stat, 10, 20 + index * 15);
  });
}

function drawDebugToggleHint() {
  fill(...CONFIG.colors.clickText);
  noStroke();
  textSize(CONFIG.debugTextSize.click);
  text("Click to debug", 10, height - 10);
}

// =================
// インタラクション
// =================

function mousePressed() {
  debugMode = !debugMode;
}