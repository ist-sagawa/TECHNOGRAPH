import { State } from '../state.js';
import { random, sortPointsClockwise } from './math.js';
import { ensureSourceImageLoaded, reprocessSourceEntry } from './dither.js';

/**
 * フレーム（Face）に画像を適用する
 * @param {Object} face - 対象のFaceオブジェクト
 * @param {p5.Image} img - 適用する画像
 * @param {string} name - 画像名
 */
export function applyImageToFace(face, img, name) {
  face.image = img;
  face.imageName = name;
  State.needsCompositeUpdate = true;
}

export function createRandomFace() {
  const count = Math.floor(random(3, 10));
  const r = random(140, 800);
  const margin = 24;
  const cx = random(r + margin, window.width - r - margin);
  const cy = random(r + margin, window.height - r - margin);

  const pts = [];
  for (let i = 0; i < count; i++) {
    const baseA = (window.TWO_PI * i) / count;
    const a = baseA + random(-0.35, 0.35);
    const rr = r * random(0.45, 1.0);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    pts.push({
      x: window.constrain(x, 0, window.width),
      y: window.constrain(y, 0, window.height)
    });
  }

  const sorted = sortPointsClockwise(pts);
  return { points: sorted, image: null, imageName: '' };
}

export function startPlacingImage(img, name) {
  if (!img) return;
  State.isImagePlacing = true;
  State.placingImg = img;
  State.placingImgName = name || '';
  State.isPlacing = false;
  State.activeFace = null;
  State.needsCompositeUpdate = true;

  if (window.updateModeButtonStyles) window.updateModeButtonStyles();
}

export function applyRandomImagesToAllFrames() {
  if (!State.faces || State.faces.length === 0) return;
  if (!State.sourceImages || State.sourceImages.length === 0) return;

  State.faces.forEach(face => {
    const pick = State.sourceImages[Math.floor(random(State.sourceImages.length))];
    if (!pick) return;
    ensureSourceImageLoaded(pick, () => {
      reprocessSourceEntry(pick, () => {
        applyImageToFace(face, pick.processedImg || pick.originalImg, pick.name);
      });
    });
  });
}

function getFaceCentroid(face) {
  const pts = face && face.points;
  if (!pts || pts.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

function getFaceRadius(face, c) {
  const pts = face && face.points;
  if (!pts || pts.length === 0) return 1;
  let r2 = 1;
  for (const p of pts) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    r2 = Math.max(r2, dx * dx + dy * dy);
  }
  return Math.sqrt(r2);
}

/**
 * フレームを「なるべく重ならないように」一気に発散させる（簡易反発シミュレーション）
 * - 円近似（各フレームの外接半径）で当たり判定
 * - 反復回数でそれっぽく整列
 */
export function spreadApartFrames(opts = {}) {
  const faces = (State.faces || []).filter(f => f && f.points && f.points.length >= 3);
  if (faces.length < 2) return;

  const iterations = Math.max(1, Math.floor(Number(opts.iterations ?? 45)));
  const padding = Math.max(0, Number(opts.padding ?? 26));
  const strength = Math.max(0.05, Math.min(2.0, Number(opts.strength ?? 0.85)));
  const margin = Math.max(0, Number(opts.margin ?? 20));

  const items = faces.map(face => {
    const c = getFaceCentroid(face);
    const r = getFaceRadius(face, c);
    return { face, c: { ...c }, r };
  });

  const w = window.width;
  const h = window.height;

  for (let it = 0; it < iterations; it++) {
    const deltas = items.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        let dx = b.c.x - a.c.x;
        let dy = b.c.y - a.c.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        const minD = a.r + b.r + padding;

        if (d < 1e-3) {
          // 同一点近傍は微小に散らす
          dx = (Math.random() - 0.5) * 0.01;
          dy = (Math.random() - 0.5) * 0.01;
          d = Math.sqrt(dx * dx + dy * dy);
        }

        if (d < minD) {
          const overlap = (minD - d) * strength;
          const nx = dx / d;
          const ny = dy / d;
          deltas[i].x -= nx * overlap * 0.5;
          deltas[i].y -= ny * overlap * 0.5;
          deltas[j].x += nx * overlap * 0.5;
          deltas[j].y += ny * overlap * 0.5;
        }
      }
    }

    // キャンバス内へ軽く押し戻す
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      let dx = deltas[i].x;
      let dy = deltas[i].y;

      const nx = a.c.x + dx;
      const ny = a.c.y + dy;

      const minX = margin + a.r;
      const maxX = w - margin - a.r;
      const minY = margin + a.r;
      const maxY = h - margin - a.r;

      const clampedX = Math.min(maxX, Math.max(minX, nx));
      const clampedY = Math.min(maxY, Math.max(minY, ny));
      dx += (clampedX - nx);
      dy += (clampedY - ny);

      // 反映
      a.c.x += dx;
      a.c.y += dy;
    }
  }

  // 実際に各 face を平行移動
  items.forEach((item) => {
    const face = item.face;
    const c0 = getFaceCentroid(face);
    const dx = item.c.x - c0.x;
    const dy = item.c.y - c0.y;

    for (const p of face.points) {
      p.x = p.x + dx;
      p.y = p.y + dy;
    }
  });

  // 変形系のセッションは形が変わるのでリセット
  if (State.frameFreeTransform) State.frameTransform = null;

  State.needsCompositeUpdate = true;
}
