import { State } from '../state.js';
import { random } from '../core/math.js';
import { sortPointsClockwise, pointInPolygon, polygonSignedArea } from '../core/math.js';
import { randomizeBackgroundImageFromBgPool } from './randomizers.js';

function getBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points || []) {
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: Math.max(1e-6, maxX - minX), h: Math.max(1e-6, maxY - minY) };
}

function fitPointsIntoCanvas(points, canvasW, canvasH, margin) {
  if (!points || points.length === 0) return;
  const w = Math.max(1, Number(canvasW || 1));
  const h = Math.max(1, Number(canvasH || 1));
  const m = Math.max(0, Number(margin || 0));

  const b0 = getBounds(points);
  const availW = Math.max(1, w - m * 2);
  const availH = Math.max(1, h - m * 2);

  // Scale down if needed (never scale up)
  const s = Math.min(1, availW / b0.w, availH / b0.h);
  const cx = (b0.minX + b0.maxX) * 0.5;
  const cy = (b0.minY + b0.maxY) * 0.5;

  if (s < 0.999) {
    for (const p of points) {
      p.x = cx + (p.x - cx) * s;
      p.y = cy + (p.y - cy) * s;
    }
  }

  // Translate to keep inside margins
  const b1 = getBounds(points);
  let dx = 0;
  let dy = 0;
  if (b1.minX < m) dx = m - b1.minX;
  if (b1.maxX > w - m) dx = (w - m) - b1.maxX;
  if (b1.minY < m) dy = m - b1.minY;
  if (b1.maxY > h - m) dy = (h - m) - b1.maxY;

  if (dx || dy) {
    for (const p of points) {
      p.x += dx;
      p.y += dy;
    }
  }
}

// ポリゴン分割ユーティリティ
function splitPolygonByLine(poly, sx, sy, nx, ny) {
  const sideA = [];
  const sideB = [];

  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];

    const d1 = (p1.x - sx) * nx + (p1.y - sy) * ny;
    const d2 = (p2.x - sx) * nx + (p2.y - sy) * ny;

    if (d1 >= 0) sideA.push(p1);
    if (d1 <= 0) sideB.push(p1);

    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
      const t = d1 / (d1 - d2);
      const ix = p1.x + t * (p2.x - p1.x);
      const iy = p1.y + t * (p2.y - p1.y);
      const inter = { x: ix, y: iy };
      sideA.push(inter);
      sideB.push(inter);
    }
  }

  // 縮退したポリゴン等をフィルタリング
  const res = [];
  // 点が3つ以上必要

  const final = [];
  if (sideA.length >= 3) final.push(sideA);
  if (sideB.length >= 3) final.push(sideB);

  return final;
}

export function randomizeCrystalize() {
  // Tone は常時有効（毎回リセットはしない）
  State.crystalTone = State.crystalTone || {
    enabled: true,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0
  };
  State.crystalTone.enabled = true;

  State.isCrystalized = true;
  // クリア
  State.faces = [];
  State.allLayers = State.allLayers.filter((l) => l.type !== 'frame');
  State.activeFace = null;
  State.selectedFace = null;
  State.selectedFaces = [];

  // Crystalize時: BG Pool から背景画像を選ぶ（背景色UIは無し）
  randomizeBackgroundImageFromBgPool();

  const w = window.width;
  const h = window.height;

  // 1. クリスタルの基本形状（元の感じに戻す）
  const mx = w / 2;
  const my = h / 2;
  const isBroad = window.random() > 0.5;
  const widthMult = isBroad ? window.random(2.0, 4.5) : window.random(1.1, 1.9);
  const hScale = isBroad ? window.random(0.7, 1.1) : 1.0;

  const makeEllipsePoly = (cx, cy0, rx, ry, n, jitterA, jitterR) => {
    const pts = [];
    const base = window.random(window.TWO_PI);
    for (let i = 0; i < n; i++) {
      const t = (window.TWO_PI * i) / n;
      const a = base + t + window.random(-jitterA, jitterA);
      const rr = 1 + window.random(-jitterR, jitterR);
      pts.push({
        x: cx + Math.cos(a) * rx * rr,
        y: cy0 + Math.sin(a) * ry * rr
      });
    }
    pts.sort((p1, p2) => Math.atan2(p1.y - cy0, p1.x - cx) - Math.atan2(p2.y - cy0, p2.x - cx));
    return pts;
  };

  const bottomY = my + (h / 2 - 50) * hScale;

  let basePoly;

  // ベース形状のバリエーションを増やす
  const modeRoll = window.random();
  const mode = (modeRoll < 0.30)
    ? 'classic'
    : (modeRoll < 0.55)
      ? 'flat'
      : (modeRoll < 0.78)
        ? 'diamond'
        : 'faceted';

  if (mode === 'flat') {
    const halfFlat = window.random(35, 120) * widthMult;
    basePoly = [
      // 底辺（2点）
      { x: mx - halfFlat, y: bottomY + window.random(-6, 6) },
      { x: mx + halfFlat, y: bottomY + window.random(-6, 6) },
      // 右側
      { x: mx + window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) },
      { x: mx + window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      // 頂点
      { x: mx + window.random(-100, 100) * widthMult, y: my - (h / 2 - 50) * hScale },
      // 左側
      { x: mx - window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      { x: mx - window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) }
    ];
  } else if (mode === 'classic') {
    basePoly = [
      { x: mx + window.random(-15, 15) * widthMult, y: bottomY },
      { x: mx + window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) },
      { x: mx + window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      { x: mx + window.random(-100, 100) * widthMult, y: my - (h / 2 - 50) * hScale },
      { x: mx - window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      { x: mx - window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) }
    ];
  } else if (mode === 'diamond') {
    const topY = my - (h / 2 - 60) * hScale;
    const sideY1 = my + window.random(-120, 60) * hScale;
    const sideY2 = my + window.random(-120, 60) * hScale;
    const rx1 = window.random(220, 420) * widthMult;
    const rx2 = window.random(220, 420) * widthMult;
    basePoly = [
      { x: mx + window.random(-25, 25) * widthMult, y: bottomY + window.random(-10, 10) },
      { x: mx + rx1, y: sideY1 + window.random(-40, 40) },
      { x: mx + window.random(-80, 80) * widthMult, y: topY + window.random(-10, 10) },
      { x: mx - rx2, y: sideY2 + window.random(-40, 40) }
    ];
  } else {
    // Faceted: 楕円ベースの多角形（凸）で、カットが多い感じを作る
    const rx = window.random(260, 520) * widthMult;
    const ry = window.random(320, 620) * hScale;
    const n = Math.floor(window.random(7, 12));
    basePoly = makeEllipsePoly(mx, my, rx, ry, n, 0.18, 0.22);
  }

  // 回転（縦の印象を保つため控えめ）
  const rot = window.random(-window.PI / 12, window.PI / 12);
  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const cy = h / 2;
  basePoly.forEach(p => {
    const dx = p.x - mx;
    const dy = p.y - cy;
    p.x = mx + dx * cosA - dy * sinA;
    p.y = cy + dx * sinA + dy * cosA;
  });

  // Ensure the whole crystal stays within the canvas (avoid touching edges)
  fitPointsIntoCanvas(basePoly, w, h, 40);

  let polyList = [basePoly];

  // 2. 再帰的分割（元の感じ）
  // 面数にもっと幅が出るように「分割の強さ」をランダム化
  const randInt = (min, maxInclusive) => Math.floor(window.random(min, maxInclusive + 1));
  const complexity = window.random();
  // フレーム数を少し減らす（= 分割回数/確率を控えめにする）
  const layerCount = (complexity < 0.20)
    ? randInt(2, 4)
    : (complexity < 0.75)
      ? randInt(2, 5)
      : randInt(4, 7);
  const splitProb = (complexity < 0.20)
    ? window.random(0.42, 0.68)
    : (complexity < 0.75)
      ? window.random(0.45, 0.72)
      : window.random(0.60, 0.86);
  // 小さすぎるポリゴンまで分割すると面数が暴発するので制限
  const minPolyArea = (complexity < 0.20)
    ? window.random(20000, 36000)
    : (complexity < 0.75)
      ? window.random(16000, 30000)
      : window.random(11000, 22000);

  for (let s = 0; s < layerCount; s++) {
    const nextList = [];

    for (const poly of polyList) {
      const areaAbs = Math.abs(polygonSignedArea(poly));
      if (areaAbs < minPolyArea) {
        nextList.push(poly);
        continue;
      }
      if (window.random() > splitProb) {
        nextList.push(poly);
        continue;
      }

      // 「割れ方」だけランダム性を増やす：ポリゴンごとに切断角度/位置を再抽選
      const b = getBounds(poly);
      const angle = window.random(window.TWO_PI);
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const pad = 80;
      const sx = window.random(b.minX - pad, b.maxX + pad);
      const sy = window.random(b.minY - pad, b.maxY + pad);

      const parts = splitPolygonByLine(poly, sx, sy, nx, ny);
      if (parts.length > 1) {
        nextList.push(...parts);
      } else {
        nextList.push(poly);
      }
    }
    polyList = nextList;
  }

  // 3. dither はフレーム画像が割り当たった後にまとめて当てる

  // 4. フレーム（顔）の生成と登録（元の感じ: 三角ファン）
  polyList.forEach((pts) => {
    if (pts.length < 3) return;

    // 単純化（一直線上の点を削除）
    const simplified = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[(i + pts.length - 1) % pts.length];
      const p2 = pts[i];
      const p3 = pts[(i + 1) % pts.length];
      const area = Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
      if (area > 5.0) simplified.push(p2);
    }

    if (simplified.length < 3) return;

    // 重心計算（簡易的な三角形分割用）
    let bx = 0, by = 0;
    simplified.forEach(p => { bx += p.x; by += p.y; });
    bx /= simplified.length;
    by /= simplified.length;

    for (let i = 0; i < simplified.length; i++) {
      const p1 = simplified[i];
      const p2 = simplified[(i + 1) % simplified.length];

      const tri = [
        { x: window.constrain(bx, 0, w), y: window.constrain(by, 0, h) },
        { x: window.constrain(p1.x, 0, w), y: window.constrain(p1.y, 0, h) },
        { x: window.constrain(p2.x, 0, w), y: window.constrain(p2.y, 0, h) }
      ];

      const f = { points: sortPointsClockwise(tri), image: null, imageName: '' };
      State.faces.push(f);
      State.allLayers.push({ type: 'frame', data: f });
    }
  });

  // 最小ケースがスカスカになりすぎることがあるので、低complexityのときだけ面数の下限を底上げする
  // （三角形を二分割して+1枚ずつ増やす）
  if (complexity < 0.30) {
    const MIN_FACES = 22;
    let guard = 0;
    while ((State.faces?.length || 0) < MIN_FACES && guard++ < 200) {
      const faces = (State.faces || []).filter((f) => f && Array.isArray(f.points) && f.points.length === 3);
      if (faces.length === 0) break;

      const face = faces[Math.floor(random(faces.length))];
      const [a, b, c] = face.points;
      // Split edge AB
      const m = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };

      // Mutate original to first triangle
      face.points = sortPointsClockwise([a, m, c]);

      // Add second triangle
      const f2 = { points: sortPointsClockwise([m, b, c]), image: null, imageName: '' };
      State.faces.push(f2);
      State.allLayers.push({ type: 'frame', data: f2 });
    }
  }

  // クリスタライズ時は「必ず」フレームへランダム画像を入れる
  // 先に「挿入される画像」を同期的に決める（imageNameだけ入れる）。
  // 実際の画像反映（image）とdither再処理は外側のフローで行う。
  if (State.faces && State.faces.length && State.sourceImages && State.sourceImages.length) {
    for (const face of State.faces) {
      if (!face) continue;
      const pick = State.sourceImages[Math.floor(random(State.sourceImages.length))];
      if (!pick) continue;
      face.imageName = pick.name;
      face.image = null;
    }
  }

  State.needsCompositeUpdate = true;
  // State.setActiveToolTab('FRAME'); // ブリッジが必要
}
