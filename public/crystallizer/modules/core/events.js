import { State } from '../state.js';
import { handleFrameDrag, handleFramePress, finalizeActiveFace, handleTransformDrag, handleTransformPress, handleTransformRelease } from '../tools/FrameTool.js';
import { handlePointDrag, handlePointPress } from '../tools/PointTool.js';
import { sortPointsClockwise } from './math.js';

function isEventFromUi(e) {
  const ui = document.getElementById('ui-panel');
  const t = e && e.target;
  // Right panel
  if (ui && t && ui.contains(t)) return true;
  // Canvas overlay UI (e.g. size label)
  if (t && typeof t.closest === 'function' && t.closest('.canvas-ui')) return true;
  return false;
}

function isPointerOutsideCanvas(e) {
  const canvasEl = (State.ui && State.ui.canvas && State.ui.canvas.elt)
    ? State.ui.canvas.elt
    : document.querySelector('#canvas-container canvas');
  if (!canvasEl || !e) return false;
  const r = canvasEl.getBoundingClientRect();
  return (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
}

function cancelTransformMode() {
  State.frameFreeTransform = false;
  State.frameTransformAll = false;
  State.frameTransform = null;
  State.needsCompositeUpdate = true;
  if (typeof window.syncTransformButton === 'function') window.syncTransformButton();
}

function cancelImagePlacingMode() {
  if (!State.isImagePlacing) return;
  State.isImagePlacing = false;
  State.placingImg = null;
  State.placingImgName = '';
  State.pendingImagePlaceFace = null;
  State.needsCompositeUpdate = true;
  // UI 側のサムネ枠を即更新
  if (typeof window.updatePanelUI === 'function') window.updatePanelUI();
}

function isTypingInField() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (el.isContentEditable) return true;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return false;
}

function runDownloadNow() {
  const pg = State.layers?.composite;
  if (!pg || !pg.canvas) return;
  const filename = `crystallizer_${Date.now()}.png`;
  const a = document.createElement('a');
  a.href = pg.canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  State.needsCompositeUpdate = true;
}

export function setupEvents() {
  // p5.js のグローバルコールバックは window オブジェクトに期待されます
  window.mousePressed = (e) => {
    // UI上のクリックはキャンバス操作に流さない
    if (isEventFromUi(e)) return;

    // active face placing: canvas外クリックで確定（legacy寄せ）
    if (State.toolTab === 'FRAME' && State.isPlacing && State.activeFace) {
      if (isPointerOutsideCanvas(e) || window.mouseX < 0 || window.mouseX > window.width || window.mouseY < 0 || window.mouseY > window.height) {
        finalizeActiveFace();
        State.isPlacing = false;
        State.needsCompositeUpdate = true;
        if (window.updateModeButtonStyles) window.updateModeButtonStyles();
        return;
      }
    }

    // Transform中: キャンバス外クリックは必ず解除（mouseX/mouseY が更新されないケース対策）
    if (State.toolTab === 'FRAME' && State.frameFreeTransform && isPointerOutsideCanvas(e)) {
      cancelTransformMode();
      return;
    }

    // 画像配置中: キャンバス外クリックで解除
    if (State.isImagePlacing && isPointerOutsideCanvas(e)) {
      cancelImagePlacingMode();
      return;
    }

    // Free Transform（FRAMEタブ時のみ）
    if (State.toolTab === 'FRAME') {
      if (handleTransformPress()) return;
    }

    // 画像配置モード中は、ポイント編集より先にフレーム挿入を優先
    // placingImg がロード待ち (null) でも handleFramePress 側で予約して後から適用する
    if (State.isImagePlacing) {
      if (handleFramePress()) return;
    }

    // ポイント編集（フレームモード）のチェック
    if (handlePointPress()) return;

    // フレーム操作（移動、または画像の配置）のチェック
    if (handleFramePress()) return;
  };

  window.mouseDragged = (e) => {
    if (isEventFromUi(e)) return;

    if (State.toolTab === 'FRAME') {
      if (handleTransformDrag()) return;
    }

    if (handlePointDrag()) return;
    if (handleFrameDrag()) return;
  };

  window.mouseReleased = (e) => {
    // UI上の mouseup は無視
    if (isEventFromUi(e)) return;
    if (State.toolTab === 'FRAME') {
      handleTransformRelease();
    }

    State.draggingPoint = null;
    State.draggingMoved = false;
    State.connectedPoints = [];
    State.draggingFace = null;

  };

  window.keyPressed = (e) => {
    // 入力中（Tweakpane等）にショートカットが暴発しないようにする
    if (isTypingInField()) return;

    // Frames toggle (legacy: F)
    if (window.key === 'f' || window.key === 'F') {
      if (State.toolTab !== 'FRAME') return;
      State.showFrames = !State.showFrames;
      State.hoverPoint = null;
      State.draggingPoint = null;
      State.draggingMoved = false;
      State.connectedPoints = [];
      State.draggingFace = null;
      State.needsCompositeUpdate = true;

      if (window.syncFramesToggleButton) window.syncFramesToggleButton();
      return;
    }

    // Crystalize (Space)
    if (window.keyCode === 32) {
      cancelImagePlacingMode();
      if (typeof window.randomizeCrystalize === 'function') window.randomizeCrystalize();
      return false;
    }

    // Distort (D)
    if (window.key === 'd' || window.key === 'D') {
      cancelImagePlacingMode();
      if (typeof window.runDistort === 'function') window.runDistort();
      return false;
    }

    // Download (Enter)
    if (window.keyCode === 13) {
      cancelImagePlacingMode();
      runDownloadNow();
      return false;
    }

    // Alpha toggle (A)
    if (window.key === 'a' || window.key === 'A') {
      cancelImagePlacingMode();
      State.transparentBg = !State.transparentBg;
      State.needsCompositeUpdate = true;
      if (typeof window.syncAlphaButton === 'function') window.syncAlphaButton();
      return false;
    }

    // Delete hovered point (Backspace/Delete)
    if (window.keyCode === 8 || window.keyCode === 46) {
      if (State.hoverPoint && State.hoverPoint.face && typeof State.hoverPoint.index === 'number') {
        const face = State.hoverPoint.face;
        const idx = State.hoverPoint.index;
        if (face.points && face.points.length > idx) {
          face.points.splice(idx, 1);
          if (face.points.length >= 3) {
            face.points = sortPointsClockwise(face.points);
          }
          State.needsCompositeUpdate = true;
        }
      }
    }
  };
}
