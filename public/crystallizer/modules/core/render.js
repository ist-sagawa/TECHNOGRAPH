import { State } from '../state.js';
import { getPointsBounds } from './math.js';
import { findNearbyPointInFaces, findTopmostFaceAt } from './picking.js';

export function drawCheckerboard(size) {
  window.noStroke();
  const w = window.width;
  const h = window.height;
  for (let y = 0; y < h; y += size * 2) {
    for (let x = 0; x < w; x += size * 2) {
      window.fill(245);
      window.rect(x, y, size, size);
      window.rect(x + size, y + size, size, size);
      window.fill(255);
      window.rect(x + size, y, size, size);
      window.rect(x, y + size, size, size);
    }
  }
}

export function renderComposite() {
  const pg = State.layers.composite;
  if (!pg) return;

  pg.clear();

  // 1. 背景
  // transparentBg=true のときは何も塗らず（alpha 0）、BG pool も描かない
  if (!State.transparentBg) {
    // legacy互換: 白背景
    pg.background(255);
  }

  // BG Pool 画像（Cover）
  if (!State.transparentBg && State.canvasBgImg) {
    pg.push();
    if (pg.drawingContext) pg.drawingContext.imageSmoothingEnabled = false;
    const img = State.canvasBgImg;
    const scale = Math.max(pg.width / img.width, pg.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    pg.imageMode(window.CENTER);
    pg.image(img, pg.width / 2, pg.height / 2, w, h);
    pg.pop();
  }

  // 2. レイヤー合成
  // State.allLayers は順番に描画されるべき
  // script.js の allLayers は {type, data} の配列

  for (const layer of State.allLayers) {
    if (layer.type === 'frame') {
      const face = layer.data;
      drawFaceToPg(pg, face);
    }
  }

  // アクティブフェイス（配置中）も表示
  if (State.activeFace && State.activeFace.points && State.activeFace.points.length >= 3 && State.activeFace.image) {
    drawFaceToPg(pg, State.activeFace);
  }

  // 3. エフェクト（全体適用の場合）
  // script.js では Effect は Image ソースごとの Dither として適用されることが多いが、
  // 全体へのポストエフェクトとして effectLayer がある場合もある。
  // ここでは省略（TODO: 必要なら復活）

  State.needsCompositeUpdate = false;
}

function drawFaceToPg(pg, face) {
  const pts = face.points;
  if (!pts || pts.length < 3) return;

  pg.push();

  // クリッピング用マスク作成
  // p5.js でのクリッピングは mask() よりも drawingContext.clip() が高速で柔軟
  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  ctx.clip();

  // 画像描画（legacy互換: polygon bbox cover）
  if (face.image) {
    const entry = face.imageName ? State.sourceImages.find(e => e.name === face.imageName) : null;
    const img = entry && entry.processedImg ? entry.processedImg : face.image;

    // Crystal tone correction (only when crystalized)
    const tone = State.crystalTone;
    const shouldTone = !!(State.isCrystalized && tone);
    if (shouldTone) {
      const b = Number(tone.brightness ?? 1.0);
      const c = Number(tone.contrast ?? 1.0);
      const s = Number(tone.saturation ?? 1.0);
      const h = Number(tone.hue ?? 0);
      ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
    }

    const b = getPointsBounds(pts);
    const boxW = Math.max(1, b.maxX - b.minX);
    const boxH = Math.max(1, b.maxY - b.minY);

    const scale = Math.max(boxW / img.width, boxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.imageSmoothingEnabled = false;
    pg.image(img, x, y, w, h);

    if (shouldTone) ctx.filter = 'none';
  } else {
    // 画像がない場合は白（あるいは透明）
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.restore();
  pg.pop();
}

export function updateHoverState() {
  State.hoverPoint = null;
  if (State.showFrames && !State.overUI) {
    if (window.mouseX >= 0 && window.mouseX <= window.width && window.mouseY >= 0 && window.mouseY <= window.height) {
      const allFaces = [];
      if (State.activeFace && State.activeFace.points && State.activeFace.points.length) allFaces.push(State.activeFace);
      if (State.faces && State.faces.length) allFaces.push(...State.faces);
      State.hoverPoint = findNearbyPointInFaces(allFaces, window.mouseX, window.mouseY, 14);
    }
  }

  State.hoverFace = null;
  // 画像配置中だけでなく、通常時も「ホバーしているフレーム」を拾う
  if (!State.overUI) {
    if (window.mouseX >= 0 && window.mouseX <= window.width && window.mouseY >= 0 && window.mouseY <= window.height) {
      State.hoverFace = findTopmostFaceAt(window.mouseX, window.mouseY, State.faces, State.activeFace);
    }
  }
}

export function drawPlacingPreview() {
  if (!State.isImagePlacing || !State.placingImg) return;
  const face = State.hoverFace;
  if (!face || !face.points || face.points.length < 3) return;

  window.push();
  const ctx = window.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(face.points[0].x, face.points[0].y);
  for (let i = 1; i < face.points.length; i++) ctx.lineTo(face.points[i].x, face.points[i].y);
  ctx.closePath();
  ctx.clip();

  const img = State.placingImg;
  const b = getPointsBounds(face.points);
  const boxW = Math.max(1, b.maxX - b.minX);
  const boxH = Math.max(1, b.maxY - b.minY);
  const scale = Math.max(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.imageSmoothingEnabled = false;
  window.tint(255, 210);
  window.image(img, x, y, w, h);

  ctx.restore();
  window.pop();
}

export function drawPlacingCursorPreview() {
  if (!State.isImagePlacing || !State.placingImg) return;
  // legacy: small preview near cursor
  const img = State.placingImg;

  window.push();
  window.noSmooth();
  window.imageMode(window.CENTER);

  const maxSize = 140;
  const s = Math.min(maxSize / img.width, maxSize / img.height);
  const pw = img.width * s;
  const ph = img.height * s;

  const px = window.mouseX + 90;
  const py = window.mouseY + 40;

  window.noFill();
  window.stroke(0);
  window.strokeWeight(1);
  window.rectMode(window.CENTER);
  window.rect(px, py, pw + 8, ph + 8);

  window.image(img, px, py, pw, ph);
  window.pop();
}


export function drawFrameGuides(face, isActive, isHover, isCompleted) {
  const pts = face.points;
  if (!pts || pts.length === 0) return;

  const isDraggingPointOnThisFace = !!(State.draggingPoint && State.draggingPoint.face === face);
  const isDraggingFaceIncludingThis = !!(State.draggingFace && Array.isArray(State.draggingFace.faces) && State.draggingFace.faces.includes(face));
  const isPlacingThisFace = !!(State.isPlacing && State.activeFace === face);
  const isHoveringThisFaceForImagePlacing = !!(State.isImagePlacing && State.hoverFace === face);

  // Transform モード中は「個々のフレーム線/点」は描かない（バウンディング/ハンドルのみ）
  const suppressFaceGuidesForTransform = !!(State.frameFreeTransform && !State.showFrames);

  // 基本は非表示。ただし操作中/配置中/変形中は該当フレームだけ一時的に表示する。
  const shouldDrawThisFace = !!(
    State.showFrames ||
    isDraggingPointOnThisFace ||
    isDraggingFaceIncludingThis ||
    isPlacingThisFace ||
    isHoveringThisFaceForImagePlacing ||
    isHover
  );

  // Free Transform overlay は face 描画とは独立して1回だけ描きたい
  const shouldDrawOverlay = !!(State.frameFreeTransform && !State.isPlacing && !State.isImagePlacing);
  const overlayAnchor = (State.faces && State.faces.length)
    ? State.faces[State.faces.length - 1]
    : (State.activeFace || null);
  const shouldDrawOverlayOnThisCall = !!(shouldDrawOverlay && overlayAnchor && face === overlayAnchor);

  const drawFaceGuides = shouldDrawThisFace && !suppressFaceGuidesForTransform;
  if (!drawFaceGuides && !shouldDrawOverlayOnThisCall) return;

  if (drawFaceGuides) {
    const frameStroke = isCompleted ? window.color(255, 0, 0) : window.color(0);
    const dotFill = isCompleted ? window.color(255, 0, 0) : window.color(0);

    // fill when no image
    if (pts.length >= 3 && !face.image) {
      window.noStroke();
      if (isCompleted) {
        window.fill(255, 210, 210, isActive ? 80 : 55);
      } else {
        window.fill(0, isActive ? 35 : 20);
      }
      window.beginShape();
      for (const p of pts) window.vertex(p.x, p.y);
      window.endShape(window.CLOSE);
    }

    window.stroke(frameStroke);
    window.strokeWeight(isHover ? 4 : (isActive ? 2 : 1));
    window.noFill();
    window.beginShape();
    for (const p of pts) window.vertex(p.x, p.y);
    window.endShape(pts.length >= 3 ? window.CLOSE : undefined);

    // dots
    window.noStroke();
    window.fill(dotFill);
    const baseDotSize = 10;
    const hoverDotSize = 18;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      // State.hoverPoint との照合
      const isDotHover = !!(State.hoverPoint && State.hoverPoint.face === face && State.hoverPoint.index === i);
      window.circle(p.x, p.y, isDotHover ? hoverDotSize : baseDotSize);
    }
  }

  // Free Transform overlay（全体/選択のグループ枠）
  // face ごとに描くと重複するので最後の face 描画時に1回だけ描く
  if (shouldDrawOverlayOnThisCall) drawFreeTransformOverlay(face);
}

function drawFreeTransformOverlay(face) {
  if (!State.frameFreeTransform) return;

  // ドラッグ矩形（複数選択）
  const tSel = State.frameTransform;
  if (tSel && tSel.dragging && tSel.dragging.type === 'select' && tSel.selectRect) {
    const r = tSel.selectRect;
    const x = Math.min(r.x1, r.x2);
    const y = Math.min(r.y1, r.y2);
    const w = Math.abs(r.x2 - r.x1);
    const h = Math.abs(r.y2 - r.y1);

    window.push();
    window.noFill();
    window.stroke(0, 120, 255);
    window.strokeWeight(1);
    if (window.drawingContext && window.drawingContext.setLineDash) {
      window.drawingContext.setLineDash([6, 6]);
    }
    window.rectMode(window.CORNER);
    window.rect(x, y, w, h);
    if (window.drawingContext && window.drawingContext.setLineDash) {
      window.drawingContext.setLineDash([]);
    }
    window.pop();
    return;
  }

  // 何も選択されてないときは枠を出さない
  const base = State.frameTransformAll
    ? (State.faces || [])
    : (Array.isArray(State.selectedFaces) ? State.selectedFaces : (State.selectedFace ? [State.selectedFace] : []));
  const faces = base.filter(f => f && f.points && f.points.length >= 3);
  if (faces.length === 0) return;

  // セッション初期化（描画時に追随）: グループ bounds
  const s = State.frameTransform;
  const needNew = !s || !Array.isArray(s.faces) || s.faces.length !== faces.length || !s.faces.every((f, i) => f === faces[i]);
  if (needNew) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    faces.forEach((f) => {
      const b = getPointsBounds(f.points);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    });
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    State.frameTransform = {
      faces,
      baseByFace: faces.map((f) => ({ face: f, points: f.points.map(p => ({ x: p.x, y: p.y })) })),
      baseCenter: { x: cx, y: cy },
      baseW: bw,
      baseH: bh,
      sx: 1,
      sy: 1,
      rot: 0,
      tx: 0,
      ty: 0,
      dragging: null,
      selectRect: null
    };
  }

  const t = State.frameTransform;
  const c = { x: t.baseCenter.x + t.tx, y: t.baseCenter.y + t.ty };
  const cosA = Math.cos(t.rot);
  const sinA = Math.sin(t.rot);
  const axisY = { x: -sinA, y: cosA };

  const hw = t.baseW / 2;
  const hh = t.baseH / 2;
  const toWorld = (vx, vy) => {
    const x0 = vx * t.sx;
    const y0 = vy * t.sy;
    return {
      x: c.x + x0 * cosA - y0 * sinA,
      y: c.y + x0 * sinA + y0 * cosA
    };
  };

  const tl = toWorld(-hw, -hh);
  const tr = toWorld(hw, -hh);
  const br = toWorld(hw, hh);
  const bl = toWorld(-hw, hh);
  const tm = toWorld(0, -hh);
  const rm = toWorld(hw, 0);
  const bm = toWorld(0, hh);
  const lm = toWorld(-hw, 0);
  const rotHandle = { x: tm.x - axisY.x * 55, y: tm.y - axisY.y * 55 };

  // --- hover detection (visual only) ---
  const mx = window.mouseX;
  const my = window.mouseY;
  const hitCircle = (p, r) => {
    const dx = (p.x - mx);
    const dy = (p.y - my);
    return (dx * dx + dy * dy) <= (r * r);
  };
  const distToSeg = (ax, ay, bx, by, px, py) => {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    if (ab2 <= 1e-9) return Math.hypot(px - ax, py - ay);
    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  };
  const boxPts = [tl, tr, br, bl];
  const cornerPts = [tl, tr, br, bl];
  const edgePts = [tm, rm, bm, lm];

  // hit radius (bigger than visual so it feels easy to grab)
  const hoverRotate = hitCircle(rotHandle, 24);
  const hoverCorner = cornerPts.map(p => hitCircle(p, 22));
  const hoverEdge = edgePts.map(p => hitCircle(p, 18));
  const hoverAnyHandle = hoverRotate || hoverCorner.some(Boolean) || hoverEdge.some(Boolean);
  const hoverBoxEdge = (() => {
    const thresh = 10;
    for (let i = 0; i < boxPts.length; i++) {
      const a = boxPts[i];
      const b = boxPts[(i + 1) % boxPts.length];
      if (distToSeg(a.x, a.y, b.x, b.y, mx, my) <= thresh) return true;
    }
    return false;
  })();

  // --- cursor ---
  // dragging state wins
  const dragging = t && t.dragging ? t.dragging : null;
  const setCursor = (name) => {
    // p5 の global cursor() が window に居ない環境があるので、canvas の style も直接触る
    try {
      if (typeof window.cursor === 'function') window.cursor(name);
    } catch { }
    try {
      const canvasEl = (State.ui && State.ui.canvas && State.ui.canvas.elt)
        ? State.ui.canvas.elt
        : document.querySelector('#canvas-container canvas');
      if (canvasEl) canvasEl.style.cursor = name;
    } catch { }
  };
  if (dragging) {
    if (dragging.type === 'move') setCursor('grabbing');
    else if (dragging.type === 'rotate') setCursor('crosshair');
    else if (dragging.type === 'scale') setCursor('grabbing');
    else if (dragging.type === 'select') setCursor('crosshair');
    else setCursor('default');
  } else if (hoverRotate) {
    setCursor('crosshair');
  } else {
    // scale cursors
    const cornerIdx = hoverCorner.findIndex(Boolean);
    const edgeIdx = hoverEdge.findIndex(Boolean);
    if (cornerIdx !== -1) {
      // tl/br: nwse, tr/bl: nesw
      setCursor((cornerIdx === 0 || cornerIdx === 2) ? 'nwse-resize' : 'nesw-resize');
    } else if (edgeIdx !== -1) {
      // edges: [top,right,bottom,left]
      setCursor((edgeIdx === 0 || edgeIdx === 2) ? 'ns-resize' : 'ew-resize');
    } else if (hoverBoxEdge) {
      setCursor('move');
    } else {
      setCursor('default');
    }
  }

  window.push();
  window.noFill();
  window.stroke(0, 120, 255);
  window.strokeWeight(hoverBoxEdge && !hoverAnyHandle ? 4 : 2);
  window.beginShape();
  window.vertex(tl.x, tl.y);
  window.vertex(tr.x, tr.y);
  window.vertex(br.x, br.y);
  window.vertex(bl.x, bl.y);
  window.endShape(window.CLOSE);

  // rotate handle line
  window.stroke(0, 120, 255);
  window.strokeWeight(1);
  window.line(tm.x, tm.y, rotHandle.x, rotHandle.y);

  const drawSquare = (p, s = 10) => {
    window.push();
    window.rectMode(window.CENTER);
    window.noStroke();
    window.fill(255);
    window.rect(p.x, p.y, s, s);
    window.stroke(0, 120, 255);
    window.noFill();
    window.rect(p.x, p.y, s, s);
    window.pop();
  };

  // handles: scale up slightly on hover
  const cornerBase = 12;
  const edgeBase = 10;
  const cornerHover = 24;
  const edgeHover = 18;
  [tl, tr, br, bl].forEach((p, i) => drawSquare(p, hoverCorner[i] ? cornerHover : cornerBase));
  [tm, rm, bm, lm].forEach((p, i) => drawSquare(p, hoverEdge[i] ? edgeHover : edgeBase));

  window.noStroke();
  window.fill(0, 120, 255);
  window.circle(rotHandle.x, rotHandle.y, hoverRotate ? 24 : 12);
  window.fill(255);
  window.circle(rotHandle.x, rotHandle.y, hoverRotate ? 12 : 6);

  window.pop();
}


