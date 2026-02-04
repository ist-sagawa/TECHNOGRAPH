import { State } from '../state.js';


export function clearCanvas() {
  State.isCrystalized = false;
  // layers
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

  State.needsCompositeUpdate = true;
}
