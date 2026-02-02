import { State } from '../state.js';
import { random } from './math.js';

export function randomizeBackground() {
  const r = Math.floor(random(0, 255));
  const g = Math.floor(random(0, 255));
  const b = Math.floor(random(0, 255));
  State.canvasBgColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  State.canvasBgImg = null; // 画像はクリア
  State.needsCompositeUpdate = true;
}

export function clearCanvas() {
  State.isCrystalized = false;
  // layers
  if (State.layers && State.layers.brush) State.layers.brush.clear();
  if (State.layers && State.layers.effect) State.layers.effect.clear();

  // frames
  State.faces = [];
  State.activeFace = null;
  State.selectedFace = null;
  State.hoverFace = null;

  // placing / dragging
  State.isPlacing = false;
  State.isImagePlacing = false;
  State.placingImg = null;
  State.placingImgName = '';
  State.draggingPoint = null;
  State.draggingMoved = false;
  State.draggingFace = null;
  State.connectedPoints = [];
  State.hoverPoint = null;

  // transform session
  State.frameTransform = null;

  // layers list
  State.allLayers = [];

  // bg
  State.canvasBgImg = null;
  State.canvasBgImgName = '';
  State.canvasBgColor = '#ffffff';
  State.canvasBgAlpha = 255;

  State.needsCompositeUpdate = true;
}
