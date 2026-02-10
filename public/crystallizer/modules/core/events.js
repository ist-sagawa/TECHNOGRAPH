import { State } from '../state.js';
import { handleFrameDrag, handleFramePress, finalizeActiveFace, handleTransformPress, handleTransformDrag, handleTransformRelease } from '../tools/FrameTool.js';
import { handlePointDrag, handlePointPress } from '../tools/PointTool.js';
import { sortPointsClockwise } from './math.js';

function getCanvasEl() {
  return (State.ui && State.ui.canvas && State.ui.canvas.elt)
    ? State.ui.canvas.elt
    : document.querySelector('#canvas-container canvas');
}

function getEventClientXY(e) {
  if (!e) return null;
  if (typeof e.clientX === 'number' && typeof e.clientY === 'number') return { x: e.clientX, y: e.clientY };
  const t0 = e.touches && e.touches[0];
  if (t0 && typeof t0.clientX === 'number' && typeof t0.clientY === 'number') return { x: t0.clientX, y: t0.clientY };
  const c0 = e.changedTouches && e.changedTouches[0];
  if (c0 && typeof c0.clientX === 'number' && typeof c0.clientY === 'number') return { x: c0.clientX, y: c0.clientY };
  return null;
}

function syncP5MouseFromEvent(e) {
  // モバイルでは touch イベントが発火しても p5 の mouseX/mouseY が更新されないことがある。
  // FrameTool などは window.mouseX/mouseY を参照して当たり判定しているため、ここで座標を同期する。
  const canvasEl = getCanvasEl();
  if (!canvasEl) return false;

  // 1) まずはネイティブイベント座標（clientX/Y）を使う
  const p = getEventClientXY(e);
  if (p) {
    const r = canvasEl.getBoundingClientRect();
    const rw = Math.max(1, r.width || 1);
    const rh = Math.max(1, r.height || 1);

    // p5 の width/height（スケッチ座標）を優先してスケールを合わせる
    const cw = Number(window.width || 0) || Number(canvasEl.width || 0) || 1;
    const ch = Number(window.height || 0) || Number(canvasEl.height || 0) || 1;

    const x = (p.x - r.left) * (cw / rw);
    const y = (p.y - r.top) * (ch / rh);

    if (Number.isFinite(x) && Number.isFinite(y)) {
      window.pmouseX = Number.isFinite(window.mouseX) ? window.mouseX : x;
      window.pmouseY = Number.isFinite(window.mouseY) ? window.mouseY : y;
      window.mouseX = x;
      window.mouseY = y;
      return true;
    }
  }

  // 2) フォールバック: p5 が用意する touches[]（スケッチ座標）
  // iOS Safari などで event が取れない/中身が空のケース対策
  const t = Array.isArray(window.touches) ? window.touches[0] : null;
  if (t && typeof t.x === 'number' && typeof t.y === 'number') {
    window.pmouseX = Number.isFinite(window.mouseX) ? window.mouseX : t.x;
    window.pmouseY = Number.isFinite(window.mouseY) ? window.mouseY : t.y;
    window.mouseX = t.x;
    window.mouseY = t.y;
    return true;
  }

  return false;
}

function isEventFromUi(e) {
  const ui = document.getElementById('ui-panel');
  const t = e && e.target;
  // Right panel
  if (ui && t && ui.contains(t)) return true;
  // Canvas overlay UI (e.g. size label)
  if (t && typeof t.closest === 'function' && t.closest('.canvas-ui')) return true;
  return false;
}

function isEventFromCanvasArea(e) {
  const t = e && e.target;
  const canvasEl = getCanvasEl();
  if (!canvasEl) return false;
  if (t) {
    if (t === canvasEl) return true;
    // Some browsers may report a child/overlay element; treat anything inside the canvas container as canvas-area.
    if (typeof t.closest === 'function' && t.closest('#canvas-container')) return true;
  }

  // Fallback: p5/touch events sometimes have an unexpected target; use coordinates.
  const p = getEventClientXY(e);
  if (!p) return false;
  const r = canvasEl.getBoundingClientRect();
  return (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
}

function isPointerOutsideCanvas(e) {
  const canvasEl = getCanvasEl();
  if (!canvasEl || !e) return false;
  const r = canvasEl.getBoundingClientRect();

  const p = getEventClientXY(e);
  if (!p) return false;
  return (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom);
}

function cancelTransformMode() {
  State.frameFreeTransform = false;
  State.frameTransformAll = false;
  State.frameTransform = null;
  State.needsCompositeUpdate = true;
  if (typeof window.syncTransformButton === 'function') window.syncTransformButton();
}

function cancelImagePlacingMode() {
  // UI側にも同名の解除処理があるため、可能ならそちらを利用して重複を減らす。
  // （存在しない場合はここで従来通り状態を落とす）
  if (typeof window.cancelImagePlacing === 'function') {
    window.cancelImagePlacing();
    return;
  }

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
  const isActivelyDragging = () => {
    return (
      !!State.draggingPoint ||
      !!State.draggingFace ||
      !!(State.frameTransform && State.frameTransform.dragging)
    );
  };

  const onPress = (e) => {
    // UI上のクリックはキャンバス操作に流さない
    if (isEventFromUi(e)) return;

    // touch/pointer 系でも mouseX/mouseY が使えるように同期しておく
    syncP5MouseFromEvent(e);

    // Mobile: prevent page scroll/gesture only when interacting with the canvas area.
    if (isEventFromCanvasArea(e)) {
      try {
        e?.preventDefault?.();
      } catch { }
    }

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
    {
      if (handlePointPress()) return;
    }

    // フレーム操作（移動、または画像の配置）のチェック
    {
      if (handleFramePress()) return;
    }
  };

  const onDrag = (e) => {
    if (isEventFromUi(e)) return;

    syncP5MouseFromEvent(e);

    if (isEventFromCanvasArea(e)) {
      try {
        e?.preventDefault?.();
      } catch { }
    }

    if (State.toolTab === 'FRAME') {
      if (handleTransformDrag()) return;
    }

    {
      if (handlePointDrag()) return;
    }
    {
      if (handleFrameDrag()) return;
    }
  };

  const onRelease = (e) => {
    // UI上の mouseup は無視
    if (isEventFromUi(e)) return;

    syncP5MouseFromEvent(e);

    if (isEventFromCanvasArea(e)) {
      try {
        e?.preventDefault?.();
      } catch { }
    }
    if (State.toolTab === 'FRAME') {
      handleTransformRelease();
    }

    State.draggingPoint = null;
    State.draggingMoved = false;
    State.connectedPoints = [];
    State.draggingFace = null;
  };

  window.mousePressed = (e) => {
    onPress(e);
  };

  window.mouseDragged = (e) => {
    onDrag(e);
  };

  window.mouseReleased = (e) => {
    onRelease(e);
  };

  // Touch support: on some mobile browsers p5 does not reliably map touch -> mouse callbacks.
  window.touchStarted = (e) => {
    // スマホでは touch を mouse に変換してくれない環境があるため、touch を明示的に拾う。
    // ただしページ全体のスクロールを殺さないように「キャンバス上の操作だけ」奪う。
    // Only intercept touches that start on the canvas area.
    if (isEventFromCanvasArea(e)) {
      // p5 互換: 一部の処理が mouseIsPressed を見る場合がある
      window.mouseIsPressed = true;
      onPress(e);
      return false;
    }
    return true;
  };
  window.touchMoved = (e) => {
    // ドラッグ操作中、またはキャンバス上での移動のみ奪う（それ以外はスクロール許可）
    // Only intercept when dragging something, or when moving on the canvas area.
    if (isActivelyDragging() || isEventFromCanvasArea(e)) {
      onDrag(e);
      return false;
    }
    return true;
  };
  window.touchEnded = (e) => {
    // キャンバス操作をしていた場合のみ奪う（それ以外はスクロール/タップを阻害しない）
    if (isActivelyDragging() || isEventFromCanvasArea(e)) {
      window.mouseIsPressed = false;
      onRelease(e);
      return false;
    }
    return true;
  };
  window.touchCancelled = (e) => {
    // iOSなどで cancel が飛ぶことがあるので release と同様に扱う
    if (isActivelyDragging() || isEventFromCanvasArea(e)) {
      window.mouseIsPressed = false;
      onRelease(e);
      return false;
    }
    return true;
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
