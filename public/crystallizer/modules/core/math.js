export function random(min, max) {
  if (window.random) return window.random(min, max);
  // Fallback if p5 is not ready
  if (Array.isArray(min)) return min[Math.floor(Math.random() * min.length)];
  if (typeof min === 'undefined') return Math.random();
  if (typeof max === 'undefined') return Math.random() * min;
  return Math.random() * (max - min) + min;
}

// 文字列から 0..1 の安定した疑似乱数を作る（FNV-1a 風）
// 乱数ではなく「名前に紐づいた揺れ」を作りたい用途向け。
export function hash01(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;
  return (h % 100000) / 100000;
}

export function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonSignedArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function sortPointsClockwise(pts) {
  if (!pts || pts.length <= 2) return pts;

  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  const sorted = [...pts].sort((a, b) => {
    const aa = Math.atan2(a.y - cy, a.x - cx);
    const bb = Math.atan2(b.y - cy, b.x - cx);
    return aa - bb;
  });

  // スクリーン座標系（Y軸下向き）では、正の面積が時計回りに相当します
  if (polygonSignedArea(sorted) < 0) sorted.reverse();
  return sorted;
}

export function getPointsBounds(pts) {
  let minX = pts[0].x;
  let minY = pts[0].y;
  let maxX = pts[0].x;
  let maxY = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    minX = Math.min(minX, pts[i].x);
    minY = Math.min(minY, pts[i].y);
    maxX = Math.max(maxX, pts[i].x);
    maxY = Math.max(maxY, pts[i].y);
  }
  return { minX, minY, maxX, maxY };
}

export function rgbToHsb(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const maxV = Math.max(r, g, b);
  const minV = Math.min(r, g, b);
  let h;
  let s;
  const v = maxV;
  const d = maxV - minV;
  s = maxV === 0 ? 0 : d / maxV;
  if (maxV === minV) {
    h = 0;
  } else {
    switch (maxV) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

export function hsbToRgb(h, s, v) {
  let r;
  let g;
  let b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [r * 255, g * 255, b * 255];
}
