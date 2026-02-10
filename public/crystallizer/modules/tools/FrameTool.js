import { State } from '../state.js';
import { ensureSourceImageLoaded } from '../core/dither.js';
import { pointInPolygon, sortPointsClockwise, getPointsBounds } from '../core/math.js';
import { findNearbyPointInFaces, findTopmostFaceAt } from '../core/picking.js';
import { scaleForPointer } from '../core/pointer.js';

// --- FrameTool 内部ヘルパー ---

function getPointHitRadius(base) {
  // 頂点はスマホだと狙いづらいので、当たり判定を大きめにする
  return scaleForPointer(base, { coarseMult: 2.0 });
}

// --- Free Transform (Photoshop風) ---

function normalizeFaceSelection() {
  // selectedFaces が空なら selectedFace から補完
  if (!Array.isArray(State.selectedFaces)) State.selectedFaces = [];
  if (State.selectedFaces.length === 0 && State.selectedFace) {
    State.selectedFaces = [State.selectedFace];
  }
  // selectedFace は primary
  if (!State.selectedFace && State.selectedFaces.length > 0) {
    State.selectedFace = State.selectedFaces[0];
  }
  // selectedFace が selection にいない場合は揃える
  if (State.selectedFace && State.selectedFaces.length > 0 && !State.selectedFaces.includes(State.selectedFace)) {
    State.selectedFace = State.selectedFaces[0];
  }
}

function setFaceSelection(faces, { additive = false } = {}) {
  const uniq = [];
  const pushUnique = (f) => {
    if (!f) return;
    if (uniq.includes(f)) return;
    uniq.push(f);
  };

  if (additive && Array.isArray(State.selectedFaces)) {
    State.selectedFaces.forEach(pushUnique);
  }
  (faces || []).forEach(pushUnique);

  State.selectedFaces = uniq;
  State.selectedFace = uniq.length > 0 ? uniq[uniq.length - 1] : null;
  State.frameTransform = null;
  State.needsCompositeUpdate = true;
}

function getSelectionFaces() {
  normalizeFaceSelection();
  return (State.selectedFaces || []).filter(f => f && f.points && f.points.length >= 3);
}

function ensureTransformSessionForFaces(faces) {
  const validFaces = (faces || []).filter(f => f && f.points && f.points.length >= 3);
  if (validFaces.length === 0) return null;

  const s = State.frameTransform;
  if (s && Array.isArray(s.faces) && s.faces.length === validFaces.length && s.faces.every((f, i) => f === validFaces[i])) {
    // 既存セッションを再利用（dragging/selectRect はそのまま）
    return s;
  }

  // グループの bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const baseByFace = validFaces.map((face) => {
    for (const p of face.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { face, points: face.points.map(p => ({ x: p.x, y: p.y })) };
  });

  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  State.frameTransform = {
    faces: validFaces,
    baseByFace,
    baseCenter: { x: cx, y: cy },
    baseW: w,
    baseH: h,
    sx: 1,
    sy: 1,
    rot: 0,
    tx: 0,
    ty: 0,
    dragging: null,
    selectRect: null,
    selectAdditive: false,
    selectBaseFaces: null
  };

  return State.frameTransform;
}

function getTransformCenter(s) {
  return { x: s.baseCenter.x + s.tx, y: s.baseCenter.y + s.ty };
}

function toWorldFromLocal(s, vx, vy) {
  const c = getTransformCenter(s);
  const cosA = Math.cos(s.rot);
  const sinA = Math.sin(s.rot);
  const x0 = vx * s.sx;
  const y0 = vy * s.sy;
  return {
    x: c.x + x0 * cosA - y0 * sinA,
    y: c.y + x0 * sinA + y0 * cosA
  };
}

function toLocalFromWorld(s, wx, wy) {
  const c = getTransformCenter(s);
  const dx = wx - c.x;
  const dy = wy - c.y;
  const cosA = Math.cos(s.rot);
  const sinA = Math.sin(s.rot);
  // rotate by -rot
  return {
    x: dx * cosA + dy * sinA,
    y: -dx * sinA + dy * cosA
  };
}

function computeTransformHandles(s) {
  const hw = s.baseW / 2;
  const hh = s.baseH / 2;

  const tl = toWorldFromLocal(s, -hw, -hh);
  const tr = toWorldFromLocal(s, hw, -hh);
  const br = toWorldFromLocal(s, hw, hh);
  const bl = toWorldFromLocal(s, -hw, hh);
  const tm = toWorldFromLocal(s, 0, -hh);
  const rm = toWorldFromLocal(s, hw, 0);
  const bm = toWorldFromLocal(s, 0, hh);
  const lm = toWorldFromLocal(s, -hw, 0);

  // rotate handle: top-mid から外側へ一定px
  const cosA = Math.cos(s.rot);
  const sinA = Math.sin(s.rot);
  const axisY = { x: -sinA, y: cosA }; // local +Y
  const rotateHandle = { x: tm.x - axisY.x * 55, y: tm.y - axisY.y * 55 };

  return {
    box: [tl, tr, br, bl],
    corners: [tl, tr, br, bl],
    edges: [tm, rm, bm, lm],
    rotate: rotateHandle
  };
}

function applyTransformToFace(s) {
  // backward compat no-op (旧シングル専用関数は残すが使わない)
  const face = s.face;
  if (!face || !face.points || !s.basePoints || s.basePoints.length !== face.points.length) return;

  const cosA = Math.cos(s.rot);
  const sinA = Math.sin(s.rot);
  const cx = s.baseCenter.x + s.tx;
  const cy = s.baseCenter.y + s.ty;

  for (let i = 0; i < face.points.length; i++) {
    const bp = s.basePoints[i];
    const vx = (bp.x - s.baseCenter.x) * s.sx;
    const vy = (bp.y - s.baseCenter.y) * s.sy;
    const x = vx * cosA - vy * sinA;
    const y = vx * sinA + vy * cosA;
    face.points[i].x = cx + x;
    face.points[i].y = cy + y;
  }
}

function applyTransformToFaces(s) {
  if (!s || !Array.isArray(s.baseByFace) || !s.baseCenter) return;
  const cosA = Math.cos(s.rot);
  const sinA = Math.sin(s.rot);
  const cx = s.baseCenter.x + s.tx;
  const cy = s.baseCenter.y + s.ty;

  for (const entry of s.baseByFace) {
    const face = entry.face;
    const basePts = entry.points;
    if (!face || !face.points || !basePts || basePts.length !== face.points.length) continue;

    for (let i = 0; i < face.points.length; i++) {
      const bp = basePts[i];
      const vx = (bp.x - s.baseCenter.x) * s.sx;
      const vy = (bp.y - s.baseCenter.y) * s.sy;
      const x = vx * cosA - vy * sinA;
      const y = vx * sinA + vy * cosA;
      face.points[i].x = cx + x;
      face.points[i].y = cy + y;
    }
  }
}

function facesInRect(x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);

  const hit = [];
  (State.faces || []).forEach((face) => {
    if (!face || !face.points || face.points.length < 3) return;
    const b = getPointsBounds(face.points);
    const overlap = !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY);
    if (overlap) hit.push(face);
  });
  return hit;
}

function hitHandle(pt, mx, my, r = 14) {
  const dx = pt.x - mx;
  const dy = pt.y - my;
  return (dx * dx + dy * dy) <= r * r;
}

function getHandleHitRadius(base) {
  // タッチ端末は狙いづらいので、当たり判定を大きくする
  return scaleForPointer(base, { coarseMult: 1.8 });
}

export function handleTransformPress() {
  if (!State.frameFreeTransform) return false;
  if (State.isPlacing) return false;
  if (State.isImagePlacing) return false;

  const mx = window.mouseX;
  const my = window.mouseY;

  const cancelTransformMode = () => {
    State.frameFreeTransform = false;
    State.frameTransformAll = false;
    State.frameTransform = null;
    State.needsCompositeUpdate = true;
    if (typeof window.syncTransformButton === 'function') window.syncTransformButton();
  };

  const startDragIfHit = (s) => {
    if (!s) return false;
    const h = computeTransformHandles(s);

    const rRot = getHandleHitRadius(16);
    const rCorner = getHandleHitRadius(14);
    const rEdge = getHandleHitRadius(12);

    if (hitHandle(h.rotate, mx, my, rRot)) {
      const c = getTransformCenter(s);
      s.dragging = {
        type: 'rotate',
        startAngle: Math.atan2(my - c.y, mx - c.x),
        startRot: s.rot
      };
      return true;
    }

    // corners
    const cornerNames = ['tl', 'tr', 'br', 'bl'];
    for (let i = 0; i < h.corners.length; i++) {
      if (hitHandle(h.corners[i], mx, my, rCorner)) {
        s.dragging = { type: 'scale', kind: 'corner', which: cornerNames[i] };
        return true;
      }
    }

    // edges: top, right, bottom, left
    const edgeNames = ['top', 'right', 'bottom', 'left'];
    for (let i = 0; i < h.edges.length; i++) {
      if (hitHandle(h.edges[i], mx, my, rEdge)) {
        s.dragging = { type: 'scale', kind: 'edge', which: edgeNames[i] };
        return true;
      }
    }

    // move if inside box
    if (pointInPolygon(mx, my, h.box)) {
      s.dragging = {
        type: 'move',
        startMx: mx,
        startMy: my,
        startTx: s.tx,
        startTy: s.ty
      };
      return true;
    }

    return false;
  };

  // All Transform: いつでも全フレームを対象にし、選択変更/矩形選択はしない
  if (State.frameTransformAll) {
    const facesAll = (State.faces || []).filter(f => f && f.points && f.points.length >= 3);
    if (facesAll.length === 0) return false;
    const sAll = ensureTransformSessionForFaces(facesAll);
    if (!sAll) return false;
    if (startDragIfHit(sAll)) return true;

    // バウンディング/ハンドルに関係ない場所を押したら即解除
    cancelTransformMode();
    return true;
  }

  // 互換: TransformAll 以外のケースでも、枠/ハンドル以外は即解除
  cancelTransformMode();
  return true;
}

export function handleTransformDrag() {
  const s = State.frameTransform;
  if (!State.frameFreeTransform) return false;
  if (!s || !s.dragging) return false;
  if (!s.faces && s.dragging.type !== 'select') return false;

  const mx = window.mouseX;
  const my = window.mouseY;

  if (s.dragging.type === 'move') {
    const dx = mx - s.dragging.startMx;
    const dy = my - s.dragging.startMy;
    s.tx = s.dragging.startTx + dx;
    s.ty = s.dragging.startTy + dy;
  } else if (s.dragging.type === 'rotate') {
    const c = getTransformCenter(s);
    const a = Math.atan2(my - c.y, mx - c.x);
    s.rot = s.dragging.startRot + (a - s.dragging.startAngle);
  } else if (s.dragging.type === 'scale') {
    const v = toLocalFromWorld(s, mx, my);
    const hw = Math.max(1, s.baseW / 2);
    const hh = Math.max(1, s.baseH / 2);

    const clampScale = (v) => Math.max(0.05, Math.min(20, v));
    const absX = Math.max(1, Math.abs(v.x));
    const absY = Math.max(1, Math.abs(v.y));

    if (s.dragging.kind === 'edge') {
      if (s.dragging.which === 'left' || s.dragging.which === 'right') {
        s.sx = clampScale(absX / hw);
      } else {
        s.sy = clampScale(absY / hh);
      }
    } else {
      // corner: non-uniform
      s.sx = clampScale(absX / hw);
      s.sy = clampScale(absY / hh);
    }
  } else if (s.dragging.type === 'select') {
    // 矩形選択
    if (!s.selectRect) s.selectRect = { x1: s.dragging.startX, y1: s.dragging.startY, x2: mx, y2: my };
    s.selectRect.x2 = mx;
    s.selectRect.y2 = my;

    const inRect = facesInRect(s.selectRect.x1, s.selectRect.y1, s.selectRect.x2, s.selectRect.y2);
    const base = Array.isArray(s.selectBaseFaces) ? s.selectBaseFaces : [];
    const selected = s.selectAdditive ? base.concat(inRect) : inRect;
    // uniq
    const uniq = [];
    selected.forEach((f) => {
      if (!f) return;
      if (uniq.includes(f)) return;
      uniq.push(f);
    });
    State.selectedFaces = uniq;
    State.selectedFace = uniq.length ? uniq[uniq.length - 1] : null;
    State.needsCompositeUpdate = true;
    return true;
  }

  applyTransformToFaces(s);
  State.needsCompositeUpdate = true;
  return true;
}

export function handleTransformRelease() {
  const s = State.frameTransform;
  if (!s || !s.dragging) return false;

  if (s.dragging.type === 'select') {
    s.selectRect = null;
    s.selectBaseFaces = null;
    // selection ができたら transform セッションは作り直す
    State.frameTransform = null;
  } else {
    // 変形が確定したら base を更新するためセッションを作り直す
    State.frameTransform = null;
  }

  s.dragging = null;
  State.needsCompositeUpdate = true;
  return true;
}

// --- インタラクションハンドラー ---

export function handlePointPress() {
  if (State.toolTab !== 'FRAME') return false;

  const tol = getPointHitRadius(14);
  const hit = findNearbyPointInFaces(State.faces, window.mouseX, window.mouseY, tol);
  if (hit) {
    State.draggingPoint = hit;
    State.draggingMoved = false;
    State.dragStartX = window.mouseX;
    State.dragStartY = window.mouseY;
    State.selectedFace = hit.face;

    // 接続された全てのポイント（同じ位置にある点）を探す
    State.connectedPoints = [];
    const px = hit.face.points[hit.index].x;
    const py = hit.face.points[hit.index].y;

    State.faces.forEach(f => {
      f.points.forEach((p, idx) => {
        const d2 = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d2 < 4) {
          State.connectedPoints.push({ face: f, index: idx });
        }
      });
    });
    return true;
  }
  return false;
}

export function handlePointDrag() {
  if (State.draggingPoint) {
    const mx = window.mouseX;
    const my = window.mouseY;
    const movedDist2 = (mx - State.dragStartX) * (mx - State.dragStartX) + (my - State.dragStartY) * (my - State.dragStartY);
    if (movedDist2 > 9) State.draggingMoved = true;

    State.connectedPoints.forEach(cp => {
      cp.face.points[cp.index].x = window.constrain(mx, 0, window.width);
      cp.face.points[cp.index].y = window.constrain(my, 0, window.height);
    });

    State.needsCompositeUpdate = true;
    if (State.frameFreeTransform) State.frameTransform = null;
    return true;
  }
  return false;
}

export function handleFramePress() {
  // 画像配置モード
  if (State.isImagePlacing) {
    const target = findTopmostFaceAt(window.mouseX, window.mouseY, State.faces, State.activeFace);
    if (!target) return true;

    const applyNow = (img, name) => {
      if (!img) return;
      target.image = img;
      target.imageName = name || '';
      State.selectedFace = target;
      State.needsCompositeUpdate = true;
      if (window.updateModeButtonStyles) window.updateModeButtonStyles();
    };

    // すでにロード済みなら即適用
    if (State.placingImg) {
      applyNow(State.placingImg, State.placingImgName);
      return true;
    }

    // ロード待ち: entry を探してロード完了後に適用（1クリックでOK）
    const entry = (State.placingImgName && Array.isArray(State.sourceImages))
      ? State.sourceImages.find(e => e && e.name === State.placingImgName)
      : null;

    if (entry) {
      State.pendingImagePlaceFace = target;
      ensureSourceImageLoaded(entry, () => {
        const img = entry.processedImg || entry.originalImg;
        State.placingImg = img;
        applyNow(img, entry.name);
        State.pendingImagePlaceFace = null;
      });
      return true;
    }

    return true;
  }

  // ポイント追加モード
  if (State.isPlacing && State.activeFace) {
    State.activeFace.points.push({ x: window.mouseX, y: window.mouseY });
    if (State.activeFace.points.length >= 3) {
      State.activeFace.points = sortPointsClockwise(State.activeFace.points);
    }
    State.needsCompositeUpdate = true;
    return true;
  }

  // フレームドラッグモード
  if (State.toolTab === 'FRAME' && !State.isPlacing) {
    const target = findTopmostFaceAt(window.mouseX, window.mouseY, State.faces, State.activeFace);
    if (target) {
      // SHIFT押下時は全フレームを移動対象に
      const facesToMove = window.keyIsDown(window.SHIFT || 16) ? State.faces : [target];

      State.draggingFace = {
        face: target,
        faces: facesToMove,
        startX: window.mouseX,
        startY: window.mouseY,
        origStates: facesToMove.map(f => ({
          face: f,
          pts: f.points.map(p => ({ x: p.x, y: p.y }))
        }))
      };
      State.selectedFace = target;
      return true;
    }
  }

  // 背景クリック等での選択解除
  State.selectedFace = null;
  return false;
}

export function handleFrameDrag() {
  if (State.draggingFace) {
    const dx = window.mouseX - State.draggingFace.startX;
    const dy = window.mouseY - State.draggingFace.startY;

    State.draggingFace.origStates.forEach(state => {
      const face = state.face;
      const orig = state.pts;

      for (let i = 0; i < face.points.length; i++) {
        face.points[i].x = window.constrain(orig[i].x + dx, 0, window.width);
        face.points[i].y = window.constrain(orig[i].y + dy, 0, window.height);
      }
    });

    State.needsCompositeUpdate = true;
    if (State.frameFreeTransform) State.frameTransform = null;
    return true;
  }
  return false;
}

export function finalizeActiveFace() {
  if (State.activeFace && State.activeFace.points && State.activeFace.points.length >= 3) {
    State.faces.push(State.activeFace);
    State.allLayers.push({ type: 'frame', data: State.activeFace });
    State.selectedFace = State.activeFace;
  }
  State.activeFace = null;
  // State.updateModeButtonStyles(); // グローバル呼び出しまたはイベント発火が必要
  // 理想的には状態更新のみとし、UIはリアクティブに更新されるべき
}
