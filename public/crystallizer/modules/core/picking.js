import { pointInPolygon } from './math.js';

export function findNearbyPointInFaces(faces, mx, my, tolerance = 14) {
  const tol = Math.max(1, Number(tolerance || 1));
  let closest = null;
  let minDistSq = tol * tol;

  (faces || []).forEach((face) => {
    const pts = face && face.points;
    if (!Array.isArray(pts) || pts.length === 0) return;
    pts.forEach((p, idx) => {
      if (!p) return;
      const dx = p.x - mx;
      const dy = p.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDistSq) {
        minDistSq = d2;
        closest = { face, index: idx };
      }
    });
  });

  return closest;
}

export function findTopmostFaceAt(mx, my, faces, activeFace = null) {
  if (activeFace && Array.isArray(activeFace.points) && activeFace.points.length >= 3) {
    if (pointInPolygon(mx, my, activeFace.points)) return activeFace;
  }

  for (let i = (faces?.length || 0) - 1; i >= 0; i--) {
    const f = faces[i];
    if (f && Array.isArray(f.points) && f.points.length >= 3 && pointInPolygon(mx, my, f.points)) return f;
  }
  return null;
}
