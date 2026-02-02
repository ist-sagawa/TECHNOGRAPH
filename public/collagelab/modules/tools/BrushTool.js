import { State } from '../state.js';

export function handleBrushStart() {
  // legacy: mousePressed で isDrawingPermitted を立て、draw ループで描画
  if (State.overUI) return;

  // 単発スタンプモード: クリックで1回だけ
  if (State.brushSingleStamp) {
    if (!State.brushStamp) return;
    if (window.mouseX < 0 || window.mouseX > window.width || window.mouseY < 0 || window.mouseY > window.height) return;
    stampBrushBurstAt(window.mouseX, window.mouseY);
    return;
  }

  State.isDrawingPermitted = true;
}

export function handleBrushEnd() {
  State.isDrawingPermitted = false;
}

function ensureBrushLayer() {
  const last = State.allLayers.length ? State.allLayers[State.allLayers.length - 1] : null;
  if (State.layers.brush && last && last.type === 'brush' && last.data === State.layers.brush) {
    return State.layers.brush;
  }

  const brushLayer = window.createGraphics(window.width, window.height);
  brushLayer.pixelDensity(1);
  brushLayer.noSmooth();
  if (brushLayer.drawingContext) brushLayer.drawingContext.imageSmoothingEnabled = false;
  brushLayer.clear();

  State.layers.brush = brushLayer;
  State.allLayers.push({ type: 'brush', data: brushLayer });
  return brushLayer;
}

export function stampBrushAt(x, y) {
  if (!State.brushStamp) return;
  const brushLayer = ensureBrushLayer();

  const scatter = Number(State.brushScatter || 0);
  const baseSize = Math.max(1, Number(State.brushSize || 1));
  const opacity255 = window.map(Number(State.brushOpacity || 0), 0, 100, 0, 255);

  const dx = x + window.random(-scatter, scatter);
  const dy = y + window.random(-scatter, scatter);

  brushLayer.push();
  brushLayer.translate(dx, dy);

  // 向き固定: 回転を入れない
  const rot = State.brushRandomRotate ? window.random(window.TWO_PI) : 0;
  brushLayer.rotate(rot);
  brushLayer.imageMode(window.CENTER);
  brushLayer.tint(255, opacity255);

  const dynamicScale = window.random(0.8, 1.2);
  const w = baseSize * dynamicScale;
  const ratio = State.brushStamp.height / State.brushStamp.width;

  if (brushLayer.drawingContext) brushLayer.drawingContext.imageSmoothingEnabled = false;
  brushLayer.image(State.brushStamp, 0, 0, w, w * ratio);
  brushLayer.pop();

  State.needsCompositeUpdate = true;
}

export function stampBrushBurstAt(x, y) {
  const amt = Number(State.brushAmount || 1);
  if (amt < 1) {
    if (window.random() < amt) stampBrushAt(x, y);
    return;
  }

  const n = Math.floor(amt);
  for (let i = 0; i < n; i++) stampBrushAt(x, y);
  if (window.random() < (amt - n)) stampBrushAt(x, y);
}
