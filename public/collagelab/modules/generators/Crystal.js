import { State } from '../state.js';
import { random } from '../core/math.js';
import { ensureSourceImageLoaded, reprocessSourceEntry, randomizeDithererOnly } from '../core/dither.js';
import { sortPointsClockwise, pointInPolygon, polygonSignedArea } from '../core/math.js';
import { applyRandomImagesToAllFrames } from '../core/frame.js';

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
  // Every Crystalize run resets tone correction
  if (typeof window.resetCrystalTone === 'function') {
    window.resetCrystalTone();
  } else {
    State.crystalTone = {
      enabled: true,
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      hue: 0
    };
  }

  State.isCrystalized = true;
  // クリア
  State.faces = [];
  State.allLayers = State.allLayers.filter((l) => l.type !== 'frame');
  State.activeFace = null;
  State.selectedFace = null;
  State.selectedFaces = [];

  // Crystalize時: BG専用8枚からランダム設定（なければ random color）
  if (window.randomizeBackgroundImageFromBgPool) {
    window.randomizeBackgroundImageFromBgPool();
  } else if (window.randomizeBackgroundColor) {
    window.randomizeBackgroundColor();
  }

  const w = window.width;
  const h = window.height;

  // 1. クリスタルの基本形状（元の感じに戻す）
  const mx = w / 2;
  const my = h / 2;
  const isBroad = window.random() > 0.5;
  const widthMult = isBroad ? window.random(2.0, 4.5) : window.random(0.8, 1.6);
  const hScale = isBroad ? window.random(0.7, 1.1) : 1.0;

  // 底が尖らない（フラット）パターンも混ぜる
  const flatBottom = window.random() < 0.35;

  const bottomY = my + (h / 2 - 50) * hScale;

  let basePoly;
  if (flatBottom) {
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
  } else {
    basePoly = [
      { x: mx + window.random(-15, 15) * widthMult, y: bottomY },
      { x: mx + window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) },
      { x: mx + window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      { x: mx + window.random(-100, 100) * widthMult, y: my - (h / 2 - 50) * hScale },
      { x: mx - window.random(250, 450) * widthMult, y: my - (h * 0.2) * hScale + window.random(-50, 50) },
      { x: mx - window.random(180, 320) * widthMult, y: my + (h * 0.05) * hScale + window.random(-50, 50) }
    ];
  }

  // 回転（元より少しだけレンジを広げてバリエーション）
  const rot = window.random(-window.PI / 4, window.PI / 4);
  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const cy = h / 2;
  basePoly.forEach(p => {
    const dx = p.x - mx;
    const dy = p.y - cy;
    p.x = window.constrain(mx + dx * cosA - dy * sinA, 0, w);
    p.y = window.constrain(cy + dx * sinA + dy * cosA, 0, h);
  });

  let polyList = [basePoly];

  // 2. 再帰的分割（元の感じ）
  const layerCount = Math.floor(window.random(3, 6));
  for (let s = 0; s < layerCount; s++) {
    const nextList = [];
    const angle = window.random(window.TWO_PI);
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const sx = mx + window.random(-400, 400);
    const sy = my + window.random(-400, 400);

    for (const poly of polyList) {
      const parts = splitPolygonByLine(poly, sx, sy, nx, ny);
      if (parts.length > 1) {
        nextList.push(...parts);
      } else {
        nextList.push(poly);
      }
    }
    polyList = nextList;
  }

  // 3. グローバルディザ設定のランダム化（確率で適用）
  if (window.random() > 0.4 && window.randomizeDithererOnly) window.randomizeDithererOnly();

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

  // クリスタライズ時は「必ず」フレームへランダム画像を入れる
  applyRandomImagesToAllFrames();

  State.needsCompositeUpdate = true;
  // State.setActiveToolTab('FRAME'); // ブリッジが必要
}
