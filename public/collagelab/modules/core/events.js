import { State } from '../state.js';
import { handleBrushStart, handleBrushEnd } from '../tools/BrushTool.js';
import { handleFrameDrag, handleFramePress, finalizeActiveFace, handleTransformDrag, handleTransformPress, handleTransformRelease } from '../tools/FrameTool.js';
import { handleTextDrag, handleTextPress } from '../tools/TextTool.js';
import { handlePointDrag, handlePointPress } from '../tools/PointTool.js';
import { sortPointsClockwise } from './math.js';

export function setupEvents() {
  // p5.js のグローバルコールバックは window オブジェクトに期待されます
  window.mousePressed = () => {
    if (State.overUI) return;

    // active face placing: canvas外クリックで確定（legacy寄せ）
    if (State.toolTab === 'FRAME' && State.isPlacing && State.activeFace) {
      if (window.mouseX < 0 || window.mouseX > window.width || window.mouseY < 0 || window.mouseY > window.height) {
        finalizeActiveFace();
        State.isPlacing = false;
        State.needsCompositeUpdate = true;
        if (window.updateModeButtonStyles) window.updateModeButtonStyles();
        return;
      }
    }

    // ブラシタブがアクティブでUI上にない場合、ブラシ操作を優先
    if (State.toolTab === 'BRUSH') {
      handleBrushStart();
      return;
    }

    // Free Transform（FRAMEタブ時のみ）
    if (State.toolTab === 'FRAME') {
      if (handleTransformPress()) return;
    }

    // ポイント編集（フレームモード）のチェック
    if (handlePointPress()) return;

    // テキスト操作のチェック
    if (handleTextPress()) return;

    // フレーム操作（移動、または画像の配置）のチェック
    if (handleFramePress()) return;
  };

  window.mouseDragged = () => {
    if (State.overUI) return;

    // BRUSH は draw ループで stamp する（legacy寄せ）
    if (State.toolTab === 'BRUSH') return;

    if (State.toolTab === 'FRAME') {
      if (handleTransformDrag()) return;
    }

    if (handlePointDrag()) return;
    if (handleTextDrag()) return;
    if (handleFrameDrag()) return;
  };

  window.mouseReleased = () => {
    if (State.toolTab === 'FRAME') {
      handleTransformRelease();
    }

    // legacy寄せ: 点ドラッグが「移動なし」で終わった場合は点を削除
    if (State.draggingPoint && !State.draggingMoved) {
      const face = State.draggingPoint.face;
      const idx = State.draggingPoint.index;

      if (face && face.points && idx >= 0 && idx < face.points.length) {
        face.points.splice(idx, 1);

        if (face.points.length < 3) {
          face.image = null;
          face.imageName = '';
          State.faces = (State.faces || []).filter(f => f !== face);
          State.allLayers = (State.allLayers || []).filter(l => l.data !== face);
        } else {
          face.points = sortPointsClockwise(face.points);
        }
        State.needsCompositeUpdate = true;
      }
    }

    State.draggingPoint = null;
    State.draggingMoved = false;
    State.connectedPoints = [];
    State.draggingFace = null;
    State.draggingTextLayer = null;

    if (State.toolTab === 'BRUSH') {
      handleBrushEnd();
    }

    // ブラシ終了時の処理（必要であれば）
    // handleBrushEnd() などを呼び出すか、ここで単にフラグをリセット
  };

  window.keyPressed = () => {
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
