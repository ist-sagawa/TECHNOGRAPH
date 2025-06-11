let gridSize = 16;
let cellSize;
let canvasSize = 720; // キャンバス全体のサイズ
let margin = 40; // エンブレム間のマージン
let emblemSize = (canvasSize - margin * 5) / 4; // 一つのエンブレムのサイズ（マージンを考慮）
let emblems = []; // 16個のエンブレムデータ

function setup() {
  createCanvas(canvasSize, canvasSize);
  cellSize = emblemSize / gridSize; // 各エンブレム内のセルサイズ
  
  // キャンバスを中央に配置
  let canvas = document.querySelector('canvas');
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  });
  
  // 16個のエンブレムを生成
  generateAllEmblems();
}

function draw() {
  clear();
  
  // 4×4のレイアウトで16個のエンブレムを描画
  for (let i = 0; i < 16; i++) {
    let row = floor(i / 4);
    let col = i % 4;
    let x = margin + col * (emblemSize + margin);
    let y = margin + row * (emblemSize + margin);
    
    drawSingleEmblem(emblems[i], x, y);
  }

  if (frameCount % 40 === 0) {
    generateAllEmblems();
  }
}

function generateAllEmblems() {
  emblems = [];
  
  // 16個のエンブレムを生成
  for (let i = 0; i < 16; i++) {
    emblems.push(generateSingleEmblem());
  }
}

function generateSingleEmblem() {
  let points = [];
  let lines = [];
  
  // 対称性をランダムに決定
  let symmetryType = floor(random(3)); // 0: 左右対称, 1: 上下対称, 2: 上下左右対称
  
  // 対称性に応じた作業領域のサイズを決定
  let workWidth, workHeight;
  if (symmetryType === 0) { // 左右対称
    workWidth = gridSize / 2;
    workHeight = gridSize;
  } else if (symmetryType === 1) { // 上下対称
    workWidth = gridSize;
    workHeight = gridSize / 2;
  } else { // 上下左右対称
    workWidth = gridSize / 2;
    workHeight = gridSize / 2;
  }
  
  // 対称線上に必ずポイントを配置
  if (symmetryType === 0) { // 左右対称
    // 中心縦線上（x=8）にポイントを配置
    let numCenterPoints = floor(random(2, 4));
    for (let i = 0; i < numCenterPoints; i++) {
      points.push({
        x: 8,
        y: floor(random(workHeight))
      });
    }
  } else if (symmetryType === 1) { // 上下対称
    // 中心横線上（y=8）にポイントを配置
    let numCenterPoints = floor(random(2, 4));
    for (let i = 0; i < numCenterPoints; i++) {
      points.push({
        x: floor(random(workWidth)),
        y: 8
      });
    }
  } else { // 上下左右対称
    // 中心点（8,8）に必ず配置
    points.push({x: 8, y: 8});
    
    // 中心線上にも追加ポイント
    let numCenterPoints = floor(random(1, 3));
    for (let i = 0; i < numCenterPoints; i++) {
      if (random() > 0.5) {
        // 縦線上
        points.push({
          x: 8,
          y: floor(random(workHeight))
        });
      } else {
        // 横線上
        points.push({
          x: floor(random(workWidth)),
          y: 8
        });
      }
    }
  }
  
  // 点を散らばるように配置
  let numPoints = floor(random(4, 8)); // 点の数を調整
  let minDistance = 2; // 点間の最小距離
  
  // 残りの点を最小距離を保ちながら配置
  let attempts = 0;
  while (points.length < numPoints && attempts < 1000) {
    let newX = floor(random(workWidth));
    let newY = floor(random(workHeight));
    
    // 既存の点との距離をチェック
    let tooClose = false;
    for (let existing of points) {
      let distance = sqrt(pow(newX - existing.x, 2) + pow(newY - existing.y, 2));
      if (distance < minDistance) {
        tooClose = true;
        break;
      }
    }
    
    if (!tooClose) {
      points.push({x: newX, y: newY});
    }
    attempts++;
  }
  
  // 最小限の点数を保証（距離制約を緩めてでも）
  while (points.length < 8) {
    points.push({
      x: floor(random(workWidth)), 
      y: floor(random(workHeight))
    });
  }
  
  // 線の数を増やして接続性を向上
  if (points.length > 1) {
    let minConnections = max(8, points.length); // 最小線数を保証
    let maxConnections = points.length * 2;
    let numConnections = floor(random(minConnections, maxConnections));
    
    // 重複を避けるためのセット
    let connectionSet = new Set();
    
    for (let i = 0; i < numConnections; i++) {
      let p1 = floor(random(points.length));
      let p2 = floor(random(points.length));
      
      if (p1 !== p2) {
        // 接続の一意性を保証（順序を統一）
        let connection = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
        if (!connectionSet.has(connection)) {
          connectionSet.add(connection);
          lines.push({start: p1, end: p2});
        }
      }
    }
    
    // 最小接続数を保証
    while (lines.length < min(5, points.length - 1)) {
      let p1 = floor(random(points.length));
      let p2 = floor(random(points.length));
      
      if (p1 !== p2) {
        let connection = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
        if (!connectionSet.has(connection)) {
          connectionSet.add(connection);
          lines.push({start: p1, end: p2});
        }
      }
    }
  }
  
  // ランダムに塗りつぶし領域を生成
  let fills = [];
  let numFills = floor(random(2, 5)); // 2〜4個の塗りつぶし領域
  
  for (let i = 0; i < numFills; i++) {
    // 3つの点をランダムに選んで三角形を作る
    if (points.length >= 3) {
      let p1 = floor(random(points.length));
      let p2 = floor(random(points.length));
      let p3 = floor(random(points.length));
      
      if (p1 !== p2 && p2 !== p3 && p1 !== p3) {
        fills.push({
          points: [p1, p2, p3],
          color: {
            r: 6,    // 青色 (#0600ff)
            g: 0,
            b: 255
          }
        });
      }
    }
  }
  
  return {
    symmetryType: symmetryType,
    points: points,
    lines: lines,
    fills: fills
  };
}

function drawSingleEmblem(emblem, offsetX, offsetY) {
  push(); // 座標系を保存
  translate(offsetX, offsetY); // 描画位置をオフセット
  
  // // グリッド描画
  // stroke(200);
  // strokeWeight(0.3);
  
  // // 垂直線
  // for (let i = 0; i <= gridSize; i++) {
  //   line(i * cellSize, 0, i * cellSize, emblemSize);
  // }
  
  // // 水平線
  // for (let i = 0; i <= gridSize; i++) {
  //   line(0, i * cellSize, emblemSize, i * cellSize);
  // }
  
  // 塗りつぶし領域を描画
  for (let fillArea of emblem.fills) {
    let p1 = emblem.points[fillArea.points[0]];
    let p2 = emblem.points[fillArea.points[1]];
    let p3 = emblem.points[fillArea.points[2]];
    
    fill(fillArea.color.r, fillArea.color.g, fillArea.color.b, fillArea.color.a);
    noStroke();
    
    // 元の三角形を描画
    drawFill(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    
    // 対称性に応じて対称な塗りつぶしを描画
    if (emblem.symmetryType === 0) { // 左右対称
      drawFill(16 - p1.x, p1.y, 16 - p2.x, p2.y, 16 - p3.x, p3.y);
    } else if (emblem.symmetryType === 1) { // 上下対称
      drawFill(p1.x, 16 - p1.y, p2.x, 16 - p2.y, p3.x, 16 - p3.y);
    } else { // 上下左右対称
      drawFill(16 - p1.x, p1.y, 16 - p2.x, p2.y, 16 - p3.x, p3.y); // 左右対称
      drawFill(p1.x, 16 - p1.y, p2.x, 16 - p2.y, p3.x, 16 - p3.y); // 上下対称
      drawFill(16 - p1.x, 16 - p1.y, 16 - p2.x, 16 - p2.y, 16 - p3.x, 16 - p3.y); // 上下左右対称
    }
  }
  
  // 線の描画
  stroke("#0600ff");
  strokeWeight(1.5);
  
  for (let line of emblem.lines) {
    let p1 = emblem.points[line.start];
    let p2 = emblem.points[line.end];
    
    // 元の線を描画
    drawLine(p1.x, p1.y, p2.x, p2.y);
    
    // 対称性に応じて対称線を描画
    if (emblem.symmetryType === 0) { // 左右対称
      drawLine(16 - p1.x, p1.y, 16 - p2.x, p2.y);
    } else if (emblem.symmetryType === 1) { // 上下対称
      drawLine(p1.x, 16 - p1.y, p2.x, 16 - p2.y);
    } else { // 上下左右対称
      drawLine(16 - p1.x, p1.y, 16 - p2.x, p2.y); // 左右対称
      drawLine(p1.x, 16 - p1.y, p2.x, 16 - p2.y); // 上下対称
      drawLine(16 - p1.x, 16 - p1.y, 16 - p2.x, 16 - p2.y); // 上下左右対称
    }
  }
  
  // 点の描画
  fill(255, 0, 0);
  noStroke();
  
  for (let point of emblem.points) {
    // 元の点を描画
    drawPoint(point.x, point.y);
    
    // 対称性に応じて対称点を描画
    if (emblem.symmetryType === 0) { // 左右対称
      drawPoint(16 - point.x, point.y);
    } else if (emblem.symmetryType === 1) { // 上下対称
      drawPoint(point.x, 16 - point.y);
    } else { // 上下左右対称
      drawPoint(16 - point.x, point.y); // 左右対称
      drawPoint(point.x, 16 - point.y); // 上下対称
      drawPoint(16 - point.x, 16 - point.y); // 上下左右対称
    }
  }
  
  pop(); // 座標系を復元
}

function drawLine(x1, y1, x2, y2) {
  let screenX1 = x1 * cellSize;
  let screenY1 = y1 * cellSize;
  let screenX2 = x2 * cellSize;
  let screenY2 = y2 * cellSize;
  line(screenX1, screenY1, screenX2, screenY2);
}

function drawPoint(x, y) {
  let screenX = x * cellSize;
  let screenY = y * cellSize;
  circle(screenX, screenY, 1); // 点のサイズを小さく
}

function drawFill(x1, y1, x2, y2, x3, y3) {
  let screenX1 = x1 * cellSize;
  let screenY1 = y1 * cellSize;
  let screenX2 = x2 * cellSize;
  let screenY2 = y2 * cellSize;
  let screenX3 = x3 * cellSize;
  let screenY3 = y3 * cellSize;
  
  triangle(screenX1, screenY1, screenX2, screenY2, screenX3, screenY3);
}
