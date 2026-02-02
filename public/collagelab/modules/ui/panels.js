import { State } from '../state.js';
import { SOURCE_FILES, SOURCE_DIR } from '../config.js';
import { ensureSourceImageLoaded, reprocessSourceEntry, createDefaultDitherParams } from '../core/dither.js';
import { createRandomFace, startPlacingImage, applyRandomImagesToAllFrames, spreadApartFrames } from '../core/frame.js';
import { finalizeActiveFace } from '../tools/FrameTool.js';
import { styleButton, styleSmallButton, createLabeledSlider, createLabeledSliderRef } from './controls.js';
import { sortPointsClockwise, hsbToRgb } from '../core/math.js';
import { setActiveToolTab } from './tabs.js';

// UI Reference Storage for Sync
const UIr = {
  brush: {},
  dither: {},
  frame: {}
};

function syncFramesToggleButton() {
  const btn = State.ui && State.ui.framesToggleBtn;
  if (!btn) return;

  btn.html(State.showFrames ? '(F) FRAMES: ON' : '(F) FRAMES: OFF');

  if (State.showFrames) {
    btn.style('background', '#000');
    btn.style('color', '#fff');
    btn.style('border', '1px solid #fff');
  } else {
    btn.style('background', '#fff');
    btn.style('color', '#000');
    btn.style('border', 'none');
  }
}

// 他モジュール（Fキー・タブ切替等）からも呼べるようにしておく
window.syncFramesToggleButton = syncFramesToggleButton;

function getCurrentEntry() {
  if (!State.currentSourceName) return null;
  return State.sourceImages.find(e => e.name === State.currentSourceName) || null;
}

function syncBrushPreviewToCurrentSource() {
  if (!UIr.brush.previewImg) return;
  const entry = getCurrentEntry();
  const src = (entry && (entry.displayUrl || entry.path)) || State.currentSourcePath || '';
  UIr.brush.previewImg.attribute('src', src);
}

function ensureEntryDither(entry) {
  if (!entry) return;
  if (!entry.dither) entry.dither = { enabled: false, params: createDefaultDitherParams() };
  if (!entry.dither.params) entry.dither.params = createDefaultDitherParams();
}

function randomizeDitherParamsForEntry(entry) {
  if (!entry) return;
  ensureEntryDither(entry);

  // 右パネルの Random は「選択中のみ」を即変化させたいので none は基本避ける
  const types = ['atkinson', 'floydsteinberg', 'bayer', 'bayer8', 'pattern', 'simple'];
  entry.dither.enabled = true;

  const p = entry.dither.params;
  p.type = types[Math.floor(Math.random() * types.length)];
  p.useColor = Math.random() > 0.3;
  p.invert = Math.random() > 0.8;
  p.threshold = Math.floor(window.random(50, 210));
  p.pixelSize = Math.floor(window.random(1, 10));
  p.brightness = window.random(0.8, 1.2);
  p.contrast = window.random(0.8, 1.2);
  p.saturation = window.random(0.8, 1.2);
  p.hue = Math.floor(window.random(-20, 20));

  // Ink Color mode (Use Color OFF): randomize ink color each time.
  if (!p.useColor) {
    const h = window.random(0, 360);
    const s = window.random(0.65, 1.0);
    const v = window.random(0.55, 1.0);
    const [r, g, b] = hsbToRgb(h, s, v);
    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    p.fgColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

// --- Brush Panel ---
export function initBrushPanel(container) {
  const brushAreaTitle = window.createElement('h2', 'Brush Shape');
  brushAreaTitle.parent(container);

  // Brush Preview Container
  const previewContainer = window.createDiv('').addClass('preview-container').parent(container);
  previewContainer.style('position', 'relative');
  // legacy/見た目: 正方形のプレビュー
  previewContainer.style('width', '100%');
  previewContainer.style('aspect-ratio', '1 / 1');
  previewContainer.style('height', 'auto');
  previewContainer.style('background', '#eee');
  previewContainer.style('overflow', 'hidden');

  // Preview Image (for visual feedback of brush texture)
  // We use a DOM img or div with background
  const previewImg = window.createImg('', 'brush preview').parent(previewContainer);
  previewImg.style('position', 'absolute');
  previewImg.style('top', '0');
  previewImg.style('left', '0');
  previewImg.style('width', '100%');
  previewImg.style('height', '100%');
  previewImg.style('object-fit', 'contain');
  // レイヤー: プレビューは下、選択線(SVG)は上
  previewImg.style('z-index', '1');
  // ぼやけ対策: 透過をやめて通常表示
  previewImg.style('opacity', '1');
  previewImg.style('display', 'block');
  // ぼやけ対策: ブラウザの補間を抑制
  previewImg.style('image-rendering', 'pixelated');
  if (previewImg.elt) {
    previewImg.elt.style.imageRendering = 'pixelated';
    // Safari/旧ブラウザ向け
    previewImg.elt.style.imageRendering = 'crisp-edges';
  }
  // Actually original script just showed the image.
  UIr.brush.previewImg = previewImg;

  // SVG Overlay for Manipulating Points
  // Using HTML5 SVG
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.zIndex = '2';
  previewContainer.elt.appendChild(svg);

  // Polygon used for fill/stroke
  const polyLine = document.createElementNS(svgNS, "polygon");
  polyLine.setAttribute("fill", "rgba(0,0,255,0.2)");
  polyLine.setAttribute("stroke", "blue");
  polyLine.setAttribute("stroke-width", "2");
  // 選択のドットライン
  polyLine.setAttribute('stroke-dasharray', '6 6');
  polyLine.setAttribute('stroke-linecap', 'round');
  svg.appendChild(polyLine);

  UIr.brush.svg = svg;
  UIr.brush.polyLine = polyLine;
  UIr.brush.previewContainer = previewContainer;

  // Click to add points
  previewContainer.mousePressed((e) => {
    // Prevent adding point if clicking on existing marker (handled by marker logic)
    if (e.target.tagName === 'circle') return;

    const rect = previewContainer.elt.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    State.brushPoints.push({ x, y });
    sortPointsClockwise(State.brushPoints);
    renderBrushUI();
    updatePolygonBrush();
  });

  const brushActionRow = window.createDiv('').parent(container);
  brushActionRow.style('display', 'grid');
  brushActionRow.style('grid-template-columns', '1fr 1fr');
  brushActionRow.style('gap', '4px');
  brushActionRow.style('margin-bottom', '10px');

  const undoBtn = window.createButton('Undo Pt').parent(brushActionRow);
  undoBtn.mousePressed(() => {
    State.brushPoints.pop();
    sortPointsClockwise(State.brushPoints);
    renderBrushUI();
    updatePolygonBrush();
  });

  const clearPtsBtn = window.createButton('Clear Pts').parent(brushActionRow);
  clearPtsBtn.mousePressed(() => {
    State.brushPoints = [];
    renderBrushUI();
    updatePolygonBrush();
  });

  const rectBtn = window.createButton('Rect').parent(brushActionRow);
  rectBtn.mousePressed(() => {
    setBrushPresetPoints('rect');
  });

  const circleBtn = window.createButton('Circle').parent(brushActionRow);
  circleBtn.mousePressed(() => {
    setBrushPresetPoints('circle');
  });

  // STORE SLIDERS IN UI REFS
  UIr.brush.size = createLabeledSlider(container, 'Size', 20, 600, State.brushSize, 1, (v) => State.brushSize = v);
  UIr.brush.opacity = createLabeledSlider(container, 'Opacity', 0, 100, State.brushOpacity, 1, (v) => State.brushOpacity = v);
  UIr.brush.scatter = createLabeledSlider(container, 'Scatter', 0, 150, State.brushScatter, 1, (v) => State.brushScatter = v);
  UIr.brush.amount = createLabeledSlider(container, 'Amount', 0.1, 10, State.brushAmount, 0.1, (v) => State.brushAmount = v);

  const brushToggles = window.createDiv('').parent(container);
  brushToggles.style('display', 'grid');
  brushToggles.style('grid-template-columns', '1fr 1fr');
  brushToggles.style('gap', '6px');
  brushToggles.style('margin', '8px 0 0');

  const singleStampToggle = window.createCheckbox('Single Stamp', !!State.brushSingleStamp).parent(brushToggles);
  singleStampToggle.changed(() => {
    State.brushSingleStamp = singleStampToggle.checked();
    // 単発時は押しっぱで連続しないように
    if (State.brushSingleStamp) State.isDrawingPermitted = false;
  });
  UIr.brush.singleStampToggle = singleStampToggle;

  const rotateToggle = window.createCheckbox('Random Rotate', State.brushRandomRotate !== false).parent(brushToggles);
  rotateToggle.changed(() => {
    State.brushRandomRotate = rotateToggle.checked();
  });
  UIr.brush.rotateToggle = rotateToggle;

  const clearBrushBtn = window.createButton('CLEAR ALL BRUSHES').parent(container);
  clearBrushBtn.style('width', '100%');
  clearBrushBtn.mousePressed(() => {
    State.allLayers = State.allLayers.filter(l => l.type !== 'brush');
    State.layers.brush.clear();
    State.needsCompositeUpdate = true;
  });

  clearBrushBtn.style('margin-top', '10px');

  // デフォルト: 画像全体を選択しているRect
  if (!State.brushPoints || State.brushPoints.length < 3) {
    const m = 0.02; // default inset margin
    State.brushPoints = [
      { x: m, y: m }, { x: 1.0 - m, y: m },
      { x: 1.0 - m, y: 1.0 - m }, { x: m, y: 1.0 - m }
    ];
  }

  // Initial render
  renderBrushUI();

  // Initial brush update (might fail if no image, but safe)
  setTimeout(() => updatePolygonBrush(), 500);
}

function renderBrushUI() {
  const svg = UIr.brush.svg;
  const polyLine = UIr.brush.polyLine;
  const container = UIr.brush.previewContainer;

  // Clear circles (markers)
  // Keep the polygon element (first child usually)
  while (svg.childNodes.length > 1) {
    svg.removeChild(svg.lastChild);
  }

  // Update Polygon points
  const w = container.elt.clientWidth || 200;
  const h = container.elt.clientHeight || 200;
  const ptsString = State.brushPoints.map(p => `${p.x * w},${p.y * h}`).join(" ");
  polyLine.setAttribute("points", ptsString);

  // Add Markers
  State.brushPoints.forEach((p, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", p.x * w);
    c.setAttribute("cy", p.y * h);
    const baseR = 5;
    const hoverR = 8;
    c.setAttribute("r", baseR);
    c.setAttribute("fill", "white");
    c.setAttribute("stroke", "black");
    c.style.cursor = "move";

    c.addEventListener('mouseenter', () => {
      c.setAttribute('r', hoverR);
    });
    c.addEventListener('mouseleave', () => {
      c.setAttribute('r', baseR);
    });

    // Drag logic
    let isDragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    c.addEventListener('mousedown', (e) => {
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      if (!moved) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if ((dx * dx + dy * dy) > 9) moved = true; // 3px
      }
      const rect = container.elt.getBoundingClientRect();
      let nx = (e.clientX - rect.left) / rect.width;
      let ny = (e.clientY - rect.top) / rect.height;
      nx = Math.max(0, Math.min(1, nx));
      ny = Math.max(0, Math.min(1, ny));
      p.x = nx;
      p.y = ny;
      renderBrushUI();
      // updatePolygonBrush deferred or throttled? 
      // doing it here might be heavy but immediate feedback is good
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        // クリック（移動なし）ならこの頂点を削除
        if (!moved) {
          State.brushPoints.splice(i, 1);
          sortPointsClockwise(State.brushPoints);
          renderBrushUI();
          updatePolygonBrush();
          return;
        }

        sortPointsClockwise(State.brushPoints);
        renderBrushUI();
        updatePolygonBrush();
      }
    });

    svg.appendChild(c);
  });
}

function setBrushPresetPoints(type) {
  State.brushPoints = [];
  if (type === 'rect') {
    State.brushPoints = [
      { x: 0.0, y: 0.0 }, { x: 1.0, y: 0.0 },
      { x: 1.0, y: 1.0 }, { x: 0.0, y: 1.0 }
    ];
  } else if (type === 'circle') {
    // より滑らかな円 + 画像いっぱい
    const num = 48;
    const r = 0.5;
    for (let i = 0; i < num; i++) {
      const ang = (Math.PI * 2 * i) / num;
      State.brushPoints.push({
        x: 0.5 + Math.cos(ang) * r,
        y: 0.5 + Math.sin(ang) * r
      });
    }
  }
  renderBrushUI();
  updatePolygonBrush();
}

export function updatePolygonBrush() {
  if (State.brushPoints.length < 3) {
    State.brushStamp = null;
    State.brushPreviewImg = null;
    // legacy: ポイント未完成でも source のプレビュー自体は表示しておく
    syncBrushPreviewToCurrentSource();
    return;
  }

  // legacy: current source（processed優先）を使い、polygon bbox で stamp を切り出す
  let sourceImg = null;
  const currentEntry = State.currentSourceName
    ? State.sourceImages.find(e => e.name === State.currentSourceName)
    : null;
  if (currentEntry) sourceImg = currentEntry.processedImg || currentEntry.originalImg || null;
  if (!sourceImg) sourceImg = State.currentSourceImg || null;
  if (!sourceImg && State.sourceImages.length > 0) sourceImg = State.sourceImages[0].processedImg || State.sourceImages[0].originalImg || null;
  if (!sourceImg) return;

  const W = sourceImg.width;
  const H = sourceImg.height;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of State.brushPoints) {
    const x = p.x * W;
    const y = p.y * H;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const pad = 2;
  const ix = Math.max(0, Math.floor(minX - pad));
  const iy = Math.max(0, Math.floor(minY - pad));
  const ax = Math.min(W, Math.ceil(maxX + pad));
  const ay = Math.min(H, Math.ceil(maxY + pad));
  const bw = Math.max(1, ax - ix);
  const bh = Math.max(1, ay - iy);

  // legacy互換: stamp は p5.Graphics として生成（ただし毎回 new せず使い回す）
  let pg = UIr.brush.stampPg;
  if (!pg) {
    pg = window.createGraphics(bw, bh);
    pg.pixelDensity(1);
    pg.noSmooth();
    if (pg.drawingContext) pg.drawingContext.imageSmoothingEnabled = false;
    UIr.brush.stampPg = pg;
  } else if (pg.width !== bw || pg.height !== bh) {
    // resize で canvas を増殖させない
    if (typeof pg.resizeCanvas === 'function') {
      pg.resizeCanvas(bw, bh);
    } else {
      // 念のため
      const oldPg = pg;
      pg = window.createGraphics(bw, bh);
      pg.pixelDensity(1);
      pg.noSmooth();
      if (oldPg && typeof oldPg.remove === 'function') oldPg.remove();
      UIr.brush.stampPg = pg;
    }
    pg.pixelDensity(1);
    pg.noSmooth();
    if (pg.drawingContext) pg.drawingContext.imageSmoothingEnabled = false;
  }

  pg.clear();

  // clip -> draw image
  const ctx = pg.drawingContext;
  if (ctx && ctx.save) ctx.save();
  if (ctx && ctx.beginPath) {
    const pts = State.brushPoints.map((p) => ({ x: p.x * W - ix, y: p.y * H - iy }));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();
  }
  if (ctx) ctx.imageSmoothingEnabled = false;
  pg.image(sourceImg, -ix, -iy);
  if (ctx && ctx.restore) ctx.restore();

  State.brushStamp = pg;
  State.brushPreviewImg = pg;

  // UI表示は常に「元ソース画像 + ポリゴンオーバーレイ」にする（legacy互換）
  // stamp（cropped）は描画用に State.brushStamp として保持する。
  syncBrushPreviewToCurrentSource();
}

// --- Frame Panel ---
export function initFramePanel(container) {
  const c = window.createDiv('').parent(container);
  c.style('display', 'flex');
  c.style('flex-direction', 'column');
  c.style('gap', '10px');

  const distortFace = (face, amount) => {
    if (!face || !face.points || face.points.length < 3) return;
    const a = Math.max(0, Number(amount || 0));
    if (a <= 0) return;

    for (const p of face.points) {
      p.x = window.constrain(p.x + window.random(-a, a), 0, window.width);
      p.y = window.constrain(p.y + window.random(-a, a), 0, window.height);
    }
    face.points = sortPointsClockwise(face.points);
  };

  const newFaceBtn = window.createButton('MAKE NEW FRAME!').parent(c);
  styleButton(newFaceBtn);
  newFaceBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    State.isImagePlacing = false;
    State.placingImg = null;
    State.placingImgName = '';
    State.isPlacing = true;
    if (State.activeFace && State.activeFace.points && State.activeFace.points.length >= 3) {
      finalizeActiveFace();
    }
    State.activeFace = { points: [], image: null, imageName: '' };
    State.selectedFace = State.activeFace;
    State.needsCompositeUpdate = true;
    if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  });

  const finishRow = window.createDiv('').parent(c);
  finishRow.style('display', 'grid');
  finishRow.style('grid-template-columns', '1fr 1fr');
  finishRow.style('gap', '6px');

  const finishBtn = window.createButton('FINISH FRAME').parent(finishRow);
  styleSmallButton(finishBtn);
  finishBtn.mousePressed(() => {
    finalizeActiveFace();
    State.isPlacing = false;
    State.needsCompositeUpdate = true;
    if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  });

  const cancelBtn = window.createButton('CANCEL').parent(finishRow);
  styleSmallButton(cancelBtn);
  cancelBtn.mousePressed(() => {
    State.activeFace = null;
    State.isPlacing = false;
    State.needsCompositeUpdate = true;
    if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  });

  const framesToggleBtn = window.createButton('FRAMES: ON').parent(c);
  framesToggleBtn.style('width', '100%');
  framesToggleBtn.mousePressed(() => {
    State.showFrames = !State.showFrames;
    State.hoverPoint = null;
    State.draggingPoint = null;
    State.draggingMoved = false;
    State.connectedPoints = [];
    State.draggingFace = null;
    syncFramesToggleButton();
    State.needsCompositeUpdate = true;
  });
  UIr.frame.toggleBtn = framesToggleBtn;
  State.ui.framesToggleBtn = framesToggleBtn;
  syncFramesToggleButton();

  const randomShapeBtn = window.createButton('RANDOM SHAPE').parent(c);
  styleButton(randomShapeBtn);
  randomShapeBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    State.isPlacing = false;
    State.isImagePlacing = false;
    State.placingImg = null;
    State.placingImgName = '';
    const face = createRandomFace();
    State.faces.push(face);
    State.allLayers.push({ type: 'frame', data: face });
    State.selectedFace = face;
    State.needsCompositeUpdate = true;
    if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  });

  const placeImageBtn = window.createButton('PUT IMAGE IN FRAME').parent(c);
  styleButton(placeImageBtn);
  placeImageBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        startPlacingImage(entry.processedImg || entry.originalImg, entry.name);
      });
    });
    if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  });

  const randomAllImagesBtn = window.createButton('RANDOM IMAGES').parent(c);
  styleButton(randomAllImagesBtn);
  randomAllImagesBtn.mousePressed(() => {
    applyRandomImagesToAllFrames();
  });

  // --- Free Transform (Photoshop風) ---
  const transformSection = window.createDiv('').parent(c);
  transformSection.style('margin-top', '6px');
  transformSection.style('padding-top', '6px');
  transformSection.style('border-top', '1px solid #ddd');

  window.createElement('h3', 'Transform').parent(transformSection).style('margin', '4px 0');

  const ftToggle = window.createCheckbox('All Transform (drag handles)', !!State.frameFreeTransform).parent(transformSection);
  ftToggle.changed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();

    State.frameFreeTransform = ftToggle.checked();
    State.frameTransformAll = State.frameFreeTransform;

    // All Transform: 全フレームを選択状態にしてグループ変形対象にする
    if (State.frameFreeTransform) {
      const faces = (State.faces || []).filter(f => f && f.points && f.points.length >= 3);
      State.selectedFaces = faces;
      State.selectedFace = faces.length ? faces[faces.length - 1] : null;
    }
    State.frameTransform = null;
    State.needsCompositeUpdate = true;
  });

  const spreadSection = window.createDiv('').parent(transformSection);
  spreadSection.style('margin-top', '8px');

  const spreadIters = createLabeledSlider(spreadSection, 'Iterations', 5, 140, 45, 1);
  const spreadPad = createLabeledSlider(spreadSection, 'Padding', 0, 120, 26, 1);

  const spreadBtn = window.createButton('SPREAD APART (ALL)').parent(spreadSection);
  spreadBtn.style('width', '100%');
  spreadBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();

    spreadApartFrames({ iterations: spreadIters.value(), padding: spreadPad.value() });
    // spreadApartFrames 内で needsCompositeUpdate を立てる
  });

  // --- Distort (ざっくり歪ませる) ---
  const distortSection = window.createDiv('').parent(c);
  distortSection.style('margin-top', '6px');
  distortSection.style('padding-top', '6px');
  distortSection.style('border-top', '1px solid #ddd');

  window.createElement('h3', 'Distort').parent(distortSection).style('margin', '4px 0');
  const distortAmt = createLabeledSlider(distortSection, 'Amount', 0, 250, 60, 1);

  const distortRow = window.createDiv('').parent(distortSection);
  distortRow.style('display', 'grid');
  distortRow.style('grid-template-columns', '1fr 1fr');
  distortRow.style('gap', '6px');

  const distortSelectedBtn = window.createButton('DISTORT SELECTED').parent(distortRow);
  styleSmallButton(distortSelectedBtn);
  distortSelectedBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();

    const face = State.selectedFace || State.activeFace;
    if (!face) return;
    distortFace(face, distortAmt.value());
    if (State.frameFreeTransform) State.frameTransform = null;
    State.needsCompositeUpdate = true;
  });

  const distortAllBtn = window.createButton('DISTORT ALL').parent(distortRow);
  styleSmallButton(distortAllBtn);
  distortAllBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    State.showFrames = true;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();

    (State.faces || []).forEach((f) => distortFace(f, distortAmt.value()));
    if (State.activeFace) distortFace(State.activeFace, distortAmt.value());
    if (State.frameFreeTransform) State.frameTransform = null;
    State.needsCompositeUpdate = true;
  });

  // legacy互換: モードボタンのハイライト
  const updateModeButtonStyles = () => {
    [newFaceBtn, placeImageBtn].forEach((btn) => {
      btn.style('background', '#fff');
      btn.style('color', '#0000ff');
      btn.style('outline', 'none');
    });

    if (State.isPlacing) {
      newFaceBtn.style('background', '#0000ff');
      newFaceBtn.style('color', '#fff');
      newFaceBtn.style('outline', '2px solid #fff');
    }

    if (State.isImagePlacing) {
      placeImageBtn.style('background', '#0000ff');
      placeImageBtn.style('color', '#fff');
      placeImageBtn.style('outline', '2px solid #fff');
    }
  };

  window.updateModeButtonStyles = updateModeButtonStyles;
  updateModeButtonStyles();
}

// --- Dither Panel ---
export function initDitherPanel(container) {
  window.createElement('h2', 'Processed Preview').parent(container);

  // Preview Image
  const previewContainer = window.createDiv('').addClass('preview-container').parent(container);

  // legacy感: 正方形＆拡大時にぼやけにくく
  previewContainer.style('width', '100%');
  previewContainer.style('aspect-ratio', '1 / 1');
  previewContainer.style('height', 'auto');
  previewContainer.style('background', '#eee');
  previewContainer.style('overflow', 'hidden');

  // Actually show the dither preview here
  // We can use a DOM img that gets updated
  const ditherPreviewImg = window.createImg('', 'dither preview').parent(previewContainer);
  ditherPreviewImg.style('width', '100%');
  ditherPreviewImg.style('height', '100%');
  ditherPreviewImg.style('object-fit', 'contain');
  ditherPreviewImg.style('display', 'block');
  // ditherはピクセル表現が多いので nearest-neighbor 寄り
  ditherPreviewImg.style('image-rendering', 'pixelated');
  UIr.dither.previewImg = ditherPreviewImg;

  const topRow = window.createDiv('').parent(container);
  topRow.style('display', 'grid');
  topRow.style('grid-template-columns', '1fr 1fr');
  topRow.style('gap', '6px');
  topRow.style('margin', '6px 0');

  const toggleBtn = window.createButton('DITHER: OFF').parent(topRow);
  toggleBtn.style('width', '100%');
  toggleBtn.mousePressed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.enabled = !entry.dither.enabled;
    if (entry.dither.enabled && entry.dither.params.type === 'none') {
      entry.dither.params.type = 'atkinson';
    }
    updateDitherPanelUI();
    triggerDitherUpdate();
  });
  UIr.dither.toggleBtn = toggleBtn;

  const randomBtn = window.createButton('RANDOM (SELECTED)').parent(topRow);
  randomBtn.style('width', '100%');
  randomBtn.mousePressed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    randomizeDitherParamsForEntry(entry);
    updateDitherPanelUI();
    triggerDitherUpdate();
  });

  // Type Select
  const typeRow = window.createDiv('').parent(container).style('display', 'flex').style('justify-content', 'space-between');
  window.createSpan('Type:').parent(typeRow);
  const typeSelect = window.createSelect().parent(typeRow);
  ['atkinson', 'floydsteinberg', 'bayer', 'bayer8', 'pattern', 'simple', 'none'].forEach(o => typeSelect.option(o));
  typeSelect.selected('atkinson');
  typeSelect.changed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.type = typeSelect.value();
    // type が none のときも enabled は保持（legacy の「OFF」扱いは enabled で制御）
    updateDitherPanelUI();
    triggerDitherUpdate();
  });
  UIr.dither.typeSelect = typeSelect;

  // Sliders
  UIr.dither.threshold = createLabeledSliderRef(container, 'Threshold', 0, 255, 128, 1, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.threshold = v;
    triggerDitherUpdate();
  });
  UIr.dither.pixelSize = createLabeledSliderRef(container, 'Pixel Size', 1, 100, 2, 1, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.pixelSize = v;
    triggerDitherUpdate();
  });

  UIr.dither.brightness = createLabeledSliderRef(container, 'Brightness', 0.2, 2.0, 1.0, 0.01, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.brightness = Number(v);
    triggerDitherUpdate();
  });

  UIr.dither.contrast = createLabeledSliderRef(container, 'Contrast', 0.2, 2.0, 1.0, 0.01, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.contrast = Number(v);
    triggerDitherUpdate();
  });

  UIr.dither.saturation = createLabeledSliderRef(container, 'Saturation', 0.0, 2.0, 1.0, 0.01, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.saturation = Number(v);
    triggerDitherUpdate();
  });

  UIr.dither.hue = createLabeledSliderRef(container, 'Hue', -180, 180, 0, 1, v => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.hue = Number(v);
    triggerDitherUpdate();
  });

  const togglesRow = window.createDiv('').parent(container);
  togglesRow.style('display', 'grid');
  togglesRow.style('grid-template-columns', '1fr 1fr');
  togglesRow.style('gap', '6px');
  togglesRow.style('margin', '6px 0');

  const useColorToggle = window.createCheckbox('Use Color', true).parent(togglesRow);
  useColorToggle.changed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.useColor = useColorToggle.checked();
    triggerDitherUpdate();
  });
  UIr.dither.useColorToggle = useColorToggle;

  const invertToggle = window.createCheckbox('Invert', false).parent(togglesRow);
  invertToggle.changed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.invert = invertToggle.checked();
    triggerDitherUpdate();
  });
  UIr.dither.invertToggle = invertToggle;

  const fgRow = window.createDiv('').parent(container);
  fgRow.style('display', 'flex');
  fgRow.style('justify-content', 'space-between');
  fgRow.style('align-items', 'center');
  fgRow.style('margin-top', '6px');

  window.createSpan('Ink Color:').parent(fgRow).style('font-size', '9px');
  const fgPicker = window.createColorPicker('#000000').parent(fgRow);
  fgPicker.input(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureEntryDither(entry);
    entry.dither.params.fgColor = fgPicker.value();
    triggerDitherUpdate();
  });
  UIr.dither.fgPicker = fgPicker;

  // 初期同期
  updateDitherPanelUI();
}

function triggerDitherUpdate() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryDither(entry);

  ensureSourceImageLoaded(entry, () => {
    reprocessSourceEntry(entry, () => {
      if (entry.displayUrl && UIr.dither.previewImg) UIr.dither.previewImg.attribute('src', entry.displayUrl);

      // 選択中の操作なので current を確実に追従させる
      if (entry.name === State.currentSourceName) {
        State.currentSourceImg = entry.processedImg || entry.originalImg;
        State.currentSourcePath = entry.displayUrl || entry.path;
      }

      updateImageGrid();
      updatePolygonBrush();
      State.needsCompositeUpdate = true;
    });
  });
}

// --- Text Panel ---
export function initTextPanel(container) {
  window.createElement('h2', 'Add Text Layer').parent(container);

  const row1 = window.createDiv('').parent(container).style('margin-bottom', '12px');
  window.createSpan('Text:').parent(row1).style('display', 'block');
  const textInput = window.createInput('Collage').parent(row1).style('width', '100%');
  textInput.style('padding', '8px');
  textInput.style('font-family', 'monospace');

  const sizeSlider = createLabeledSlider(container, 'Size', 10, 500, 100, 1);

  const row2 = window.createDiv('').parent(container).style('display', 'flex').style('justify-content', 'space-between');
  const colorPicker = window.createColorPicker('#000000').parent(row2);

  const addBtn = window.createButton('ADD TEXT TO CANVAS').parent(container);
  styleButton(addBtn);
  addBtn.mousePressed(() => {
    const txt = textInput.value();
    if (!txt) return;
    State.allLayers.push({
      type: 'text',
      data: {
        text: txt,
        size: sizeSlider.value(),
        color: colorPicker.value(),
        x: window.width / 2,
        y: window.height / 2
      }
    });
    State.needsCompositeUpdate = true;
  });

  const clearBtn = window.createButton('CLEAR ALL TEXT').parent(container);
  styleSmallButton(clearBtn);
  clearBtn.mousePressed(() => {
    State.allLayers = State.allLayers.filter(l => l.type !== 'text');
    State.needsCompositeUpdate = true;
  });
}

// --- Source Panel ---
export function initSourcePanel(container) {
  // Drag & Drop zone (legacy互換)
  const dropZone = window.createDiv('DROP IMAGES HERE').parent(container);
  dropZone.addClass('drop-zone');
  dropZone.style('margin-bottom', '10px');
  dropZone.style('user-select', 'none');

  // legacy: 画面上に input を出さず、DnD で追加する（必要なら drop zone クリックで起動）
  const addLocalInput = window.createFileInput((file) => {
    if (!file) return;
    if (!file.file) return;
    if (!file.type || !String(file.type).startsWith('image/')) return;

    const url = URL.createObjectURL(file.file);
    const nameBase = file.file.name || 'local-image';
    const uniqueName = `local_${Date.now()}_${nameBase}`;
    const entry = {
      name: uniqueName,
      path: url,
      isLocal: true,
      originalImg: null,
      processedImg: null,
      thumbUrl: '',
      displayUrl: '',
      dither: { enabled: false, params: createDefaultDitherParams() },
      loading: false
    };
    State.sourceImages.unshift(entry);
    State.currentSourceName = entry.name;
    State.currentSourcePath = entry.path;
    updateImageGrid();

    entry.loading = true;
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        entry.loading = false;
        State.currentSourceImg = entry.originalImg;
        updateImageGrid();
        updatePolygonBrush();
        updateDitherPanelUI();
      });
    });
  }, true).parent(container);
  // "ファイル選択UI" を見せない
  addLocalInput.hide();

  // drop zone をクリックしたら隠し input を起動（見た目は legacy のまま）
  dropZone.mousePressed(() => {
    if (addLocalInput && addLocalInput.elt) addLocalInput.elt.click();
  });

  // native DnD
  const el = dropZone.elt;
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style('background', '#222');
    dropZone.style('color', '#fff');
  });
  el.addEventListener('dragleave', () => {
    dropZone.style('background', '');
    dropZone.style('color', '');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style('background', '');
    dropZone.style('color', '');
    const files = Array.from(e.dataTransfer?.files || []).filter(f => String(f.type || '').startsWith('image/'));
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      const uniqueName = `local_${Date.now()}_${f.name}`;
      const entry = {
        name: uniqueName,
        path: url,
        isLocal: true,
        originalImg: null,
        processedImg: null,
        thumbUrl: '',
        displayUrl: '',
        dither: { enabled: false, params: createDefaultDitherParams() },
        loading: false
      };
      State.sourceImages.unshift(entry);
      State.currentSourceName = entry.name;
      State.currentSourcePath = entry.path;

      entry.loading = true;
      ensureSourceImageLoaded(entry, () => {
        reprocessSourceEntry(entry, () => {
          entry.loading = false;
          State.currentSourceImg = entry.originalImg;
          updateImageGrid();
          updatePolygonBrush();
          updateDitherPanelUI();
        });
      });
    });
    updateImageGrid();
  });

  const grid = window.createDiv('').id('image-grid-container').parent(container);

  // legacy感: 縦ホイールで横スクロール（横長サムネ一覧）
  if (grid && grid.elt) {
    grid.elt.addEventListener('wheel', (e) => {
      // Shift 押下はブラウザデフォルトの横スクロールに任せる
      if (e.shiftKey) return;
      const dx = e.deltaX || 0;
      const dy = e.deltaY || 0;
      // 縦入力が主なら横に変換
      if (Math.abs(dy) > Math.abs(dx)) {
        grid.elt.scrollLeft += dy;
        e.preventDefault();
      }
    }, { passive: false });
  }

  if (State.sourceImages.length === 0) {
    // should be populated by main.js preload but safe check
    SOURCE_FILES.forEach(file => {
      State.sourceImages.push({
        name: file,
        path: SOURCE_DIR + file,
        isLocal: false,
        originalImg: null,
        processedImg: null,
        thumbUrl: '',
        displayUrl: '',
        dither: { enabled: false, params: createDefaultDitherParams() },
        loading: false
      });
    });
  }
  updateImageGrid();
}

export function updateImageGrid() {
  const grid = window.select('#image-grid-container');
  if (!grid) return;

  // Grid layout styles -> Horizontal Scroll
  grid.style('display', 'flex');
  grid.style('overflow-x', 'auto');
  grid.style('white-space', 'nowrap'); // Ensure no wrapping
  grid.style('gap', '10px');
  // Scrollbar styling could be added via CSS file, but basic functional change here
  grid.style('padding-bottom', '10px'); // space for scrollbar

  grid.html('');

  State.sourceImages.forEach(entry => {
    const thumb = window.createDiv().parent(grid).addClass('image-thumb');
    thumb.style('height', '80px');
    thumb.style('min-width', '80px'); // Prevent shrinking
    thumb.style('width', '80px');
    thumb.style('background-size', 'cover');
    thumb.style('background-position', 'center');
    thumb.style('border', '1px solid #ccc');
    thumb.style('cursor', 'pointer');

    // Selection highlight
    if (State.currentSourceName === entry.name) {
      thumb.style('border', '2px solid #ffffff');
      // Update Dither Panel Preview when selected
      if (UIr.dither.previewImg && entry.displayUrl) {
        UIr.dither.previewImg.attribute('src', entry.displayUrl);
      }
    }

    if (entry.thumbUrl) {
      thumb.style('background-image', `url(${entry.thumbUrl})`);
    } else {
      thumb.html(entry.name);
      if (!entry.originalImg && !entry.loading) {
        entry.loading = true;
        ensureSourceImageLoaded(entry, () => {
          reprocessSourceEntry(entry, () => {
            entry.loading = false;
            // simple refresh
            updateImageGrid();
          });
        });
      }
    }

    thumb.mousePressed(() => {
      ensureSourceImageLoaded(entry, () => {
        // UI 上の操作対象は processed を優先
        State.currentSourceImg = entry.processedImg || entry.originalImg;
        State.currentSourceName = entry.name;
        updateImageGrid(); // refresh highlight
        updatePolygonBrush();
        updateDitherPanelUI();
      });
    });
  });
}

// --- Download Panel ---
export function initDownloadPanel(container) {
  const section = window.createDiv('').parent(container).addClass('ui-section');

  // BG color/alpha
  const bgRow = window.createDiv('').parent(section);
  bgRow.style('display', 'grid');
  bgRow.style('grid-template-columns', '1fr 1fr');
  bgRow.style('gap', '8px');

  const bgPicker = window.createColorPicker(State.canvasBgColor).parent(bgRow);
  bgPicker.input(() => {
    State.canvasBgColor = bgPicker.value();
    State.needsCompositeUpdate = true;
  });

  const alphaSlider = createLabeledSlider(section, 'BG Alpha', 0, 255, State.canvasBgAlpha, 1, (v) => {
    State.canvasBgAlpha = v;
    State.needsCompositeUpdate = true;
  });
  UIr.download = UIr.download || {};
  UIr.download.bgAlpha = alphaSlider;

  const bgBtnRow = window.createDiv('').parent(section);
  bgBtnRow.style('display', 'grid');
  bgBtnRow.style('grid-template-columns', '1fr 1fr');
  bgBtnRow.style('gap', '6px');

  const setBgBtn = window.createButton('SET CURRENT SOURCE AS BG').parent(bgBtnRow);
  styleSmallButton(setBgBtn);
  setBgBtn.mousePressed(() => {
    const entry = getCurrentEntry();
    if (!entry) return;
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        State.canvasBgImg = entry.processedImg || entry.originalImg;
        State.canvasBgImgName = entry.name;
        State.needsCompositeUpdate = true;
      });
    });
  });

  const clearBgBtn = window.createButton('CLEAR BG IMAGE').parent(bgBtnRow);
  styleSmallButton(clearBgBtn);
  clearBgBtn.mousePressed(() => {
    State.canvasBgImg = null;
    State.canvasBgImgName = '';
    State.needsCompositeUpdate = true;
  });

  const downloadBtn = window.createButton('DOWNLOAD PNG').parent(section);
  styleButton(downloadBtn);
  downloadBtn.style('margin-top', '10px');
  downloadBtn.mousePressed(() => {
    const doDownload = () => {
      const pg = State.layers.composite;
      if (!pg || !pg.canvas) return;
      const stamp = new Date();
      const yyyy = stamp.getFullYear();
      const mm = String(stamp.getMonth() + 1).padStart(2, '0');
      const dd = String(stamp.getDate()).padStart(2, '0');
      const hh = String(stamp.getHours()).padStart(2, '0');
      const mi = String(stamp.getMinutes()).padStart(2, '0');
      const ss = String(stamp.getSeconds()).padStart(2, '0');
      const filename = `collagelab_${yyyy}${mm}${dd}_${hh}${mi}${ss}.png`;

      const a = document.createElement('a');
      a.href = pg.canvas.toDataURL('image/png');
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    State.needsCompositeUpdate = true;
    window.setTimeout(() => {
      // draw() 側が renderComposite を呼ぶ想定だが、確実性のためもう一拍待つ
      window.setTimeout(doDownload, 20);
    }, 20);
  });
}

// --- GLOBAL UI UPDATE ---
export function updatePanelUI() {
  updateBrushPanelUI();
  updateDitherPanelUI();
  updateImageGrid();
  updateDownloadPanelUI();
  // others...
}

export function updateDownloadPanelUI() {
  if (UIr.download && UIr.download.bgPicker) {
    // p5 DOM の colorPicker は value() setter
    UIr.download.bgPicker.value(State.canvasBgColor || '#ffffff');
  }
  if (UIr.download && UIr.download.bgAlpha) {
    UIr.download.bgAlpha.value(State.canvasBgAlpha);
  }
}

export function updateBrushPanelUI() {
  if (UIr.brush.size) UIr.brush.size.value(State.brushSize);
  if (UIr.brush.opacity) UIr.brush.opacity.value(State.brushOpacity);
  if (UIr.brush.scatter) UIr.brush.scatter.value(State.brushScatter);
  if (UIr.brush.amount) UIr.brush.amount.value(State.brushAmount);

  if (UIr.brush.singleStampToggle) UIr.brush.singleStampToggle.checked(!!State.brushSingleStamp);
  if (UIr.brush.rotateToggle) UIr.brush.rotateToggle.checked(State.brushRandomRotate !== false);

  renderBrushUI();
  updatePolygonBrush();
}

export function updateDitherPanelUI() {
  const entry = getCurrentEntry();
  if (!entry) return;
  ensureEntryDither(entry);

  if (UIr.dither.typeSelect) UIr.dither.typeSelect.selected(entry.dither.params.type);
  if (UIr.dither.threshold && UIr.dither.threshold.setValueSilently) UIr.dither.threshold.setValueSilently(entry.dither.params.threshold);
  if (UIr.dither.pixelSize && UIr.dither.pixelSize.setValueSilently) UIr.dither.pixelSize.setValueSilently(entry.dither.params.pixelSize);
  if (UIr.dither.brightness && UIr.dither.brightness.setValueSilently) UIr.dither.brightness.setValueSilently(entry.dither.params.brightness);
  if (UIr.dither.contrast && UIr.dither.contrast.setValueSilently) UIr.dither.contrast.setValueSilently(entry.dither.params.contrast);
  if (UIr.dither.saturation && UIr.dither.saturation.setValueSilently) UIr.dither.saturation.setValueSilently(entry.dither.params.saturation);
  if (UIr.dither.hue && UIr.dither.hue.setValueSilently) UIr.dither.hue.setValueSilently(entry.dither.params.hue);

  if (UIr.dither.useColorToggle) UIr.dither.useColorToggle.checked(!!entry.dither.params.useColor);
  if (UIr.dither.invertToggle) UIr.dither.invertToggle.checked(!!entry.dither.params.invert);
  if (UIr.dither.fgPicker) UIr.dither.fgPicker.value(entry.dither.params.fgColor || '#000000');

  if (UIr.dither.toggleBtn) UIr.dither.toggleBtn.html(entry.dither.enabled ? 'DITHER: ON' : 'DITHER: OFF');
}
